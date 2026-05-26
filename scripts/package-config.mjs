import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const version = process.env.VERSION?.replace(/^v/, "");
const releaseArch = process.env.RELEASE_ARCH;
const mapping = {
  x64: { nfpm: "amd64", binary: "codex-history-linux-x64" },
  arm64: { nfpm: "arm64", binary: "codex-history-linux-arm64" },
};
const architecture = mapping[releaseArch];

if (!version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("VERSION must contain a semver release version.");
}
if (!architecture) {
  throw new Error("RELEASE_ARCH must be x64 or arm64.");
}

const dist = path.resolve("dist");
await mkdir(dist, { recursive: true });
const config = `name: codex-history-viewer
arch: ${architecture.nfpm}
platform: linux
version: "${version}"
section: utils
priority: optional
maintainer: codex-history-viewer contributors
description: Terminal viewer for codex-cli session history
vendor: iskrantxusa
homepage: https://github.com/iskrantxusa/codex-history-viewer
license: MIT
recommends:
  - wl-clipboard
  - xclip
  - xsel
contents:
  - src: ${path.join("dist", architecture.binary)}
    dst: /usr/bin/codex-history
`;
await writeFile(path.join(dist, "nfpm.yaml"), config);
console.log(`Generated nFPM configs for ${releaseArch} ${version}`);
