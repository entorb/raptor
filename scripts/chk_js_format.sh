#!/bin/sh
set -e
cd "$(dirname "$0")/.."

out=$(mktemp)
trap 'rm -f "$out"' EXIT INT TERM

# check = format + lint
status=0
pnpm exec biome check --write --reporter=concise . >>"$out" 2>&1 || status=$?

if [ $status -ne 0 ]; then
  printf 'Issues remaining, you can try:\npnpm exec biome check --write --unsafe .\n'
  head -n 100 "$out"
else
  echo OK
fi
exit $status
