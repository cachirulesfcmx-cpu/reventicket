import { createHmac, randomInt, timingSafeEqual } from "crypto";

// OTP codes are never stored in plaintext: only HMAC-SHA256(pepper, "phone:code").
// The pepper is OTP_PEPPER (preferred) or SESSION_SECRET; production refuses to run without one.
function pepper(): string {
  const value = process.env.OTP_PEPPER || process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("OTP_PEPPER or SESSION_SECRET is required to store OTP codes");
  }
  return "dev-only-otp-pepper";
}

export function generateOtpCode(): string {
  return randomInt(100000, 1000000).toString();
}

export function hashOtp(phone: string, code: string): string {
  return createHmac("sha256", pepper()).update(`${phone}:${code}`).digest("hex");
}

export function otpHashMatches(storedHash: string, phone: string, code: string): boolean {
  const expected = Buffer.from(hashOtp(phone, code), "hex");
  const actual = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Failed verifications per phone (the per-IP otpLimiter does not stop distributed guessing).
// After MAX_FAILURES within the window every active code for that phone is expired in the database.
// In-memory: with several instances each one counts separately, the DB expiry still applies to all.
export const MAX_OTP_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();

export function recordOtpFailure(phone: string): number {
  const now = Date.now();
  const entry = failures.get(phone);
  const next = !entry || now - entry.first > WINDOW_MS ? { count: 1, first: now } : { count: entry.count + 1, first: entry.first };
  failures.set(phone, next);
  return next.count;
}

export function clearOtpFailures(phone: string): void {
  failures.delete(phone);
}
