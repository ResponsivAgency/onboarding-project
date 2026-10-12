"use strict";
// Team Maria onboarding: web server, accounts, and training progress.
// Needs DATABASE_URL (Railway Postgres). Optional: ADMINS, PORT.
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const CONTENT = require("./content");

const PORT = process.env.PORT || 3000;
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add a Postgres database and reference its DATABASE_URL on this service.");
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 10,
});
const q = (text, params) => pool.query(text, params);

const SESSION_DAYS = 30;
const INVITE_DAYS = 14;
const TIERS = ["standard", "premium"];
const TRACKS = { onboarding: CONTENT.ONBOARDING, advanced: CONTENT.ADVANCED };

/* ---------- Database ---------- */
async function migrate() {
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('admin', 'leader', 'member')),
      tier TEXT CHECK (tier IN ('standard', 'premium')),
      leader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      sponsor_name TEXT NOT NULL DEFAULT '',
      sponsor_phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT,
      invite_hash TEXT UNIQUE,
      invite_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_active_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track TEXT NOT NULL CHECK (track IN ('onboarding', 'advanced')),
      lesson INTEGER NOT NULL,
      takeaway TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, track, lesson)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS users_leader_idx ON users(leader_id);
  `);
  await q("DELETE FROM sessions WHERE expires_at < now()");
}

/* ---------- Passwords and tokens ---------- */
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(pw) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(pw, salt, 64, SCRYPT, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${salt.toString("base64")}$${key.toString("base64")}`));
  });
}
function verifyPassword(pw, stored) {
  return new Promise((resolve) => {
    const [kind, saltB64, keyB64] = String(stored || "").split("$");
    if (kind !== "scrypt" || !saltB64 || !keyB64) return resolve(false);
    const expected = Buffer.from(keyB64, "base64");
    crypto.scrypt(pw, Buffer.from(saltB64, "base64"), expected.length, SCRYPT, (err, key) =>
      resolve(!err && crypto.timingSafeEqual(key, expected)));
  });
}
// Used when an email isn't found, so a wrong email takes as long as a wrong password
let DUMMY_HASH = "";
hashPassword(newToken()).then((h) => { DUMMY_HASH = h; });

/* ---------- Helpers ---------- */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const digits = (v) => String(v || "").replace(/\D/g, "");
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function videoEmbed(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1`;
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-f]+))?/);
  if (m) return `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}`;
  return "";
}
const lessonsFor = (list) => list.map(({ videoUrl, ...rest }) => ({ ...rest, embed: videoEmbed(videoUrl) }));

const origin = (req) => `${req.protocol}://${req.get("host")}`;
async function issueLink(req, userId) {
  const token = newToken();
  await q(`UPDATE users SET invite_hash = $1, invite_expires = now() + make_interval(days => $2) WHERE id = $3`,
    [sha256(token), INVITE_DAYS, userId]);
  return `${origin(req)}/#invite/${token}`;
}

