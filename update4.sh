#!/bin/bash
T=~/ransomguard; [ -d "$T" ] || T=~/ransomguard_old
cd "$T" || { echo "project folder not found"; exit 1; }; echo "updating $T"; mkdir -p simulator
cat > ransomguard.py <<'RG_EOF'
#!/usr/bin/env python3
"""RansomGuard prototype: fanotify-based ransomware detection + containment.
Run as root:  sudo python3 ransomguard.py -c config.json [--dry-run] [--snapshot]
Restore:      sudo python3 ransomguard.py -c config.json --restore
"""
import argparse, collections, ctypes, ctypes.util, hashlib, json, math, os
import queue, select, shutil, signal, struct, threading, time

# ---------- kernel constants ----------
FAN_CLOEXEC, FAN_CLASS_CONTENT = 0x1, 0x4
FAN_MODIFY, FAN_CLOSE_WRITE, FAN_OPEN_PERM = 0x2, 0x8, 0x10000
FAN_MARK_ADD, FAN_MARK_MOUNT, FAN_ALLOW = 0x1, 0x10, 1
AT_FDCWD = -100
EV_FMT = "=IBBHQii"                      # event_len, vers, rsv, meta_len, mask, fd, pid
EV_SZ = struct.calcsize(EV_FMT)
IN_MOVED_FROM, IN_MOVED_TO = 0x40, 0x80
IN_FMT = "=iIII"                          # wd, mask, cookie, len
IN_SZ = struct.calcsize(IN_FMT)
libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)
libc.fanotify_mark.argtypes = [ctypes.c_int, ctypes.c_uint, ctypes.c_uint64, ctypes.c_int, ctypes.c_char_p]
ME = os.getpid()


# ---------- helpers ----------
def shannon(b: bytes) -> float:
    if not b:
        return 0.0
    n = len(b)
    return -sum(c / n * math.log2(c / n) for c in collections.Counter(b).values())

def exe_of(pid):
    try: return os.readlink(f"/proc/{pid}/exe")
    except OSError: return "?"

def children_of(pid):
    """pid + all descendants, via /proc/*/stat (field 4 = ppid)."""
    tree, parent = {}, {}
    for d in os.listdir("/proc"):
        if d.isdigit():
            try:
                with open(f"/proc/{d}/stat") as f:
                    parent[int(d)] = int(f.read().rsplit(")", 1)[1].split()[1])
            except (OSError, IndexError, ValueError): pass
    for c, p in parent.items(): tree.setdefault(p, []).append(c)
    out, stack = [], [pid]
    while stack:
        p = stack.pop(); out.append(p); stack += tree.get(p, [])
    return out

def ppid_of(pid):
    try:
        with open(f"/proc/{pid}/stat") as f: return int(f.read().rsplit(")", 1)[1].split()[1])
    except (OSError, IndexError, ValueError): return 0

def ancestors(pid):
    out = set()
    while pid > 1:
        out.add(pid)
        try:
            with open(f"/proc/{pid}/stat") as f: pid = int(f.read().rsplit(")", 1)[1].split()[1])
        except (OSError, IndexError, ValueError): break
    return out


# ---------- snapshot / rollback (copy-on-first-write) ----------
class Snapshotter:
    def __init__(self, cfg):
        self.dir, self.max = cfg["snapshot_dir"], cfg["snapshot_max_mb"] * 1024 * 1024
        os.makedirs(self.dir, exist_ok=True)
        self.idx_path = os.path.join(self.dir, "index.json")
        self.idx = json.load(open(self.idx_path)) if os.path.exists(self.idx_path) else {}
        self.lock = threading.Lock()

    def snap(self, path, fd):
        with self.lock:
            if path in self.idx.values(): return
        try:
            if os.fstat(fd).st_size > self.max or not os.path.isfile(path): return
            dest = os.path.join(self.dir, hashlib.sha1(path.encode()).hexdigest())
            with os.fdopen(os.dup(fd), "rb") as src, open(dest, "wb") as dst:  # dup'd event fd: no new events
                shutil.copyfileobj(src, dst)
            with self.lock:
                self.idx[dest] = path
                json.dump(self.idx, open(self.idx_path, "w"))
        except OSError:
            pass

    def restore(self):
        n = 0
        for dest, path in self.idx.items():
            if os.path.exists(dest):
                os.makedirs(os.path.dirname(path), exist_ok=True)
                shutil.copy2(dest, path); n += 1
        return n


