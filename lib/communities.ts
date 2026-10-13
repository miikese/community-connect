import { LGAS, text } from "./domain";
import type { Context, Identity, DB } from "./service";
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export async function superAdmin(db: DB, user: Identity, ctx: Context) {
  if (!user) return false;
  const row = await db
    .prepare("SELECT role FROM users WHERE id=?")
    .bind(user.userId)
    .first();
  return (
    row?.role === "super-admin" ||
    ctx.adminIds.includes(user.userId) ||
    !!(
      !user.passwordAccount &&
      user.email &&
      ctx.adminEmails?.includes(user.email.toLowerCase())
    )
  );
}
export async function communityRoute(
  req: Request,
  ctx: Context,
  data: () => Promise<any>,
  json: (v: unknown, status?: number) => Response,
): Promise<Response | null> {
  const { db, user } = ctx,
    url = new URL(req.url),
    path = url.pathname.replace(/^\/api\/?/, ""),
    now = new Date().toISOString();
  if (
    !path.startsWith("communities") &&
    path !== "community-feed" &&
    path !== "platform/overview"
  )
    return null;
  const signed = () => {
    if (!user) fail("Sign in to continue.", 401);
    return user!;
  };
  const superUser = await superAdmin(db, user, ctx);
  const stmt = (sql: string, ...args: (string | number | null)[]) =>
    db.prepare(sql).bind(...args);
  const all = async (sql: string, ...args: (string | number | null)[]) =>
    (await stmt(sql, ...args).all()).results;
  if (path === "platform/overview" && req.method === "GET") {
    if (!superUser) fail("Super-admin access required.", 403);
    return json({
      counts: await stmt(
        "SELECT (SELECT count(*) FROM communities) AS communities,(SELECT count(*) FROM communities WHERE status='pending') AS pending,(SELECT count(*) FROM community_posts WHERE status='published') AS posts,(SELECT count(*) FROM users) AS members",
      ).first(),
    });
  }
  if (path === "community-feed" && req.method === "GET")
    return json({
      posts: await all(
        "SELECT p.id,p.community,p.title,p.content,p.category,p.created,c.name AS communityName,c.type FROM community_posts p JOIN communities c ON c.id=p.community WHERE p.status='published' AND c.status='approved' ORDER BY p.created DESC LIMIT 100",
      ),
    });
  if (path === "communities" && req.method === "GET") {
    const mine = url.searchParams.get("mine") === "1",
      review = url.searchParams.get("review") === "1";
    if (mine) signed();
    if (review && !superUser) fail("Super-admin access required.", 403);
    let rows = await all(
      "SELECT c.id,c.name,c.type,c.lga,c.area,c.description,c.status,c.created,c.updated,c.review_note AS reviewNote,(SELECT count(*) FROM community_admins a WHERE a.community=c.id) AS adminCount FROM communities c " +
        (review
          ? ""
          : "WHERE " +
            (mine
              ? "c.id IN (SELECT community FROM community_admins WHERE user=?)"
              : "c.status='approved'")) +
        " ORDER BY c.created DESC LIMIT 500",
      ...(mine && !review ? [user!.userId] : []),
    );
    if (!mine && !review)
      rows = rows.map(({ reviewNote: _reviewNote, ...row }: any) => row);
    return json({ communities: rows });
  }
  if (path === "communities" && req.method === "POST") {
    const u = signed(),
      d = await data(),
      name = text(d.name, "School or community name", 3, 120),
      description = text(d.description, "Description", 20, 2000),
      area = text(d.area, "General area", 2, 150),
      type = String(d.type),
      lga = String(d.lga);
    if (
      !["school", "street", "community"].includes(type) ||
      !LGAS.includes(lga)
    )
      fail("Choose a valid workspace type and LGA.");
    if (
      await stmt(
        "SELECT id FROM communities WHERE lower(name)=lower(?) AND lga=? AND status<>'rejected'",
        name,
        lga,
      ).first()
    )
      fail(
        "This name is already registered in this LGA. Find its existing workspace.",
        409,
      );
    const id = crypto.randomUUID();
    await db.batch([
      stmt(
        "INSERT INTO users(id,name,role) VALUES(?,?,'member') ON CONFLICT(id) DO NOTHING",
        u.userId,
        u.displayName,
      ),
      stmt(
        "INSERT INTO communities(id,name,type,lga,area,description,owner,status,created,updated) VALUES(?,?,?,?,?,?,?,'pending',?,?)",
        id,
        name,
        type,
        lga,
        area,
        description,
        u.userId,
        now,
        now,
      ),
      stmt(
        "INSERT INTO community_admins(id,community,user,created) VALUES(?,?,?,?)",
        crypto.randomUUID(),
        id,
        u.userId,
        now,
      ),
    ]);
    return json({ id, status: "pending" }, 201);
  }
  const parts = path.split("/"),
    id = parts[1];
  if (!id) fail("Endpoint not found.", 404);
  const group = await stmt("SELECT * FROM communities WHERE id=?", id).first();
  if (!group) fail("Workspace not found.", 404);
  const delegated = user
      ? await stmt(
          "SELECT id FROM community_admins WHERE community=? AND user=?",
          id,
          user.userId,
        ).first()
      : null,
    canPost = !!delegated || superUser,
    canManage = group.owner === user?.userId || superUser;
  if (group.status !== "approved" && !canPost)
    fail("Workspace not found.", 404);
  if (parts.length === 2 && req.method === "GET")
    return json({
      community: {
        id: group.id,
        name: group.name,
        type: group.type,
        lga: group.lga,
        area: group.area,
        description: group.description,
        status: group.status,
        ...(canPost ? { reviewNote: group.review_note } : {}),
      },
      canPost,
      canManage,
      isSuperAdmin: superUser,
      posts: await all(
        "SELECT p.id,p.title,p.content,p.category,p.status,p.created,p.updated,u.name AS authorName FROM community_posts p LEFT JOIN users u ON u.id=p.author WHERE p.community=?" +
          (canPost ? "" : " AND p.status='published'") +
          " ORDER BY p.created DESC LIMIT 100",
        id,
      ),
    });
  if (parts.length === 2 && req.method === "PATCH") {
    if (!superUser) fail("Super-admin access required.", 403);
    const d = await data(),
      status = String(d.status),
      note = text(d.note, "Review note", 10, 1200);
    if (
      !["approved", "rejected", "suspended"].includes(status) ||
      group.status === status
    )
      fail("Choose a different valid workspace status.", 409);
    await stmt(
      "UPDATE communities SET status=?,review_note=?,updated=? WHERE id=?",
      status,
      note,
      now,
      id,
    ).run();
    return json({ status });
  }
  if (parts.length === 2 && req.method === "DELETE") {
    if (!canManage) fail("Workspace owner access required.", 403);
    await db.batch([
      stmt("DELETE FROM community_posts WHERE community=?", id),
      stmt("DELETE FROM community_admins WHERE community=?", id),
      stmt("DELETE FROM communities WHERE id=?", id),
    ]);
    return json({ deleted: true });
  }
  if (parts[2] === "admins") {
    if (!canPost) fail("Workspace admin access required.", 403);
    if (req.method === "GET")
      return json({
        admins: await all(
          "SELECT a.user AS id,u.name,(a.user=?) AS owner FROM community_admins a JOIN users u ON u.id=a.user WHERE a.community=? ORDER BY a.created",
          group.owner,
          id,
        ),
        limit: 10,
      });
    if (!canManage)
      fail(
        "Only the workspace owner or super admin can manage delegated admins.",
        403,
      );
    if (req.method === "POST") {
      const d = await data(),
        email = text(d.email, "Registered account email", 3, 254).toLowerCase(),
        target = await stmt(
          "SELECT user_id FROM credentials WHERE email=?",
          email,
        ).first();
      if (!target) fail("This person needs to create an account first.", 404);
      if (
        await stmt(
          "SELECT id FROM community_admins WHERE community=? AND user=?",
          id,
          target.user_id,
        ).first()
      )
        return json({ added: false });
      try {
        await stmt(
          "INSERT INTO community_admins(id,community,user,created) VALUES(?,?,?,?)",
          crypto.randomUUID(),
          id,
          target.user_id,
          now,
        ).run();
      } catch (e) {
        if (/admin limit/i.test((e as Error).message))
          fail(
            "This workspace already has 10 admins, including its owner.",
            409,
          );
        throw e;
      }
      return json({ added: true }, 201);
    }
    if (req.method === "DELETE") {
      const target = parts[3];
      if (!target || target === group.owner)
        fail(
          "The workspace owner must remain an admin. Transfer ownership first.",
          409,
        );
      await stmt(
        "DELETE FROM community_admins WHERE community=? AND user=?",
        id,
        target,
      ).run();
      return json({ removed: true });
    }
  }
  if (parts[2] === "transfer" && req.method === "POST") {
    if (!canManage) fail("Workspace owner access required.", 403);
    const d = await data(),
      target = String(d.userId);
    if (
      !(await stmt(
        "SELECT id FROM community_admins WHERE community=? AND user=?",
        id,
        target,
      ).first())
    )
      fail("Choose one of this workspace's existing admins.");
    await stmt(
      "UPDATE communities SET owner=?,updated=? WHERE id=?",
      target,
      now,
      id,
    ).run();
    return json({ transferred: true });
  }
  if (parts[2] === "posts") {
    if (!canPost)
      fail(
        "Only this workspace's admins can publish or manage its posts.",
        403,
      );
    if (group.status !== "approved")
      fail(
        "Your workspace must be approved and active before publishing.",
        409,
      );
    if (req.method === "POST" || req.method === "PUT") {
      const d = await data(),
        title = text(d.title, "Post title", 5, 140),
        content = text(d.content, "Post content", 20, 5000),
        category = String(d.category);
      if (!["Notice", "Event", "Opportunity", "Update"].includes(category))
        fail("Choose a valid post category.");
      if (req.method === "PUT") {
        const post = await stmt(
          "UPDATE community_posts SET title=?,content=?,category=?,updated=? WHERE id=? AND community=? RETURNING id",
          title,
          content,
          category,
          now,
          parts[3] || "",
          id,
        ).first();
        if (!post) fail("Post not found.", 404);
        return json({ id: post.id });
      }
      const post = crypto.randomUUID();
      await stmt(
        "INSERT INTO community_posts(id,community,author,title,content,category,created,updated) VALUES(?,?,?,?,?,?,?,?)",
        post,
        id,
        signed().userId,
        title,
        content,
        category,
        now,
        now,
      ).run();
      return json({ id: post }, 201);
    }
    if (req.method === "DELETE") {
      await stmt(
        "DELETE FROM community_posts WHERE id=? AND community=?",
        parts[3] || "",
        id,
      ).run();
      return json({ deleted: true });
    }
  }
  fail("Endpoint not found.", 404);
}
