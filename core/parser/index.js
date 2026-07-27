function normalizeSource(value) {
  return String(value || "").replace(/\r\n?/g, "\n");
}

function normalizeTag(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\s+/g, "-");
}

function tokenizeSource(source) {
  return source
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter(Boolean);
}

function extractTagsFromSource(source) {
  const matches = source.match(/#([a-zA-Z0-9_-]+)/g) ?? [];
  return [...new Set(matches.map((token) => normalizeTag(token.slice(1))).filter(Boolean))];
}

function parseWikiLinksFromSource(source) {
  const matches = source.match(/\[\[([^\]]+)\]\]/g) ?? [];
  return [...new Set(matches.map((token) => token.slice(2, -2).trim()).filter(Boolean))];
}

function scanMarkdown(source) {
  const lines = source.split("\n");
  const textNodes = [];
  const metadataLines = [];
  const codeBlocks = [];
  let codeLines = [];
  let fenceLanguage = "txt";
  let inFence = false;

  function appendCodeBlock(closed) {
    const code = closed && codeLines.length ? codeLines.join("\n") + "\n" : codeLines.join("\n");
    codeBlocks.push({ language: fenceLanguage, code });
    codeLines = [];
    fenceLanguage = "txt";
    inFence = false;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (inFence) {
      if (trimmed === "```") {
        appendCodeBlock(true);
      } else {
        codeLines.push(line);
      }
      continue;
    }

    const fenceMatch = trimmed.match(/^```([a-z0-9_-]*)$/i);
    if (fenceMatch) {
      inFence = true;
      fenceLanguage = (fenceMatch[1] || "txt").toLowerCase();
      continue;
    }

    metadataLines.push(line);
    if (!trimmed) {
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      textNodes.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2] });
      continue;
    }

    textNodes.push({ type: "paragraph", text: trimmed });
  }

  if (inFence) {
    appendCodeBlock(false);
  }

  return {
    codeBlocks,
    metadataSource: metadataLines.join("\n"),
    textNodes,
  };
}

function analyzeMarkdown(value) {
  const source = normalizeSource(value);
  const { codeBlocks, metadataSource, textNodes } = scanMarkdown(source);
  const tags = extractTagsFromSource(metadataSource);
  const links = parseWikiLinksFromSource(metadataSource);
  const ast = [
    ...textNodes,
    ...links.map((target) => ({ type: "wikilink", target })),
    ...codeBlocks.map((block) => ({ type: "code", language: block.language, text: block.code })),
  ];

  return {
    ast,
    tags,
    links,
    codeBlocks,
    tokens: tokenizeSource(source),
  };
}

export function tokenize(value) {
  return tokenizeSource(normalizeSource(value));
}

export function extractTags(text) {
  return analyzeMarkdown(text).tags;
}

export function parseWikiLinks(text) {
  return analyzeMarkdown(text).links;
}

export function extractCodeBlocks(text) {
  return analyzeMarkdown(text).codeBlocks;
}

export function parseMarkdown(content) {
  return analyzeMarkdown(content).ast;
}

export function parseDocument(content) {
  return analyzeMarkdown(content);
}
