import { chmod, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const architecture = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : "";

if (process.platform !== "linux" || !architecture) {
  throw new Error(`SEA releases support Linux x64/arm64 only; got ${process.platform}/${process.arch}.`);
}

const binary = path.join(dist, process.env.BINARY_NAME ?? `codex-history-linux-${architecture}`);
const bundled = path.join(dist, "sea-entry.cjs");
const blob = path.join(dist, "sea-prep.blob");
const config = path.join(dist, "sea-config.json");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} failed with status ${result.status}\n${output}`);
  }
}

await mkdir(dist, { recursive: true });
await rm(binary, { force: true });
await build({
  entryPoints: [path.join(root, "bin", "codex-history.mjs")],
  bundle: true,
  format: "cjs",
  outfile: bundled,
  platform: "node",
  target: "node22",
});
await writeFile(
  config,
  JSON.stringify({
    main: bundled,
    output: blob,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
  }),
);
run(process.execPath, ["--experimental-sea-config", config]);
await copyFile(process.execPath, binary);
await chmod(binary, 0o755);
run(path.join(root, "node_modules", ".bin", "postject"), [
  binary,
  "NODE_SEA_BLOB",
  blob,
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
]);
console.log(binary);
