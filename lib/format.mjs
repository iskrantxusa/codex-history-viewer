const ESCAPE_RE = /\u001b\[[0-?]*[ -/]*[@-~]/g;

export const ansi = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  brightCyan: "\u001b[96m",
  green: "\u001b[32m",
  brightGreen: "\u001b[92m",
  red: "\u001b[31m",
  brightRed: "\u001b[91m",
  yellow: "\u001b[33m",
  magenta: "\u001b[35m",
  blue: "\u001b[34m",
  brightBlue: "\u001b[94m",
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
      output.push({ text: "", start: offset, source: rawLine });
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
      output.push({ text: rest.slice(0, cut), start, source: rawLine });
      const removedSpace = rest[cut] === " " ? 1 : 0;
      rest = rest.slice(cut + removedSpace);
      start += cut + removedSpace;
    }
    output.push({ text: rest, start, source: rawLine });
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

function span(start, end, style) {
  return { start, end, style };
}

function tokenSpans(text, language) {
  const spans = [];
  const normalized = language.toLocaleLowerCase();
  const rules = [];
  let comments = [];
  if (["js", "javascript", "jsx", "ts", "typescript", "tsx", "mjs", "cjs"].includes(normalized)) {
    rules.push(
      [/\b(?:async|await|break|case|catch|class|const|continue|default|delete|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield)\b/g, ansi.magenta],
      [/\b(?:console|JSON|Math|Promise|Array|Object|String|Number|Boolean|Error|Map|Set)\b/g, ansi.brightCyan],
    );
    comments = [[/\/\/.*|\/\*.*?\*\//g, ansi.gray]];
  } else if (["py", "python"].includes(normalized)) {
    rules.push(
      [/\b(?:and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|match|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b/g, ansi.magenta],
      [/\b(?:print|len|range|str|int|dict|list|set|tuple|Path|Exception)\b/g, ansi.brightCyan],
    );
    comments = [[/#.*$/g, ansi.gray]];
  } else if (["sh", "bash", "shell", "zsh"].includes(normalized)) {
    rules.push(
      [/\b(?:case|do|done|elif|else|esac|export|fi|for|function|if|in|local|readonly|then|while)\b/g, ansi.magenta],
      [/(?:^|\s)(?:cd|echo|printf|test|git|npm|node|python3?|rg|sed|sudo)(?=\s|$)/g, ansi.brightCyan],
    );
    comments = [[/#.*$/g, ansi.gray]];
  } else if (["json", "jsonc"].includes(normalized)) {
    rules.push(
      [/"(?:\\.|[^"\\])*"(?=\s*:)/g, ansi.brightCyan],
      [/\b(?:true|false|null)\b/g, ansi.magenta],
    );
  } else if (["yaml", "yml"].includes(normalized)) {
    rules.push(
      [/^\s*[\w.-]+(?=\s*:)/g, ansi.brightCyan],
      [/\b(?:true|false|null|yes|no)\b/gi, ansi.magenta],
    );
    comments = [[/#.*$/g, ansi.gray]];
  } else if (["css", "scss"].includes(normalized)) {
    rules.push(
      [/[.#]?[a-zA-Z_-][\w-]*(?=\s*\{)/g, ansi.brightCyan],
      [/--?[\w-]+(?=\s*:)/g, ansi.magenta],
    );
    comments = [[/\/\*.*?\*\//g, ansi.gray]];
  }
  rules.push([/\b(?:0x[\da-f]+|\d+(?:\.\d+)?)\b/gi, ansi.yellow]);
  if (!["json", "jsonc"].includes(normalized)) {
    rules.push([/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, ansi.green]);
  }
  rules.push(...comments);
  for (const [expression, style] of rules) {
    for (const match of text.matchAll(expression)) {
      spans.push(span(match.index, match.index + match[0].length, style));
    }
  }
  return spans;
}

function diffLineStyle(text) {
  if (/^diff --git |^index |^--- |^\+\+\+ |^\*\*\* (?:Begin|End|Update|Add|Delete|Move)/.test(text)) {
    return ansi.bold + ansi.gray;
  }
  if (/^@@ /.test(text)) {
    return ansi.brightCyan;
  }
  if (/^\+(?!\+\+ )/.test(text)) {
    return ansi.brightGreen;
  }
  if (/^-(?!--- )/.test(text)) {
    return ansi.brightRed;
  }
  return "";
}

function lineStyleSpans(line, context) {
  if (context.diff) {
    const diffStyle = diffLineStyle(line.source ?? line.text);
    return diffStyle ? [span(0, line.text.length, diffStyle)] : [];
  }
  if (context.code) {
    return tokenSpans(line.text, context.language);
  }
  const trimmed = line.text.trimStart();
  if (/^#{1,6}\s/.test(trimmed)) {
    return [span(0, line.text.length, ansi.bold + ansi.brightCyan)];
  }
  if (/^(\s*[-*+]|\s*\d+\.)\s/.test(line.text)) {
    return [span(0, line.text.length, ansi.cyan)];
  }
  if (trimmed.startsWith(">")) {
    return [span(0, line.text.length, ansi.gray)];
  }
  return [];
}

function styleAt(position, spans) {
  const matching = spans.filter((item) => item.start <= position && position < item.end);
  return matching.length ? matching[matching.length - 1].style : "";
}

function renderStyledLine(line, styleSpans, matches, activeStart, colors) {
  if (!colors) {
    return line.text;
  }
  let value = "";
  const localMatches = matches
    .filter((match) => match.end > line.start && match.start < line.start + line.text.length)
    .map((match) => ({
      start: Math.max(match.start, line.start) - line.start,
      end: Math.min(match.end, line.start + line.text.length) - line.start,
      active: match.start === activeStart,
    }));
  const boundaries = new Set([0, line.text.length]);
  for (const item of [...styleSpans, ...localMatches]) {
    boundaries.add(item.start);
    boundaries.add(item.end);
  }
  const points = [...boundaries].sort((a, b) => a - b);
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const search = localMatches.find((item) => item.start <= start && start < item.end);
    const style = search
      ? search.active ? ansi.activeSearch : ansi.search
      : styleAt(start, styleSpans);
    value += style ? paint(line.text.slice(start, end), style, true) : line.text.slice(start, end);
  }
  return value;
}

export function styledContentLines(text, width, query = "", colors = true, activeStart = null) {
  const lines = wrapTextWithOffsets(text, width);
  const matches = findTextMatches(text, query);
  let code = false;
  let language = "";
  let rawDiff = false;
  return lines.map((line) => {
    const trimmed = line.text.trimStart();
    if (trimmed.startsWith("```")) {
      code = !code;
      language = code ? trimmed.slice(3).trim().split(/\s+/, 1)[0] : "";
      const lineMatches = matches.filter(
        (match) => match.end > line.start && match.start < line.start + line.text.length,
      );
      return {
        text: renderStyledLine(
          line,
          [span(0, line.text.length, ansi.magenta)],
          matches,
          activeStart,
          colors,
        ),
        matches: lineMatches,
      };
    }
    if (!code && /^(?:diff --git |\*\*\* Begin Patch)/.test(line.source ?? line.text)) {
      rawDiff = true;
    }
    const lineMatches = matches.filter(
      (match) => match.end > line.start && match.start < line.start + line.text.length,
    );
    const context = {
      code,
      language,
      diff: (code && ["diff", "patch"].includes(language)) || (!code && rawDiff),
    };
    return {
      text: renderStyledLine(line, lineStyleSpans(line, context), matches, activeStart, colors),
      matches: lineMatches,
    };
  });
}
