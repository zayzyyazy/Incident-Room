#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PB="$ROOT/.playwright-browsers"
TMP="$ROOT/.tmp-pw-dl"
VER="149.0.7827.55"
ARCH="mac-arm64"
GCS="https://storage.googleapis.com/chrome-for-testing-public/$VER/$ARCH"
rm -rf "$TMP"
mkdir -p "$TMP" "$PB/chromium-1228" "$PB/chromium_headless_shell-1228"
curl -L --fail -o "$TMP/chrome-mac-arm64.zip" "$GCS/chrome-mac-arm64.zip"
curl -L --fail -o "$TMP/chrome-headless-shell-mac-arm64.zip" "$GCS/chrome-headless-shell-mac-arm64.zip"
unzip -q "$TMP/chrome-mac-arm64.zip" -d "$PB/chromium-1228"
unzip -q "$TMP/chrome-headless-shell-mac-arm64.zip" -d "$PB/chromium_headless_shell-1228"
rm -rf "$TMP"
xattr -cr "$PB" 2>/dev/null || true
echo "Installed Playwright Chromium to $PB"
