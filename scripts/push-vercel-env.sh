#!/usr/bin/env bash
# Push .env.local (+ required defaults) to Vercel production, preview, and development.
set -eo pipefail
cd "$(dirname "$0")/.."

if ! vercel whoami >/dev/null 2>&1; then
  echo "Not logged in to Vercel. Run: vercel login"
  exit 1
fi

if [[ ! -f .vercel/project.json ]]; then
  vercel link --project mosquepay --yes
fi

# Load .env.local (skip comments)
set -a
# shellcheck disable=SC1091
source <(grep -v '^#' .env.local | grep -v '^$' | sed 's/^export //')
set +a

# Defaults not always in .env.local
ADMIN_ROLE="${ADMIN_ROLE:-super_admin}"
CONTACT_EMAIL="${CONTACT_EMAIL:-ag@experrt.com}"
EMAIL_LOGO_URL="${EMAIL_LOGO_URL:-https://www.mosque-pay.com/brand/mosquepay-email-logo.png}"
MOOOV_API_BASE="${MOOOV_API_BASE:-https://staging.api.mooov.money}"
MOSQUEPAY_GIVING_SUBSCRIPTION_ENABLED="${MOSQUEPAY_GIVING_SUBSCRIPTION_ENABLED:-false}"
PLATFORM_OWNER_PASSWORD="${PLATFORM_OWNER_PASSWORD:-Brandnew4}"

PROD_SITE_URL="https://www.mosque-pay.com"
PROD_MOOV_REDIRECT="${MOOOV_REDIRECT_URI:-https://www.mosque-pay.com/oauth/mooov/callback}"

SENSITIVE_KEYS=(
  OPENAI_API_KEY
  SUPABASE_SERVICE_ROLE_KEY
  RESEND_API_KEY
  SESSION_SECRET
  ADMIN_PASSWORD
  PLATFORM_OWNER_PASSWORD
)

is_sensitive() {
  local key=$1
  for s in "${SENSITIVE_KEYS[@]}"; do
    [[ "$key" == "$s" ]] && return 0
  done
  return 1
}

push_var() {
  local key=$1
  local value=$2
  local env=$3
  if [[ -z "${value}" ]]; then
    echo "  skip $key ($env): empty"
    return 0
  fi
  local args=(env add "$key" "$env" --force --yes)
  if is_sensitive "$key"; then
    args+=(--sensitive)
  fi
  printf '%s' "$value" | vercel "${args[@]}" >/dev/null
  echo "  ✓ $key → $env"
}

ALL_KEYS=(
  ADMIN_EMAIL ADMIN_PASSWORD ADMIN_ROLE
  ALLOW_IN_MEMORY_MOCK
  MOSQUEPAY_GIVING_SUBSCRIPTION_ENABLED
  CONTACT_EMAIL E2E_TEST_EMAIL
  EMAIL_FROM EMAIL_LOGO_URL
  MOOOV_API_BASE MOOOV_CONNECT_BASE MOOOV_CONNECT_MODE
  MOOOV_DEMO_MOSQUE_ID MOOOV_GATEWAY_BASE_URL
  MOOOV_PLATFORM_ID MOOOV_PLATFORM_SLUG MOOOV_REDIRECT_URI
  NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_SUPABASE_URL
  OPENAI_API_KEY PAYMENTS_PROVIDER
  PLATFORM_OWNER_PASSWORD
  RESEND_API_KEY RESEND_FROM_EMAIL
  SESSION_SECRET SUPABASE_SERVICE_ROLE_KEY
)

echo "Pushing environment variables to Vercel (mosquepay)..."

for env in production preview development; do
  echo ""
  echo "== $env =="
  SITE_URL="$PROD_SITE_URL"
  MOCK_FLAG="false"
  MOOOV_URI="$PROD_MOOV_REDIRECT"
  SESSION_VAL="$SESSION_SECRET"

  if [[ "$env" == "development" ]]; then
    SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"
    MOCK_FLAG="${ALLOW_IN_MEMORY_MOCK:-true}"
    MOOOV_URI="${MOOOV_REDIRECT_URI:-$PROD_MOOV_REDIRECT}"
    SESSION_VAL="${SESSION_SECRET:-local-development-session-secret}"
  elif [[ "$env" == "preview" ]]; then
    MOCK_FLAG="false"
    MOOOV_URI="$PROD_MOOV_REDIRECT"
    SESSION_VAL="$(openssl rand -hex 32)"
  elif [[ "$env" == "production" ]]; then
    SESSION_VAL="$(openssl rand -hex 32)"
  fi

  for key in "${ALL_KEYS[@]}"; do
    case "$key" in
      NEXT_PUBLIC_SITE_URL) val="$SITE_URL" ;;
      ALLOW_IN_MEMORY_MOCK) val="$MOCK_FLAG" ;;
      MOOOV_REDIRECT_URI) val="$MOOOV_URI" ;;
      SESSION_SECRET) val="$SESSION_VAL" ;;
      *) val="${!key:-}" ;;
    esac
    push_var "$key" "$val" "$env"
  done
done

echo ""
echo "Done. Run: vercel env ls"
