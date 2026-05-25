const ESCAPE_RE = /\u001b\[[0-?]*[ -/]*[@-~]/g;

export const ansi = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  brightCyan: "\u001b[96m",
  green: "\u001b[32m",
  brightGreen: "\u001b[92m",
  yellow: "\u001b[33m",
  magenta: "\u001b[35m",
  blue: "\u001b[34m",
  gray: "\u001b[90m",
  black: "\u001b[30m",
  selected: "\u001b[48;5;236m",
  search: "\u001b[30;43m",
  activeSearch: "\u001b[30;103;1m",
};

export function cleanTerminalText(text) {
  return String(text ?? "")
    .replace(ESCAPE_RE, "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
}

export function plainLength(text) {
  return cleanTerminalText(text).replace(ESCAPE_RE, "").length;
}

export function paint(text, style, colors = true) {
  return colors ? `${style}${text}${ansi.reset}` : text;
}

export function clip(text, width) {
  const value = cleanTerminalText(text);
  if (value.length <= width) {
    return value;
  }
  return width <= 1 ? value.slice(0, width) : `${value.slice(0, width - 1)}…`;
}

export function padStyled(text, width) {
  const remaining = Math.max(0, width - plainLength(text));
  return `${text}${" ".repeat(remaining)}`;
}

export function wrapTextWithOffsets(text, width) {
  if (width <= 1) {
    return [{ text: clip(text, width), start: 0 }];
  }
  const output = [];
  let offset = 0;
  for (const rawLine of cleanTerminalText(text).split("\n")) {
    if (rawLine.length === 0) {
      output.push({ text: "", start: offset });
      offset += 1;
      continue;
    }
    let rest = rawLine;
    let start = offset;
    while (rest.length > width) {
      let cut = rest.lastIndexOf(" ", width);
      if (cut < Math.floor(width / 3)) {
        cut = width;
      }
      output.push({ text: rest.slice(0, cut), start });
      const removedSpace = rest[cut] === " " ? 1 : 0;
      rest = rest.slice(cut + removedSpace);
      start += cut + removedSpace;
    }
    output.push({ text: rest, start });
    offset += rawLine.length + 1;
  }
  return output;
}

export function wrapText(text, width) {
  return wrapTextWithOffsets(text, width).map((line) => line.text);
}

export function findTextMatches(text, query) {
  const value = cleanTerminalText(text);
  const needle = cleanTerminalText(query).toLocaleLowerCase();
  if (!needle) {
    return [];
  }
  const lower = value.toLocaleLowerCase();
  const matches = [];
  let from = 0;
  while (from <= lower.length - needle.length) {
    const start = lower.indexOf(needle, from);
    if (start === -1) {
      break;
    }
    matches.push({ start, end: start + needle.length });
    from = start + needle.length;
  }
  return matches;
}

function highlightSearch(line, matches, activeStart, colors) {
  if (!colors || !matches.length) {
    return line.text;
  }
  let value = "";
  let at = 0;
  const end = line.start + line.text.length;
  for (const match of matches) {
    if (match.end <= line.start || match.start >= end) {
      continue;
    }
    const start = Math.max(match.start, line.start) - line.start;
    const finish = Math.min(match.end, end) - line.start;
    value += line.text.slice(at, start);
    const style = match.start === activeStart ? ansi.activeSearch : ansi.search;
    value += paint(line.text.slice(start, finish), style, true);
    at = finish;
  }
  return value + line.text.slice(at);
}

export function styledContentLines(text, width, query = "", colors = true, activeStart = null) {
  const lines = wrapTextWithOffsets(text, width);
  const matches = findTextMatches(text, query);
  let code = false;
  return lines.map((line) => {
    const trimmed = line.text.trimStart();
    let style = "";
    if (trimmed.startsWith("```")) {
      code = !code;
      style = ansi.magenta;
    } else if (code) {
      style = ansi.yellow;
    } else if (/^#{1,6}\s/.test(trimmed)) {
      style = ansi.bold + ansi.brightCyan;
    } else if (/^(\s*[-*+]|\s*\d+\.)\s/.test(line.text)) {
      style = ansi.cyan;
    } else if (trimmed.startsWith(">")) {
      style = ansi.gray;
    }
    const lineMatches = matches.filter(
      (match) => match.end > line.start && match.start < line.start + line.text.length,
    );
    const highlighted = highlightSearch(line, matches, activeStart, colors);
    return {
      text: colors && style ? paint(highlighted, style, true) : highlighted,
      matches: lineMatches,
    };
  });
}
