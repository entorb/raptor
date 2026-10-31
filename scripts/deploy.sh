#!/bin/sh
set -e
cd "$(dirname "$0")/.."

# cleanup
rm -f .DS_Store
rm -f -- ./*/.DS_Store

echo "## Checks"
echo "### Code checks"
./scripts/run_checks.sh
./scripts/run_spelling.sh

echo "## Frontend Build and Transfer"
pnpm run build
rsync -rhv --delete --no-perms dist/ entorb8@mab.uberspace.de:html/raptor/

echo "## DONE"
