#!/bin/zsh

set -euo pipefail

APP_NAME="tek-custom-ebook-reader"
HOST="${DEV_SERVER_HOST:-127.0.0.1}"
PORT="${DEV_SERVER_PORT:-5173}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
LOG_DIR="${HOME}/Library/Logs/${APP_NAME}"
START_LOG="${LOG_DIR}/start-dev-server.log"

mkdir -p "$LOG_DIR" 2>/dev/null || true

timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

log_message() {
  echo "$(timestamp) $*" >> "$START_LOG" 2>/dev/null || true
}

export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

# LaunchAgents do not get your normal terminal environment, so load common
# shell setup locations for Homebrew, nvm, fnm, asdf, pnpm, and similar tools.
for profile in "${HOME}/.zprofile" "${HOME}/.zshrc"; do
  if [[ -r "$profile" ]]; then
    set +u
    source "$profile" >/dev/null 2>&1 || true
    set -u
  fi
done

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  set +u
  source "${HOME}/.nvm/nvm.sh" >/dev/null 2>&1 || true
  if [[ -f "${REPO_DIR}/.nvmrc" ]] && command -v nvm >/dev/null 2>&1; then
    nvm use --silent >/dev/null 2>&1 || true
  fi
  set -u
fi

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  log_message "dev server already listening on port ${PORT}; leaving it alone."
  exit 0
fi

cd "$REPO_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  log_message "pnpm not found. Install pnpm or enable corepack, then run this script again: ${0}"
  echo "pnpm not found. Install pnpm or enable corepack, then run this script again: ${0}" >&2
  exit 127
fi

log_message "starting ${APP_NAME} dev server at http://${HOST}:${PORT}"
exec pnpm --dir "${REPO_DIR}/apps/web" exec vite dev --host "${HOST}" --port "${PORT}" --strictPort
