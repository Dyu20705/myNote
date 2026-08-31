/**
 * Pure functions for text selection transformations in Markdown textareas.
 * These functions have zero DOM dependencies and return { value, selectionStart, selectionEnd }.
 */

export function wrapSelection(text, selectionStart, selectionEnd, prefix, suffix = prefix) {
  const safeText = String(text ?? "");
  const start = Math.max(0, Math.min(selectionStart, safeText.length));
  const end = Math.max(start, Math.min(selectionEnd, safeText.length));

  // Check if current selection is already wrapped with prefix and suffix
  const prefixLen = prefix.length;
  const suffixLen = suffix.length;

  const hasOuterWrapper =
    start >= prefixLen &&
    end + suffixLen <= safeText.length &&
    safeText.slice(start - prefixLen, start) === prefix &&
    safeText.slice(end, end + suffixLen) === suffix;

  if (hasOuterWrapper && start !== end) {
    // Unwrap selection
    const value =
      safeText.slice(0, start - prefixLen) +
      safeText.slice(start, end) +
      safeText.slice(end + suffixLen);
    return {
      value,
      selectionStart: start - prefixLen,
      selectionEnd: end - prefixLen,
    };
  }

  const selectedText = safeText.slice(start, end);
  const before = safeText.slice(0, start);
  const after = safeText.slice(end);

  const value = `${before}${prefix}${selectedText}${suffix}${after}`;

  if (start === end) {
    // Collapsed cursor: position cursor between prefix and suffix
    return {
      value,
      selectionStart: start + prefixLen,
      selectionEnd: start + prefixLen,
    };
  }

  return {
    value,
    selectionStart: start + prefixLen,
    selectionEnd: end + prefixLen,
  };
}

export function insertBold(text, selectionStart, selectionEnd) {
  return wrapSelection(text, selectionStart, selectionEnd, "**");
}

export function insertItalic(text, selectionStart, selectionEnd) {
  return wrapSelection(text, selectionStart, selectionEnd, "*");
}

export function insertStrikethrough(text, selectionStart, selectionEnd) {
  return wrapSelection(text, selectionStart, selectionEnd, "~~");
}

export function insertInlineCode(text, selectionStart, selectionEnd) {
  return wrapSelection(text, selectionStart, selectionEnd, "`");
}

export function insertLink(text, selectionStart, selectionEnd, url = "url") {
  const safeText = String(text ?? "");
  const start = Math.max(0, Math.min(selectionStart, safeText.length));
  const end = Math.max(start, Math.min(selectionEnd, safeText.length));
  const selected = safeText.slice(start, end);

  if (!selected) {
    const placeholder = "[title](url)";
    const value = `${safeText.slice(0, start)}${placeholder}${safeText.slice(end)}`;
    return {
      value,
      selectionStart: start + 1,
      selectionEnd: start + 6, // selects "title"
    };
  }

  const value = `${safeText.slice(0, start)}[${selected}](${url})${safeText.slice(end)}`;
  return {
    value,
    selectionStart: start + selected.length + 3,
    selectionEnd: start + selected.length + 3 + url.length, // selects "url"
  };
}

export function cycleHeading(text, selectionStart) {
  const safeText = String(text ?? "");
  const pos = Math.max(0, Math.min(selectionStart, safeText.length));

  // Find current line bounds
  const lineStart = safeText.lastIndexOf("\n", pos - 1) + 1;
  let lineEnd = safeText.indexOf("\n", pos);
  if (lineEnd === -1) {
    lineEnd = safeText.length;
  }

  const line = safeText.slice(lineStart, lineEnd);
  let nextLine;
  let delta;

  if (line.startsWith("### ")) {
    nextLine = line.slice(4);
    delta = -4;
  } else if (line.startsWith("## ")) {
    nextLine = `### ${line.slice(3)}`;
    delta = 1;
  } else if (line.startsWith("# ")) {
    nextLine = `## ${line.slice(2)}`;
    delta = 1;
  } else {
    nextLine = `# ${line}`;
    delta = 2;
  }

  const value = `${safeText.slice(0, lineStart)}${nextLine}${safeText.slice(lineEnd)}`;
  const nextPos = Math.max(lineStart, Math.min(pos + delta, lineStart + nextLine.length));

  return {
    value,
    selectionStart: nextPos,
    selectionEnd: nextPos,
  };
}

export function insertTaskItem(text, selectionStart) {
  const safeText = String(text ?? "");
  const pos = Math.max(0, Math.min(selectionStart, safeText.length));

  const lineStart = safeText.lastIndexOf("\n", pos - 1) + 1;
  let lineEnd = safeText.indexOf("\n", pos);
  if (lineEnd === -1) {
    lineEnd = safeText.length;
  }

  const line = safeText.slice(lineStart, lineEnd);
  let nextLine;
  let delta;

  const taskRegex = /^- \[[ xX]\] /;
  if (taskRegex.test(line)) {
    const matchLen = line.match(taskRegex)[0].length;
    nextLine = line.slice(matchLen);
    delta = -matchLen;
  } else {
    nextLine = `- [ ] ${line}`;
    delta = 6;
  }

  const value = `${safeText.slice(0, lineStart)}${nextLine}${safeText.slice(lineEnd)}`;
  const nextPos = Math.max(lineStart, Math.min(pos + delta, lineStart + nextLine.length));

  return {
    value,
    selectionStart: nextPos,
    selectionEnd: nextPos,
  };
}
