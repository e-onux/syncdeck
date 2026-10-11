#!/usr/bin/env bash
# Puts Rclone.xcframework into mobile/ios/Frameworks.
#
#   scripts/fetch-engine.sh            download the engine-v<version> release
#   scripts/fetch-engine.sh --build    build it locally with gomobile instead
#
# <version> comes from app/rclone.version, so the phone app links the same
# rclone release the desktop app bundles. The release is produced by
# .github/workflows/rclone-mobile.yml; a download is checked against the
# .sha256 published next to it.
set -euo pipefail

IOS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$IOS_DIR/../.." && pwd)"
VERSION="$(tr -d '[:space:]' < "$REPO_DIR/app/rclone.version")"
DEST="$IOS_DIR/Frameworks"
MODE="${1:-download}"

mkdir -p "$DEST"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

build_locally() {
  command -v go >/dev/null || { echo "go is required for --build" >&2; exit 1; }
  export PATH="$(go env GOPATH)/bin:$PATH"
  command -v gomobile >/dev/null || go install golang.org/x/mobile/cmd/gomobile@latest
  command -v gobind >/dev/null || go install golang.org/x/mobile/cmd/gobind@latest
  cp -R "$REPO_DIR/mobile/engine" "$WORK/engine"
  (
    cd "$WORK/engine"
    go get "github.com/rclone/rclone@v$VERSION"
    go mod tidy
    go get golang.org/x/mobile/bind
    gomobile init
    gomobile bind -ldflags="-s -w" -target=ios,iossimulator -o Rclone.xcframework .
  )
  rm -rf "$DEST/Rclone.xcframework"
  mv "$WORK/engine/Rclone.xcframework" "$DEST/"
}

download() {
  local base="https://github.com/e-onux/syncdeck/releases/download/engine-v$VERSION"
  echo "Downloading rclone mobile engine v$VERSION"
  curl -fL --retry 5 -C - -o "$WORK/Rclone.xcframework.zip" "$base/Rclone.xcframework.zip"
  curl -fsSL -o "$WORK/expected.sha256" "$base/Rclone.xcframework.zip.sha256"
  local expected actual
  expected="$(tr -d '[:space:]' < "$WORK/expected.sha256")"
  actual="$(shasum -a 256 "$WORK/Rclone.xcframework.zip" | awk '{print $1}')"
  if [[ "$expected" != "$actual" ]]; then
    echo "checksum mismatch: expected $expected, got $actual" >&2
    exit 1
  fi
  rm -rf "$DEST/Rclone.xcframework"
  unzip -q "$WORK/Rclone.xcframework.zip" -d "$DEST"
}

case "$MODE" in
  --build) build_locally ;;
  download) download ;;
  *) echo "usage: $0 [--build]" >&2; exit 2 ;;
esac

echo "$VERSION" > "$DEST/Rclone.version"
echo "Rclone.xcframework (rclone v$VERSION) is in $DEST"
