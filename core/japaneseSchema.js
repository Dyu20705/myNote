export const JAPANESE_ITEM_TYPES = Object.freeze(["kanji", "vocabulary", "grammar", "output", "sentence"]);
export const JAPANESE_CARD_SKILLS = Object.freeze(["recognition", "meaning", "reading", "form-recall"]);
export const JAPANESE_CARD_STATUSES = Object.freeze(["new", "learning", "review", "suspended"]);
export const JAPANESE_REVIEW_RATINGS = Object.freeze(["again", "hard", "good", "easy"]);

function throwInvalid(message) {
  const error = new TypeError(message);
  error.code = "INVALID_JAPANESE_SCHEMA";
  throw error;
}

export function validateJapaneseItem(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throwInvalid("Item must be an object");
  }
  
  const id = String(raw.id || "");
  const noteId = String(raw.noteId || "");
  const type = String(raw.type || "");
  const target = String(raw.target || "");
  
  if (!id) throwInvalid("Missing id");
  if (!noteId) throwInvalid("Missing noteId");
  if (!JAPANESE_ITEM_TYPES.includes(type)) throwInvalid("Invalid type");
  if (!target || typeof raw.target !== "string") throwInvalid("Missing or invalid target");
  
  if (typeof raw.createdAt !== "number" || Number.isNaN(raw.createdAt)) throwInvalid("Invalid createdAt");
  if (typeof raw.updatedAt !== "number" || Number.isNaN(raw.updatedAt)) throwInvalid("Invalid updatedAt");
  
  const item = {
    id,
    noteId,
    type,
    target,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
  
  if ("reading" in raw && raw.reading !== undefined) {
    if (typeof raw.reading !== "string") throwInvalid("Invalid reading");
    item.reading = raw.reading;
  }
  
  if ("meaning" in raw && raw.meaning !== undefined) {
    if (typeof raw.meaning !== "string") throwInvalid("Invalid meaning");
    item.meaning = raw.meaning;
  }
  
  return item;
}

export function validateJapaneseCard(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throwInvalid("Card must be an object");
  }
  
  const id = String(raw.id || "");
  const itemId = String(raw.itemId || "");
  const skill = String(raw.skill || "");
  const status = String(raw.status || "");
  
  if (!id) throwInvalid("Missing id");
  if (!itemId) throwInvalid("Missing itemId");
  if (!JAPANESE_CARD_SKILLS.includes(skill)) throwInvalid("Invalid skill");
  if (!JAPANESE_CARD_STATUSES.includes(status)) throwInvalid("Invalid status");
  
  if (typeof raw.nextReviewAt !== "number" || Number.isNaN(raw.nextReviewAt)) throwInvalid("Invalid nextReviewAt");
  if (typeof raw.interval !== "number" || Number.isNaN(raw.interval) || raw.interval < 0) throwInvalid("Invalid interval");
  if (typeof raw.ease !== "number" || Number.isNaN(raw.ease) || raw.ease < 1.3 || raw.ease > 3.0) throwInvalid("Invalid ease");
  if (typeof raw.lapses !== "number" || Number.isNaN(raw.lapses) || raw.lapses < 0) throwInvalid("Invalid lapses");
  
  return {
    id,
    itemId,
    skill,
    status,
    nextReviewAt: raw.nextReviewAt,
    interval: raw.interval,
    ease: raw.ease,
    lapses: raw.lapses,
  };
}

export function validateJapaneseReviewLog(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throwInvalid("ReviewLog must be an object");
  }
  
  const id = String(raw.id || "");
  const cardId = String(raw.cardId || "");
  const rating = String(raw.rating || "");
  const previousStatus = String(raw.previousStatus || "");
  
  if (!id) throwInvalid("Missing id");
  if (!cardId) throwInvalid("Missing cardId");
  if (!JAPANESE_REVIEW_RATINGS.includes(rating)) throwInvalid("Invalid rating");
  if (!JAPANESE_CARD_STATUSES.includes(previousStatus)) throwInvalid("Invalid previousStatus");
  
  if (typeof raw.reviewedAt !== "number" || Number.isNaN(raw.reviewedAt)) throwInvalid("Invalid reviewedAt");
  if (typeof raw.responseTimeMs !== "number" || Number.isNaN(raw.responseTimeMs) || raw.responseTimeMs < 0) throwInvalid("Invalid responseTimeMs");
  if (typeof raw.previousInterval !== "number" || Number.isNaN(raw.previousInterval) || raw.previousInterval < 0) throwInvalid("Invalid previousInterval");
  if (typeof raw.previousEase !== "number" || Number.isNaN(raw.previousEase) || raw.previousEase < 1.3 || raw.previousEase > 3.0) throwInvalid("Invalid previousEase");
  if (typeof raw.previousNextReviewAt !== "number" || Number.isNaN(raw.previousNextReviewAt)) throwInvalid("Invalid previousNextReviewAt");
  
  return {
    id,
    cardId,
    rating,
    reviewedAt: raw.reviewedAt,
    responseTimeMs: raw.responseTimeMs,
    previousStatus,
    previousInterval: raw.previousInterval,
    previousEase: raw.previousEase,
    previousNextReviewAt: raw.previousNextReviewAt,
  };
}
