#!/bin/sh
cd "$(dirname "$0")/.." || exit 1

# exit upon error
set -e

# cleanup
rm -f .DS_Store
rm -f -- ./*/.DS_Store

echo "## Checks"
echo "### Code checks"
./scripts/run_checks.sh
./scripts/run_spelling.sh

echo "## Frontend Build and Transfer"
pnpm run build
rsync -rhv --delete --no-perms dist/ entorb@entorb.net:html/raptor/

echo "## DONE"
