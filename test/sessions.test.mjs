import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { printSession } from "../lib/tui.mjs";
import { filterSessions, loadSessions, parseSessionFile } from "../lib/sessions.mjs";

const records = [
  {
    timestamp: "2026-05-25T10:00:00Z",
    type: "session_meta",
    payload: { id: "session-one", timestamp: "2026-05-25T10:00:00Z", cwd: "/code/demo" },
  },
  {
    timestamp: "2026-05-25T10:00:01Z",
    type: "response_item",
    payload: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "duplicated internal prompt" }],
    },
  },
  {
    timestamp: "2026-05-25T10:00:02Z",
    type: "event_msg",
    payload: { type: "user_message", message: "Find the failing test" },
  },
  {
    timestamp: "2026-05-25T10:00:03Z",
    type: "event_msg",
    payload: { type: "agent_message", message: "I will inspect it.", phase: "commentary" },
  },
  {
    timestamp: "2026-05-25T10:00:04Z",
    type: "response_item",
    payload: { type: "function_call", name: "exec_command", arguments: "{\"cmd\":\"npm test\"}" },
  },
  {
    timestamp: "2026-05-25T10:00:05Z",
    type: "response_item",
    payload: { type: "function_call_output", output: "ok" },
  },
];

async function fixture(contents = records) {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-history-"));
  const dir = path.join(root, "2026", "05", "25");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "rollout.jsonl");
  await writeFile(file, contents.map((record) => JSON.stringify(record)).join("\n"));
  return { root, file };
}

test("extracts user and assistant events without response duplicates", async () => {
  const { file } = await fixture();
  const session = await parseSessionFile(file);
  assert.equal(session.id, "session-one");
  assert.equal(session.title, "Find the failing test");
  assert.deepEqual(
    session.entries.map((entry) => entry.text),
    ["Find the failing test", "I will inspect it."],
  );
  assert.equal(session.tools.length, 2);
  assert.equal(session.allEntries.length, 4);
});

test("uses response messages as fallback for older session data", async () => {
  const { file } = await fixture([
    records[0],
    {
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Fallback answer" }],
      },
    },
  ]);
  const session = await parseSessionFile(file);
  assert.equal(session.entries[0].text, "Fallback answer");
});

test("loads newest sessions first and searches message text", async () => {
  const { root } = await fixture();
  const older = path.join(root, "older.jsonl");
  await writeFile(
    older,
    `${JSON.stringify({
      type: "session_meta",
      payload: { id: "older", timestamp: "2020-01-01T00:00:00Z" },
    })}\n`,
  );
  const sessions = await loadSessions(root);
  assert.equal(sessions[0].id, "session-one");
  assert.equal(filterSessions(sessions, "FAILING").length, 1);
  assert.equal(filterSessions(sessions, "missing").length, 0);
});

test("plain rendering can disable terminal color escapes", async () => {
  const { file } = await fixture();
  const session = await parseSessionFile(file);
  const output = printSession(session, { colors: false });
  assert.doesNotMatch(output, /\u001b\[/);
});
