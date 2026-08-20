import { validateKanjiLearningItem, validateVocabularyLearningItem } from "./japaneseLearningItem.js";

export function compileLearningItem(item, existingCards = [], existingStates = []) {
  if (item.type === "kanji") {
    return compileKanjiCards(item, existingCards, existingStates);
  } else if (item.type === "vocabulary") {
    return compileVocabularyCards(item, existingCards, existingStates);
  } else {
    // Fallback to generic compilation if type is omitted (for backward compatibility during transition)
    return compileGenericCards(item, existingCards, existingStates);
  }
}

export function compileKanjiCards(item, existingCards = [], existingStates = []) {
  validateKanjiLearningItem(item);
  return compileGenericCards(item, existingCards, existingStates);
}

export function compileVocabularyCards(item, existingCards = [], existingStates = []) {
  validateVocabularyLearningItem(item);
  return compileGenericCards(item, existingCards, existingStates);
}

function compileGenericCards(item, existingCards = [], existingStates = []) {
  const now = new Date().toISOString();
  
  // Enforce boundary: existing cards must belong to this item
  for (const card of existingCards) {
    if (card.itemId !== item.id) {
      throw new Error(`Compiler received card ${card.id} belonging to item ${card.itemId}, expected ${item.id}`);
    }
  }
  
  // Map of existing cards by skill for quick lookup
  const cardsBySkill = new Map();
  for (const card of existingCards) {
    cardsBySkill.set(`${card.itemId}:${card.skill}`, card);
  }

  const generatedCards = [];
  const generatedStates = [];

  // Generate or preserve cards for active skills
  for (const skill of (item.skills || [])) {
    const key = `${item.id}:${skill}`;
    let card = cardsBySkill.get(key);
    let state = existingStates.find(s => s.cardId === card?.id);

    if (!card) {
      // Create new card
      const cardId = crypto.randomUUID();
      card = {
        id: cardId,
        itemId: item.id,
        skill: skill,
        status: item.status === "active" ? "active" : "archived",
        createdAt: now,
        updatedAt: now
      };
      
      // Create initial review state
      state = {
        cardId: cardId,
        state: "new",
        due: now, // Due immediately
        reps: 0,
        lapses: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        scheduler: "legacy-sm2", // Default to legacy adapter for now
        schedulerVersion: "1.0",
        updatedAt: now
      };
    } else {
      // Update existing card status if item status changed
      if (item.status === "archived" && card.status !== "archived") {
        card = { ...card, status: "archived", updatedAt: now };
      } else if (item.status === "active" && card.status === "orphaned") {
        card = { ...card, status: "active", updatedAt: now };
      }
    }
    
    generatedCards.push(card);
    if (state) generatedStates.push(state);
    
    cardsBySkill.delete(key); // Remove processed skill
  }

  // Handle removed skills (orphans)
  for (const orphanedCard of cardsBySkill.values()) {
    if (orphanedCard.status !== "orphaned" && orphanedCard.status !== "archived") {
      generatedCards.push({
        ...orphanedCard,
        status: "orphaned",
        updatedAt: now
      });
    } else {
      generatedCards.push(orphanedCard);
    }
    
    const state = existingStates.find(s => s.cardId === orphanedCard.id);
    if (state) {
      generatedStates.push(state);
    }
  }

  return { cards: generatedCards, reviewStates: generatedStates };
}
