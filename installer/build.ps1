# Kubervise CLI Build Script for Windows
# Builds binaries for Windows, Linux, and macOS

$VERSION = "1.0.0"
$API_URL = if ($env:API_URL) { $env:API_URL } else { "https://your-app.vercel.app" }
$OUTPUT_DIR = "./dist"

Write-Host "Building Kubervise CLI v$VERSION"
Write-Host "API URL: $API_URL"
Write-Host ""

# Clean output directory
if (Test-Path $OUTPUT_DIR) {
    Remove-Item -Recurse -Force $OUTPUT_DIR
}
New-Item -ItemType Directory -Path $OUTPUT_DIR | Out-Null

# Build configurations
$builds = @(
    @{OS="windows"; ARCH="amd64"; EXT=".exe"},
    @{OS="linux"; ARCH="amd64"; EXT=""},
    @{OS="linux"; ARCH="arm64"; EXT=""},
    @{OS="darwin"; ARCH="amd64"; EXT=""},
    @{OS="darwin"; ARCH="arm64"; EXT=""}
)

foreach ($build in $builds) {
    $outputName = "kubervise-$($build.OS)-$($build.ARCH)$($build.EXT)"
    Write-Host "Building $outputName..."

    $env:GOOS = $build.OS
    $env:GOARCH = $build.ARCH

    go build -ldflags "-s -w -X main.apiURL=$API_URL -X main.version=$VERSION" -o "$OUTPUT_DIR/$outputName" .

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to build $outputName" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Build complete! Binaries are in $OUTPUT_DIR/" -ForegroundColor Green
Get-ChildItem $OUTPUT_DIR
