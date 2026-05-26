import { spawn } from "node:child_process";

function shellArgument(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) {
    return text;
  }
  return `'${text.replaceAll("'", "'\\''")}'`;
}

export function resumeCommand(sessionId) {
  const id = String(sessionId ?? "").trim();
  return id ? `codex resume ${shellArgument(id)}` : "";
}

function clipboardCommands(env) {
  const commands = [];
  if (env.WAYLAND_DISPLAY) {
    commands.push(["wl-copy", []]);
  }
  if (env.DISPLAY) {
    commands.push(["xclip", ["-selection", "clipboard"]]);
    commands.push(["xsel", ["--clipboard", "--input"]]);
  }
  return commands;
}

function writeClipboard(command, args, text, spawnProcess) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, { stdio: ["pipe", "ignore", "ignore"] });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with status ${code}`));
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(text);
  });
}

export async function copyTextToClipboard(text, options = {}) {
  const env = options.env ?? process.env;
  const spawnProcess = options.spawnProcess ?? spawn;
  const commands = clipboardCommands(env);
  if (!commands.length) {
    throw new Error("No graphical clipboard environment detected.");
  }
  let lastError;
  for (const [command, args] of commands) {
    try {
      await writeClipboard(command, args, text, spawnProcess);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Clipboard command failed.");
}
