export function compileLearningItem(item, existingCards = [], existingStates = []) {
  const now = new Date().toISOString();
  
  // Map of existing cards by skill for quick lookup
  const cardsBySkill = new Map();
  for (const card of existingCards) {
    cardsBySkill.set(card.skill, card);
  }

  const generatedCards = [];
  const generatedStates = [];

  // Generate or preserve cards for active skills
  for (const skill of item.skills) {
    let card = cardsBySkill.get(skill);
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
    
    cardsBySkill.delete(skill); // Remove processed skill
  }

  // Handle removed skills (orphans)
  for (const [skill, orphanedCard] of cardsBySkill.entries()) {
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