# ---------- detection engine ----------
class Engine:
    def __init__(self, cfg, dry_run=False):
        self.c, self.dry = cfg, dry_run
        self.hist = collections.defaultdict(collections.deque)   # pid -> (t, kind, path, pts)
        self.first_seen, self.state, self.deadline = {}, {}, {}
        self.members, self.key_cache, self.signaled = collections.defaultdict(set), {}, set()
        self.last_writer, self.exe_cache = {}, {}
        self.protected = ancestors(ME) | {1}
        self.log_f = open(cfg["log_file"], "a", buffering=1)

    def log(self, **kw):
        kw["ts"] = round(time.time(), 3)
        line = json.dumps(kw); print(line); self.log_f.write(line + "\n")

    def exe(self, pid):
        if pid not in self.exe_cache: self.exe_cache[pid] = exe_of(pid)   # cache early: short-lived procs
        return self.exe_cache[pid]

    def add(self, pid, kind, path, pts):
        now = time.time()
        self.first_seen.setdefault(pid, now)
        h = self.hist[pid]; h.append((now, kind, path, pts))
        while h and now - h[0][0] > self.c["window_sec"]: h.popleft()
        self.evaluate(pid)

    def score(self, pid):
        h = self.hist[pid]
        files = len({p for _, k, p, _ in h if k != "rename"})
        s = sum(x[3] for x in h)
        if files >= self.c["rate_threshold_files"]: s += self.c["rate_points"]
        return s, files

    def key(self, pid):
        """Scoring group = parent PID, so parallel workers of one attacker pool their score.
        Falls back to the PID itself if the parent is init or one of our own ancestors."""
        if pid not in self.key_cache:
            pp = ppid_of(pid)
            self.key_cache[pid] = pid if (pp <= 1 or pp in self.protected) else pp
        return self.key_cache[pid]

    def signal_pid(self, pid, sig):
        if pid in self.signaled or pid in self.protected or pid == ME: return
        self.signaled.add(pid)
        if not self.dry:
            try: os.kill(pid, getattr(signal, sig))
            except ProcessLookupError: pass
        self.log(event="CONTAIN-LATE", action=sig + (" (dry-run)" if self.dry else ""), pid=pid, exe=self.exe(pid))

    def skip(self, pid):
        return pid == ME or pid in self.protected or self.exe(pid) in self.c["whitelist_exe"]

    def on_write(self, pid, path, sample):
        if self.skip(pid): return
        key = self.key(pid); self.members[key].add(pid)
        st = self.state.get(key)
        if st:                                   # group already contained: catch workers that join late
            self.signal_pid(pid, "SIGSTOP" if st == "stopped" else "SIGKILL"); return
        self.last_writer[path] = pid
        ext = os.path.splitext(path)[1].lower()
        pts = self.c.get("write_points", 1)   # plain low-entropy writes carry no score by themselves
        if (len(sample) >= self.c["min_sample_bytes"] and ext not in self.c["natural_high_entropy_ext"]
                and shannon(sample) >= self.c["entropy_threshold"]):
            pts += self.c["entropy_points"]
        self.add(key, "write", path, pts)

    def on_rename(self, old, new):
        pid = self.last_writer.pop(old, None)          # inotify has no pid -> borrow from fanotify
        if pid is None or self.skip(pid): return
        key = self.key(pid)
        if self.state.get(key): return
        self.last_writer[new] = pid
        oe, ne = os.path.splitext(old)[1].lower(), os.path.splitext(new)[1].lower()
        if ne != oe and ne not in self.c["known_ext"]:
            self.add(key, "rename", new, self.c["ext_change_points"])

    def evaluate(self, pid):
        s, files = self.score(pid)
        if s >= self.c["kill_score"]: self.contain(pid, "SIGKILL", s, files)
        elif s >= self.c["suspend_score"] and self.state.get(pid) != "stopped":
            self.contain(pid, "SIGSTOP", s, files)

    def contain(self, pid, sig, score, files):
        targets = {t for m in self.members[pid] for t in children_of(m)}      # every writer in the group + descendants
        if len(self.members[pid]) >= self.c.get("group_parent_min_members", 3):
            targets |= set(children_of(pid))          # spawn-per-file pattern: freeze the orchestrating parent too
        targets = [p for p in targets if p not in self.protected and p != ME]
        self.signaled.update(targets)
        if not self.dry:
            for p in targets:
                try: os.kill(p, getattr(signal, sig))
                except ProcessLookupError: pass
        self.state[pid] = "stopped" if sig == "SIGSTOP" else "killed"
        if sig == "SIGSTOP":
            self.deadline[pid] = time.time() + self.c["kill_after_suspend_sec"]
        else:
            self.deadline.pop(pid, None)
        self.log(event="CONTAIN", action=sig + (" (dry-run)" if self.dry else ""), pid=min(self.members[pid] or {pid}), group=pid, members=sorted(self.members[pid]),
                 exe=self.exe(min(self.members[pid] or {pid})), score=score, files=files, latency_sec=round(time.time() - self.first_seen[pid], 3))

    def tick(self):                                      # escalate stopped -> killed after grace period
        now = time.time()
        for pid, t in list(self.deadline.items()):
            if now >= t:
                s, f = self.score(pid); self.contain(pid, "SIGKILL", s, f)


