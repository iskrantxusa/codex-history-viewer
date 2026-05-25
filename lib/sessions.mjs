import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

export const DEFAULT_SESSIONS_DIR = path.join(
  process.env.HOME ?? "",
  ".codex",
  "sessions",
);

function textContent(content) {
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((item) => ["input_text", "output_text", "text"].includes(item?.type))
    .map((item) => item.text ?? "")
    .filter(Boolean)
    .join("\n");
}

function trimToolOutput(value) {
  const output =
    typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2);
  const clean = output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
  return clean.length > 40000 ? `${clean.slice(0, 40000)}\n... (truncated)` : clean;
}

function meaningfulTitle(entries, session) {
  const firstPrompt = entries.find(
    (entry) =>
      entry.role === "user" &&
      entry.text.trim() &&
      !entry.text.trim().startsWith("<environment_context>"),
  );
  const source = firstPrompt?.text ?? session.cwd ?? session.id ?? path.basename(session.path);
  return source.replace(/\s+/g, " ").trim().slice(0, 92);
}

export async function findSessionFiles(root = DEFAULT_SESSIONS_DIR) {
  const files = [];
  async function walk(directory) {
    let children;
    try {
      children = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }
    await Promise.all(
      children.map(async (child) => {
        const filePath = path.join(directory, child.name);
        if (child.isDirectory()) {
          await walk(filePath);
        } else if (child.isFile() && child.name.endsWith(".jsonl")) {
          files.push(filePath);
        }
      }),
    );
  }
  await walk(root);
  return files;
}

export async function parseSessionFile(filePath) {
  const primary = [];
  const fallback = [];
  const tools = [];
  const errors = [];
  const session = {
    path: filePath,
    id: "",
    startedAt: "",
    cwd: "",
    originator: "",
    cliVersion: "",
    primary,
    tools,
    errors,
  };

  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let index = 0;
  for await (const line of lines) {
    index += 1;
    if (!line.trim()) {
      continue;
    }
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      errors.push(`Invalid JSON at line ${index}`);
      continue;
    }
    const payload = record.payload ?? {};
    const timestamp = record.timestamp ?? "";
    if (record.type === "session_meta") {
      session.id = payload.id ?? session.id;
      session.startedAt = payload.timestamp ?? timestamp;
      session.cwd = payload.cwd ?? "";
      session.originator = payload.originator ?? "";
      session.cliVersion = payload.cli_version ?? "";
      continue;
    }
    if (record.type === "event_msg" && payload.type === "user_message") {
      primary.push({ role: "user", text: payload.message ?? "", timestamp, index });
      continue;
    }
    if (record.type === "event_msg" && payload.type === "agent_message") {
      primary.push({
        role: "assistant",
        text: payload.message ?? "",
        phase: payload.phase ?? "",
        timestamp,
        index,
      });
      continue;
    }
    if (record.type === "response_item" && payload.type === "message") {
      const text = textContent(payload.content);
      if (text && ["user", "assistant"].includes(payload.role)) {
        fallback.push({ role: payload.role, text, timestamp, index });
      }
      continue;
    }
    if (record.type === "response_item" && payload.type === "function_call") {
      const args = payload.arguments ? `\n${trimToolOutput(payload.arguments)}` : "";
      tools.push({
        role: "tool",
        text: `${payload.name ?? "tool"}${args}`,
        timestamp,
        index,
      });
      continue;
    }
    if (record.type === "response_item" && payload.type === "function_call_output") {
      tools.push({
        role: "result",
        text: trimToolOutput(payload.output),
        timestamp,
        index,
      });
      continue;
    }
    if (record.type === "response_item" && payload.type === "custom_tool_call") {
      tools.push({
        role: "tool",
        text: `${payload.name ?? "custom_tool"}\n${trimToolOutput(payload.input)}`,
        timestamp,
        index,
      });
      continue;
    }
  }

  session.entries = primary.length > 0 ? primary : fallback;
  session.allEntries = [...session.entries, ...tools].sort((a, b) => a.index - b.index);
  session.title = meaningfulTitle(session.entries, session);
  session.messageCount = session.entries.length;
  session.searchText = [
    session.title,
    session.cwd,
    session.id,
    ...session.allEntries.map((entry) => entry.text),
  ]
    .join("\n")
    .toLocaleLowerCase();
  return session;
}

export async function loadSessions(root = DEFAULT_SESSIONS_DIR) {
  const files = await findSessionFiles(root);
  const sessions = await Promise.all(files.map((filePath) => parseSessionFile(filePath)));
  sessions.sort(
    (a, b) =>
      (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0) ||
      b.path.localeCompare(a.path),
  );
  return sessions;
}

export function filterSessions(sessions, query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) {
    return sessions;
  }
  return sessions.filter((session) => session.searchText.includes(needle));
}
