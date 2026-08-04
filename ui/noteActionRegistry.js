const DEFAULT_MAX_ACTIONS = 16;
const COMMAND_ID_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+$/;
const TONES = new Set(["default", "danger"]);
const PLACEMENTS = new Set(["menu", "supplementary"]);

function actionError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function validateDescriptor(candidate) {
  if (
    !candidate
    || typeof candidate !== "object"
    || Array.isArray(candidate)
    || typeof candidate.commandId !== "string"
    || !COMMAND_ID_PATTERN.test(candidate.commandId)
  ) {
    throw actionError("NOTE_ACTION_INVALID");
  }

  const tone = candidate.tone ?? "default";
  const order = candidate.order ?? 0;
  const placement = candidate.placement ?? "menu";
  if (
    !TONES.has(tone)
    || !Number.isInteger(order)
    || order < -1000
    || order > 1000
    || !PLACEMENTS.has(placement)
  ) {
    throw actionError("NOTE_ACTION_INVALID");
  }

  return Object.freeze({
    commandId: candidate.commandId,
    tone,
    order,
    placement,
  });
}

export function createNoteActionRegistry({ maxActions = DEFAULT_MAX_ACTIONS } = {}) {
  if (!Number.isInteger(maxActions) || maxActions < 1 || maxActions > 64) {
    throw actionError("NOTE_ACTION_OPTIONS_INVALID");
  }

  const descriptors = new Map();
  let serial = 0;

  function register(candidate) {
    const descriptor = validateDescriptor(candidate);
    if (descriptors.has(descriptor.commandId)) {
      throw actionError("NOTE_ACTION_DUPLICATE");
    }
    if (descriptors.size >= maxActions) {
      throw actionError("NOTE_ACTION_LIMIT");
    }

    const token = ++serial;
    descriptors.set(descriptor.commandId, { descriptor, token });
    let active = true;
    return () => {
      if (!active) {
        return false;
      }
      active = false;
      const current = descriptors.get(descriptor.commandId);
      if (current?.token !== token) {
        return false;
      }
      descriptors.delete(descriptor.commandId);
      return true;
    };
  }

  function snapshot(commands) {
    if (!Array.isArray(commands)) {
      throw actionError("NOTE_ACTION_COMMANDS_INVALID");
    }
    const commandById = new Map(
      commands
        .filter((command) => command && typeof command.id === "string")
        .map((command) => [command.id, command]),
    );

    return [...descriptors.values()]
      .map(({ descriptor }) => ({ descriptor, command: commandById.get(descriptor.commandId) }))
      .filter(({ command }) => Boolean(command))
      .sort((left, right) => (
        left.descriptor.order - right.descriptor.order
        || left.descriptor.commandId.localeCompare(right.descriptor.commandId)
      ))
      .map(({ descriptor, command }) => ({
        commandId: descriptor.commandId,
        tone: descriptor.tone,
        order: descriptor.order,
        placement: descriptor.placement,
        command,
      }));
  }

  return Object.freeze({ register, snapshot });
}
