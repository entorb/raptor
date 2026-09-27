#!/bin/sh
# Download SonarCloud open issues as JSON.

set -e
cd "$(dirname "$0")/.." || exit 1

api=https://sonarcloud.io/api/issues/search
component=$(sed -n 's/^sonar\.projectKey=//p' .sonarcloud.properties 2>/dev/null || true)
if [ -z "$component" ]; then
  component=$(sed -n 's/^sonar\.projectKey=//p' sonar-project.properties 2>/dev/null || true)
fi
component=${component:-entorb_korrekturleser}

mkdir -p tmp
out=tmp/sonar.json

curl -sS \
  "$api?componentKeys=$component&resolved=false" >"$out"

# Reduce to the fields an AI needs to fix each finding (file/line/message/flows).
jq '{
  total,
  issues: [ .issues[] | {
    file: (.component | sub("^[^:]*:"; "")),
    line: .textRange.startLine,
    startOffset: .textRange.startOffset,
    endOffset: .textRange.endOffset,
    rule, severity, type, message
  } ]
}' "$out" >"$out.tmp" && mv "$out.tmp" "$out"

echo "Wrote $out ($(jq '.issues | length' "$out") issues, SonarQube total $(jq -r '.total' "$out"))."
