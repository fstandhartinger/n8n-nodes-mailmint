#!/usr/bin/env bash
# Off-camera setup for the demo recording: a clean n8n 2.36.7 with an owner
# account and an OpenAI credential, and no community node installed.
#
#   OPENAI_API_KEY=… ./setup.sh
set -euo pipefail

PORT="${PORT:-5680}"
NAME="${NAME:-n8n-mm-demo}"
BASE="http://127.0.0.1:${PORT}"
EMAIL='demo@mailmint.dev'
PASS='MailMintDemo2026'
JAR="$(mktemp)"

sudo -n docker rm -f "$NAME" >/dev/null 2>&1 || true
sudo -n docker run -d --name "$NAME" -p "${PORT}:5678" \
  -e N8N_ENCRYPTION_KEY=mailmint-demo-key \
  -e N8N_SECURE_COOKIE=false \
  -e N8N_DIAGNOSTICS_ENABLED=false \
  -e N8N_RUNNERS_ENABLED=true \
  -e N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true \
  -e N8N_HIRING_BANNER_ENABLED=false \
  -e WEBHOOK_URL="http://localhost:${PORT}/" \
  -e N8N_EDITOR_BASE_URL="http://localhost:${PORT}/" \
  n8nio/n8n:2.36.7 >/dev/null

until curl -s -m 5 "${BASE}/rest/settings" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null; do sleep 3; done

curl -s -m 30 -X POST "${BASE}/rest/owner/setup" -H 'content-type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"firstName\":\"Mail\",\"lastName\":\"Mint\",\"password\":\"${PASS}\"}" \
  -c "$JAR" -o /dev/null -w 'owner setup: %{http_code}\n'

if [ -n "${OPENAI_API_KEY:-}" ]; then
  curl -s -m 30 -X POST "${BASE}/rest/credentials" -b "$JAR" -H 'content-type: application/json' \
    -d "{\"name\":\"OpenAi account\",\"type\":\"openAiApi\",\"data\":{\"apiKey\":\"${OPENAI_API_KEY}\"}}" \
    -o /dev/null -w 'openai credential: %{http_code}\n'
else
  echo 'no OPENAI_API_KEY: the AI-agent stage will fail'
fi

# n8n caches the frontend settings payload, so after a REST-only owner setup the
# SPA still renders "Set up owner account" and every later click misses. A
# restart rebuilds that cache; without it the recording starts on the wrong page.
sudo -n docker restart "$NAME" >/dev/null
# /rest/login answers before the settings payload is rebuilt, so waiting on it
# is not waiting for a usable n8n. Wait for settings to parse.
until curl -s -m 5 "${BASE}/rest/settings" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null; do sleep 3; done
curl -s -m 15 "${BASE}/rest/settings" \
  | python3 -c "import json,sys;print('showSetupOnFirstLoad:', json.load(sys.stdin)['data']['userManagement']['showSetupOnFirstLoad'])"

rm -f "$JAR"
rm -rf /tmp/mmdemo/raw /tmp/mmdemo/shots
echo "ready at ${BASE}"
