#!/usr/bin/env python3
"""SAFE ransomware simulator. Only touches a directory containing a .rg_sandbox marker file.
Mimics ransomware I/O: overwrite file with random bytes -> rename to <name>.locked
(os.urandom stands in for ciphertext; no real encryption, nothing is exfiltrated.)
usage: fake_ransom.py <dir> [--delay 0.02] [--workers N] [--limit N]"""
import os, sys, time, argparse, multiprocessing as mp

def lock(files, delay):
    n = 0
    for p in files:
        size = max(os.path.getsize(p), 1024)
        with open(p, "wb") as fh: fh.write(os.urandom(size))
        os.rename(p, p + ".locked"); n += 1; time.sleep(delay)
    print(f"[sim pid {os.getpid()}] 'encrypted' {n} files", flush=True)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("dir")
    ap.add_argument("--delay", type=float, default=0.02, help="seconds between files")
    ap.add_argument("--workers", type=int, default=1, help="parallel worker processes")
    ap.add_argument("--limit", type=int, default=0, help="max files to process (0 = all)")
    a = ap.parse_args()
    if not os.path.exists(os.path.join(a.dir, ".rg_sandbox")):
        sys.exit("refusing: no .rg_sandbox marker in target dir")
    files = [os.path.join(dp, f) for dp, _, fs in os.walk(a.dir) for f in sorted(fs)
             if not f.startswith(".") and not f.endswith(".locked")]
    if a.limit: files = files[:a.limit]
    if a.workers <= 1:
        lock(files, a.delay)
    else:
        ps = [mp.Process(target=lock, args=(files[i::a.workers], a.delay)) for i in range(a.workers)]
        [p.start() for p in ps]; [p.join() for p in ps]
