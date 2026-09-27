#!/bin/sh

cd "$(dirname "$0")/.." || exit 1
out=$(mktemp)
trap 'rm -f "$out"' EXIT INT TERM

# check = format + lint
pnpm exec biome check --write --reporter=concise . >>"$out" 2>&1
status=$?

if [ $status -ne 0 ]; then
  echo "Issues remaining, you can try:\npnpm exec biome check --write --unsafe ."
  head -n 100 "$out"
else
  echo OK
fi
exit $status
