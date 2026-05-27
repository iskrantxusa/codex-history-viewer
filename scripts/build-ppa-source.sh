#!/bin/sh
set -eu

VERSION="${VERSION:?VERSION is required}"
SERIES="${SERIES:?SERIES is required}"
UBUNTU_VERSION="${UBUNTU_VERSION:?UBUNTU_VERSION is required}"
ARTIFACT_DIR="${ARTIFACT_DIR:-dist/ppa-assets}"
OUTPUT_DIR="${OUTPUT_DIR:-dist/ppa/$SERIES}"
MAINTAINER="${MAINTAINER:-iskrantxusa <iskrantxusa@users.noreply.github.com>}"

case "$VERSION" in v*) VERSION="${VERSION#v}" ;; esac
case "$SERIES" in noble|resolute) ;; *) printf '%s\n' "Unsupported Ubuntu series: $SERIES" >&2; exit 1 ;; esac

DEBIAN_VERSION="$VERSION-1ppa1~${SERIES}1"
SOURCE_DIR="$OUTPUT_DIR/codex-history-viewer-$VERSION"
ORIG_TARBALL="$OUTPUT_DIR/codex-history-viewer_$VERSION.orig.tar.gz"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

rm -rf "$OUTPUT_DIR"
mkdir -p "$SOURCE_DIR/binaries/amd64" "$SOURCE_DIR/binaries/arm64" "$SOURCE_DIR/runtime-notices"

for pair in "x64 amd64" "arm64 arm64"; do
  set -- $pair
  archive="$ARTIFACT_DIR/codex-history-linux-$1.tar.gz"
  test -f "$archive" || { printf '%s\n' "Missing artifact: $archive" >&2; exit 1; }
  unpacked="$tmp/$1"
  mkdir -p "$unpacked"
  tar -xzf "$archive" -C "$unpacked"
  install -m 0755 "$unpacked/codex-history" "$SOURCE_DIR/binaries/$2/codex-history"
  if [ ! -f "$SOURCE_DIR/runtime-notices/NODE-LICENSE" ]; then
    install -m 0644 "$unpacked/NODE-LICENSE" "$SOURCE_DIR/runtime-notices/NODE-LICENSE"
    install -m 0644 "$unpacked/STANDALONE-NOTICE.md" "$SOURCE_DIR/runtime-notices/STANDALONE-NOTICE.md"
  else
    cmp "$SOURCE_DIR/runtime-notices/NODE-LICENSE" "$unpacked/NODE-LICENSE"
    cmp "$SOURCE_DIR/runtime-notices/STANDALONE-NOTICE.md" "$unpacked/STANDALONE-NOTICE.md"
  fi
done

install -m 0644 LICENSE "$SOURCE_DIR/LICENSE"
install -m 0644 packaging/codex-history.1 "$SOURCE_DIR/codex-history.1"
cp -a packaging/debian "$SOURCE_DIR/debian"
cat > "$SOURCE_DIR/debian/changelog" <<EOF
codex-history-viewer ($DEBIAN_VERSION) $SERIES; urgency=medium

  * Package the upstream standalone Linux release for Ubuntu $UBUNTU_VERSION.
  * Include license notices for the embedded Node.js runtime.

 -- $MAINTAINER  $(date -R)
EOF
mkdir -p "$OUTPUT_DIR"
tar -czf "$ORIG_TARBALL" -C "$OUTPUT_DIR" --exclude="codex-history-viewer-$VERSION/debian" "codex-history-viewer-$VERSION"
printf '%s\n' "$SOURCE_DIR"
