import { JAPANESE_ITEM_TYPES, validateJapaneseItem, validateJapaneseCard } from "./japaneseSchema.js";

function buildItem(note, review) {
  return validateJapaneseItem({
    id: `item-${note.id}`,
    noteId: note.id,
    type: review.notebookType,
    target: note.title || "Untitled",
    createdAt: Date.parse(note.createdAt) || Date.now(),
    updatedAt: Date.parse(note.updatedAt) || Date.now(),
  });
}

function buildCards(item, review) {
  const baseCard = {
    itemId: item.id,
    status: review.status,
    nextReviewAt: Date.parse(review.nextReviewAt) || Date.now(),
    interval: review.interval,
    ease: review.ease,
    lapses: 0,
  };

  let skills = [];
  if (item.type === "kanji" || item.type === "vocabulary") {
    skills = ["recognition", "reading", "meaning"];
  } else if (item.type === "grammar" || item.type === "sentence") {
    skills = ["recognition"];
  } else if (item.type === "output") {
    skills = ["form-recall"];
  }

  return skills.map((skill) =>
    validateJapaneseCard({
      id: `card-${item.id}-${skill}`,
      skill,
      ...baseCard,
    })
  );
}

export function migrateV1ReviewToV2(v1Note, v1Review) {
  const emptyResult = { items: [], cards: [], logs: [] };

  if (!v1Note || typeof v1Note !== "object") return emptyResult;
  if (!v1Review || typeof v1Review !== "object") return emptyResult;
  if (!JAPANESE_ITEM_TYPES.includes(v1Review.notebookType)) return emptyResult;

  try {
    const item = buildItem(v1Note, v1Review);
    const cards = buildCards(item, v1Review);
    return { items: [item], cards, logs: [] };
  } catch (err) {
    if (err && err.code === "INVALID_JAPANESE_SCHEMA") {
      return emptyResult;
    }
    throw err;
  }
}
