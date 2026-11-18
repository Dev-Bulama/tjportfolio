#!/usr/bin/env bash
# Builds a clean ZIP for Hostinger's "upload ZIP" deployment route:
# source + migrations only — no node_modules, dist, built assets, .env, uploads or test output.
set -euo pipefail
cd "$(dirname "$0")/.."

name="tj-portfolio-$(date +%Y%m%d-%H%M).zip"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "⚠  You have uncommitted changes; the ZIP contains the last commit only (HEAD)." >&2
  fi
  git archive --format=zip --output="$name" HEAD
else
  zip -rq "$name" . \
    -x "node_modules/*" "dist/*" "public/assets/*" "public/fonts/*" ".env" ".env.*" "storage/*" \
       "coverage/*" "playwright-report/*" "test-results/*" "*.zip" ".git/*"
fi

echo "Created $name ($(du -h "$name" | cut -f1))"
echo "Upload it in hPanel → your Node.js app → Deployments → Upload ZIP. Build: npm run build · Start: npm start"
