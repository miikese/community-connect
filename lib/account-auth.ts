import type { DB, Identity } from "./service";
export type OwnerSettings={email?:string;passwordHash?:string};
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const bytes = (value: string) =>
  new Uint8Array(value.match(/../g)!.map((h) => parseInt(h, 16)));
export async function passwordHash(
  password: string,
  salt = hex(crypto.getRandomValues(new Uint8Array(16))),
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: bytes(salt), iterations: 100000 },
    key,
    256,
  );
  return "pbkdf2-sha256:100000:" + salt + ":" + hex(new Uint8Array(hash));
}
async function verify(password: string, stored: string) {
  const parts = stored.split(":");
  if (
    parts.length !== 4 ||
    parts[0] !== "pbkdf2-sha256" ||
    parts[1] !== "100000"
  )
    return false;
  const actual = await passwordHash(password, parts[2]);
  let different = actual.length ^ stored.length;
  for (let i = 0; i < actual.length; i++)
    different |= actual.charCodeAt(i) ^ stored.charCodeAt(i);
  return different === 0;
}
export const sessionHash = async (value: string) =>
  hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
export async function accountSession(req: Request, db: DB, owner:OwnerSettings={}): Promise<Identity> {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("cc_session="))
    ?.slice(11);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await db
    .prepare(
      "SELECT u.id,u.name,c.email,c.password_hash FROM account_sessions s JOIN credentials c ON c.user_id=s.user_id JOIN users u ON u.id=c.user_id WHERE s.id=? AND s.expires>?",
    )
    .bind(await sessionHash(token), Date.now())
    .first();
  if(row&&owner.email?.trim().toLowerCase()===row.email&&owner.passwordHash!==row.password_hash)return null;
  return row
    ? {
        userId: row.id,
        displayName: row.name,
        email: row.email,
        passwordAccount: true,
      }
    : null;
}
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export async function accountAuth(
  req: Request,
  db: DB,
  path: string,
  data: Record<string, unknown>,
  owner:OwnerSettings={},
) {
  const now = Date.now(),
    secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  if (path === "auth/logout") {
    const token = req.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("cc_session="))
      ?.slice(11);
    if (token)
      await db
        .prepare("DELETE FROM account_sessions WHERE id=?")
        .bind(await sessionHash(token))
        .run();
    return new Response(JSON.stringify({ signedOut: true }), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "set-cookie":
          "cc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" + secure,
      },
    });
  }
  const email =
      typeof data.email === "string" ? data.email.trim().toLowerCase() : "",
    password = typeof data.password === "string" ? data.password : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    new TextEncoder().encode(password).length < 8 ||
    new TextEncoder().encode(password).length > 128
  )
    fail("Use a valid email and a password between 8 and 128 bytes.");
  const globalKey = "auth-total:" + Math.floor(now / 60000),
    globalLimit = await db
      .prepare(
        "INSERT INTO limits(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",
      )
      .bind(globalKey)
      .first();
  if (globalLimit.count > 60)
    fail("Sign-in is busy. Please try again in a minute.", 429);
  const rateKey = "auth:" + email + ":" + Math.floor(now / 60000),
    limit = await db
      .prepare(
        "INSERT INTO limits(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",
      )
      .bind(rateKey)
      .first();
  if (limit.count > 8) fail("Please wait a minute before trying again.", 429);
  let user: any;
  const configuredOwner=!!owner.email&&email===owner.email.trim().toLowerCase();
  if (path === "auth/register") {
    if(configuredOwner)fail("This email is reserved for the configured owner. Use Sign in.",403);
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (name.length < 2 || name.length > 80)
      fail("Enter a display name between 2 and 80 characters.");
    if (data.role || data.admin)
      fail("Administrative roles cannot be requested at signup.", 403);
    if (
      await db
        .prepare("SELECT user_id FROM credentials WHERE email=?")
        .bind(email)
        .first()
    )
      fail("Unable to register this email. Try signing in instead.", 409);
    const id = crypto.randomUUID(),
      hash = await passwordHash(password);
    await db.batch([
      db
        .prepare("INSERT INTO users(id,name,role) VALUES(?,?,'member')")
        .bind(id, name),
      db
        .prepare(
          "INSERT INTO credentials(user_id,email,password_hash) VALUES(?,?,?)",
        )
        .bind(id, email, hash),
    ]);
    user = { id, name, role: "member" };
  } else if (path === "auth/login"&&configuredOwner) {
    if(!owner.passwordHash||!/^pbkdf2-sha256:100000:[a-f0-9]{32}:[a-f0-9]{64}$/.test(owner.passwordHash))fail("Owner sign-in needs valid private runtime settings.",503);
    if(!await verify(password,owner.passwordHash))fail("Invalid email or password.",401);
    const prior=await db.prepare("SELECT user_id,password_hash FROM credentials WHERE email=?").bind(email).first(),id=prior?.user_id||crypto.randomUUID(),changed=prior?.password_hash!==owner.passwordHash;
    await db.batch([
      db.prepare("INSERT INTO users(id,name,role) VALUES(?,'Platform owner','super-admin') ON CONFLICT(id) DO UPDATE SET role='super-admin'").bind(id),
      db.prepare("INSERT INTO credentials(user_id,email,password_hash) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash").bind(id,email,owner.passwordHash),
      ...(changed?[db.prepare("DELETE FROM account_sessions WHERE user_id=?").bind(id)]:[])
    ]);
    const record=await db.prepare("SELECT name FROM users WHERE id=?").bind(id).first();
    user={id,name:record.name,role:"super-admin"};
  } else if (path === "auth/login") {
    const row = await db
      .prepare(
        "SELECT c.user_id AS id,c.password_hash,u.name,u.role FROM credentials c JOIN users u ON u.id=c.user_id WHERE email=?",
      )
      .bind(email)
      .first();
    const valid = await verify(
      password,
      row?.password_hash ||
        "pbkdf2-sha256:100000:00000000000000000000000000000000:" +
          "0".repeat(64),
    );
    if (!row || !valid) fail("Invalid email or password.", 401);
    user = { id: row.id, name: row.name, role: row.role };
  } else fail("Authentication endpoint not found.", 404);
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await db
    .prepare("INSERT INTO account_sessions(id,user_id,expires) VALUES(?,?,?)")
    .bind(await sessionHash(token), user.id, now + 7 * 86400000)
    .run();
  await db
    .prepare("DELETE FROM account_sessions WHERE expires<?")
    .bind(now)
    .run();
  return new Response(JSON.stringify({ user }), {
    status: path === "auth/register" ? 201 : 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "set-cookie":
        "cc_session=" +
        token +
        "; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800" +
        secure,
    },
  });
}
