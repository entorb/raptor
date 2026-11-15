#!/bin/sh
set -e
cd "$(dirname "$0")/.."

echo "## Node"
echo "### delete old node_modules and lock"
rm -rf node_modules
rm -f pnpm-lock.yaml

echo "### Node packages"
pnpm up --recursive --latest
pnpm exec biome migrate --write
# ensure biome.json is formatted after migration
pnpm biome format --write biome.json

echo "### Node package audit"
./scripts/chk_js_package_audit.sh

echo "## Code checks"
echo "### Prek update"
prek update --cooldown-days 7

echo "### run_checks.sh"
./scripts/run_checks.sh

echo "## Git"
if [ -n "$(git status --porcelain)" ]; then
  echo "### git push"
  FILES="pnpm-lock.yaml package.json pnpm-workspace.yaml biome.json .pre-commit-config.yaml"
  # shellcheck disable=SC2086
  git add $FILES
  # shellcheck disable=SC2086
  git diff --staged --quiet || git commit -m "chore(deps): Package update" -- $FILES
  git push
fi

echo "update DONE, not yet deployed"
