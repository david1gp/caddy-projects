#!/usr/bin/env bash
# Provision Zitadel confidential OIDC client for caddy-projects on leo-server.
# Safe to re-run; credentials preserved; redirect URIs updated in place.
#
# Redirect URIs sourced from leo-server Caddyfile sites that `import oidc_auth`:
# hermes, neo, blue, wiki, leonardomora.de, www.leonardomora.de
# (see /home/david/Coding/leo_internal/leo-server/caddy_config/Caddyfile).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEO_SERVER_DIR="${LEO_SERVER_DIR:-$HOME/Coding/leo_internal/leo-server}"
ZITADEL_ENV="${ZITADEL_ENV:-$LEO_SERVER_DIR/../contentoren-server/zitadel/podman/zitadel.env}"
ENV_FILE="${LEO_SERVER_OIDC_ENV_FILE:-$LEO_SERVER_DIR/caddy_config/caddy-projects.oidc.env}"
API="https://auth.contentoren.de"
ORG_NAME="Contentoren"
PROJECT_NAME="caddy-projects"
APP_NAME="caddy-projects leo-server"
DRY_RUN=0

REDIRECT_URIS=(
	"https://leonardomora.de/oauth2/callback"
	"https://www.leonardomora.de/oauth2/callback"
	"https://hermes.leonardomora.de/oauth2/callback"
	"https://neo.leonardomora.de/oauth2/callback"
	"https://blue.leonardomora.de/oauth2/callback"
	"https://wiki.leonardomora.de/oauth2/callback"
)
POST_LOGOUT_URIS=(
	"https://leonardomora.de/"
	"https://www.leonardomora.de/"
	"https://hermes.leonardomora.de/"
	"https://neo.leonardomora.de/"
	"https://blue.leonardomora.de/"
	"https://wiki.leonardomora.de/"
)

usage() {
	cat <<'EOF'
Usage: provision_leo_server_oidc.sh [options]

Provision a Zitadel OIDC client for caddy-projects on leo-server.

Options:
  --dry-run   Print redirect URIs and planned API calls; touch nothing
  -h, --help  Show this help

Env overrides:
  ZITADEL_ENV                 path to zitadel.env (IDP_ADMIN_PAT)
  LEO_SERVER_OIDC_ENV_FILE    output env file path
  LEO_SERVER_DIR              leo-server repo root
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--dry-run) DRY_RUN=1; shift ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
	esac
done

if [[ "$DRY_RUN" -eq 1 ]]; then
	echo "[dry-run] API=$API org=$ORG_NAME project=$PROJECT_NAME app=$APP_NAME"
	echo "[dry-run] ZITADEL_ENV=$ZITADEL_ENV"
	echo "[dry-run] ENV_FILE=$ENV_FILE"
	echo "[dry-run] redirect URIs:"
	printf '  %s\n' "${REDIRECT_URIS[@]}"
	echo "[dry-run] post-logout URIs:"
	printf '  %s\n' "${POST_LOGOUT_URIS[@]}"
	echo "[dry-run] would: search/create project, create/update OIDC app, write env (chmod 600)"
	echo "[dry-run] would set: CADDY_PROJECTS_OIDC_{ISSUER,CLIENT_ID,CLIENT_SECRET,COOKIE_SECRET,PROVIDER}"
	exit 0
fi

[[ -f "$ZITADEL_ENV" ]] || { echo "Missing Zitadel environment: $ZITADEL_ENV" >&2; exit 1; }
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

IDP_ADMIN_PAT="$(sed -n 's/^IDP_ADMIN_PAT=//p' "$ZITADEL_ENV")"
: "${IDP_ADMIN_PAT:?IDP_ADMIN_PAT is missing in $ZITADEL_ENV}"

api() {
	local method="$1" path="$2" body="${3:-}"
	local args=(-sS -X "$method" -H "Authorization: Bearer $IDP_ADMIN_PAT" -H 'Content-Type: application/json' -H "x-zitadel-orgid: $ORG_ID")
	[[ -n "$body" ]] && args+=(--data "$body")
	curl "${args[@]}" "$API$path"
}
json() { python3 -c "import json,sys; print($1)"; }
env_get() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1; }
env_set() {
	python3 - "$ENV_FILE" "$1" "$2" <<'PY'
import sys
path, key, value = sys.argv[1:]
lines = open(path).read().splitlines()
out, found = [], False
for line in lines:
    if line.startswith(key + '='):
        out.append(f'{key}={value}')
        found = True
    else:
        out.append(line)
if not found:
    out.append(f'{key}={value}')
open(path, 'w').write('\n'.join(out) + '\n')
PY
}
oidc_body() {
	python3 - "$APP_NAME" "${REDIRECT_URIS[@]}" -- "${POST_LOGOUT_URIS[@]}" <<'PY'
import json, sys
args = sys.argv[1:]
sep = args.index('--')
name = args[0]
redirects = args[1:sep]
logouts = args[sep + 1:]
print(json.dumps({
  'name': name,
  'redirectUris': redirects,
  'postLogoutRedirectUris': logouts,
  'responseTypes': ['OIDC_RESPONSE_TYPE_CODE'],
  'grantTypes': [
    'OIDC_GRANT_TYPE_AUTHORIZATION_CODE',
    'OIDC_GRANT_TYPE_REFRESH_TOKEN',
  ],
  'appType': 'OIDC_APP_TYPE_WEB',
  'authMethodType': 'OIDC_AUTH_METHOD_TYPE_BASIC',
  'version': 'OIDC_VERSION_1_0',
  'accessTokenType': 'OIDC_TOKEN_TYPE_BEARER',
  'devMode': False,
}))
PY
}

