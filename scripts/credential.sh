#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
[[ -f .env ]] || { echo "No .env file found. Run an installer first." >&2; exit 1; }
set -a
# shellcheck disable=SC1091
source .env
set +a

mask_uri() {
  printf '%s' "${1-}" | sed -E 's#(mongodb(\+srv)?://[^:/?#]+:)[^@/]+#\1********#'
}
echo "QA Auditor credentials and connection summary"
echo "---------------------------------------------"
echo "Application: ${PUBLIC_ORIGIN:-http://localhost:${HOST_PORT:-${PORT:-3000}}}"
echo "MongoDB URI: $(mask_uri "${MONGODB_URI:-not configured}")"
echo "Database:    ${MONGODB_DATABASE:-not configured}"
echo "Namespace:   ${DEPLOYMENT_NAMESPACE:-not configured}"
echo "Setup token: ${SETUP_TOKEN:-not configured}"
echo ""
echo "Secrets are stored in .env (chmod 600). Never paste this output into a ticket or commit it."
if [[ "${1-}" == "--show-secrets" ]]; then
  echo
  echo "Sensitive values (explicitly requested):"
  echo "SESSION_SECRET=${SESSION_SECRET-}"
  echo "APP_ENCRYPTION_KEY=${APP_ENCRYPTION_KEY-}"
  echo "GEMINI_API_KEY=${GEMINI_API_KEY-}"
  echo "OPENAI_API_KEY=${OPENAI_API_KEY-}"
fi
