// Unit checks for server/lib/otp.ts. Usage: RT_DIR=/path/to/checkout <checkout>/node_modules/.bin/tsx otp.unit.mts
const { generateOtpCode, hashOtp, otpHashMatches, recordOtpFailure, clearOtpFailures, MAX_OTP_FAILURES } = await import(`${process.env.RT_DIR}/server/lib/otp.ts`);
const ok = (c: boolean, m: string) => { if (!c) { console.log("FAIL", m); process.exit(1); } console.log("ok -", m); };
const codes = Array.from({ length: 2000 }, generateOtpCode);
ok(codes.every((c) => /^\d{6}$/.test(c) && +c >= 100000), "2000 generated codes are 6 digits in range");
ok(new Set(codes).size > 1990, "generated codes are not repetitive");
const h = hashOtp("5512345678", "123456");
ok(/^[0-9a-f]{64}$/.test(h), "hash is 64 hex chars (works without SESSION_SECRET outside production)");
ok(otpHashMatches(h, "5512345678", "123456"), "right code matches");
ok(!otpHashMatches(h, "5512345678", "123457"), "wrong code does not match");
ok(!otpHashMatches(h, "5500000000", "123456"), "code bound to its phone");
ok(!otpHashMatches("123456", "5512345678", "123456"), "legacy plaintext row never matches (no crash)");
ok(!otpHashMatches("", "5512345678", "123456"), "empty stored value never matches");
let n = 0; for (let i = 0; i < MAX_OTP_FAILURES; i++) n = recordOtpFailure("p1");
ok(n === MAX_OTP_FAILURES, "failure counter reaches the limit");
clearOtpFailures("p1"); ok(recordOtpFailure("p1") === 1, "counter clears after success");
process.env.NODE_ENV = "production"; delete process.env.SESSION_SECRET; delete process.env.OTP_PEPPER;
let threw = false; try { hashOtp("1", "2"); } catch { threw = true; }
ok(threw, "production without OTP_PEPPER/SESSION_SECRET refuses to hash");