ORG_ID="$(curl -fsS -X POST "$API/admin/v1/orgs/_search" -H "Authorization: Bearer $IDP_ADMIN_PAT" -H 'Content-Type: application/json' --data '{}' | ORG="$ORG_NAME" python3 -c "import json,os,sys; d=json.load(sys.stdin); print(next((o['id'] for o in d.get('result', []) if o.get('name') == os.environ['ORG']), ''))")"
[[ -n "$ORG_ID" ]] || { echo "Zitadel organization not found: $ORG_NAME" >&2; exit 1; }

PROJECT_ID="$(api POST /management/v1/projects/_search '{}' | NAME="$PROJECT_NAME" python3 -c "import json,os,sys; d=json.load(sys.stdin); print(next((p['id'] for p in d.get('result', []) if p.get('name') == os.environ['NAME']), ''))")"
if [[ -z "$PROJECT_ID" ]]; then
	PROJECT_ID="$(api POST /management/v1/projects "{\"name\":\"$PROJECT_NAME\"}" | json "json.load(sys.stdin).get('id', '')")"
	[[ -n "$PROJECT_ID" ]] || { echo "Could not create Zitadel project: $PROJECT_NAME" >&2; exit 1; }
	echo "Created project $PROJECT_NAME ($PROJECT_ID)"
else
	echo "Project $PROJECT_NAME exists ($PROJECT_ID)"
fi

apps="$(api POST "/management/v1/projects/$PROJECT_ID/apps/_search" '{}')"
APP_ID="$(printf '%s' "$apps" | NAME="$APP_NAME" python3 -c "import json,os,sys; d=json.load(sys.stdin); print(next((a['id'] for a in d.get('result', []) if a.get('name') == os.environ['NAME']), ''))")"
if [[ -z "$APP_ID" ]]; then
	created="$(api POST "/management/v1/projects/$PROJECT_ID/apps/oidc" "$(oidc_body)")"
	CLIENT_ID="$(printf '%s' "$created" | json "json.load(sys.stdin).get('clientId', '')")"
	CLIENT_SECRET="$(printf '%s' "$created" | json "json.load(sys.stdin).get('clientSecret', '')")"
	[[ -n "$CLIENT_ID" && -n "$CLIENT_SECRET" ]] || { echo "Could not create Zitadel OIDC application: $created" >&2; exit 1; }
	echo "Created app $APP_NAME (clientId $CLIENT_ID)"
else
	CLIENT_ID="$(printf '%s' "$apps" | NAME="$APP_NAME" python3 -c "import json,os,sys; d=json.load(sys.stdin); print(next((a.get('oidcConfig', {}).get('clientId', '') for a in d.get('result', []) if a.get('name') == os.environ['NAME']), ''))")"
	updated="$(api PUT "/management/v1/projects/$PROJECT_ID/apps/$APP_ID/oidc_config" "$(oidc_body)")"
	printf '%s' "$updated" | python3 -c "import json,sys; d=json.load(sys.stdin); message=str(d.get('message', '')); sys.exit(0 if not any(k in d for k in ('code', 'error', 'errors')) or message.startswith('No changes') else 1)" || {
		echo "Could not update OIDC app: $updated" >&2
		exit 1
	}
	CLIENT_SECRET="$(env_get CADDY_PROJECTS_OIDC_CLIENT_SECRET)"
	if [[ -z "$CLIENT_SECRET" ]]; then
		CLIENT_SECRET="$(api POST "/management/v1/projects/$PROJECT_ID/apps/$APP_ID/oidc_config/_generate_client_secret" '{}' | json "json.load(sys.stdin).get('clientSecret', '')")"
	fi
	[[ -n "$CLIENT_ID" && -n "$CLIENT_SECRET" ]] || { echo "Could not recover OIDC credentials" >&2; exit 1; }
	echo "Updated app $APP_NAME (clientId $CLIENT_ID)"
fi

COOKIE_SECRET="$(env_get CADDY_PROJECTS_OIDC_COOKIE_SECRET)"
[[ -n "$COOKIE_SECRET" ]] || COOKIE_SECRET="$(env_get COOKIE_SECRET)"
[[ -n "$COOKIE_SECRET" ]] || COOKIE_SECRET="$(openssl rand -hex 32)"
env_set CADDY_PROJECTS_OIDC_ISSUER "$API"
env_set CADDY_PROJECTS_OIDC_CLIENT_ID "$CLIENT_ID"
env_set CADDY_PROJECTS_OIDC_CLIENT_SECRET "$CLIENT_SECRET"
env_set CADDY_PROJECTS_OIDC_COOKIE_SECRET "$COOKIE_SECRET"
env_set CADDY_PROJECTS_OIDC_PROVIDER "zitadel"
chmod 600 "$ENV_FILE"

echo "---"
echo "Provisioned Zitadel OIDC client for caddy-projects leo-server"
echo "  env file:  $ENV_FILE"
echo "  client id: $CLIENT_ID"
echo "  redirects: ${#REDIRECT_URIS[@]}"
echo "Point the daemon at it: set -a; source $ENV_FILE; set +a"
