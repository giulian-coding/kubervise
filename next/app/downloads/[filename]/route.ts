import { NextRequest, NextResponse } from "next/server";

// GitHub repository for releases
const GITHUB_REPO = "giulian-coding/kubervise";
const AGENT_VERSION = process.env.AGENT_VERSION || "latest";

// Map filenames to GitHub release assets
const ASSET_MAP: Record<string, string> = {
  "agentkubervise-linux-amd64": "agentkubervise-linux-amd64",
  "agentkubervise-darwin-amd64": "agentkubervise-darwin-amd64",
  "agentkubervise-windows-amd64.exe": "agentkubervise-windows-amd64.exe",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Check if this is a valid asset
  const assetName = ASSET_MAP[filename];
  if (!assetName) {
    return NextResponse.json(
      { error: "Invalid filename. Available downloads: " + Object.keys(ASSET_MAP).join(", ") },
      { status: 404 }
    );
  }

  // Build the GitHub release download URL
  let downloadUrl: string;

  if (AGENT_VERSION === "latest") {
    // Redirect to latest release
    downloadUrl = `https://github.com/${GITHUB_REPO}/releases/latest/download/${assetName}`;
  } else {
    // Redirect to specific version
    downloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/${AGENT_VERSION}/${assetName}`;
  }

  // Redirect to GitHub
  return NextResponse.redirect(downloadUrl, { status: 302 });
}