# ---------- monitor ----------
def under(path, roots): return any(path == r or path.startswith(r + os.sep) for r in roots)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-c", "--config", default="config.json")
    ap.add_argument("--dry-run", action="store_true", help="detect + log only, no signals")
    ap.add_argument("--snapshot", action="store_true", help="copy-on-first-write backups (uses blocking perm events)")
    ap.add_argument("--restore", action="store_true", help="restore files from snapshot dir and exit")
    a = ap.parse_args()
    cfg = json.load(open(a.config))
    os.makedirs(os.path.dirname(cfg["log_file"]), exist_ok=True)
    if a.restore:
        print(f"restored {Snapshotter(cfg).restore()} files"); return
    roots = [os.path.realpath(d) for d in cfg["watch_dirs"]]
    skip_roots = [os.path.realpath(cfg["snapshot_dir"])]

    eng, snap = Engine(cfg, a.dry_run), (Snapshotter(cfg) if a.snapshot else None)

    # fanotify: mount-wide mark, filtered to watch_dirs in userspace
    mask = FAN_MODIFY | FAN_CLOSE_WRITE | (FAN_OPEN_PERM if a.snapshot else 0)
    fan = libc.fanotify_init(FAN_CLOEXEC | FAN_CLASS_CONTENT, os.O_RDONLY)
    if fan < 0: raise SystemExit(f"fanotify_init failed (need root): {os.strerror(ctypes.get_errno())}")
    for r in roots:
        if libc.fanotify_mark(fan, FAN_MARK_ADD | FAN_MARK_MOUNT, mask, AT_FDCWD, r.encode()) < 0:
            raise SystemExit(f"fanotify_mark failed: {os.strerror(ctypes.get_errno())}")

    # inotify: rename events only (fanotify classic can't see them)
    ino = libc.inotify_init1(os.O_NONBLOCK)
    wd_path, cookies = {}, {}
    for r in roots:
        for dp, _, _ in os.walk(r):
            wd = libc.inotify_add_watch(ino, dp.encode(), IN_MOVED_FROM | IN_MOVED_TO)
            if wd >= 0: wd_path[wd] = dp

    # snapshot worker thread: copying opens files -> perm events for our own pid, which the
    # main loop must keep answering, so copying can't run on the main thread
    work = queue.Queue()
    def worker():
        while True:
            fd, path = work.get()
            try: snap.snap(path, fd)
            finally:
                os.write(fan, struct.pack("=iI", fd, FAN_ALLOW)); os.close(fd)
    if snap: threading.Thread(target=worker, daemon=True).start()

    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    eng.log(event="START", watching=roots, dry_run=a.dry_run, snapshot=a.snapshot)
    try:
        while True:
            r, _, _ = select.select([fan, ino], [], [], 0.5)
            eng.tick()
            if fan in r:
                buf = os.read(fan, 65536); off = 0
                while off + EV_SZ <= len(buf):
                    elen, _, _, _, m, fd, pid = struct.unpack_from(EV_FMT, buf, off); off += elen
                    if fd < 0: continue
                    if m & FAN_OPEN_PERM:
                        path = os.path.realpath(os.readlink(f"/proc/self/fd/{fd}"))
                        # event fd is always O_RDONLY, so write intent is invisible here:
                        # snapshot on first open of any file (cheap enough: once per file, size-capped)
                        if pid != ME and snap and under(path, roots) and not under(path, skip_roots):
                            work.put((fd, path)); continue      # worker answers + closes
                        os.write(fan, struct.pack("=iI", fd, FAN_ALLOW)); os.close(fd); continue
                    try:
                        path = os.path.realpath(os.readlink(f"/proc/self/fd/{fd}"))
                        if under(path, roots) and not under(path, skip_roots) and pid != ME and (m & FAN_CLOSE_WRITE):
                            eng.exe(pid)
                            eng.on_write(pid, path, os.pread(fd, 4096, 0))
                    except OSError: pass
                    finally: os.close(fd)
            if ino in r:
                try: buf = os.read(ino, 65536)
                except BlockingIOError: buf = b""
                off = 0
                while off + IN_SZ <= len(buf):
                    wd, m, ck, ln = struct.unpack_from(IN_FMT, buf, off)
                    name = buf[off + IN_SZ: off + IN_SZ + ln].split(b"\0")[0].decode(errors="replace"); off += IN_SZ + ln
                    full = os.path.join(wd_path.get(wd, ""), name)
                    if m & IN_MOVED_FROM: cookies[ck] = full
                    elif m & IN_MOVED_TO and ck in cookies: eng.on_rename(cookies.pop(ck), full)
    except KeyboardInterrupt:
        eng.log(event="STOP")

