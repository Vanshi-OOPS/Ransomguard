#!/bin/bash
mkdir -p ~/ransomguard/simulator && cd ~/ransomguard || exit 1
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

    def skip(self, pid):
        return pid == ME or pid in self.protected or pid in self.state or self.exe(pid) in self.c["whitelist_exe"]

    def on_write(self, pid, path, sample):
        if self.skip(pid): return
        self.last_writer[path] = pid
        ext = os.path.splitext(path)[1].lower()
        pts = 1
        if (len(sample) >= self.c["min_sample_bytes"] and ext not in self.c["natural_high_entropy_ext"]
                and shannon(sample) >= self.c["entropy_threshold"]):
            pts += self.c["entropy_points"]
        self.add(pid, "write", path, pts)

    def on_rename(self, old, new):
        pid = self.last_writer.pop(old, None)          # inotify has no pid -> borrow from fanotify
        if pid is None or self.skip(pid): return
        self.last_writer[new] = pid
        oe, ne = os.path.splitext(old)[1].lower(), os.path.splitext(new)[1].lower()
        if ne != oe and ne not in self.c["known_ext"]:
            self.add(pid, "rename", new, self.c["ext_change_points"])

    def evaluate(self, pid):
        s, files = self.score(pid)
        if s >= self.c["kill_score"]: self.contain(pid, "SIGKILL", s, files)
        elif s >= self.c["suspend_score"] and self.state.get(pid) != "stopped":
            self.contain(pid, "SIGSTOP", s, files)

    def contain(self, pid, sig, score, files):
        targets = [p for p in children_of(pid) if p not in self.protected and p != ME]
        if not self.dry:
            for p in targets:
                try: os.kill(p, getattr(signal, sig))
                except ProcessLookupError: pass
        self.state[pid] = "stopped" if sig == "SIGSTOP" else "killed"
        if sig == "SIGSTOP":
            self.deadline[pid] = time.time() + self.c["kill_after_suspend_sec"]
        else:
            self.deadline.pop(pid, None)
        self.log(event="CONTAIN", action=sig + (" (dry-run)" if self.dry else ""), pid=pid, exe=self.exe(pid),
                 score=score, files=files, latency_sec=round(time.time() - self.first_seen[pid], 3))

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
cat > demo.sh <<'RG_EOF'
#!/bin/bash
# Review I demo: sudo ./demo.sh   (VM / throwaway dir only)
cd "$(dirname "$0")"; mkdir -p /tmp/rg_test; rm -f /tmp/rg_test/ransomguard.log
run() {  # $1=label, $2=workload cmd, $3=extra daemon flags
  ./simulator/make_testdata.sh >/dev/null
  python3 ransomguard.py -c config.json $3 > /tmp/rg_test/demo.out 2>&1 & D=$!; sleep 1
  echo "=== $1"; eval "$2"; sleep 1.5
  if [ -z "$3" ]; then sleep 5; fi
  kill -TERM $D; wait $D 2>/dev/null
  grep CONTAIN /tmp/rg_test/demo.out || echo "(no detection)"
}
run "Benign: tar + cp (expect NO detection)" \
  "tar czf /tmp/rg_test/b.tar.gz -C /tmp/rg_test victim; cp -r /tmp/rg_test/victim/docs /tmp/rg_test/victim/docs2"
run "Attack: simulator (expect SIGSTOP then SIGKILL)" "python3 simulator/fake_ransom.py /tmp/rg_test/victim"
echo "=== Rollback"; ./simulator/make_testdata.sh >/dev/null
python3 ransomguard.py -c config.json --snapshot > /tmp/rg_test/demo.out 2>&1 & D=$!; sleep 1
python3 simulator/fake_ransom.py /tmp/rg_test/victim; sleep 1; kill -TERM $D; wait $D 2>/dev/null
find /tmp/rg_test/victim -name '*.locked' -delete; python3 ransomguard.py -c config.json --restore
RG_EOF
cat > simulator/fake_ransom.py <<'RG_EOF'
#!/usr/bin/env python3
"""SAFE ransomware simulator. Only touches a directory containing a .rg_sandbox marker file.
Mimics ransomware I/O: read file -> write random-looking bytes -> rename to <name>.locked
(Uses os.urandom as a stand-in for ciphertext; no real encryption, nothing is exfiltrated.)
usage: fake_ransom.py <dir> [--delay 0.02]"""
import os, sys, time, argparse
ap = argparse.ArgumentParser(); ap.add_argument("dir"); ap.add_argument("--delay", type=float, default=0.02)
a = ap.parse_args()
if not os.path.exists(os.path.join(a.dir, ".rg_sandbox")):
    sys.exit("refusing: no .rg_sandbox marker in target dir")
n = 0
for dp, _, fs in os.walk(a.dir):
    for f in sorted(fs):
        if f.startswith(".") or f.endswith(".locked"): continue
        p = os.path.join(dp, f); size = max(os.path.getsize(p), 1024)
        with open(p, "wb") as fh: fh.write(os.urandom(size))
        os.rename(p, p + ".locked"); n += 1; time.sleep(a.delay)
print(f"[sim] 'encrypted' {n} files")
RG_EOF
cat > simulator/make_testdata.sh <<'RG_EOF'
#!/bin/bash
# creates sandbox with 60 text-ish files + marker
D=${1:-/tmp/rg_test/victim}; rm -rf "$D"; mkdir -p "$D/docs" "$D/src"
touch "$D/.rg_sandbox"
for i in $(seq 1 30); do seq 1 800 | sed "s/^/doc $i line /" > "$D/docs/report_$i.txt"; done
for i in $(seq 1 30); do seq 1 800 | sed "s/^/int v$i = /" > "$D/src/code_$i.c"; done
echo "created $(find $D -type f ! -name '.rg*' | wc -l) files in $D"
RG_EOF
sed -i 's/$//' *.sh simulator/*.sh *.py simulator/*.py
chmod +x demo.sh simulator/*.sh
wc -l demo.sh ransomguard.py config.json simulator/*
