/**
 * Pure functions for calculating note statistics and metrics.
 */

export function calculateWordCount(text = "") {
  const normalized = String(text || "").trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).filter(Boolean).length;
}

export function calculateCharacterCount(text = "") {
  return String(text || "").length;
}

export function calculateReadingTimeMinutes(text = "") {
  const words = calculateWordCount(text);
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / 200));
}

export function calculateParagraphCount(text = "") {
  const normalized = String(text || "").trim();
  if (!normalized) return 0;
  return normalized.split(/\n\s*\n/).filter((block) => block.trim().length > 0).length;
}

export function computeNoteStats(text = "") {
  const words = calculateWordCount(text);
  const characters = calculateCharacterCount(text);
  const readingTime = calculateReadingTimeMinutes(text);
  const paragraphs = calculateParagraphCount(text);

  return {
    words,
    characters,
    readingTimeMinutes: readingTime,
    paragraphs,
  };
}
