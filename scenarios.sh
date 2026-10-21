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
