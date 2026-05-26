# codex-history-viewer

A full-screen terminal viewer for reading `codex-cli` history stored in
`~/.codex/sessions`. Standalone Linux builds require no runtime dependencies;
the npm package runs on Node.js 22+ with no application dependencies.

## Features

- Two-pane TUI with the session list on the left and conversation view on the right.
- Search across titles, working directories, and message contents.
- Next/previous match navigation with automatic scrolling inside a selected session.
- Syntax highlighting for common fenced code blocks and Codex-style Git/patch changes.
- Review-style Git Changes cards with file headers, line numbers, and full-width added/removed backgrounds.
- Optional display of tool calls and their results.
- Copy a `codex resume` command for the selected dialog to the clipboard.
- Plain-text output for piping, scripting, and quick inspection.
- Native support for the Codex JSONL session format with internal message duplicates removed.

## Installation

### Install Script (Linux)

Install the latest standalone binary into `~/.local/bin`:

```bash
curl -fsSL https://raw.githubusercontent.com/iskrantxusa/codex-history-viewer/main/install.sh | sh
```

The script supports Linux `x86_64` and `arm64`, verifies the release checksum,
and does not use `sudo`. Pin a version or choose another install directory:

```bash
curl -fsSL https://raw.githubusercontent.com/iskrantxusa/codex-history-viewer/main/install.sh |
  VERSION=v0.1.0 INSTALL_DIR="$HOME/bin" sh
```

### npm

With Node.js 22 or newer:

```bash
npm install -g codex-history-viewer
codex-history
```

### Debian And RPM Packages

```bash
# Debian / Ubuntu / Linux Mint
sudo apt install ./codex-history-viewer_0.1.0_amd64.deb

# Fedora / RHEL-family
sudo dnf install ./codex-history-viewer-0.1.0-1.x86_64.rpm
```

Packages and standalone archives for `amd64`/`x86_64` and `arm64`/`aarch64`
are attached to each [GitHub Release](https://github.com/iskrantxusa/codex-history-viewer/releases).

### Clipboard Support

The viewer works without desktop integration. To use `r` for copying a
`codex resume` command, install one clipboard helper appropriate for your
session:

```bash
# Debian / Ubuntu / Linux Mint
sudo apt install wl-clipboard   # Wayland
sudo apt install xclip          # X11

# Fedora
sudo dnf install wl-clipboard   # Wayland
sudo dnf install xclip          # X11
```

## Usage

Useful commands:

```bash
codex-history --list
codex-history --search "wheel" --list
codex-history --plain --session 019e5fed
codex-history --plain --tools
codex-history --dir /another/sessions/path
```

Run directly from a source checkout:

```bash
npm install
node ./bin/codex-history.mjs
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
| `r` | Copy `codex resume <session-id>` for the selected dialog |
| `g`, `G` | Move to the beginning or end |
| `?` | Show keyboard help |
| `q` | Quit |

Search filters sessions using conversation text and session metadata. The
`Match X/Y` counter and `n` / `N` navigation refer to occurrences in the
selected session's conversation and tool activity. Navigating to a tool
activity match automatically reveals tool output.

With tool activity enabled, applied patches and `git diff` output are rendered
as file-by-file change cards with source syntax highlighting layered over the
added and removed line backgrounds.

## Upgrade And Uninstall

```bash
# Install-script installation: update and remove
curl -fsSL https://raw.githubusercontent.com/iskrantxusa/codex-history-viewer/main/install.sh | sh
rm "$HOME/.local/bin/codex-history"

# npm
npm update -g codex-history-viewer
npm uninstall -g codex-history-viewer

# Debian / Ubuntu / Linux Mint
sudo apt remove codex-history-viewer

# Fedora / RHEL-family
sudo dnf remove codex-history-viewer
```

## Verification

```bash
npm install
npm test
node ./bin/codex-history.mjs --list
```
