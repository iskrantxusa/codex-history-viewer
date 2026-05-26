import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const architecture = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : "";
const binary = process.argv[2] ?? path.resolve("dist", `codex-history-linux-${architecture}`);

const help = execFileSync(binary, ["--help"], { encoding: "utf8" });
if (!help.includes("terminal viewer for codex-cli sessions")) {
  throw new Error("Standalone --help output is invalid.");
}

const root = await mkdtemp(path.join(os.tmpdir(), "codex-history-sea-"));
const sessions = path.join(root, "2026", "05", "26");
await mkdir(sessions, { recursive: true });
await writeFile(
  path.join(sessions, "rollout.jsonl"),
  `${JSON.stringify({
    timestamp: "2026-05-26T10:00:00Z",
    type: "session_meta",
    payload: { id: "standalone-smoke", timestamp: "2026-05-26T10:00:00Z", cwd: "/tmp/demo" },
  })}\n${JSON.stringify({
    timestamp: "2026-05-26T10:00:01Z",
    type: "event_msg",
    payload: { type: "user_message", message: "Standalone smoke dialog" },
  })}\n`,
);
const list = execFileSync(binary, ["--list", "--dir", root], { encoding: "utf8" });
if (!list.includes("standalone-smoke".slice(0, 8)) || !list.includes("Standalone smoke dialog")) {
  throw new Error("Standalone session reading smoke test failed.");
}
console.log(`Verified ${binary}`);
