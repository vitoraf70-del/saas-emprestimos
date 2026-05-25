import { createHmac, timingSafeEqual } from "crypto";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const LOGIN_TTL_MS = 60 * 1000;

function secret() {
  const value = process.env.NEXTAUTH_SECRET?.trim();
  if (!value) throw new Error("NEXTAUTH_SECRET não configurado.");
  return value;
}

function sign(payload: object, ttlMs: number) {
  const exp = Date.now() + ttlMs;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify<T extends Record<string, unknown>>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  let parsed: T & { exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
  } catch {
    return null;
  }
  if (!parsed.exp || parsed.exp < Date.now()) return null;
  const { exp: _exp, ...rest } = parsed;
  return rest as T;
}

export function createLoginChallengeToken(userId: string) {
  return sign({ kind: "challenge", userId }, CHALLENGE_TTL_MS);
}

export function parseLoginChallengeToken(token: string) {
  const data = verify<{ kind: string; userId: string }>(token);
  if (!data || data.kind !== "challenge" || !data.userId) return null;
  return data.userId;
}

export function createLoginCompleteToken(userId: string) {
  return sign({ kind: "login", userId }, LOGIN_TTL_MS);
}

export function parseLoginCompleteToken(token: string) {
  const data = verify<{ kind: string; userId: string }>(token);
  if (!data || data.kind !== "login" || !data.userId) return null;
  return data.userId;
}

export function createTotpSetupToken(userId: string, totpSecret: string) {
  return sign({ kind: "setup", userId, totpSecret }, CHALLENGE_TTL_MS);
}

export function parseTotpSetupToken(token: string) {
  const data = verify<{ kind: string; userId: string; totpSecret: string }>(token);
  if (!data || data.kind !== "setup" || !data.userId || !data.totpSecret) return null;
  return { userId: data.userId, totpSecret: data.totpSecret };
}
