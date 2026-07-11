#!/usr/bin/env bash
set -euo pipefail

APP="course"
REPO="RennKaeo/Courze"
INSTALL_DIR="${HOME}/.course/bin"
DATA_DIR="${HOME}/.course"

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

install_node() {
  echo -e "${ORANGE}Node.js >= 22 not found. Installing via nvm...${NC}"
  if command -v curl &>/dev/null; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="${HOME}/.nvm"
    [ -s "${NVM_DIR}/nvm.sh" ] && \. "${NVM_DIR}/nvm.sh"
    nvm install 22
    nvm use 22
  elif command -v wget &>/dev/null; then
    wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="${HOME}/.nvm"
    [ -s "${NVM_DIR}/nvm.sh" ] && \. "${NVM_DIR}/nvm.sh"
    nvm install 22
    nvm use 22
  else
    echo -e "${RED}Error: curl or wget required to install Node.js.${NC}"
    echo -e "${RED}Install Node.js >= 22 manually: https://nodejs.org${NC}"
    exit 1
  fi
}

if ! command -v node &>/dev/null; then
  install_node
else
  NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
  if [ "$NODE_MAJOR" -lt 22 ]; then
    echo -e "${ORANGE}Node.js $(node -v) is too old. Upgrading...${NC}"
    install_node
  fi
fi

# ── Detect target platform ──────────────────────────────────────────────────

raw_os=$(uname -s)
case "$raw_os" in
  Darwin*) os="darwin" ;;
  Linux*) os="linux" ;;
  MINGW*|MSYS*|CYGWIN*) os="windows" ;;
  *) echo -e "${RED}Unsupported OS: $raw_os${NC}"; exit 1 ;;
esac

raw_arch=$(uname -m)
case "$raw_arch" in
  x86_64|amd64) arch="x64" ;;
  aarch64|arm64) arch="arm64" ;;
  *) echo -e "${RED}Unsupported arch: $raw_arch${NC}"; exit 1 ;;
esac

TARGET="${os}-${arch}"

# ── Determine version ──────────────────────────────────────────────────

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

if [ -z "$requested_version" ]; then
  echo -e "${MUTED}Fetching latest release...${NC}"
  requested_version=$(curl -sL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name":' | sed 's/.*"v\([^"]*\)".*/\1/' | head -1)
  if [ -z "$requested_version" ]; then
    echo -e "${ORANGE}No pre-built release found, will build from source.${NC}"
    requested_version="main"
  fi
fi

if [ "$requested_version" = "main" ]; then
  USE_SOURCE=true
else
  USE_SOURCE=false
fi

echo -e "${GREEN}Installing Course Code v${requested_version}...${NC}"

# ── PATH setup (defined early so both paths can call it) ─────────────────

add_to_path() {
  if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo -e "${MUTED}Adding ${INSTALL_DIR} to PATH...${NC}"

    SHELL_NAME=$(basename "${SHELL:-bash}")
    case "$SHELL_NAME" in
      fish)
        mkdir -p "${HOME}/.config/fish"
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
}

# ── Try pre-built tarball ──────────────────────────────────────────────────

if [ "$USE_SOURCE" = "false" ]; then
  ARCHIVE_NAME="${APP}-${TARGET}.tar.gz"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${requested_version}/${ARCHIVE_NAME}"

  echo -e "${MUTED}Checking for pre-built release: ${ARCHIVE_NAME}${NC}"
  HTTP_STATUS=$(curl -sI -o /dev/null -w "%{http_code}" -L "$DOWNLOAD_URL" 2>/dev/null || echo "000")

  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${MUTED}Downloading pre-built release...${NC}"
    curl -# -L -o "${TMP_DIR}/${ARCHIVE_NAME}" "$DOWNLOAD_URL"

    echo -e "${MUTED}Extracting...${NC}"
    tar xzf "${TMP_DIR}/${ARCHIVE_NAME}" -C "${TMP_DIR}"

    EXTRACTED_DIR="${TMP_DIR}/${APP}-${TARGET}"
    if [ ! -d "$EXTRACTED_DIR" ]; then
      EXTRACTED_DIR=$(find "${TMP_DIR}" -maxdepth 2 -type d -name "${APP}-*" | head -1)
    fi

    if [ -d "$EXTRACTED_DIR" ]; then
      # Copy binary
      mkdir -p "$INSTALL_DIR"
      cp "${EXTRACTED_DIR}/bin/${APP}" "$INSTALL_DIR/" 2>/dev/null || true
      chmod 755 "${INSTALL_DIR}/${APP}" 2>/dev/null || true

      # Copy dist/
      if [ -d "${EXTRACTED_DIR}/dist" ]; then
        rm -rf "${DATA_DIR}/dist"
        cp -r "${EXTRACTED_DIR}/dist" "${DATA_DIR}/"
      fi

      # Copy node_modules/
      if [ -d "${EXTRACTED_DIR}/node_modules" ]; then
        rm -rf "${DATA_DIR}/node_modules"
        cp -r "${EXTRACTED_DIR}/node_modules" "${DATA_DIR}/"
      fi

      # Copy package.json
      if [ -f "${EXTRACTED_DIR}/package.json" ]; then
        cp "${EXTRACTED_DIR}/package.json" "${DATA_DIR}/"
      fi

      echo -e ""
      echo -e "${GREEN}✓ Course Code v${requested_version} installed to ${INSTALL_DIR}${NC}"
      echo -e ""

      add_to_path
      exit 0
    else
      echo -e "${ORANGE}Pre-built tarball extraction failed, falling back to source build.${NC}"
    fi
  else
    echo -e "${ORANGE}No pre-built tarball for ${TARGET}, will build from source.${NC}"
  fi
fi

# ── Source build fallback ──────────────────────────────────────────────────

echo -e "${MUTED}Building from source...${NC}"

if ! command -v bun &>/dev/null; then
  echo -e "${ORANGE}Bun not found. Installing Bun...${NC}"
  curl -fsSL https://bun.sh/install | bash
  # shellcheck source=/dev/null
  if [ -f "${HOME}/.bashrc" ]; then
    export BUN_INSTALL="${HOME}/.bun"
    export PATH="${BUN_INSTALL}/bin:${PATH}"
  fi
fi

git clone --depth 1 --branch "v${requested_version}" \
  "https://github.com/${REPO}.git" "${TMP_DIR}/course" 2>/dev/null || \
git clone --depth 1 \
  "https://github.com/${REPO}.git" "${TMP_DIR}/course"

cd "${TMP_DIR}/course"

echo -e "${MUTED}Installing dependencies...${NC}"
bun install

echo -e "${MUTED}Building...${NC}"
bun run build

# ── Install ────────────────────────────────────────────────────────────────

mkdir -p "$INSTALL_DIR"
cp bin/course "$INSTALL_DIR/"
chmod 755 "${INSTALL_DIR}/course"

rm -rf "${DATA_DIR}/dist"
cp -r dist "${DATA_DIR}/dist"

echo -e ""
echo -e "${GREEN}✓ Course Code v${requested_version} installed to ${INSTALL_DIR}${NC}"
echo -e ""

add_to_path

echo -e ""
echo -e "${GREEN}Run 'course' to start.${NC}"
echo -e "${MUTED}Need a provider key? Run /provider inside Course Code.${NC}"
echo -e ""
