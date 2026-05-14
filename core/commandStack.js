export function createCommandStack(limit = 300) {
  const undoStack = [];
  const redoStack = [];

  async function execute(command) {
    await command.do();
    undoStack.push(command);
    redoStack.length = 0;
    if (undoStack.length > limit) {
      undoStack.shift();
    }
  }

  async function undo() {
    const command = undoStack.pop();
    if (!command) {
      return false;
    }
    await command.undo();
    redoStack.push(command);
    return true;
  }

  async function redo() {
    const command = redoStack.pop();
    if (!command) {
      return false;
    }
    await command.do();
    undoStack.push(command);
    return true;
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  return {
    execute,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
