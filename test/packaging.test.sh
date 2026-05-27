#!/bin/sh
set -eu

root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT HUP INT TERM
assets="$root/assets"
payload="$root/payload"
mkdir -p "$assets" "$payload"
printf '#!/bin/sh\nexit 0\n' > "$payload/codex-history"
chmod +x "$payload/codex-history"
cp LICENSE "$payload/LICENSE"
cp packaging/STANDALONE-NOTICE.md "$payload/STANDALONE-NOTICE.md"
printf '%s\n' "Node runtime test notices" > "$payload/NODE-LICENSE"
for arch in x64 arm64; do
  tar -czf "$assets/codex-history-linux-$arch.tar.gz" -C "$payload" \
    codex-history LICENSE STANDALONE-NOTICE.md NODE-LICENSE
done

source_dir="$(
  VERSION=0.1.1 SERIES=noble UBUNTU_VERSION=24.04 ARTIFACT_DIR="$assets" OUTPUT_DIR="$root/out" \
    sh ./scripts/build-ppa-source.sh
)"
test -x "$source_dir/binaries/amd64/codex-history"
test -x "$source_dir/binaries/arm64/codex-history"
grep -q "0.1.1-1ppa1~noble1" "$source_dir/debian/changelog"
grep -q "Node runtime test notices" "$source_dir/runtime-notices/NODE-LICENSE"
test -f "$source_dir/codex-history.1"
test -f "$root/out/codex-history-viewer_0.1.1.orig.tar.gz"
