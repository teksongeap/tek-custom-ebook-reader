#!/usr/bin/env bash

set -euo pipefail

LABEL="com.teksongeap.tek-custom-ebook-reader.dev-server"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
USER_ID="$(id -u)"

launchctl bootout "gui/${USER_ID}" "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "Removed ${LABEL}"
