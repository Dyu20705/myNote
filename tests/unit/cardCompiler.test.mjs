import { describe, it } from "node:test";
import assert from "node:assert";
import { compileLearningItem } from "../../core/cardCompiler.js";

describe("Card Compiler", () => {
  const mockItem = {
    id: "item-123",
    type: "vocabulary",
    content: { writtenForm: "猫", meanings: ["cat"] },
    skills: ["recognition", "meaning"],
    status: "active",
  };

  it("should generate new cards for a new item", () => {
    const { cards, reviewStates } = compileLearningItem(mockItem);
    assert.strictEqual(cards.length, 2);
    assert.strictEqual(reviewStates.length, 2);
    
    const recognitionCard = cards.find(c => c.skill === "recognition");
    assert.ok(recognitionCard);
    assert.strictEqual(recognitionCard.status, "active");
    assert.strictEqual(recognitionCard.itemId, "item-123");
    
    const meaningState = reviewStates.find(s => s.cardId === cards.find(c => c.skill === "meaning").id);
    assert.ok(meaningState);
    assert.strictEqual(meaningState.state, "new");
  });

  it("should preserve exact Card/ReviewState identity and update updatedAt", async () => {
    const { cards: initialCards, reviewStates: initialStates } = compileLearningItem(mockItem);
    
    const recognitionCard = initialCards.find(c => c.skill === "recognition");
    const recognitionState = initialStates.find(s => s.cardId === recognitionCard.id);
    
    // Wait slightly to ensure timestamp difference
    await new Promise(r => setTimeout(r, 10));

    const updatedItem = { ...mockItem, skills: ["recognition"] }; // removed 'meaning'
    const { cards: nextCards, reviewStates: nextStates } = compileLearningItem(updatedItem, initialCards, initialStates);
    
    assert.strictEqual(nextCards.length, 2);
    
    const nextRecognitionCard = nextCards.find(c => c.skill === "recognition");
    const meaningCard = nextCards.find(c => c.skill === "meaning");
    
    assert.strictEqual(nextRecognitionCard.id, recognitionCard.id, "Identity preserved for Card");
    assert.strictEqual(nextRecognitionCard.createdAt, recognitionCard.createdAt, "createdAt unchanged");
    assert.strictEqual(nextRecognitionCard.status, "active");
    
    const nextRecognitionState = nextStates.find(s => s.cardId === nextRecognitionCard.id);
    assert.strictEqual(nextRecognitionState.cardId, recognitionState.cardId, "Identity preserved for ReviewState");
    
    assert.strictEqual(meaningCard.status, "orphaned", "Removed skill causes card to be orphaned");
    assert.notStrictEqual(meaningCard.updatedAt, initialCards.find(c => c.skill === "meaning").updatedAt, "updatedAt should change when status changes");
  });
});
