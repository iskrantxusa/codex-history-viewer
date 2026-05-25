import path from "node:path";
import {
  ansi,
  cleanTerminalText,
  clip,
  padStyled,
  paint,
  styledContentLines,
} from "./format.mjs";
import { filterSessions } from "./sessions.mjs";

function localTime(iso) {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleStyle(role) {
  if (role === "user") return { label: "YOU", color: ansi.brightGreen };
  if (role === "assistant") return { label: "CODEX", color: ansi.brightCyan };
  if (role === "tool") return { label: "TOOL", color: ansi.magenta };
  return { label: "RESULT", color: ansi.yellow };
}

export class HistoryTui {
  constructor(sessions, options = {}) {
    this.sessions = sessions;
    this.query = options.query ?? "";
    this.filtered = filterSessions(sessions, this.query);
    this.selected = 0;
    this.focus = "sessions";
    this.scroll = 0;
    this.showTools = false;
    this.help = false;
    this.searching = false;
    this.searchBeforeEdit = "";
    this.colors = !options.noColor;
    this.onData = (data) => this.handleKey(data);
    this.onResize = () => this.render();
  }

  current() {
    return this.filtered[this.selected];
  }

  run() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error("Interactive view requires a TTY. Use --list or --plain.");
    }
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", this.onData);
    process.stdout.on("resize", this.onResize);
    process.stdout.write("\u001b[?1049h\u001b[?25l");
    this.render();
  }

  stop() {
    process.stdin.off("data", this.onData);
    process.stdout.off("resize", this.onResize);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\u001b[?25h\u001b[?1049l");
  }

  applySearch(query) {
    this.query = query;
    this.filtered = filterSessions(this.sessions, query);
    this.selected = Math.min(this.selected, Math.max(0, this.filtered.length - 1));
    this.scroll = 0;
  }

  handleKey(key) {
    if (this.searching) {
      if (key === "\r") {
        this.searching = false;
      } else if (key === "\u001b") {
        this.searching = false;
        this.applySearch(this.searchBeforeEdit);
      } else if (key === "\u007f" || key === "\b") {
        this.applySearch(this.query.slice(0, -1));
      } else if (!key.startsWith("\u001b") && key >= " ") {
        this.applySearch(this.query + key);
      }
      this.render();
      return;
    }
    if (key === "q" || key === "\u0003") {
      this.stop();
      return;
    }
    if (key === "/") {
      this.searching = true;
      this.searchBeforeEdit = this.query;
      this.render();
      return;
    }
    if (key === "?" ) {
      this.help = !this.help;
      this.render();
      return;
    }
    if (key === "c") {
      this.applySearch("");
    } else if (key === "t") {
      this.showTools = !this.showTools;
      this.scroll = 0;
    } else if (key === "\t" || key === "\r") {
      this.focus = this.focus === "sessions" ? "dialog" : "sessions";
    } else if (key === "\u001b") {
      this.help = false;
      this.focus = "sessions";
    } else if (key === "\u001b[A" || key === "k") {
      this.move(-1);
    } else if (key === "\u001b[B" || key === "j") {
      this.move(1);
    } else if (key === "\u001b[5~") {
      this.move(-10);
    } else if (key === "\u001b[6~") {
      this.move(10);
    } else if (key === "g") {
      this.moveToStart();
    } else if (key === "G") {
      this.moveToEnd();
    }
    this.render();
  }

  move(amount) {
    if (this.focus === "sessions") {
      const next = Math.max(0, Math.min(this.filtered.length - 1, this.selected + amount));
      if (next !== this.selected) {
        this.selected = next;
        this.scroll = 0;
      }
    } else {
      this.scroll = Math.max(0, this.scroll + amount);
    }
  }

  moveToStart() {
    if (this.focus === "sessions") this.selected = 0;
    else this.scroll = 0;
  }

  moveToEnd() {
    if (this.focus === "sessions") {
      this.selected = Math.max(0, this.filtered.length - 1);
      this.scroll = 0;
    } else {
      this.scroll = Number.MAX_SAFE_INTEGER;
    }
  }

  sessionLines(width, height) {
    if (!this.filtered.length) {
      return [paint("  Nothing found", ansi.gray, this.colors)];
    }
    const start = Math.max(
      0,
      Math.min(this.selected - Math.floor(height / 2), this.filtered.length - height),
    );
    return this.filtered.slice(start, start + height).map((session, offset) => {
      const selected = start + offset === this.selected;
      const marker = selected ? "› " : "  ";
      const title = clip(session.title || "(untitled)", width - marker.length);
      const raw = padStyled(
        `${marker}${selected ? paint(title, ansi.bold, this.colors) : title}`,
        width,
      );
      return selected ? paint(raw, ansi.selected, this.colors) : raw;
    });
  }

  dialogLines(session, width) {
    if (!session) {
      return [paint("No sessions match the search.", ansi.gray, this.colors)];
    }
    const entries = this.showTools ? session.allEntries : session.entries;
    const lines = [];
    for (const entry of entries) {
      const role = roleStyle(entry.role);
      const phase = entry.phase ? ` · ${entry.phase}` : "";
      lines.push(paint(`${role.label}${phase}`, ansi.bold + role.color, this.colors));
      lines.push(...styledContentLines(entry.text, width, this.query, this.colors));
      lines.push("");
    }
    return lines.length ? lines : [paint("Empty dialog.", ansi.gray, this.colors)];
  }

  renderHelp(cols, rows) {
    const help = [
      "Keyboard",
      "",
      "↑/↓ or j/k   select session / scroll dialog",
      "Tab, Enter   change focused panel",
      "/            search all session text",
      "c            clear search",
      "t            show/hide tool activity",
      "g / G        beginning / end",
      "?            close help",
      "q            quit",
    ];
    const width = Math.min(55, cols - 4);
    const left = Math.max(0, Math.floor((cols - width) / 2));
    const top = Math.max(1, Math.floor((rows - help.length - 2) / 2));
    help.forEach((line, i) => {
      const value = padStyled(`  ${clip(line, width - 4)}`, width);
      process.stdout.write(
        `\u001b[${top + i};${left + 1}H${paint(value, ansi.selected, this.colors)}`,
      );
    });
  }

  render() {
    const cols = Math.max(40, process.stdout.columns ?? 100);
    const rows = Math.max(10, process.stdout.rows ?? 30);
    const session = this.current();
    const header = ` Codex History  ${this.filtered.length}/${this.sessions.length} sessions`;
    const status = this.searching
      ? ` Search: ${this.query}▌`
      : ` / search  Tab focus  t tools:${this.showTools ? "on" : "off"}  ? help  q quit`;
    const bodyHeight = rows - 3;
    const leftWidth = Math.min(45, Math.max(25, Math.floor(cols * 0.32)));
    const rightWidth = cols - leftWidth - 3;
    const left = this.sessionLines(leftWidth, bodyHeight);
    const dialog = this.dialogLines(session, rightWidth);
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, dialog.length - bodyHeight)));
    const right = dialog.slice(this.scroll, this.scroll + bodyHeight);
    const details = session
      ? `${localTime(session.startedAt)}  ${session.cwd || path.basename(session.path)}`
      : "No matching dialog";
    const output = [];
    output.push(
      paint(padStyled(clip(header, cols), cols), ansi.bold + ansi.selected, this.colors),
    );
    output.push(
      `${paint(padStyled(this.focus === "sessions" ? " DIALOGS " : " Dialogs ", leftWidth), ansi.cyan, this.colors)} │ ${paint(clip(details, rightWidth), ansi.gray, this.colors)}`,
    );
    for (let i = 0; i < bodyHeight; i += 1) {
      const lhs = left[i] ?? " ".repeat(leftWidth);
      const rhs = right[i] ?? "";
      output.push(`${padStyled(lhs, leftWidth)} │ ${rhs}`);
    }
    output.push(paint(padStyled(clip(status, cols), cols), ansi.selected, this.colors));
    process.stdout.write(`\u001b[H\u001b[2J${output.slice(0, rows).join("\n")}`);
    if (this.help) {
      this.renderHelp(cols, rows);
    }
  }
}

export function printSession(session, { showTools = false, colors = true } = {}) {
  const entries = showTools ? session.allEntries : session.entries;
  const metadata = [
    paint(session.title, ansi.bold + ansi.brightCyan, colors),
    paint(`${localTime(session.startedAt)}  ${session.cwd || session.path}`, ansi.gray, colors),
    "",
  ];
  for (const entry of entries) {
    const role = roleStyle(entry.role);
    metadata.push(paint(role.label, ansi.bold + role.color, colors));
    metadata.push(cleanTerminalText(entry.text));
    metadata.push("");
  }
  return metadata.join("\n");
}
