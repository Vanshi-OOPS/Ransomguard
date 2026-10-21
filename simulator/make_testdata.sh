#!/bin/bash
# creates sandbox with 60 text-ish files + marker
D=${1:-/tmp/rg_test/victim}; rm -rf "$D"; mkdir -p "$D/docs" "$D/src"
touch "$D/.rg_sandbox"
for i in $(seq 1 30); do seq 1 800 | sed "s/^/doc $i line /" > "$D/docs/report_$i.txt"; done
for i in $(seq 1 30); do seq 1 800 | sed "s/^/int v$i = /" > "$D/src/code_$i.c"; done
echo "created $(find $D -type f ! -name '.rg*' | wc -l) files in $D"
