#!/usr/bin/env node
import { loadSessions, filterSessions, DEFAULT_SESSIONS_DIR } from "../lib/sessions.mjs";
import { HistoryTui, printSession } from "../lib/tui.mjs";

function usage() {
  return `codex-history - terminal viewer for codex-cli sessions

Usage:
  codex-history                         Open interactive viewer
  codex-history --list                  List dialogs
  codex-history --plain [--session ID]  Print one dialog without TUI

Options:
  -d, --dir PATH       Sessions directory (default: ${DEFAULT_SESSIONS_DIR})
  -s, --search TEXT    Search/filter dialog contents
  --session ID         Select session by id or filename fragment
  --tools              Include tool calls/results in --plain or open with them shown
  --no-color           Disable ANSI colors
  -h, --help           Show this help

Keys in interactive mode:
  Up/Down, j/k  navigate or scroll    Tab/Enter  switch panel
  /             search                n/N        next/previous match
  c             clear search
  t             tool activity         ?          shortcuts
  g/G           top/bottom             q          quit`;
}

function parseArguments(args) {
  const result = { dir: DEFAULT_SESSIONS_DIR, query: "", session: "" };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--list") result.list = true;
    else if (arg === "--plain") result.plain = true;
    else if (arg === "--tools") result.tools = true;
    else if (arg === "--no-color") result.noColor = true;
    else if (arg === "-h" || arg === "--help") result.help = true;
    else if (arg === "-d" || arg === "--dir") result.dir = args[++i];
    else if (arg === "-s" || arg === "--search") result.query = args[++i] ?? "";
    else if (arg === "--session") result.session = args[++i] ?? "";
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!result.dir) throw new Error("--dir requires a path");
  return result;
}

function selectSession(sessions, id) {
  if (!id) return sessions[0];
  const needle = id.toLocaleLowerCase();
  return sessions.find(
    (session) =>
      session.id.toLocaleLowerCase().includes(needle) ||
      session.path.toLocaleLowerCase().includes(needle),
  );
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n\n${usage()}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(usage());
    return;
  }
  let sessions;
  try {
    sessions = await loadSessions(options.dir);
  } catch (error) {
    console.error(`Unable to read sessions: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const matchingSessions = filterSessions(sessions, options.query);
  if (!matchingSessions.length) {
    console.error("No matching Codex sessions found.");
    process.exitCode = 1;
    return;
  }
  if (options.list) {
    for (const session of matchingSessions) {
      const date = session.startedAt.slice(0, 16).replace("T", " ");
      console.log(`${date.padEnd(17)} ${session.id.slice(0, 8)}  ${session.title}`);
    }
    return;
  }
  if (options.plain || !process.stdout.isTTY || !process.stdin.isTTY) {
    const session = selectSession(matchingSessions, options.session);
    if (!session) {
      console.error(`Session not found: ${options.session}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      printSession(session, {
        showTools: options.tools,
        colors: Boolean(process.stdout.isTTY) && !options.noColor,
      }),
    );
    return;
  }
  const tui = new HistoryTui(sessions, { query: options.query, noColor: options.noColor });
  tui.showTools = Boolean(options.tools);
  tui.run();
}

main();
