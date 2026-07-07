#!/usr/bin/env bash
set -euo pipefail

APP="course"
REPO="RennKaeo/Courze"
INSTALL_DIR="${HOME}/.course/bin"

MUTED='\033[0;2m'
GREEN='\033[0;32m'
RED='\033[0;31m'
ORANGE='\033[38;5;214m'
NC='\033[0m'

usage() {
  cat <<EOF
Course Code Installer

Usage: install.sh [options]

Options:
  -h, --help              Display this help
  -v, --version <version> Install a specific version (tag)
  -d, --dir <path>        Install to a custom directory (default: ~/.course/bin)

Examples:
  curl -fsSL https://raw.githubusercontent.com/RennKaeo/Courze/main/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/RennKaeo/Courze/main/install.sh | bash -s -- -v 0.21.0
EOF
}

requested_version=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    -v|--version) requested_version="$2"; shift 2 ;;
    -d|--dir) INSTALL_DIR="$2"; shift 2 ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; usage; exit 1 ;;
  esac
done

# ── Prerequisites ──────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  echo -e "${RED}Error: Node.js >= 22 is required. Install it first: https://nodejs.org${NC}"
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo -e "${RED}Error: Node.js >= 22 required, found $(node -v)${NC}"
  exit 1
fi

if ! command -v bun &>/dev/null; then
  echo -e "${ORANGE}Bun not found. Installing Bun...${NC}"
  curl -fsSL https://bun.sh/install | bash
  # shellcheck source=/dev/null
  if [ -f "${HOME}/.bashrc" ]; then
    export BUN_INSTALL="${HOME}/.bun"
    export PATH="${BUN_INSTALL}/bin:${PATH}"
  fi
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# ── Determine version ──────────────────────────────────────────────

if [ -z "$requested_version" ]; then
  echo -e "${MUTED}Fetching latest release...${NC}"
  requested_version=$(curl -sL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name":' | sed 's/.*"v\([^"]*\)".*/\1/')
  if [ -z "$requested_version" ]; then
    requested_version="main"
  fi
fi

echo -e "${GREEN}Installing Course Code v${requested_version}...${NC}"

# ── Download source ────────────────────────────────────────────────

git clone --depth 1 --branch "v${requested_version}" \
  "https://github.com/${REPO}.git" "${TMP_DIR}/course" 2>/dev/null || \
git clone --depth 1 \
  "https://github.com/${REPO}.git" "${TMP_DIR}/course"

cd "${TMP_DIR}/course"

# ── Build ──────────────────────────────────────────────────────────

echo -e "${MUTED}Installing dependencies...${NC}"
bun install

echo -e "${MUTED}Building...${NC}"
bun run build

# ── Install ────────────────────────────────────────────────────────

mkdir -p "$INSTALL_DIR"
cp bin/course "$INSTALL_DIR/"
chmod 755 "${INSTALL_DIR}/course"

# Copy dist/
cp -r dist "${INSTALL_DIR}/../dist" 2>/dev/null || true

echo -e ""
echo -e "${GREEN}✓ Course Code v${requested_version} installed to ${INSTALL_DIR}${NC}"
echo -e ""

# ── PATH setup ─────────────────────────────────────────────────────

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo -e "${MUTED}Adding ${INSTALL_DIR} to PATH...${NC}"

  SHELL_NAME=$(basename "${SHELL:-bash}")
  case "$SHELL_NAME" in
    fish)
      echo "fish_add_path ${INSTALL_DIR}" >> "${HOME}/.config/fish/config.fish"
      ;;
    zsh)
      echo "export PATH=\"${INSTALL_DIR}:\$PATH\"" >> "${ZDOTDIR:-$HOME}/.zshrc"
      ;;
    bash|*)
      echo "export PATH=\"${INSTALL_DIR}:\$PATH\"" >> "${HOME}/.bashrc"
      ;;
  esac

  export PATH="${INSTALL_DIR}:${PATH}"
  echo -e "${MUTED}Restart your shell or run: export PATH=\"${INSTALL_DIR}:\$PATH\"${NC}"
fi

echo -e ""
echo -e "${GREEN}Run 'course' to start.${NC}"
echo -e "${MUTED}Need a provider key? Run /provider inside Course Code.${NC}"
echo -e ""
