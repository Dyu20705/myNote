export function validateKanjiLearningItem(item) {
  if (!item || !item.id) {
    throw new Error("Invalid learning item: missing id");
  }

  if (!item.content || typeof item.content !== "object") {
    throw new Error("Kanji item must have a content object");
  }
  const { character, primaryReading, primaryWord, meaning, sourceInkId } = item.content;
  if (typeof character !== "string" || !character.trim()) throw new Error("Kanji item missing character");
  if (typeof primaryReading !== "string" || !primaryReading.trim()) throw new Error("Kanji item missing primaryReading");
  if (typeof primaryWord !== "string" || !primaryWord.trim()) throw new Error("Kanji item missing primaryWord");
  if (typeof meaning !== "string" || !meaning.trim()) throw new Error("Kanji item missing meaning");
  
  if (sourceInkId !== undefined && typeof sourceInkId !== "string") {
    throw new Error("Kanji item sourceInkId must be a string if provided");
  }

  // A LearningItem may exist with zero enabled skills. Such an item generates zero StudyCards.
  const allowedSkills = new Set(["recognition", "form_recall"]);
  for (const skill of (item.skills || [])) {
    if (!allowedSkills.has(skill)) {
      throw new Error(`Unsupported skill for Kanji item: ${skill}`);
    }
  }

  return item;
}

export function validateVocabularyLearningItem(item) {
  if (!item || !item.id) {
    throw new Error("Invalid learning item: missing id");
  }
  
  if (!item.content || typeof item.content !== "object") {
    throw new Error("Vocabulary item must have a content object");
  }

  return item;
}


export function validateGrammarLearningItem(item) {
  if (!item || !item.id) {
    throw new Error("Invalid learning item: missing id");
  }

  if (!item.content || typeof item.content !== "object") {
    throw new Error("Grammar item must have a content object");
  }

  const { pattern, meaning, contexts } = item.content;
  if (typeof pattern !== "string" || !pattern.trim()) {
    throw new Error("Grammar item missing pattern");
  }

  if (!Array.isArray(meaning)) {
    throw new Error("Grammar item missing meaning or meaning is not an array");
  }
  for (const m of meaning) {
    if (typeof m !== "string" || !m.trim()) {
      throw new Error("Grammar item meaning elements must be non-empty strings");
    }
  }

  if (!Array.isArray(contexts)) {
    throw new Error("Grammar item missing contexts or contexts is not an array");
  }
  for (const c of contexts) {
    if (typeof c !== "string" || !c.trim()) {
      throw new Error("Grammar item context elements must be non-empty strings");
    }
  }

  const allowedSkills = new Set(["recognition", "meaning"]);
  for (const skill of (item.skills || [])) {
    if (!allowedSkills.has(skill)) {
      throw new Error(`Unsupported skill for Grammar item: ${skill}`);
    }
  }

  return item;
}