/* ---------- Sessions ---------- */
const COOKIE = "tm_session";
function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
function setSessionCookie(req, res, token, maxAgeSec) {
  const secure = req.secure ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`);
}
async function startSession(req, res, userId) {
  const token = newToken();
  await q(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [sha256(token), userId, SESSION_DAYS]);
  await q("UPDATE users SET last_active_at = now() WHERE id = $1", [userId]);
  setSessionCookie(req, res, token, SESSION_DAYS * 86400);
}

/* ---------- App ---------- */
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000");
  next();
});

app.get("/healthz", (req, res) => res.type("text").send("ok"));

// API: JSON only, same-site only
app.use("/api", express.json({ limit: "20kb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return next();
  const o = req.get("origin");
  if (o) {
    try { if (new URL(o).host !== req.get("host")) return res.status(403).json({ error: "Request blocked." }); }
    catch (e) { return res.status(403).json({ error: "Request blocked." }); }
  }
  if (req.method !== "DELETE" && !req.is("application/json")) return res.status(415).json({ error: "Expected JSON." });
  next();
});

// Who is signed in
app.use("/api", wrap(async (req, res, next) => {
  const token = readCookie(req, COOKIE);
  if (!token) return next();
  const { rows } = await q(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha256(token)]);
  if (!rows[0]) return next();
  req.user = rows[0];
  req.sessionHash = sha256(token);
  const last = rows[0].last_active_at ? new Date(rows[0].last_active_at).getTime() : 0;
  if (Date.now() - last > 5 * 60 * 1000) q("UPDATE users SET last_active_at = now() WHERE id = $1", [rows[0].id]).catch(() => {});
  next();
}));
const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Please sign in." }));
const requireStaff = (req, res, next) =>
  !req.user ? res.status(401).json({ error: "Please sign in." })
  : ["admin", "leader"].includes(req.user.role) ? next() : res.status(403).json({ error: "Not allowed." });
const requireAdmin = (req, res, next) =>
  !req.user ? res.status(401).json({ error: "Please sign in." })
  : req.user.role === "admin" ? next() : res.status(403).json({ error: "Only Maria’s admin account can do that." });

// Simple sign-in throttle: 10 tries per 15 minutes per address + email
const attempts = new Map();
function throttled(key) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.reset < now) { attempts.set(key, { n: 1, reset: now + 15 * 60 * 1000 }); return false; }
  a.n++;
  return a.n > 10;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k); }, 10 * 60 * 1000).unref();

/* ---------- Auth ---------- */
app.post("/api/login", wrap(async (req, res) => {
  const email = clean(req.body.email, 254).toLowerCase();
  const password = String(req.body.password || "");
  if (throttled(`${req.ip}|${email}`)) throw new HttpError(429, "Too many tries. Wait 15 minutes and try again.");
  const { rows } = await q("SELECT id, password_hash FROM users WHERE email = $1", [email]);
  const ok = rows[0]?.password_hash
    ? await verifyPassword(password, rows[0].password_hash)
    : (await verifyPassword(password, DUMMY_HASH), false);
  if (!ok) throw new HttpError(401, "That email and password don’t match. Check them and try again.");
  await startSession(req, res, rows[0].id);
  res.json({ ok: true });
}));

app.post("/api/logout", wrap(async (req, res) => {
  if (req.sessionHash) await q("DELETE FROM sessions WHERE token_hash = $1", [req.sessionHash]);
  setSessionCookie(req, res, "", 0);
  res.json({ ok: true });
}));

async function inviteUser(token) {
  if (!token || token.length > 100) return null;
  const { rows } = await q(
    "SELECT id, name, email, password_hash FROM users WHERE invite_hash = $1 AND invite_expires > now()", [sha256(token)]);
  return rows[0] || null;
}
app.get("/api/invite/:token", wrap(async (req, res) => {
  const u = await inviteUser(req.params.token);
  if (!u) throw new HttpError(404, "This link has expired or was already used. Ask Maria for a new one.");
  res.json({ name: u.name, email: u.email, kind: u.password_hash ? "reset" : "invite" });
}));
app.post("/api/invite/:token", wrap(async (req, res) => {
  const u = await inviteUser(req.params.token);
  if (!u) throw new HttpError(404, "This link has expired or was already used. Ask Maria for a new one.");
  const password = String(req.body.password || "");
  if (password.length < 8) throw new HttpError(400, "Use at least 8 characters.");
  if (password.length > 200) throw new HttpError(400, "That password is too long.");
  await q("UPDATE users SET password_hash = $1, invite_hash = NULL, invite_expires = NULL WHERE id = $2",
    [await hashPassword(password), u.id]);
  await q("DELETE FROM sessions WHERE user_id = $1", [u.id]);
  await startSession(req, res, u.id);
  res.json({ ok: true });
}));

/* ---------- Distributor ---------- */
async function progressOf(userId) {
  const { rows } = await q("SELECT track, lesson, takeaway FROM progress WHERE user_id = $1 ORDER BY lesson", [userId]);
  const out = { onboarding: [], advanced: [] };
  rows.forEach((r) => { out[r.track][r.lesson] = r.takeaway; });
  return out;
}
app.get("/api/me", requireUser, wrap(async (req, res) => {
  const u = req.user;
  const me = { id: u.id, name: u.name, email: u.email, role: u.role };
  if (u.role !== "member") return res.json({ me });
  const premium = u.tier === "premium";
  res.json({
    me: { ...me, tier: u.tier, sponsor: { name: u.sponsor_name, phone: u.sponsor_phone } },
    content: {
      onboarding: lessonsFor(CONTENT.ONBOARDING),
      advanced: premium ? lessonsFor(CONTENT.ADVANCED) : [],
      advancedCount: CONTENT.ADVANCED.length,
      mindset: CONTENT.MINDSET,
    },
    progress: await progressOf(u.id),
  });
}));

app.post("/api/progress", requireUser, wrap(async (req, res) => {
  const u = req.user;
  if (u.role !== "member") throw new HttpError(403, "Training progress is only saved for team members.");
  const track = req.body.track;
  const lesson = Number(req.body.lesson);
  const takeaway = clean(req.body.takeaway, 2000);
  if (!TRACKS[track] || !Number.isInteger(lesson) || lesson < 0 || lesson >= TRACKS[track].length) throw new HttpError(400, "Unknown lesson.");
  if (!takeaway) throw new HttpError(400, "Write your takeaway first.");
  const p = await progressOf(u.id);
  if (track === "advanced") {
    if (u.tier !== "premium") throw new HttpError(403, "Advanced training is part of the Premium plan.");
    if (p.onboarding.filter(Boolean).length < CONTENT.ONBOARDING.length) throw new HttpError(403, "Finish onboarding first.");
  }
  if (lesson !== p[track].length) throw new HttpError(409, "Finish the lessons in order.");
  await q("INSERT INTO progress (user_id, track, lesson, takeaway) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
    [u.id, track, lesson, takeaway]);
  res.json({ progress: await progressOf(u.id) });
}));

/* ---------- Maria and team leaders ---------- */
async function targetFor(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(404, "Not found.");
  const { rows } = await q("SELECT * FROM users WHERE id = $1", [id]);
  const t = rows[0];
  if (!t) throw new HttpError(404, "That person isn’t on the team anymore.");
  const me = req.user;
  const allowed = me.role === "admin" || (t.role === "member" && t.leader_id === me.id);
  if (!allowed) throw new HttpError(403, "Not allowed.");
  return t;
}
const leaderChoices = async () =>
  (await q("SELECT id, name, role FROM users WHERE role IN ('admin', 'leader') ORDER BY role, name")).rows;

app.get("/api/team", requireStaff, wrap(async (req, res) => {
  const me = req.user;
  const { rows } = await q(`
    SELECT u.id, u.name, u.email, u.phone, u.tier, u.leader_id, l.name AS leader_name,
           u.sponsor_name, u.sponsor_phone, (u.password_hash IS NOT NULL) AS activated,
           u.last_active_at, u.created_at,
           COUNT(p.*) FILTER (WHERE p.track = 'onboarding')::int AS done,
           COUNT(p.*) FILTER (WHERE p.track = 'advanced')::int AS adv
    FROM users u
    LEFT JOIN users l ON l.id = u.leader_id
    LEFT JOIN progress p ON p.user_id = u.id
    WHERE u.role = 'member' AND ($1::int IS NULL OR u.leader_id = $1)
    GROUP BY u.id, l.name
    ORDER BY u.created_at DESC`, [me.role === "admin" ? null : me.id]);
  const out = {
    me: { id: me.id, name: me.name, role: me.role },
    members: rows,
    lessons: {
      onboarding: CONTENT.ONBOARDING.map((l) => l.title),
      advanced: CONTENT.ADVANCED.map((l) => l.title),
    },
  };
  if (me.role === "admin") {
    out.leaderChoices = await leaderChoices();
    out.staff = (await q(`SELECT id, name, email, phone, role, (password_hash IS NOT NULL) AS activated
                          FROM users WHERE role IN ('admin', 'leader') ORDER BY role, name`)).rows;
  }
  res.json(out);
}));

function readPerson(body) {
  const p = {
    name: clean(body.name, 120),
    email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 40),
  };
  if (!p.name) throw new HttpError(400, "Add their full name.");
  if (!isEmail(p.email)) throw new HttpError(400, "That email doesn’t look right. It should look like name@example.com.");
  if (digits(p.phone).length < 10) throw new HttpError(400, "Add a 10-digit phone number.");
  return p;
}
async function insertUser(fields) {
  const cols = Object.keys(fields);
  try {
    const { rows } = await q(
      `INSERT INTO users (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
      cols.map((c) => fields[c]));
    return rows[0].id;
  } catch (e) {
    if (e.code === "23505") throw new HttpError(409, "Someone on the team already uses that email.");
    throw e;
  }
}

