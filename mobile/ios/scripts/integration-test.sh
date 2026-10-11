#!/usr/bin/env bash
# Runs the iOS test suite, including EngineIntegrationTests, against throwaway
# WebDAV and SFTP servers started on 127.0.0.1 by the host's rclone.
#
#   scripts/integration-test.sh [simulator-udid-or-name]
#
# Needs: Xcode, rclone on PATH, and Frameworks/Rclone.xcframework (run
# scripts/fetch-engine.sh first).
set -euo pipefail

cd "$(dirname "$0")/.."
DEVICE="${1:-iPhone 16 Pro}"
WORK="$(mktemp -d)"
PASS="$(openssl rand -hex 12)"
DAV_PORT=18080
SFTP_PORT=12022

cleanup() {
  kill "${DAV_PID:-}" "${SFTP_PID:-}" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$WORK/webdav" "$WORK/sftp"
rclone serve webdav "$WORK/webdav" --addr "127.0.0.1:$DAV_PORT" --user syncdeck --pass "$PASS" --config /dev/null >"$WORK/webdav.log" 2>&1 &
DAV_PID=$!
rclone serve sftp "$WORK/sftp" --addr "127.0.0.1:$SFTP_PORT" --user syncdeck --pass "$PASS" --config /dev/null >"$WORK/sftp.log" 2>&1 &
SFTP_PID=$!
sleep 2

if [[ "$DEVICE" =~ ^[0-9A-F-]{36}$ ]]; then DEST="id=$DEVICE"; else DEST="platform=iOS Simulator,name=$DEVICE"; fi

# xcodebuild forwards TEST_RUNNER_* variables to the test process without the prefix.
TEST_RUNNER_SYNCDECK_IT_WEBDAV_URL="http://127.0.0.1:$DAV_PORT" \
TEST_RUNNER_SYNCDECK_IT_SFTP_PORT="$SFTP_PORT" \
TEST_RUNNER_SYNCDECK_IT_USER=syncdeck \
TEST_RUNNER_SYNCDECK_IT_PASS="$PASS" \
xcodebuild test \
  -project SyncDeck.xcodeproj \
  -scheme SyncDeck \
  -destination "$DEST" \
  -derivedDataPath build/dd \
  "${@:2}"
