#!/bin/sh
set -eu

root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT HUP INT TERM
release="$root/release"
bin="$root/source/codex-history"
target="$root/bin"
case "$(uname -m)" in
  x86_64|amd64) arch="x64" ;;
  aarch64|arm64) arch="arm64" ;;
  *) printf '%s\n' "Unsupported test architecture." >&2; exit 1 ;;
esac
mkdir -p "$release" "$(dirname "$bin")"
printf '#!/bin/sh\nprintf "installed smoke\\n"\n' > "$bin"
chmod +x "$bin"
tar -czf "$release/codex-history-linux-$arch.tar.gz" -C "$(dirname "$bin")" codex-history
(cd "$release" && sha256sum "codex-history-linux-$arch.tar.gz" > SHA256SUMS)

PATH="/usr/bin:/bin" RELEASE_BASE_URL="file://$release" INSTALL_DIR="$target" \
  sh ./install.sh >/dev/null
test -x "$target/codex-history"
test "$("$target/codex-history")" = "installed smoke"

(cd "$release" && sha256sum "./codex-history-linux-$arch.tar.gz" > SHA256SUMS)
PATH="/usr/bin:/bin" RELEASE_BASE_URL="file://$release" INSTALL_DIR="$root/prefixed" \
  sh ./install.sh >/dev/null
test "$("$root/prefixed/codex-history")" = "installed smoke"

printf '%s\n' "invalid" > "$release/codex-history-linux-$arch.tar.gz"
if PATH="/usr/bin:/bin" RELEASE_BASE_URL="file://$release" INSTALL_DIR="$root/bad" \
  sh ./install.sh >/dev/null 2>&1; then
  printf '%s\n' "Expected checksum mismatch to fail." >&2
  exit 1
fi
