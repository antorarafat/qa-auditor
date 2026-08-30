#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

prompt() {
  local label="$1" default="${2-}" value
  if [[ -n "$default" ]]; then
    read -r -p "$label [$default]: " value
    printf '%s' "${value:-$default}"
  else
    read -r -p "$label: " value
    printf '%s' "$value"
  fi
}
prompt_secret() {
  local label="$1" value
  read -r -s -p "$label: " value
  printf '\n' >&2
  printf '%s' "$value"
}
generate_secret() { openssl rand -base64 "$1" | tr -d '\n'; }
existing_env() { sed -n "s/^$1=//p" .env 2>/dev/null | head -n 1; }

command -v docker >/dev/null || { echo "Docker is required. Install Docker Desktop or Docker Engine first." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required (docker compose)." >&2; exit 1; }

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

echo "QA Auditor Docker installer"
echo "MongoDB examples:"
echo "  Local on host: mongodb://USER:PASSWORD@host.docker.internal:27017/10ms-qaaudit?authSource=admin"
echo "  External/TLS:  mongodb+srv://USER:PASSWORD@cluster.example/10ms-qaaudit"
echo "The Compose file includes host.docker.internal:host-gateway so a host MongoDB is reachable on Linux."

mongo_uri="$(prompt 'MongoDB URI' 'mongodb://host.docker.internal:27017/10ms-qaaudit')"
database="$(prompt 'MongoDB database' '10ms-qaaudit')"
host_port="$(prompt 'Host port' '3423')"
origin="$(prompt 'Public origin (include scheme and port)' "http://localhost:${host_port}")"
local_ip="$(prompt 'Local/LAN IPv4 (optional, press Enter to skip)' '')"
tailscale_ip="$(prompt 'Tailscale IPv4 (optional, press Enter to skip)' '')"
namespace="$(prompt 'Deployment namespace' 'local')"
setup_token="$(existing_env SETUP_TOKEN)"; [[ -z "$setup_token" || "$setup_token" == replace_* ]] && setup_token="$(generate_secret 48)"
session_secret="$(existing_env SESSION_SECRET)"; [[ -z "$session_secret" || "$session_secret" == replace_* ]] && session_secret="$(generate_secret 48)"
encryption_key="$(existing_env APP_ENCRYPTION_KEY)"; [[ -z "$encryption_key" || "$encryption_key" == replace_* ]] && encryption_key="$(generate_secret 32)"

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
set_env HOST_PORT "$host_port"
set_env PUBLIC_ORIGIN "$origin"
origins="$origin,http://localhost:${host_port},http://127.0.0.1:${host_port}"
[[ -n "$local_ip" ]] && origins="$origins,http://${local_ip}:${host_port}"
[[ -n "$tailscale_ip" ]] && origins="$origins,http://${tailscale_ip}:${host_port}"
set_env PUBLIC_ORIGINS "$origins"
set_env DEPLOYMENT_NAMESPACE "$namespace"
set_env SESSION_SECRET "$session_secret"
set_env APP_ENCRYPTION_KEY "$encryption_key"
set_env SETUP_TOKEN "$setup_token"
set_env PORT 3000
set_env NODE_ENV production
set_env COOKIE_SECURE false
mv "$tmp_env" .env
chmod 600 .env

docker compose up -d --build
echo
echo "QA Auditor is running at: ${origin}"
echo "Open ${origin}/setup to create the first administrator."
echo "SETUP_TOKEN (also available via ./scripts/credential.sh): ${setup_token}"
