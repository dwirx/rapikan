#!/bin/bash

# Exit on error
set -e

# Detect OS and Architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)
    OS_NAME="linux"
    ;;
  Darwin)
    OS_NAME="darwin"
    ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64)
    ARCH_NAME="x64"
    ;;
  arm64|aarch64)
    ARCH_NAME="arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

BINARY_NAME="rapikan-${OS_NAME}-${ARCH_NAME}"
DOWNLOAD_URL="https://github.com/dwirx/rapikan/releases/latest/download/${BINARY_NAME}"

echo "Detecting OS: $OS ($ARCH)"
echo "Downloading $BINARY_NAME from latest release..."

# Create temporary file
TMP_BIN="/tmp/rapikan"
curl -L -o "$TMP_BIN" "$DOWNLOAD_URL"

# Make executable
chmod +x "$TMP_BIN"

# Move to bin directory
DEST_DIR="/usr/local/bin"
if [ -w "$DEST_DIR" ]; then
  mv "$TMP_BIN" "$DEST_DIR/rapikan"
else
  echo "Requesting sudo permissions to install to $DEST_DIR/rapikan"
  sudo mv "$TMP_BIN" "$DEST_DIR/rapikan"
fi

echo "Successfully installed 'rapikan' to $DEST_DIR/rapikan!"
echo "You can now run: rapikan"
