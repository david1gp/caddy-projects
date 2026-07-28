#!/usr/bin/env bash
# Build and install Caddy with the caddy-oidc plugin via xcaddy.
#
# Stock caddy CANNOT validate configs containing the `oidc` handler.
# access: internal projects require this custom build so `caddy validate`
# and the live server both understand http.handlers.oidc.
#
# Module: github.com/relvacode/caddy-oidc
set -euo pipefail

MODULE="github.com/relvacode/caddy-oidc"
DEFAULT_LOCAL="/home/david/c/adaptive/caddy-oidc"
DEFAULT_OUTPUT="${HOME}/.local/bin/caddy"

OUTPUT="$DEFAULT_OUTPUT"
CADDY_VERSION=""
LOCAL_PATH=""
FORCE_REMOTE=0
FORCE_LOCAL=0

usage() {
	cat <<'EOF'
Usage: caddy_oidc_install.sh [options]

Build Caddy with the caddy-oidc plugin (xcaddy) and install the binary.

Options:
  --output <path>           Install path (default: ~/.local/bin/caddy)
  --caddy-version <vX.Y.Z>  Pin Caddy version passed to xcaddy
  --local <path>            Build against a local checkout of caddy-oidc
  --remote                  Force build from the remote module (ignore local)
  -h, --help                Show this help

If neither --local nor --remote is set and /home/david/c/adaptive/caddy-oidc
exists, that checkout is used automatically; otherwise the remote module is used.
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--output)
			OUTPUT="${2:?--output requires a path}"
			shift 2
			;;
		--caddy-version)
			CADDY_VERSION="${2:?--caddy-version requires a version}"
			shift 2
			;;
		--local)
			FORCE_LOCAL=1
			LOCAL_PATH="${2:?--local requires a path}"
			shift 2
			;;
		--remote)
			FORCE_REMOTE=1
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			usage >&2
			exit 1
			;;
	esac
done

if [[ "$FORCE_LOCAL" -eq 1 && "$FORCE_REMOTE" -eq 1 ]]; then
	echo "Error: --local and --remote are mutually exclusive" >&2
	exit 1
fi

if ! command -v go >/dev/null 2>&1; then
	echo "Error: go is required (xcaddy needs a Go toolchain)." >&2
	echo "Install Go: https://go.dev/doc/install" >&2
	echo "  e.g.  curl -fsSL https://go.dev/dl/go1.26.2.linux-amd64.tar.gz | sudo tar -C /usr/local -xz" >&2
	echo "  then: export PATH=\$PATH:/usr/local/go/bin" >&2
	exit 1
fi

echo "==> go: $(go version)"

export PATH="$(go env GOPATH)/bin:${HOME}/.local/bin:${PATH}"

if ! command -v xcaddy >/dev/null 2>&1; then
	echo "==> installing xcaddy..."
	go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
fi
echo "==> xcaddy: $(command -v xcaddy)"

WITH_ARG="$MODULE"
if [[ "$FORCE_REMOTE" -eq 1 ]]; then
	echo "==> building from remote module: $MODULE"
elif [[ "$FORCE_LOCAL" -eq 1 ]]; then
	[[ -d "$LOCAL_PATH" ]] || { echo "Error: local path not found: $LOCAL_PATH" >&2; exit 1; }
	WITH_ARG="${MODULE}=${LOCAL_PATH}"
	echo "==> building from local checkout: $LOCAL_PATH"
elif [[ -d "$DEFAULT_LOCAL" ]]; then
	WITH_ARG="${MODULE}=${DEFAULT_LOCAL}"
	echo "==> building from local checkout (auto): $DEFAULT_LOCAL"
else
	echo "==> building from remote module: $MODULE"
fi

BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/caddy-oidc-build.XXXXXX")"
cleanup() { rm -rf "$BUILD_DIR"; }
trap cleanup EXIT

XCADDY_ARGS=(build --output "$BUILD_DIR/caddy" --with "$WITH_ARG")
if [[ -n "$CADDY_VERSION" ]]; then
	XCADDY_ARGS+=(--with "github.com/caddyserver/caddy/v2@${CADDY_VERSION}")
	echo "==> caddy version pin: $CADDY_VERSION"
fi

echo "==> xcaddy ${XCADDY_ARGS[*]}"
(
	cd "$BUILD_DIR"
	xcaddy "${XCADDY_ARGS[@]}"
)

echo "==> verifying http.handlers.oidc in binary..."
if ! "$BUILD_DIR/caddy" list-modules | grep -q '^http.handlers.oidc$'; then
	echo "Error: built binary is missing http.handlers.oidc" >&2
	echo "list-modules (oidc-related):" >&2
	"$BUILD_DIR/caddy" list-modules | grep -i oidc || true
	exit 1
fi
echo "==> plugin present: http.handlers.oidc"
"$BUILD_DIR/caddy" version

mkdir -p "$(dirname "$OUTPUT")"
if [[ -e "$OUTPUT" ]]; then
	echo "==> backing up existing binary to ${OUTPUT}.bak"
	cp -a "$OUTPUT" "${OUTPUT}.bak"
fi
install -m 755 "$BUILD_DIR/caddy" "$OUTPUT"
echo "==> installed: $OUTPUT"
"$OUTPUT" version
echo "Done."
