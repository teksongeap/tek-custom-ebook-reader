#!/usr/bin/env bash

set -euo pipefail

APP_NAME="tek-custom-ebook-reader"
LABEL="com.teksongeap.tek-custom-ebook-reader.dev-server"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
START_SCRIPT="${REPO_DIR}/scripts/start-dev-server.sh"
PLIST_DIR="${HOME}/Library/LaunchAgents"
LOG_DIR="${HOME}/Library/Logs/${APP_NAME}"
COMMAND_DIR="${HOME}/Library/Application Support/${APP_NAME}"
COMMAND_PATH="${COMMAND_DIR}/start-dev-server.command"
PLIST_PATH="${PLIST_DIR}/${LABEL}.plist"
USER_ID="$(id -u)"

mkdir -p "$PLIST_DIR" "$LOG_DIR" "$COMMAND_DIR"
chmod +x "$START_SCRIPT"

cat > "$COMMAND_PATH" <<COMMAND
#!/bin/zsh

cd "${REPO_DIR}"
exec "${START_SCRIPT}"
COMMAND

chmod +x "$COMMAND_PATH"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-a</string>
    <string>Terminal</string>
    <string>${COMMAND_PATH}</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/dev-server.out.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/dev-server.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/${USER_ID}" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${USER_ID}" "$PLIST_PATH"
launchctl enable "gui/${USER_ID}/${LABEL}" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/${USER_ID}/${LABEL}"

echo "Installed ${LABEL}"
echo "Dev server URL: http://127.0.0.1:5173"
echo "Logs: ${LOG_DIR}"
echo "Login command: ${COMMAND_PATH}"
