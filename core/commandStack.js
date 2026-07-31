let activeCommandStack = null;

export function getActiveCommandStack() {
  return activeCommandStack;
}

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
    try {
      await command.undo();
    } catch (error) {
      undoStack.push(command);
      throw error;
    }
    redoStack.push(command);
    return true;
  }

  async function redo() {
    const command = redoStack.pop();
    if (!command) {
      return false;
    }
    try {
      await command.do();
    } catch (error) {
      redoStack.push(command);
      throw error;
    }
    undoStack.push(command);
    return true;
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  activeCommandStack = {
    execute,
    undo,
    redo,
    canUndo,
    canRedo,
  };
  return activeCommandStack;
}
