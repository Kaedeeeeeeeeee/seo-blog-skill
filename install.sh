#!/usr/bin/env bash
# Install seo-blog-skill into ~/.claude/skills/
# Usage: bash install.sh [--symlink]
#
# Default: copy this directory to ~/.claude/skills/seo-blog/
# --symlink: link instead of copy (so updates here are immediately visible)

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$HOME/.claude/skills/seo-blog"

mkdir -p "$HOME/.claude/skills"

if [ -e "$TARGET_DIR" ] || [ -L "$TARGET_DIR" ]; then
  echo "→ Removing existing $TARGET_DIR"
  rm -rf "$TARGET_DIR"
fi

if [ "${1:-}" = "--symlink" ]; then
  ln -s "$SOURCE_DIR" "$TARGET_DIR"
  echo "✓ Symlinked $SOURCE_DIR → $TARGET_DIR"
else
  cp -R "$SOURCE_DIR" "$TARGET_DIR"
  echo "✓ Copied $SOURCE_DIR → $TARGET_DIR"
fi

if [ -f "$SOURCE_DIR/package.json" ]; then
  echo "→ Installing Node dependencies..."
  (cd "$TARGET_DIR" && npm install --omit=dev --silent)
  echo "✓ Dependencies installed"
fi

cat <<EOF

✓ seo-blog-skill installed at $TARGET_DIR

Next steps:
  1. cd into the host project (where you want to author blog posts)
  2. Set DEEPSEEK_API_KEY (or your chosen LLM provider's key) in .env.local
  3. Open Claude Code and ask: "Use the seo-blog skill to set up blog production for this project"

Or invoke scripts directly:
  node $TARGET_DIR/scripts/cli.mjs --help

EOF
