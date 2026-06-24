#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$ROOT/.playwright-browsers}"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
cd "$ROOT"
npx playwright install chromium
xattr -cr "$PLAYWRIGHT_BROWSERS_PATH" 2>/dev/null || true
echo "Installed Playwright Chromium to $PLAYWRIGHT_BROWSERS_PATH"
