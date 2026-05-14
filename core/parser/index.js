function normalizeTag(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\s+/g, "-");
}

export function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter(Boolean);
}

export function extractTags(text) {
  const matches = String(text || "").match(/#([a-zA-Z0-9_-]+)/g) ?? [];
  return [...new Set(matches.map((token) => normalizeTag(token.slice(1))).filter(Boolean))];
}

export function parseWikiLinks(text) {
  const matches = String(text || "").match(/\[\[([^\]]+)\]\]/g) ?? [];
  return [...new Set(matches.map((token) => token.slice(2, -2).trim()).filter(Boolean))];
}

export function extractCodeBlocks(text) {
  const source = String(text || "");
  const matches = [...source.matchAll(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi)];
  return matches.map((match) => ({
    language: (match[1] || "txt").toLowerCase(),
    code: match[2] || "",
  }));
}

export function parseMarkdown(content) {
  const source = String(content || "");
  const lines = source.split("\n");
  const nodes = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      nodes.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2] });
      continue;
    }

    nodes.push({ type: "paragraph", text: trimmed });
  }

  for (const link of parseWikiLinks(source)) {
    nodes.push({ type: "wikilink", target: link });
  }

  for (const block of extractCodeBlocks(source)) {
    nodes.push({ type: "code", language: block.language, text: block.code });
  }

  return nodes;
}

export function parseDocument(content) {
  const ast = parseMarkdown(content);
  const tags = extractTags(content);
  const links = parseWikiLinks(content);
  const codeBlocks = extractCodeBlocks(content);
  const tokens = tokenize(content);

  return {
    ast,
    tags,
    links,
    codeBlocks,
    tokens,
  };
}