if __name__ == "__main__":
    main()
RG_EOF
cat > config.json <<'RG_EOF'
{
  "watch_dirs": ["/tmp/rg_test/victim"],
  "window_sec": 5,
  "rate_threshold_files": 15,
  "rate_points": 20,
  "entropy_threshold": 7.5,
  "write_points": 0,
  "group_parent_min_members": 3,
  "entropy_points": 10,
  "min_sample_bytes": 512,
  "ext_change_points": 15,
  "suspend_score": 60,
  "kill_score": 120,
  "kill_after_suspend_sec": 5,
  "whitelist_exe": ["/usr/bin/rsync", "/usr/bin/apt", "/usr/bin/dpkg"],
  "natural_high_entropy_ext": [".zip", ".gz", ".xz", ".bz2", ".7z", ".jpg", ".jpeg", ".png", ".mp3", ".mp4", ".pdf", ".docx", ".xlsx", ".pptx"],
  "known_ext": [".txt", ".md", ".csv", ".json", ".log", ".py", ".c", ".h", ".cpp", ".html", ".css", ".js", ".doc", ".docx", ".xlsx", ".pptx", ".pdf", ".jpg", ".png", ".zip", ".gz", ".tmp"],
  "snapshot_dir": "/tmp/rg_test/snapshots",
  "snapshot_max_mb": 50,
  "log_file": "/tmp/rg_test/ransomguard.log"
}
RG_EOF
cat > scenarios.sh <<'RG_EOF'
#!/bin/bash
# Run all test scenarios and print a results table.  Usage: sudo bash scenarios.sh
cd "$(dirname "$0")" || exit 1
V=/tmp/rg_test/victim; O=/tmp/rg_test; mkdir -p $O; : > $O/rows.txt; : > $O/rows.csv
md5list() { (cd $V && find . -type f ! -name '.rg*' -exec md5sum {} + | sort -k2); }

# args: id | kind(attack/benign) | expect(detect/clean) | setup cmd | workload cmd
scenario() {
  id=$1; kind=$2; expect=$3; setup=$4; work=$5
  ./simulator/make_testdata.sh >/dev/null; eval "$setup"
  rm -rf $O/snapshots; md5list > $O/before.md5
  flag=""; [ "$kind" = attack ] && flag="--snapshot"
  python3 ransomguard.py -c config.json $flag > $O/run.out 2>&1 & D=$!
  sleep 1; bash -c "$work" >/dev/null 2>&1; sleep 6     # 6s lets the 5s kill grace expire
  kill -TERM $D; wait $D 2>/dev/null
  det=no; grep -q '"SIGSTOP\|"SIGKILL' $O/run.out && det=yes
  lat=$(grep -m1 CONTAIN $O/run.out | sed -n 's/.*latency_sec": *\([0-9.]*\).*/\1/p'); lat=${lat:--}
  dmg=-; rec=-
  if [ "$kind" = attack ]; then
    dmg=$(find $V -name '*.locked' | wc -l)
    find $V -name '*.locked' -delete; python3 ransomguard.py -c config.json --restore >/dev/null
    md5list > $O/after.md5
    tot=$(wc -l < $O/before.md5); bad=$(diff $O/before.md5 $O/after.md5 | grep -c '^<')
    rec="$((tot-bad))/$tot"
  fi
  if { [ $expect = detect ] && [ $det = yes ]; } || { [ $expect = clean ] && [ $det = no ]; }; then v=PASS; else v=FAIL; fi
  printf "%-4s %-34s %-7s %-9s %-8s %-8s %-9s %s\n" "$id" "$6" "$expect" "$det" "$lat" "$dmg" "$rec" "$v" >> $O/rows.txt
  latc=$lat; [ "$lat" = - ] && latc=; dmgc=$dmg; [ "$dmg" = - ] && dmgc=; recc=$rec; [ "$rec" = - ] && recc=
  echo "$id,\"$6\",$kind,$expect,$det,$latc,$dmgc,$recc,$v" >> $O/rows.csv
  echo "done $id -> $v"
}

