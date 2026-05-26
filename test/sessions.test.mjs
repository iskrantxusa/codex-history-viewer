import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cardsFromPatchEvent, parseGitDiffOutput } from "../lib/changes.mjs";
import { ansi, findTextMatches, styledContentLines } from "../lib/format.mjs";
import { resumeCommand } from "../lib/resume.mjs";
import { HistoryTui, printSession } from "../lib/tui.mjs";
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

test("finds and highlights every match while marking the active one", () => {
  assert.deepEqual(findTextMatches("Hit hit HIT", "hit"), [
    { start: 0, end: 3 },
    { start: 4, end: 7 },
    { start: 8, end: 11 },
  ]);
  const [line] = styledContentLines("Hit hit HIT", 40, "hit", true, 4);
  assert.equal(line.matches.length, 3);
  assert.equal(line.text.split(ansi.search).length - 1, 2);
  assert.equal(line.text.split(ansi.activeSearch).length - 1, 1);
});

test("syntax highlights fenced source code without coloring markdown lists as diffs", () => {
  const lines = styledContentLines(
    "```js\nconst count = 42; // total\n```\n- plain list item",
    80,
    "",
    true,
  );
  assert.match(lines[1].text, new RegExp(ansi.magenta.replace("[", "\\[")));
  assert.match(lines[1].text, new RegExp(ansi.yellow.replace("[", "\\[")));
  assert.match(lines[1].text, new RegExp(ansi.gray.replace("[", "\\[")));
  assert.match(lines[3].text, new RegExp(ansi.cyan.replace("[", "\\[")));
  assert.doesNotMatch(lines[3].text, new RegExp(ansi.brightRed.replace("[", "\\[")));
});

test("styles git diffs and Codex patch tool input as changes", () => {
  const diff = styledContentLines(
    "diff --git a/a.js b/a.js\n@@ -1 +1 @@\n # unchanged\n-old\n+new",
    80,
    "",
    true,
  );
  assert.match(diff[0].text, new RegExp(ansi.gray.replace("[", "\\[")));
  assert.match(diff[1].text, new RegExp(ansi.brightCyan.replace("[", "\\[")));
  assert.doesNotMatch(diff[2].text, new RegExp(ansi.brightCyan.replace("[", "\\[")));
  assert.match(diff[3].text, new RegExp(ansi.brightRed.replace("[", "\\[")));
  assert.match(diff[4].text, new RegExp(ansi.brightGreen.replace("[", "\\[")));
  const patch = styledContentLines(
    "*** Begin Patch\n*** Update File: lib/a.mjs\n-old\n+new\n*** End Patch",
    80,
    "",
    true,
  );
  assert.match(patch[2].text, new RegExp(ansi.brightRed.replace("[", "\\[")));
  assert.match(patch[3].text, new RegExp(ansi.brightGreen.replace("[", "\\[")));
});

test("parses git diff cards with old and new line numbers", () => {
  const parsed = parseGitDiffOutput(
    "tool output\nOutput:\ndiff --git a/src/a.py b/src/a.py\n--- a/src/a.py\n+++ b/src/a.py\n@@ -2,2 +2,2 @@\n-old = 1\n+new = 2\n keep",
  );
  assert.equal(parsed.prefix, "tool output\nOutput:");
  assert.equal(parsed.cards[0].path, "src/a.py");
  assert.equal(parsed.cards[0].additions, 1);
  assert.equal(parsed.cards[0].deletions, 1);
  assert.deepEqual(parsed.cards[0].hunks[0].lines[0], {
    kind: "delete",
    text: "old = 1",
    raw: "-old = 1",
    oldLine: 2,
    newLine: null,
  });
  assert.equal(parsed.cards[0].hunks[0].lines[2].newLine, 3);
});

test("builds structured patch cards and reports failed patches", () => {
  const success = cardsFromPatchEvent({
    success: true,
    changes: {
      "/code/demo/src/main.py": {
        type: "update",
        unified_diff: "@@ -1,1 +1,1 @@\n-print(1)\n+print(2)",
      },
    },
  });
  assert.equal(success.cards[0].path, "/code/demo/src/main.py");
  assert.equal(success.cards[0].language, "python");
  assert.equal(cardsFromPatchEvent({ success: false, stderr: "Invalid Context" }).error, "Invalid Context");
});

test("session parser replaces apply_patch payload with relative change cards", async () => {
  const { file } = await fixture([
    records[0],
    {
      timestamp: "2026-05-25T10:00:01Z",
      type: "response_item",
      payload: { type: "custom_tool_call", name: "apply_patch", input: "*** Begin Patch\nsecret raw patch" },
    },
    {
      timestamp: "2026-05-25T10:00:02Z",
      type: "event_msg",
      payload: {
        type: "patch_apply_end",
        success: true,
        changes: {
          "/code/demo/src/main.py": {
            type: "update",
            unified_diff: "@@ -3,1 +3,1 @@\n-old = 1\n+new = 2",
          },
        },
      },
    },
  ]);
  const session = await parseSessionFile(file);
  assert.equal(session.tools.length, 1);
  assert.equal(session.tools[0].role, "change");
  assert.equal(session.tools[0].card.path, "src/main.py");
  assert.doesNotMatch(session.searchText, /secret raw patch/);
});

test("session parser keeps failed patch diagnostics as an error card", async () => {
  const { file } = await fixture([
    records[0],
    {
      timestamp: "2026-05-25T10:00:02Z",
      type: "event_msg",
      payload: {
        type: "patch_apply_end",
        success: false,
        stderr: "Invalid Context 10",
      },
    },
  ]);
  const session = await parseSessionFile(file);
  assert.equal(session.tools[0].role, "change_error");
  assert.equal(session.tools[0].text, "Invalid Context 10");
});

