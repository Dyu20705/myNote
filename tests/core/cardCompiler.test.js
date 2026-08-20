import { compileLearningItem } from "../../core/cardCompiler.js";

const mockItem = {
  id: "item-123",
  type: "vocabulary",
  content: { writtenForm: "猫", meanings: ["cat"] },
  skills: ["recognition", "meaning"],
  status: "active",
};

export function runTests() {
  console.log("Running Card Compiler tests...");
  let failCount = 0;

  // Test 1: New generation
  const { cards, reviewStates } = compileLearningItem(mockItem);
  if (cards.length !== 2 || reviewStates.length !== 2) {
    console.error("❌ Test 1 failed: Expected 2 cards and 2 states.");
    failCount++;
  }
  
  const recognitionCard = cards.find(c => c.skill === "recognition");
  if (!recognitionCard || recognitionCard.status !== "active") {
    console.error("❌ Test 1 failed: Missing active recognition card.");
    failCount++;
  }

  // Test 2: Idempotency & removal
  const updatedItem = { ...mockItem, skills: ["recognition"] }; // removed 'meaning'
  const { cards: nextCards } = compileLearningItem(updatedItem, cards, reviewStates);
  
  if (nextCards.length !== 2) {
    console.error("❌ Test 2 failed: Should still output 2 cards.");
    failCount++;
  }
  
  const meaningCard = nextCards.find(c => c.skill === "meaning");
  if (meaningCard.status !== "orphaned") {
    console.error("❌ Test 2 failed: meaning card should be orphaned.");
    failCount++;
  }

  if (failCount === 0) console.log("✅ All compiler tests passed.");
  return failCount;
}

runTests();