echo "running scenarios (about 2 minutes)..."
BIG='mkdir -p $V/big; touch $V/big/.rg_sandbox; for i in $(seq 1 15); do head -c 1500000 /dev/zero | tr "\0" "a" > $V/big/f$i.txt; done'
GCC='mkdir -p /tmp/rg_test/victim/cc; for i in $(seq 1 30); do echo "int f$i(void){return $i;}" > /tmp/rg_test/victim/cc/m$i.c; done'
S=simulator/fake_ransom.py
scenario A1 attack detect ":" "python3 $S $V --delay 0.02" "fast ransomware (50 files/s)"      2>/dev/null
scenario A2 attack detect ":" "python3 $S $V --delay 0.5"  "medium (2 files/s)"                 2>/dev/null
scenario A3 attack detect ":" "python3 $S $V --delay 1.0 --limit 25" "slow (1 file/s)"          2>/dev/null
scenario A4 attack detect "$BIG" "python3 $S $V/big --delay 0.05" "large files (1.5 MB each)"   2>/dev/null
scenario A5 attack detect ":" "python3 $S $V --delay 0.05 --workers 4" "4 parallel workers"     2>/dev/null
scenario A6 attack detect ":" "python3 simulator/aes_attacker.py $V --mode copy" "real AES-256, openssl per file"    2>/dev/null
scenario A7 attack detect ":" "python3 simulator/aes_attacker.py $V --mode inplace" "real AES-256, in-place overwrite" 2>/dev/null
scenario B1 benign clean ":" "tar czf $O/b.tar.gz -C $O victim" "tar czf (compression)"          2>/dev/null
scenario B2 benign clean ":" "cp -r $V/docs $V/docs2" "cp -r (bulk copy)"                        2>/dev/null
scenario B3 benign clean ":" "python3 -c \"
import os
for i in range(40): open('$V/docs/new_%d.txt'%i,'w').write('hello world '*300)\"" "python writes 40 text files"  2>/dev/null
if command -v gcc >/dev/null; then
scenario B4 benign clean "$GCC" "cd $V/cc && for f in m*.c; do gcc -c \$f; done" "gcc compile 30 files"   2>/dev/null
else echo "(gcc not installed: skipping B4)"; fi
scenario B5 benign clean ":" "python3 -m zipfile -c $O/z.zip $V" "zip archive"                   2>/dev/null

echo; echo "RESULTS (latency in seconds; damaged = files already renamed .locked when attack stopped)"
printf "%-4s %-34s %-7s %-9s %-8s %-8s %-9s %s\n" ID Scenario Expect Detected Latency Damaged Recovered Verdict
printf -- "-%.0s" {1..92}; echo; cat $O/rows.txt
{ echo "id,scenario,kind,expect,detected,latency_sec,files_damaged,recovered,verdict"; cat $O/rows.csv; } > results.csv
[ -n "$SUDO_USER" ] && chown "$SUDO_USER" results.csv
echo; echo "saved $(pwd)/results.csv"
RG_EOF
cat > simulator/aes_attacker.py <<'RG_EOF'
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
RG_EOF
sed -i 's/$//' *.sh *.py simulator/*.py simulator/*.sh; chmod +x *.sh simulator/*.sh simulator/*.py
wc -l ransomguard.py config.json scenarios.sh simulator/aes_attacker.py
