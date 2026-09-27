#!/bin/sh

cd "$(dirname "$0")/.." || exit 1
out=$(mktemp)
trap 'rm -f "$out"' EXIT INT TERM

pnpm exec vitest --watch=false --silent=passed-only --reporter=minimal >"$out" 2>&1
status=$?

if [ $status -ne 0 ]; then
  head -n 100 "$out"
else
  echo OK
fi
exit $status
