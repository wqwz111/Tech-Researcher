#!/bin/bash
# Usage: ./push-report.sh <report-file.html> ["commit message"]
# Example: ./push-report.sh reports/2026-03-14-claude4-analysis.html

set -e

REPORT="$1"
MSG="${2:-📊 Report: $(basename "$REPORT" .html)}"

if [ -z "$REPORT" ]; then
  echo "Usage: $0 <report-file.html> [commit message]"
  exit 1
fi

cd "$(dirname "$0")"

git add -A
git commit -m "$MSG"
git push origin master

echo "✅ Pushed! Report will be live at:"
echo "https://wqwz111.github.io/Tech-Researcher/${REPORT}"
