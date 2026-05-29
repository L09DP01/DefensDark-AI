const GITHUB_RELEASE_BASE =
  "https://github.com/defensdark-ai-tech/defensdark-ai/releases/latest/download";

export const downloadLinks = {
  macos: `${GITHUB_RELEASE_BASE}/DefensDark AI-universal.dmg`,
  windows: `${GITHUB_RELEASE_BASE}/DefensDark AI-windows-x64.exe`,
  linuxAppImage: `${GITHUB_RELEASE_BASE}/DefensDark AI-linux-x64.AppImage`,
  linuxArm64AppImage: `${GITHUB_RELEASE_BASE}/DefensDark AI-linux-arm64.AppImage`,
  linuxDeb: `${GITHUB_RELEASE_BASE}/DefensDark AI-linux-x64.deb`,
  linuxArm64Deb: `${GITHUB_RELEASE_BASE}/DefensDark AI-linux-arm64.deb`,
};
