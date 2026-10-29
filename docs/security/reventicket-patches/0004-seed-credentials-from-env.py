#!/usr/bin/env python3
"""Applies fix 0004 to server/seed.ts of a RevenTicket checkout (run from the checkout root).

Shipped as a script instead of a diff on purpose: a diff would have to show the deleted lines, which contain the
seed passwords that are currently committed in the source. This script removes them without reproducing them.
"""
import re, sys, pathlib

path = pathlib.Path("server/seed.ts")
src = path.read_text()
if "SEED_ADMIN_PASSWORD" in src:
    sys.exit("already applied")
guard = '''async function seed() {
  // The seed TRUNCATEs users, orders and tickets: never against production.
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:seed is disabled in production (it truncates every table)");
  }
  // Credentials come from the environment; nothing secret lives in the repository.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const buyerPassword = process.env.SEED_BUYER_PASSWORD;
  if (!adminPassword || adminPassword.length < 12 || !buyerPassword || buyerPassword.length < 12) {
    throw new Error("Set SEED_ADMIN_PASSWORD and SEED_BUYER_PASSWORD (12+ characters) to run the seed");
  }
'''
if src.count("async function seed() {\n") != 1:
    sys.exit("unexpected seed.ts layout; apply by hand")
src = src.replace("async function seed() {\n", guard, 1)
literals = list(re.finditer(r'await bcrypt\.hash\("[^"]*", 10\)', src))
if len(literals) != 2:
    sys.exit(f"expected 2 hard-coded passwords, found {len(literals)}; apply by hand")
replacements = iter(["await bcrypt.hash(adminPassword, 10)", "await bcrypt.hash(buyerPassword, 10)"])
src = re.sub(r'await bcrypt\.hash\("[^"]*", 10\)', lambda m: next(replacements), src)
path.write_text(src)
print("server/seed.ts updated")