app.post("/api/members", requireStaff, wrap(async (req, res) => {
  const me = req.user;
  const p = readPerson(req.body);
  const sponsorName = clean(req.body.sponsorName, 120);
  const sponsorPhone = clean(req.body.sponsorPhone, 40);
  const tier = req.body.tier;
  if (!sponsorName) throw new HttpError(400, "Add their sponsor’s name. It’s shown at the end of every lesson.");
  if (sponsorPhone && digits(sponsorPhone).length < 10) throw new HttpError(400, "The sponsor’s phone needs 10 digits, or leave it blank.");
  if (!TIERS.includes(tier)) throw new HttpError(400, "Choose Standard or Premium for their onboarding plan.");
  let leaderId = me.id;
  if (me.role === "admin") {
    leaderId = Number(req.body.leaderId);
    if (!(await leaderChoices()).some((l) => l.id === leaderId)) throw new HttpError(400, "Choose their team leader.");
  }
  const id = await insertUser({ ...p, role: "member", tier, leader_id: leaderId, sponsor_name: sponsorName, sponsor_phone: sponsorPhone });
  res.json({ id, link: await issueLink(req, id) });
}));

app.post("/api/leaders", requireAdmin, wrap(async (req, res) => {
  const p = readPerson(req.body);
  const id = await insertUser({ ...p, role: "leader" });
  res.json({ id, link: await issueLink(req, id) });
}));

