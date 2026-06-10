#!/bin/sh
set -eu

if command -v node >/dev/null 2>&1; then
  exec node ./scripts/open-cook-mcp.mjs
fi

CODEX_NODE="/Users/safe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [ -x "$CODEX_NODE" ]; then
  exec "$CODEX_NODE" ./scripts/open-cook-mcp.mjs
fi

echo "OpenCook MCP requires Node.js 18 or newer on PATH." >&2
exit 127
