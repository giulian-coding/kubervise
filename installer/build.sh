#!/bin/bash

# Kubervise CLI Build Script
# Builds binaries for Windows, Linux, and macOS

set -e

VERSION="1.0.0"
API_URL="${API_URL:-https://your-app.vercel.app}"
OUTPUT_DIR="./dist"

echo "Building Kubervise CLI v${VERSION}"
echo "API URL: ${API_URL}"
echo ""

# Clean output directory
rm -rf ${OUTPUT_DIR}
mkdir -p ${OUTPUT_DIR}

# Build for each platform
platforms=(
    "windows/amd64/.exe"
    "linux/amd64/"
    "linux/arm64/"
    "darwin/amd64/"
    "darwin/arm64/"
)

for platform in "${platforms[@]}"; do
    IFS='/' read -r os arch ext <<< "$platform"
    output_name="kubervise-${os}-${arch}${ext}"

    echo "Building ${output_name}..."

    GOOS=$os GOARCH=$arch go build \
        -ldflags "-s -w -X main.apiURL=${API_URL} -X main.version=${VERSION}" \
        -o "${OUTPUT_DIR}/${output_name}" \
        .
done

echo ""
echo "Build complete! Binaries are in ${OUTPUT_DIR}/"
ls -la ${OUTPUT_DIR}/
