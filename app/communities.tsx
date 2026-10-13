"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  MapPin,
  Users,
  Plus,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { api } from "../lib/client";
import { LGAS } from "../lib/domain";
import { Notice, Empty } from "./components";
import { TranslationResult } from "./translation";
type Community = {
  id: string;
  name: string;
  type: string;
  lga: string;
  area: string;
  description: string;
  status: string;
  adminCount?: number;
  reviewNote?: string;
};
const workspaceLabel = (type: string) =>
  ({ school: "School", street: "Street", community: "Community" })[type] ||
  type;
function PostCard({
  post,
  onEdit,
  onDelete,
}: {
  post: any;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className="workspace-post">
      <div className="record-top">
        <span className="pill">{post.category}</span>
        <small>{new Date(post.created).toLocaleDateString()}</small>
      </div>
      {post.communityName && (
        <p className="workspace-post-origin">
          {workspaceLabel(post.type)} · {post.communityName}
        </p>
      )}
      <h3>{post.title}</h3>
      <p className="workspace-post-content">{post.content}</p>
      {post.authorName && <small>Posted by {post.authorName}</small>}
      {onEdit && (
        <div className="button-row">
          <button className="text-button" onClick={onEdit}>
            Edit post
          </button>
          <button className="text-button" onClick={onDelete}>
            Delete post
          </button>
        </div>
      )}
      <TranslationResult text={post.title + "\n\n" + post.content} />
    </article>
  );
}
export function CommunityHub() {
  const [groups, setGroups] = useState<Community[]>([]),
    [mine, setMine] = useState<Community[]>([]),
    [feed, setFeed] = useState<any[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [q, setQ] = useState(""),
    [type, setType] = useState(""),
    [message, setMessage] = useState(""),
    [form, setForm] = useState(false),
    [busy, setBusy] = useState(false),
    [user, setUser] = useState<any>(undefined);
  const load = useCallback(() => {
    api("communities")
      .then((d) => setGroups(d.communities))
      .catch((e) => setMessage(e.message));
    api("community-feed")
      .then((d) => setFeed(d.posts))
      .catch((e) => setMessage(e.message));
    api("me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
    api("communities?mine=1")
      .then((d) => setMine(d.communities))
      .catch(() => setMine([]));
  }, []);
  useEffect(() => {
    load();
    const id = new URLSearchParams(location.search).get("community");
    if (id) setSelected(id);
  }, [load]);
  const choose = (id: string) => {
    setSelected(id);
    history.replaceState(
      null,
      "",
      "/?section=communities&community=" + encodeURIComponent(id),
    );
  };
  if (selected)
    return (
      <Workspace
        id={selected}
        onBack={() => {
          setSelected(null);
          history.replaceState(null, "", "/?section=communities");
          load();
        }}
      />
    );
  const visible = groups.filter(
    (g) =>
      (!type || g.type === type) &&
      [g.name, g.area, g.lga].join(" ").toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <section className="section community-workspaces">
      <p className="eyebrow">Many places. One shared platform.</p>
      <div className="heading-row">
        <div>
          <h1>
            A place for your school.
            <br />
            <em>A voice for your street.</em>
          </h1>
          <p className="muted">
            Named workspaces for schools, streets and communities, connected
            through one public feed.
          </p>
        </div>
        <button
          className="button"
          disabled={user === undefined}
          onClick={() => {
            if (!user) {
              location.assign(
                new URL("/?section=account", location.origin).href,
              );
              return;
            }
            setForm(!form);
          }}
        >
          <Plus size={16} />
          Register a workspace
        </button>
      </div>
      {message && <Notice>{message}</Notice>}
      {form && (
        <form
          className="card workspace-registration"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const d = Object.fromEntries(new FormData(e.currentTarget)),
                result = await api("communities", "POST", d);
              setForm(false);
              choose(result.id);
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Give your place a name.</h2>
          <p className="muted">
            You become its first workspace admin. The platform reviews your
            registration before publishing. Use public, general details.
          </p>
          <label className="field">
            Workspace name
            <input
              name="name"
              required
              minLength={3}
              maxLength={120}
              placeholder="e.g. a school name or a street community"
            />
          </label>
          <div className="field-row">
            <label className="field">
              Workspace type
              <select name="type">
                <option value="school">School</option>
                <option value="street">Street</option>
                <option value="community">Community</option>
              </select>
            </label>
            <label className="field">
              LGA
              <select name="lga" defaultValue="Otukpo">
                {LGAS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            General area
            <input name="area" required minLength={2} maxLength={150} />
          </label>
          <label className="field">
            About your school or community
            <textarea
              name="description"
              required
              minLength={20}
              maxLength={2000}
            />
          </label>
          <button className="button" disabled={busy}>
            {busy ? "Registering…" : "Submit registration for review"}
            <ArrowRight size={15} />
          </button>
        </form>
      )}
      {mine.length > 0 && (
        <section>
          <h2 className="subheading">Your workspaces.</h2>
          <div className="workspace-grid">
            {mine.map((g) => (
              <WorkspaceCard key={g.id} group={g} onOpen={() => choose(g.id)} />
            ))}
          </div>
        </section>
      )}
      <div className="heading-row board-heading">
        <div>
          <h2>Schools & communities.</h2>
          <p className="muted">
            Find a familiar place, or discover a new connection.
          </p>
        </div>
        <div className="workspace-search">
          <input
            aria-label="Search schools and communities"
            placeholder="A school, a street, a place…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            aria-label="Filter workspace type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All workspaces</option>
            <option value="school">Schools</option>
            <option value="street">Streets</option>
            <option value="community">Communities</option>
          </select>
        </div>
      </div>
      <div className="workspace-grid">
        {visible.map((g) => (
          <WorkspaceCard key={g.id} group={g} onOpen={() => choose(g.id)} />
        ))}
      </div>
      {!visible.length && (
        <Empty
          title="Every place starts with a first connection"
          detail="Registered schools and communities appear here after platform review."
        />
      )}
      <h2 className="subheading">Across the whole community.</h2>
      <p className="muted">
        Updates from approved schools and streets, together in one public feed.
      </p>
      <div className="workspace-feed">
        {feed.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
      {!feed.length && (
        <Empty
          title="A shared feed, ready to grow"
          detail="Updates posted by approved workspace admins will appear here."
        />
      )}
    </section>
  );
}
function WorkspaceCard({
  group: g,
  onOpen,
}: {
  group: Community;
  onOpen: () => void;
}) {
  return (
    <button className="workspace-card" onClick={onOpen}>
      <span className="workspace-icon">
        {g.type === "school" ? <Building2 size={22} /> : <MapPin size={22} />}
      </span>
      <span className="pill">
        {workspaceLabel(g.type)} · {g.status}
      </span>
      <h3>{g.name}</h3>
      <p>{g.description}</p>
      <small>
        <MapPin size={12} />
        {g.area} · {g.lga}
      </small>
      <span className="workspace-card-footer">
        <Users size={14} />
        {g.adminCount || 1} / 10 admins <ArrowRight size={16} />
      </span>
    </button>
  );
}
function Workspace({ id, onBack }: { id: string; onBack: () => void }) {
  const [state, setState] = useState<any>(null),
    [admins, setAdmins] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<any>(null),
    [composer, setComposer] = useState(false);
  const load = useCallback(() => {
    api("communities/" + id)
      .then((d) => {
        setState(d);
        if (d.canPost)
          api("communities/" + id + "/admins")
            .then((a) => setAdmins(a.admins))
            .catch((e) => setMessage(e.message));
      })
      .catch((e) => setMessage(e.message));
  }, [id]);
  useEffect(load, [load]);
  if (!state)
    return (
      <section className="section">
        <button className="text-button" onClick={onBack}>
          ← All workspaces
        </button>
        <Notice>{message || "Loading workspace…"}</Notice>
      </section>
    );
  const g: Community = state.community;
  return (
    <section className="section named-workspace">
      <button className="text-button" onClick={onBack}>
        ← All schools & communities
      </button>
      <p className="eyebrow workspace-kicker">
        {workspaceLabel(g.type)} · {g.status}
      </p>
      <div className="heading-row">
        <div>
          <h1>{g.name}</h1>
          <p className="muted">
            {g.area} · {g.lga}
          </p>
        </div>
        {state.canPost && g.status === "approved" && (
          <button
            className="button"
            onClick={() => {
              setComposer(!composer);
              setEditing(null);
            }}
          >
            <Plus size={15} />
            Publish an update
          </button>
        )}
      </div>
      <p className="workspace-description">{g.description}</p>
      {g.status !== "approved" && (
        <Notice>
          {g.status === "pending"
            ? "Your registration is awaiting platform review. Posting opens after approval."
            : "This workspace is not currently active."}
          {g.reviewNote && " Review: " + g.reviewNote}
        </Notice>
      )}
      {message && <Notice>{message}</Notice>}
      {composer && (
        <form
          className="card workspace-composer"
          key={editing?.id || "new"}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              await api(
                "communities/" +
                  id +
                  "/posts" +
                  (editing ? "/" + editing.id : ""),
                editing ? "PUT" : "POST",
                Object.fromEntries(new FormData(e.currentTarget)),
              );
              setComposer(false);
              setEditing(null);
              setMessage(
                "Your update is published in this workspace and the shared platform feed.",
              );
              load();
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>
            {editing
              ? "Edit your workspace update."
              : "Keep your people in the loop."}
          </h2>
          <label className="field">
            Post title
            <input
              name="title"
              required
              minLength={5}
              maxLength={140}
              defaultValue={editing?.title}
            />
          </label>
          <label className="field">
            Category
            <select
              name="category"
              defaultValue={editing?.category || "Notice"}
            >
              {["Notice", "Event", "Opportunity", "Update"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Your update
            <textarea
              name="content"
              required
              minLength={20}
              maxLength={5000}
              defaultValue={editing?.content}
            />
          </label>
          <small>
            Public updates only. Avoid student details, private addresses and
            identifying information.
          </small>
          <button className="button" disabled={busy}>
            {busy
              ? "Publishing…"
              : editing
                ? "Save post changes"
                : "Publish post"}
          </button>
        </form>
      )}
      <div
        className={
          "workspace-layout " + (!state.canPost ? "workspace-public" : "")
        }
      >
        <div>
          <h2 className="subheading">From your workspace.</h2>
          <div className="workspace-feed">
            {state.posts.map((p: any) => (
              <PostCard
                key={p.id}
                post={p}
                onEdit={
                  state.canPost
                    ? () => {
                        setEditing(p);
                        setComposer(true);
                      }
                    : undefined
                }
                onDelete={() => {
                  if (
                    confirm(
                      "Delete this post from the workspace and shared feed?",
                    )
                  )
                    api("communities/" + id + "/posts/" + p.id, "DELETE")
                      .then(load)
                      .catch((e) => setMessage(e.message));
                }}
              />
            ))}
          </div>
          {!state.posts.length && (
            <Empty
              title="A little update can make a big difference"
              detail="Workspace admins can publish notices, events, opportunities and progress updates here."
            />
          )}
        </div>
        {state.canPost && (
          <aside className="workspace-admin-panel card">
            <ShieldCheck size={25} />
            <h2>Your workspace team.</h2>
            <p className="muted">
              {admins.length} / 10 delegated admins. These permissions apply
              only to this workspace.
            </p>
            {admins.map((a) => (
              <div className="workspace-admin-row" key={a.id}>
                <span>
                  <strong>{a.name}</strong>
                  <small>{a.owner ? "Workspace owner" : "Posting admin"}</small>
                </span>
                {state.canManage && !a.owner && (
                  <button
                    className="text-button"
                    onClick={() => {
                      if (confirm("Remove this person's posting access?"))
                        api("communities/" + id + "/admins/" + a.id, "DELETE")
                          .then(load)
                          .catch((e) => setMessage(e.message));
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {state.canManage && (
              <>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    const form = e.currentTarget;
                    try {
                      await api(
                        "communities/" + id + "/admins",
                        "POST",
                        Object.fromEntries(new FormData(form)),
                      );
                      form.reset();
                      setMessage(
                        "Workspace admin added. They can sign in with their own account.",
                      );
                      load();
                    } catch (e) {
                      setMessage((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="field">
                    Add an admin by registered email
                    <input type="email" name="email" required maxLength={254} />
                  </label>
                  <small>
                    Ask this person to create their own account first. This does
                    not send an email.
                  </small>
                  <button
                    className="button secondary"
                    disabled={busy || admins.length >= 10}
                  >
                    <Plus size={14} />
                    Add posting admin
                  </button>
                </form>
                {admins.length > 1 && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        !confirm(
                          "Transfer ownership and admin-management rights to this person?",
                        )
                      )
                        return;
                      try {
                        await api(
                          "communities/" + id + "/transfer",
                          "POST",
                          Object.fromEntries(new FormData(e.currentTarget)),
                        );
                        load();
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    <label className="field">
                      Transfer workspace ownership
                      <select name="userId">
                        {admins
                          .filter((a) => !a.owner)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button className="text-button">Transfer ownership</button>
                  </form>
                )}
                <button
                  className="text-button workspace-delete"
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this workspace, its admins and every post?",
                      )
                    )
                      api("communities/" + id, "DELETE")
                        .then(onBack)
                        .catch((e) => setMessage(e.message));
                  }}
                >
                  Delete workspace
                </button>
              </>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
export function PlatformAdmin() {
  const [groups, setGroups] = useState<Community[]>([]),
    [counts, setCounts] = useState<any>(null),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState("pending"),
    [note, setNote] = useState("");
  const load = useCallback(() => {
    api("communities?review=1")
      .then((d) => setGroups(d.communities))
      .catch((e) => setMessage(e.message));
    api("platform/overview")
      .then((d) => setCounts(d.counts))
      .catch((e) => setMessage(e.message));
  }, []);
  useEffect(load, [load]);
  return (
    <section className="section platform-admin">
      <p className="eyebrow">A shared platform. Carefully connected.</p>
      <h1>Your super-admin workspace.</h1>
      <p className="muted">
        Review school, street and community registrations. Local posting admins
        retain their own workspace permissions.
      </p>
      {message && <Notice>{message}</Notice>}
      {counts && (
        <div className="workspace-stats">
          {[
            ["communities", "Registered workspaces"],
            ["pending", "Awaiting review"],
            ["posts", "Published updates"],
            ["members", "Platform members"],
          ].map(([key, label]) => (
            <article key={key}>
              <small>{label}</small>
              <strong>{counts[key]}</strong>
            </article>
          ))}
        </div>
      )}
      <div className="heading-row board-heading">
        <h2>Workspace registrations.</h2>
        <select
          aria-label="Workspace review status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["pending", "approved", "rejected", "suspended"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <label className="field">
        Workspace review note
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          minLength={10}
          maxLength={1200}
          placeholder="Explain the review decision or changes needed."
        />
      </label>
      <div className="workspace-grid">
        {groups
          .filter((g) => g.status === status)
          .map((g) => (
            <article className="card" key={g.id}>
              <span className="pill">
                {workspaceLabel(g.type)} · {g.status}
              </span>
              <h3>{g.name}</h3>
              <p>{g.description}</p>
              <small>
                {g.area} · {g.lga} · {g.adminCount} admins
              </small>
              {g.reviewNote && <p>Review: {g.reviewNote}</p>}
              <div className="button-row">
                {["approved", "rejected", "suspended"]
                  .filter((s) => s !== g.status)
                  .map((s) => (
                    <button
                      className="button small secondary"
                      key={s}
                      onClick={() =>
                        api("communities/" + g.id, "PATCH", { status: s, note })
                          .then(() => {
                            setMessage("Workspace review saved.");
                            load();
                          })
                          .catch((e) => setMessage(e.message))
                      }
                    >
                      {s === "approved"
                        ? "Approve workspace"
                        : s === "suspended"
                          ? "Suspend workspace"
                          : "Request changes"}
                    </button>
                  ))}
                <a
                  className="text-button"
                  href={"/?section=communities&community=" + g.id}
                >
                  View workspace ↗
                </a>
              </div>
            </article>
          ))}
      </div>
      {!groups.some((g) => g.status === status) && (
        <Empty
          title="Nothing in this queue"
          detail="New school and community registrations will appear here."
        />
      )}
    </section>
  );
}
export function SharedFeedPreview({ onOpen }: { onOpen: () => void }) {
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => {
    api("community-feed")
      .then((d) => setPosts(d.posts.slice(0, 3)))
      .catch(() => {});
  }, []);
  return (
    <section className="board-content shared-feed-preview">
      <div className="heading-row">
        <div>
          <p className="eyebrow">Schools. Streets. A shared community.</p>
          <h2>Updates from your places.</h2>
        </div>
        <button className="text-button" onClick={onOpen}>
          All workspaces
          <ArrowRight size={14} />
        </button>
      </div>
      {posts.length ? (
        <div className="workspace-preview-grid">
          {posts.map((p) => (
            <article className="workspace-post" key={p.id}>
              <small>
                {p.communityName} · {p.category}
              </small>
              <h3>{p.title}</h3>
              <p>{p.content.slice(0, 180)}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          Register a named school or street workspace. Its approved admins can
          share updates here with the wider platform.
        </p>
      )}
    </section>
  );
}