function tuiSession({ entries, tools = [], searchText = "" }) {
  return {
    id: "test",
    title: "test",
    path: "/tmp/test",
    cwd: "/tmp",
    startedAt: "2026-05-25T10:00:00Z",
    entries,
    tools,
    allEntries: [...entries, ...tools].sort((a, b) => a.index - b.index),
    searchText: searchText || [...entries, ...tools].map((entry) => entry.text).join("\n").toLowerCase(),
  };
}

test("n and N navigate cyclically inside the current session", () => {
  const session = tuiSession({
    entries: [{ role: "assistant", text: "hit and hit", index: 1 }],
  });
  const tui = new HistoryTui([session], { noColor: true });
  tui.applySearch("hit");
  tui.selectFirstMatch();
  assert.equal(tui.activeMatchKey, "1:0");
  tui.navigateMatch(1);
  assert.equal(tui.activeMatchKey, "1:8");
  tui.navigateMatch(1);
  assert.equal(tui.activeMatchKey, "1:0");
  tui.navigateMatch(-1);
  assert.equal(tui.activeMatchKey, "1:8");
});

test("pasted search input is handled as individual terminal keys", () => {
  const session = tuiSession({
    entries: [{ role: "assistant", text: "find pasted needle", index: 1 }],
  });
  const tui = new HistoryTui([session], { noColor: true });
  tui.render = () => {};
  tui.handleInput("/needle\r");
  assert.equal(tui.query, "needle");
  assert.equal(tui.searching, false);
  assert.equal(tui.activeMatchKey, "1:12");
});

test("navigating to a hidden tool result reveals tool activity", () => {
  const session = tuiSession({
    entries: [{ role: "user", text: "ordinary prompt", index: 1 }],
    tools: [{ role: "result", text: "hidden needle result", index: 2 }],
  });
  const tui = new HistoryTui([session], { noColor: true });
  tui.applySearch("needle");
  tui.selectFirstMatch();
  assert.equal(tui.showTools, true);
  assert.equal(tui.activeMatchKey, "2:7");
});

test("renders change cards with gutters and full-line addition backgrounds", () => {
  const card = cardsFromPatchEvent({
    success: true,
    changes: {
      "src/main.py": {
        type: "update",
        unified_diff: "@@ -3,1 +3,1 @@\n-old = 1\n+new = 2",
      },
    },
  }).cards[0];
  const entry = { role: "change", card, text: `${card.path}\n${card.rawDiff}`, index: 2 };
  const session = tuiSession({ entries: [], tools: [entry] });
  const tui = new HistoryTui([session]);
  tui.showTools = true;
  const lines = tui.dialogLines(session, 50);
  assert.match(lines[0].text, /src\/main.py/);
  assert.match(lines[2].text, /3\s+-/);
  assert.match(lines[2].text, new RegExp(ansi.changeDelete.replace("[", "\\[")));
  assert.match(lines[3].text, /3\s+\+\s/);
  assert.match(lines[3].text, new RegExp(ansi.changeAdd.replace("[", "\\[")));
});

test("metadata-only filters keep a session without navigable matches", () => {
  const session = tuiSession({
    entries: [{ role: "user", text: "ordinary prompt", index: 1 }],
    searchText: "ordinary prompt /workspace/special-directory",
  });
  const tui = new HistoryTui([session], { noColor: true });
  tui.applySearch("special-directory");
  tui.selectFirstMatch();
  assert.equal(tui.filtered.length, 1);
  assert.deepEqual(tui.matchesForSession(), []);
  assert.equal(tui.activeMatchKey, null);
  tui.navigateMatch(1);
  assert.equal(tui.activeMatchKey, null);
});

test("builds shell-safe Codex resume commands", () => {
  assert.equal(resumeCommand("019e5fed-1234"), "codex resume 019e5fed-1234");
  assert.equal(resumeCommand("named thread's work"), "codex resume 'named thread'\\''s work'");
  assert.equal(resumeCommand(""), "");
});

test("r copies the selected session resume command and reports success", async () => {
  const copied = [];
  const session = tuiSession({ entries: [] });
  session.id = "019e5fed-1234";
  const tui = new HistoryTui([session], {
    noColor: true,
    copyText: async (text) => copied.push(text),
  });
  tui.render = () => {};
  await tui.handleKey("r");
  assert.deepEqual(copied, ["codex resume 019e5fed-1234"]);
  assert.equal(tui.statusMessage, " Copied: codex resume 019e5fed-1234");
  tui.handleKey("c");
  assert.equal(tui.statusMessage, "");
});

test("r shows resume commands when clipboard fails and rejects missing ids", async () => {
  let attempts = 0;
  const failed = tuiSession({ entries: [] });
  failed.id = "session-one";
  const tui = new HistoryTui([failed], {
    noColor: true,
    copyText: async () => {
      attempts += 1;
      throw new Error("clipboard unavailable");
    },
  });
  tui.render = () => {};
  await tui.handleKey("r");
  assert.equal(tui.statusMessage, " Copy failed: codex resume session-one");
  const missing = tuiSession({ entries: [] });
  missing.id = "";
  const withoutId = new HistoryTui([missing], {
    noColor: true,
    copyText: async () => {
      attempts += 1;
    },
  });
  withoutId.render = () => {};
  await withoutId.handleKey("r");
  assert.equal(withoutId.statusMessage, " Cannot resume: session id is missing");
  assert.equal(attempts, 1);
});
