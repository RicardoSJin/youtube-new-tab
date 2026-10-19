#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"
node scripts/check.cjs
npm test
command -v zip >/dev/null 2>&1 || { printf '%s\n' 'Missing system zip command.' >&2; exit 1; }
version=$(node -p 'require("./extension/manifest.json").version')
mkdir -p dist
runtime="dist/youtube-new-tab-v${version}.zip"
source="dist/youtube-new-tab-source-v${version}.zip"
for file in "$runtime" "$source"; do
  if [ -e "$file" ]; then
    mv "$file" "${file}.previous-$(date +%Y%m%d%H%M%S)-$$"
  fi
done
(cd extension && zip -qr "../$runtime" .)
zip -qr "$source" .gitignore .gitattributes AGENTS.md LICENSE README.md PRIVACY.md package.json package-lock.json package.ps1 package.sh extension scripts tests docs .github
node scripts/checksums.cjs "$runtime" "$source"