app.post("/api/users/:id/tier", requireStaff, wrap(async (req, res) => {
  const t = await targetFor(req);
  if (t.role !== "member") throw new HttpError(400, "Only team members have a plan.");
  if (!TIERS.includes(req.body.tier)) throw new HttpError(400, "Choose Standard or Premium.");
  await q("UPDATE users SET tier = $1 WHERE id = $2", [req.body.tier, t.id]);
  res.json({ ok: true });
}));

app.post("/api/users/:id/link", requireStaff, wrap(async (req, res) => {
  const t = await targetFor(req);
  res.json({ link: await issueLink(req, t.id), kind: t.password_hash ? "reset" : "invite" });
}));

app.get("/api/users/:id/answers", requireStaff, wrap(async (req, res) => {
  const t = await targetFor(req);
  res.json({ progress: await progressOf(t.id) });
}));

app.delete("/api/users/:id", requireAdmin, wrap(async (req, res) => {
  const t = await targetFor(req);
  if (t.id === req.user.id) throw new HttpError(400, "You can’t remove your own account.");
  if (t.role === "admin") throw new HttpError(400, "Admin accounts can’t be removed here.");
  await q("DELETE FROM users WHERE id = $1", [t.id]);
  res.json({ ok: true });
}));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

/* ---------- Page ---------- */
const PAGE = "<!doctype html>\n" + fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
app.get(["/", "/index.html"], (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.type("html").send(PAGE);
});
app.use((req, res) => res.status(404).type("text").send("Not found"));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") return res.status(400).json({ error: "That request didn’t look right." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end. Try again in a minute." });
});

/* ---------- First admin accounts ----------
   ADMINS="Maria Lopez <maria@example.com>, Nicole <nicole@responsiv.agency>"
   Each admin without a password gets a setup link, printed to the deploy logs. */
async function bootstrapAdmins() {
  const raw = process.env.ADMINS || "";
  const base = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${PORT}`;
  for (const part of raw.split(/[,;]/)) {
    if (!part.trim()) continue;
    const m = part.match(/^\s*(.+?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
    if (!m) { console.warn(`ADMINS entry not understood (use Name <email>): ${part.trim()}`); continue; }
    const name = m[1], email = m[2].toLowerCase();
    let { rows } = await q("SELECT id, role, password_hash, invite_expires FROM users WHERE email = $1", [email]);
    let u = rows[0];
    if (!u) {
      const id = await insertUser({ name, email, role: "admin" });
      u = { id, password_hash: null, invite_expires: null };
    } else if (u.role !== "admin") {
      await q("UPDATE users SET role = 'admin', tier = NULL, leader_id = NULL WHERE id = $1", [u.id]);
    }
    if (u.password_hash) continue;
    if (u.invite_expires && new Date(u.invite_expires) > new Date()) {
      console.log(`Admin ${name} <${email}> has an unused setup link. Another admin can copy a fresh one from the dashboard.`);
      continue;
    }
    const token = newToken();
    await q(`UPDATE users SET invite_hash = $1, invite_expires = now() + make_interval(days => $2) WHERE id = $3`,
      [sha256(token), INVITE_DAYS, u.id]);
    console.log(`Admin setup link for ${name} <${email}> (valid ${INVITE_DAYS} days): ${base}/#invite/${token}`);
  }
}

(async () => {
  await migrate();
  await bootstrapAdmins();
  app.listen(PORT, () => console.log(`Team Maria onboarding running on port ${PORT}`));
})().catch((e) => { console.error("Startup failed:", e); process.exit(1); });
