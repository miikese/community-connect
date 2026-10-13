import { beforeEach, afterEach, it, expect } from "vitest";
import { database } from "./database";
import { handle, type Context } from "../lib/service";
let db: ReturnType<typeof database>, ctx: Context;
const owner = { userId: "owner", displayName: "School owner" },
  other = { userId: "other", displayName: "Another member" },
  superUser = { userId: "platform", displayName: "Platform owner" };
const school = {
  name: "QA community school",
  type: "school",
  lga: "Otukpo",
  area: "General test area",
  description: "A test-only school workspace for validation.",
};
async function call(
  path: string,
  method = "GET",
  data?: unknown,
  cookie?: string,
  origin?: string,
) {
  const response = await handle(
    new Request("http://test/api/" + path, {
      method,
      headers: {
        ...(data ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(origin ? { origin } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    }),
    ctx,
  );
  return {
    status: response.status,
    body: (await response.json()) as any,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function create() {
  return (await call("communities", "POST", school)).body.id;
}
beforeEach(() => {
  db = database();
  ctx = { db, user: owner, adminIds: ["platform"] };
});
afterEach(() => db.close());
it("keeps school registrations private until super-admin review", async () => {
  const id = await create();
  ctx.user = null;
  expect((await call("communities")).body.communities).toHaveLength(0);
  expect((await call("communities/" + id)).status).toBe(404);
  ctx.user = other;
  expect(
    (
      await call("communities/" + id, "PATCH", {
        status: "approved",
        note: "I cannot review another workspace.",
      })
    ).status,
  ).toBe(404);
  ctx.user = superUser;
  expect(
    (
      await call("communities/" + id, "PATCH", {
        status: "approved",
        note: "Reviewed automated school fixture.",
      })
    ).status,
  ).toBe(200);
  ctx.user = null;
  const result = await call("communities");
  expect(result.body.communities).toHaveLength(1);
  expect(result.body.communities[0]).not.toHaveProperty("reviewNote");
});
it("limits every workspace to 10 admins and blocks cross-workspace posting", async () => {
  const id = await create();
  ctx.user = superUser;
  await call("communities/" + id, "PATCH", {
    status: "approved",
    note: "Reviewed automated fixture school.",
  });
  ctx.user = owner;
  for (let i = 0; i < 10; i++) {
    await db
      .prepare("INSERT INTO users VALUES(?,?,'member')")
      .bind("delegate-" + i, "Delegate " + i)
      .run();
    await db
      .prepare("INSERT INTO credentials VALUES(?,?,?)")
      .bind(
        "delegate-" + i,
        "delegate" + i + "@example.test",
        "not-a-login-hash",
      )
      .run();
    const r = await call("communities/" + id + "/admins", "POST", {
      email: "delegate" + i + "@example.test",
    });
    expect(r.status).toBe(i < 9 ? 201 : 409);
  }
  expect(
    (await call("communities/" + id + "/admins")).body.admins,
  ).toHaveLength(10);
  ctx.user = { userId: "delegate-0", displayName: "Delegate 0" };
  const post = {
    title: "Useful school announcement",
    content: "An automated post for our shared community feed.",
    category: "Notice",
  };
  expect(
    (await call("communities/" + id + "/posts", "POST", post)).status,
  ).toBe(201);
  expect((await call("communities?review=1")).status).toBe(403);
  expect(
    (
      await call("communities/" + id + "/admins", "POST", {
        email: "delegate9@example.test",
      })
    ).status,
  ).toBe(403);
  ctx.user = other;
  expect(
    (await call("communities/" + id + "/posts", "POST", post)).status,
  ).toBe(403);
  ctx.user = null;
  expect((await call("community-feed")).body.posts).toHaveLength(1);
});
it("hides suspended workspace posts from all public feeds", async () => {
  const id = await create();
  ctx.user = superUser;
  await call("communities/" + id, "PATCH", {
    status: "approved",
    note: "Reviewed school registration test.",
  });
  ctx.user = owner;
  await call("communities/" + id + "/posts", "POST", {
    title: "Public test notice",
    content: "A useful test notice for the community feed.",
    category: "Notice",
  });
  ctx.user = superUser;
  await call("communities/" + id, "PATCH", {
    status: "suspended",
    note: "Suspended this test workspace for validation.",
  });
  ctx.user = null;
  expect((await call("community-feed")).body.posts).toHaveLength(0);
  expect((await call("communities/" + id)).status).toBe(404);
});
it("preserves the owner, supports transfer, and revokes removed delegates", async () => {
  const id = await create();
  await db
    .prepare("INSERT INTO users VALUES('delegate','Delegate','member')")
    .run();
  await db
    .prepare(
      "INSERT INTO credentials VALUES('delegate','delegate@example.test','not-a-login-hash')",
    )
    .run();
  await call("communities/" + id + "/admins", "POST", {
    email: "delegate@example.test",
  });
  expect(
    (await call("communities/" + id + "/admins/owner", "DELETE")).status,
  ).toBe(409);
  await call("communities/" + id + "/transfer", "POST", { userId: "delegate" });
  ctx.user = { userId: "delegate", displayName: "Delegate" };
  expect(
    (await call("communities/" + id + "/admins/owner", "DELETE")).status,
  ).toBe(200);
  ctx.user = owner;
  expect((await call("communities/" + id + "/admins")).status).toBe(404);
});
it("hashes credentials, uses HttpOnly sessions and revokes logout", async () => {
  ctx.user = null;
  const registration = await call("auth/register", "POST", {
    name: "Test resident",
    email: "resident@example.test",
    password: "test-account-password",
  });
  expect(registration.status).toBe(201);
  const stored = await db
    .prepare("SELECT password_hash FROM credentials")
    .first();
  expect(stored.password_hash).not.toContain("test-account-password");
  expect(
    (await call("me", "GET", undefined, registration.cookie)).body.user.role,
  ).toBe("member");
  expect(
    (
      await call("auth/login", "POST", {
        email: "resident@example.test",
        password: "incorrect-password",
      })
    ).status,
  ).toBe(401);
  await call("auth/logout", "POST", {}, registration.cookie);
  expect(
    (await call("me", "GET", undefined, registration.cookie)).body.user,
  ).toBe(null);
});
it("never grants platform admin to an unverified email signup", async () => {
  ctx.user = null;
  ctx.adminEmails = ["owner@example.test"];
  const r = await call("auth/register", "POST", {
    name: "Email claimant",
    email: "owner@example.test",
    password: "test-account-password",
  });
  expect((await call("me", "GET", undefined, r.cookie)).body.user.role).toBe(
    "member",
  );
  expect(
    (await call("platform/overview", "GET", undefined, r.cookie)).status,
  ).toBe(403);
  expect(
    (
      await call("auth/register", "POST", {
        name: "Another person",
        email: "admin@example.test",
        password: "test-account-password",
        role: "super-admin",
      })
    ).status,
  ).toBe(403);
});
it("rejects cross-origin authentication and invalid logins", async () => {
  ctx.user = null;
  expect(
    (
      await call(
        "auth/register",
        "POST",
        {
          name: "Person",
          email: "person@example.test",
          password: "test-account-password",
        },
        undefined,
        "http://evil",
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await call("auth/login", "POST", {
        email: "missing@example.test",
        password: "test-account-password",
      })
    ).status,
  ).toBe(401);
});
it("protects a founder's workspace when deleting account data", async () => {
  await create();
  expect((await call("account", "DELETE", {})).status).toBe(409);
});
