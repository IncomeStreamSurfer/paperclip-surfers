#!/bin/sh
set -e
# Proxy localhost:3000 → twenty-server-1:3000 so the twenty-crm MCP server
# (configured with TWENTY_BASE_URL=http://localhost:3000) reaches the Twenty
# CRM container without requiring changes to .claude.json
if getent hosts twenty-server-1 >/dev/null 2>&1; then
  socat TCP4-LISTEN:3000,fork,reuseaddr TCP4:twenty-server-1:3000 &
fi
exec "$@"
