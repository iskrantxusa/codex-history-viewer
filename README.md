# codex-history-viewer

A full-screen terminal viewer for reading `codex-cli` history stored in
`~/.codex/sessions`. It runs on Node.js 20+ with no third-party dependencies.

## Features

- Two-pane TUI with the session list on the left and conversation view on the right.
- Search across titles, working directories, and message contents.
- Next/previous match navigation with automatic scrolling inside a selected session.
- Highlighting for roles, Markdown headings, lists, and fenced code blocks.
- Optional display of tool calls and their results.
- Plain-text output for piping, scripting, and quick inspection.
- Native support for the Codex JSONL session format with internal message duplicates removed.

## Installation And Usage

```bash
npm link
codex-history
```

Run without installing the global command:

```bash
node ./bin/codex-history.mjs
```

Useful commands:

```bash
codex-history --list
codex-history --search "wheel" --list
codex-history --plain --session 019e5fed
codex-history --plain --tools
codex-history --dir /another/sessions/path
```

## TUI Key Bindings

| Key | Action |
| --- | --- |
| `Up` / `Down`, `j` / `k` | Select a session or scroll messages |
| `Tab`, `Enter` | Switch focus between panes |
| `/` | Search across all sessions |
| `n`, `N` | Move to the next or previous match in the selected session |
| `c` | Clear search |
| `t` | Show or hide tool activity |
| `g`, `G` | Move to the beginning or end |
| `?` | Show keyboard help |
| `q` | Quit |

Search filters sessions using conversation text and session metadata. The
`Match X/Y` counter and `n` / `N` navigation refer to occurrences in the
selected session's conversation and tool activity. Navigating to a tool
activity match automatically reveals tool output.

## Verification

```bash
npm test
node ./bin/codex-history.mjs --list
```
