import path from "node:path";

function statusLabel(status) {
  if (status === "add") return "added";
  if (status === "delete") return "deleted";
  if (status === "move") return "moved";
  return "modified";
}

export function languageForPath(filePath) {
  const extension = path.extname(filePath).toLocaleLowerCase();
  return {
    ".js": "js",
    ".jsx": "jsx",
    ".mjs": "mjs",
    ".cjs": "cjs",
    ".ts": "ts",
    ".tsx": "tsx",
    ".py": "python",
    ".sh": "sh",
    ".bash": "bash",
    ".zsh": "zsh",
    ".json": "json",
    ".jsonc": "jsonc",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".css": "css",
    ".scss": "scss",
  }[extension] ?? "";
}

export function parseUnifiedDiff(diff, options = {}) {
  const source = String(diff ?? "");
  const lines = source.split("\n");
  const hunks = [];
  let additions = 0;
  let deletions = 0;
  let current = null;
  let oldLine = 0;
  let newLine = 0;
  for (const line of lines) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      current = { header: line, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.lines.push({ kind: "add", text: line.slice(1), raw: line, oldLine: null, newLine });
      newLine += 1;
      additions += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      current.lines.push({ kind: "delete", text: line.slice(1), raw: line, oldLine, newLine: null });
      oldLine += 1;
      deletions += 1;
    } else if (line.startsWith(" ")) {
      current.lines.push({ kind: "context", text: line.slice(1), raw: line, oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    } else if (line.startsWith("\\")) {
      current.lines.push({ kind: "meta", text: line, raw: line, oldLine: null, newLine: null });
    }
  }
  if (!hunks.length) {
    return null;
  }
  const filePath = options.path ?? "";
  return {
    path: filePath,
    status: options.status ?? "update",
    label: statusLabel(options.status ?? "update"),
    language: languageForPath(filePath),
    rawDiff: source,
    hunks,
    additions,
    deletions,
  };
}

function gitPath(value) {
  if (value === "/dev/null") return "";
  return value.replace(/^[ab]\//, "");
}

export function parseGitDiffOutput(output) {
  const source = String(output ?? "");
  const starts = [...source.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)];
  if (!starts.length) {
    return null;
  }
  const cards = [];
  for (let i = 0; i < starts.length; i += 1) {
    const match = starts[i];
    const end = starts[i + 1]?.index ?? source.length;
    const chunk = source.slice(match.index, end).replace(/\n$/, "");
    const lines = chunk.split("\n");
    const oldHeader = lines.find((line) => line.startsWith("--- "))?.slice(4).split("\t", 1)[0];
    const newHeader = lines.find((line) => line.startsWith("+++ "))?.slice(4).split("\t", 1)[0];
    const oldPath = gitPath(oldHeader ?? `a/${match[1]}`);
    const newPath = gitPath(newHeader ?? `b/${match[2]}`);
    const status = !oldPath ? "add" : !newPath ? "delete" : "update";
    const card = parseUnifiedDiff(chunk, { path: newPath || oldPath, status });
    if (!card) {
      return null;
    }
    cards.push(card);
  }
  return { prefix: source.slice(0, starts[0].index).trimEnd(), cards };
}

export function cardsFromPatchEvent(payload) {
  if (!payload.success) {
    return {
      error: payload.stderr || payload.stdout || "Patch application failed.",
      cards: [],
    };
  }
  const cards = Object.entries(payload.changes ?? {}).flatMap(([filePath, change]) => {
    let diff = change.unified_diff;
    if (!diff && change.type === "add" && typeof change.content === "string") {
      const content = change.content.replace(/\n$/, "").split("\n");
      diff = `@@ -0,0 +1,${content.length} @@\n${content.map((line) => `+${line}`).join("\n")}`;
    }
    if (!diff && change.type === "delete" && typeof change.content === "string") {
      const content = change.content.replace(/\n$/, "").split("\n");
      diff = `@@ -1,${content.length} +0,0 @@\n${content.map((line) => `-${line}`).join("\n")}`;
    }
    const card = parseUnifiedDiff(diff, {
      path: change.move_path ?? filePath,
      status: change.type ?? "update",
    });
    return card ? [card] : [];
  });
  return { error: "", cards };
}

export function cardText(card) {
  return `${card.path}\n${card.rawDiff}`;
}
