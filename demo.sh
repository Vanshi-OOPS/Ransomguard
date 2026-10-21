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
