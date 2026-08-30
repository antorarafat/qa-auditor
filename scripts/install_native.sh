#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
prompt() {
  local label="$1" default="${2-}" value
  read -r -p "$label${default:+ [$default]}: " value
  printf '%s' "${value:-$default}"
}
generate_secret() { openssl rand -base64 "$1" | tr -d '\n'; }
existing_env() { sed -n "s/^$1=//p" .env 2>/dev/null | head -n 1; }
command -v node >/dev/null || { echo "Node.js 20 or newer is required." >&2; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0]) < 20) process.exit(1)' || { echo "Node.js 20 or newer is required." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required." >&2; exit 1; }

if [[ ! -f .env ]]; then cp .env.example .env; fi
echo "QA Auditor native Node installer"
echo "For MongoDB on this computer use mongodb://USER:PASSWORD@127.0.0.1:27017/10ms-qaaudit?authSource=admin"
echo "For an external server use mongodb+srv://USER:PASSWORD@cluster.example/10ms-qaaudit (usually with TLS)."
mongo_uri="$(prompt 'MongoDB URI' 'mongodb://localhost:27017/10ms-qaaudit')"
database="$(prompt 'MongoDB database' '10ms-qaaudit')"
port="$(prompt 'Application port' '3423')"
origin="$(prompt 'Public origin (include scheme and port)' "http://localhost:${port}")"
local_ip="$(prompt 'Local/LAN IPv4 (optional, press Enter to skip)' '')"
tailscale_ip="$(prompt 'Tailscale IPv4 (optional, press Enter to skip)' '')"
namespace="$(prompt 'Deployment namespace' 'local-native')"

tmp_env=".env.install.$$"
cp .env "$tmp_env"
trap 'rm -f "$tmp_env"' EXIT
set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$tmp_env"; then
    local escaped
    escaped=$(printf '%s' "$value" | sed 's/[\\&|]/\\&/g')
    sed -i.bak "s|^${key}=.*|${key}=${escaped}|" "$tmp_env" && rm -f "$tmp_env.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$tmp_env"
  fi
}
set_env MONGODB_URI "$mongo_uri"
set_env MONGODB_DATABASE "$database"
set_env PORT "$port"
set_env HOST_PORT "$port"
set_env PUBLIC_ORIGIN "$origin"
origins="$origin,http://localhost:${port},http://127.0.0.1:${port}"
[[ -n "$local_ip" ]] && origins="$origins,http://${local_ip}:${port}"
[[ -n "$tailscale_ip" ]] && origins="$origins,http://${tailscale_ip}:${port}"
set_env PUBLIC_ORIGINS "$origins"
set_env DEPLOYMENT_NAMESPACE "$namespace"
session_secret="$(existing_env SESSION_SECRET)"; [[ -z "$session_secret" || "$session_secret" == replace_* ]] && session_secret="$(generate_secret 48)"
encryption_key="$(existing_env APP_ENCRYPTION_KEY)"; [[ -z "$encryption_key" || "$encryption_key" == replace_* ]] && encryption_key="$(generate_secret 32)"
setup_token="$(existing_env SETUP_TOKEN)"; [[ -z "$setup_token" || "$setup_token" == replace_* ]] && setup_token="$(generate_secret 48)"
set_env SESSION_SECRET "$session_secret"
set_env APP_ENCRYPTION_KEY "$encryption_key"
set_env SETUP_TOKEN "$setup_token"
set_env NODE_ENV production
set_env COOKIE_SECURE false
mv "$tmp_env" .env
chmod 600 .env

npm ci
npm run build
echo
echo "Start the service with: npm start"
echo "Open ${origin}/setup for first-time setup."
echo "Use ./scripts/credential.sh to display the setup token and connection summary."
