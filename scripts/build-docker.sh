#!/bin/bash

# Build Docker image with version from git tag
# Usage: ./scripts/build-docker.sh [tag]
# Supports both docker and podman

set -e

# Detect container runtime (prefer podman if available)
if command -v podman >/dev/null 2>&1; then
    CONTAINER_CMD="podman"
elif command -v docker >/dev/null 2>&1; then
    CONTAINER_CMD="docker"
else
    echo "Error: Neither podman nor docker found in PATH"
    exit 1
fi

echo "Using container runtime: $CONTAINER_CMD"

# Get version from git tag (latest tag matching v*)
VERSION=$(git describe --tags --match 'v[0-9]*' --abbrev=0 2>/dev/null || echo "v0.0.0-unknown")

# Use provided tag or default to version
TAG="${1:-$VERSION}"

echo "Building Docker image..."
echo "  Version: $VERSION"
echo "  Tag: promptbridge:$TAG"
echo

# Build the image
$CONTAINER_CMD build \
  --build-arg VERSION="$VERSION" \
  -t "promptbridge:$TAG" \
  .

echo
echo "Build complete!"
echo "To run: $CONTAINER_CMD run -p 3000:3000 promptbridge:$TAG"
echo "To verify version: curl http://localhost:3000/version.txt"
