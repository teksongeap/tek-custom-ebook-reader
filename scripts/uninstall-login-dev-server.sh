#!/usr/bin/env bash

set -euo pipefail

APP_NAME="tek-custom-ebook-reader"
LABEL="com.teksongeap.tek-custom-ebook-reader.dev-server"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
COMMAND_PATH="${HOME}/Library/Application Support/${APP_NAME}/start-dev-server.command"
USER_ID="$(id -u)"

launchctl bootout "gui/${USER_ID}" "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"
rm -f "$COMMAND_PATH"

echo "Removed ${LABEL}"
