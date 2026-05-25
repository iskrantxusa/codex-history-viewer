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

export function wrapText(text, width) {
  if (width <= 1) {
    return [clip(text, width)];
  }
  const output = [];
  for (const rawLine of cleanTerminalText(text).split("\n")) {
    if (rawLine.length === 0) {
      output.push("");
      continue;
    }
    let rest = rawLine;
    while (rest.length > width) {
      let cut = rest.lastIndexOf(" ", width);
      if (cut < Math.floor(width / 3)) {
        cut = width;
      }
      output.push(rest.slice(0, cut));
      rest = rest.slice(cut).replace(/^ /, "");
    }
    output.push(rest);
  }
  return output;
}

function highlightSearch(text, query, colors) {
  if (!query || !colors) {
    return text;
  }
  const start = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (start === -1) {
    return text;
  }
  return (
    text.slice(0, start) +
    paint(text.slice(start, start + query.length), ansi.search, true) +
    text.slice(start + query.length)
  );
}

export function styledContentLines(text, width, query = "", colors = true) {
  const lines = wrapText(text, width);
  let code = false;
  return lines.map((line) => {
    const trimmed = line.trimStart();
    let style = "";
    if (trimmed.startsWith("```")) {
      code = !code;
      style = ansi.magenta;
    } else if (code) {
      style = ansi.yellow;
    } else if (/^#{1,6}\s/.test(trimmed)) {
      style = ansi.bold + ansi.brightCyan;
    } else if (/^(\s*[-*+]|\s*\d+\.)\s/.test(line)) {
      style = ansi.cyan;
    } else if (trimmed.startsWith(">")) {
      style = ansi.gray;
    }
    const highlighted = highlightSearch(line, query, colors);
    return colors && style ? paint(highlighted, style, true) : highlighted;
  });
}
