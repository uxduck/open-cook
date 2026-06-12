#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)

if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/open-cook-mcp.mjs"
fi

echo "OpenCook MCP requires Node.js 18 or newer on PATH." >&2
exit 127
