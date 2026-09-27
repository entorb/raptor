#!/bin/sh
SCRIPT_DIR="$(dirname "$0")"
cd "$SCRIPT_DIR/.."

# exit upon error
set -e

echo "## Node and PNPM Versions"
# use the versions provided by the system, never install them here (brew upgrade is done in korrekturleser only)
NODE_VER=$(node --version | sed 's/v//')
# query outside of the repo, inside pnpm reports the version pinned in package.json
PNPM_VER=$(cd / && pnpm --version)
PNPM_MANAGER="pnpm@$PNPM_VER"
printf '%s\n' "${NODE_VER%%.*}" >.nvmrc
node -e "
  const pkg = JSON.parse(require('fs').readFileSync('package.json','utf8'));
  pkg.packageManager = '$PNPM_MANAGER';
  pkg.engines ??= {};
  pkg.engines.node = '>=$NODE_VER';
  pkg.engines.pnpm = '>=$PNPM_VER';
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo "## Node"
echo "### delete old node_modules and lock"
rm -rf node_modules
rm -f pnpm-lock.yaml

echo "### Node packages"
pnpm up --latest
pnpm exec biome migrate --write
# npm i baseline-browser-mapping@latest -D
# npx update-browserslist-db@latest

echo "### Node package audit"
./scripts/chk_js_package_audit.sh

echo "## Code checks"
echo "### Prek autoupdate"
prek autoupdate

echo "### run_checks.sh"
./scripts/run_checks.sh

echo "## Git"

if [ -n "$(git status --porcelain)" ]; then
  echo "## git push"
  git add pnpm-lock.yaml
  git diff --staged --quiet -- pnpm-lock.yaml || git commit -m "chore(deps): Lock"

  git add package.json pnpm-workspace.yaml biome.json .pre-commit-config.yaml .nvmrc
  git commit -m "chore(deps): Package update" || true
  git push
fi

echo "update DONE, not yet deployed"
