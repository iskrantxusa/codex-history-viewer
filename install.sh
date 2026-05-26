#!/bin/sh
set -eu

REPOSITORY="${REPOSITORY:-iskrantxusa/codex-history-viewer}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${VERSION:-}"

case "$(uname -m)" in
  x86_64|amd64) arch="x64" ;;
  aarch64|arm64) arch="arm64" ;;
  *)
    printf '%s\n' "Unsupported Linux architecture: $(uname -m). Supported: x86_64, arm64." >&2
    exit 1
    ;;
esac
if [ "$(uname -s)" != "Linux" ]; then
  printf '%s\n' "Unsupported operating system: $(uname -s). This installer supports Linux only." >&2
  exit 1
fi

asset="codex-history-linux-${arch}.tar.gz"
if [ -n "${RELEASE_BASE_URL:-}" ]; then
  base_url="${RELEASE_BASE_URL%/}"
elif [ -n "$VERSION" ]; then
  case "$VERSION" in v*) ;; *) VERSION="v$VERSION" ;; esac
  base_url="https://github.com/${REPOSITORY}/releases/download/${VERSION}"
else
  base_url="https://github.com/${REPOSITORY}/releases/latest/download"
fi

command -v curl >/dev/null 2>&1 || {
  printf '%s\n' "curl is required to install codex-history." >&2
  exit 1
}
command -v sha256sum >/dev/null 2>&1 || {
  printf '%s\n' "sha256sum is required to verify codex-history releases." >&2
  exit 1
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
curl -fsSL -o "$tmp/$asset" "$base_url/$asset"
curl -fsSL -o "$tmp/SHA256SUMS" "$base_url/SHA256SUMS"
(
  cd "$tmp"
  grep "  $asset\$" SHA256SUMS > SHA256SUMS.selected || {
    printf '%s\n' "Checksum for $asset is missing from SHA256SUMS." >&2
    exit 1
  }
  sha256sum -c SHA256SUMS.selected
)
tar -xzf "$tmp/$asset" -C "$tmp" "codex-history"
mkdir -p "$INSTALL_DIR"
install -m 0755 "$tmp/codex-history" "$INSTALL_DIR/codex-history"

printf '%s\n' "Installed codex-history to $INSTALL_DIR/codex-history"
case ":${PATH:-}:" in
  *":$INSTALL_DIR:"*) ;;
  *) printf '%s\n' "Add $INSTALL_DIR to PATH to run codex-history." ;;
esac
