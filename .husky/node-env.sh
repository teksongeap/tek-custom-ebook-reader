prepend_path() {
	if [ -d "$1" ]; then
		case ":$PATH:" in
			*":$1:"*) ;;
			*) PATH="$1:$PATH" ;;
		esac
	fi
}

prepend_path "/opt/homebrew/bin"
prepend_path "/usr/local/bin"
prepend_path "$HOME/.volta/bin"
prepend_path "$HOME/Library/pnpm"
prepend_path "$HOME/.local/share/pnpm"
prepend_path "$HOME/.asdf/shims"

if ! command -v node >/dev/null 2>&1; then
	export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
	if [ -s "$NVM_DIR/nvm.sh" ]; then
		. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
		if [ -f ".nvmrc" ]; then
			nvm use --silent >/dev/null 2>&1 || true
		else
			nvm use --silent default >/dev/null 2>&1 || nvm use --silent node >/dev/null 2>&1 || true
		fi
	fi
fi

export PATH
