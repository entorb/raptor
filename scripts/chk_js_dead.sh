#!/bin/sh

cd "$(dirname "$0")/.." || exit 1
out=$(mktemp)
trap 'rm -f "$out"' EXIT INT TERM

pnpm exec knip --reporter compact >"$out" 2>&1
status=$?

# print output in good case only if more than 1 lines
if [ $status -eq 0 ]; then
  lines=$(wc -l <"$out")
  if [ "$lines" -gt 1 ]; then
    head -n 10 "$out"
  fi
  echo OK
else
  head -n 100 "$out"
fi
exit $status
