const DEFAULT_MAX_COMMANDS = 128;
const DEFAULT_SEQUENCE_TIMEOUT_MS = 450;
const SUPPORTED_SCOPES = new Set([
  "global",
  "shell",
  "editor",
  "palette",
  "review-modal",
]);
const TEXT_TARGETS = new Set(["input", "textarea", "select", "contenteditable"]);
const COMMAND_ID_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+$/;

function registryError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeKey(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.length === 1 ? value.toLowerCase() : value;
}

function validateShortcut(shortcut) {
  if (!isPlainObject(shortcut)) {
    throw registryError("COMMAND_SHORTCUT_INVALID");
  }

  const keys = Object.keys(shortcut);
  const allowed = new Set([
    "key",
    "sequence",
    "primaryModifier",
    "shiftKey",
    "altKey",
  ]);
  if (keys.some((key) => !allowed.has(key))) {
    throw registryError("COMMAND_SHORTCUT_INVALID");
  }

  if ("sequence" in shortcut) {
    if (
      keys.some((key) => key !== "sequence")
      || !Array.isArray(shortcut.sequence)
      || shortcut.sequence.length < 2
      || shortcut.sequence.length > 4
      || shortcut.sequence.some((key) => !isNonEmptyString(key))
    ) {
      throw registryError("COMMAND_SHORTCUT_INVALID");
    }
    return Object.freeze({
      sequence: Object.freeze(shortcut.sequence.map(normalizeKey)),
    });
  }

  if (!isNonEmptyString(shortcut.key)) {
    throw registryError("COMMAND_SHORTCUT_INVALID");
  }

  for (const modifier of ["primaryModifier", "shiftKey", "altKey"]) {
    if (modifier in shortcut && typeof shortcut[modifier] !== "boolean") {
      throw registryError("COMMAND_SHORTCUT_INVALID");
    }
  }

  return Object.freeze({
    key: normalizeKey(shortcut.key),
    ...(shortcut.primaryModifier === true ? { primaryModifier: true } : {}),
    ...(shortcut.shiftKey === true ? { shiftKey: true } : {}),
    ...(shortcut.altKey === true ? { altKey: true } : {}),
  });
}

function validateCommand(candidate) {
  if (!isPlainObject(candidate)) {
    throw registryError("COMMAND_INVALID");
  }

  if (
    !isNonEmptyString(candidate.id)
    || !COMMAND_ID_PATTERN.test(candidate.id)
    || !isNonEmptyString(candidate.title)
    || !isNonEmptyString(candidate.description)
    || !Array.isArray(candidate.shortcuts)
    || candidate.shortcuts.length === 0
    || typeof candidate.isAvailable !== "function"
    || typeof candidate.unavailableReason !== "function"
    || typeof candidate.run !== "function"
  ) {
    throw registryError("COMMAND_INVALID");
  }

  if (!SUPPORTED_SCOPES.has(candidate.scope)) {
    throw registryError("COMMAND_SCOPE_UNSUPPORTED");
  }

  const shortcuts = candidate.shortcuts.map(validateShortcut);
  return Object.freeze({
    id: candidate.id,
    title: candidate.title,
    description: candidate.description,
    shortcuts: Object.freeze(shortcuts),
    scope: candidate.scope,
    isAvailable: candidate.isAvailable,
    unavailableReason: candidate.unavailableReason,
    run: candidate.run,
  });
}

function availabilityFor(command, context) {
  const available = Boolean(command.isAvailable(context));
  const unavailableReason = available ? "" : command.unavailableReason(context);
  if (!available && !isNonEmptyString(unavailableReason)) {
    throw registryError("COMMAND_UNAVAILABLE_REASON_REQUIRED");
  }
  return { available, unavailableReason: available ? "" : unavailableReason };
}

function snapshotCommand(command, context) {
  const { available, unavailableReason } = availabilityFor(command, context);
  return {
    id: command.id,
    title: command.title,
    description: command.description,
    shortcuts: command.shortcuts.map((shortcut) => (
      "sequence" in shortcut
        ? { sequence: [...shortcut.sequence] }
        : { ...shortcut }
    )),
    scope: command.scope,
    available,
    unavailableReason,
  };
}

function unhandledResult(reason = "") {
  return {
    handled: false,
    executed: false,
    commandId: null,
    reason,
  };
}

function pendingSequenceResult() {
  return {
    handled: true,
    executed: false,
    commandId: null,
    reason: "sequence-pending",
  };
}

function contextToken(context) {
  return JSON.stringify([
    context.workspace ?? "",
    context.activeScope ?? "",
    context.focusToken ?? "",
    context.modalScope ?? "",
    Boolean(context.paletteOpen),
  ]);
}

function scopeAllows(commandScope, context) {
  if (context.modalScope) {
    return commandScope === context.modalScope;
  }
  if (context.paletteOpen || context.activeScope === "palette") {
    return commandScope === "palette";
  }
  if (TEXT_TARGETS.has(context.targetKind)) {
    return commandScope === "editor" && context.activeScope === "editor";
  }
  if (commandScope === "global") {
    return true;
  }
  return commandScope === context.activeScope;
}

function primaryModifierPressed(event, platform) {
  return platform === "darwin" ? Boolean(event.metaKey) : Boolean(event.ctrlKey);
}

function shortcutMatchesEvent(shortcut, event, context) {
  if (!("key" in shortcut)) {
    return false;
  }
  if (normalizeKey(event.key) !== shortcut.key) {
    return false;
  }

  const primary = primaryModifierPressed(event, context.platform);
  if (Boolean(shortcut.primaryModifier) !== primary) {
    return false;
  }
  if (Boolean(shortcut.shiftKey) !== Boolean(event.shiftKey)) {
    return false;
  }
  if (Boolean(shortcut.altKey) !== Boolean(event.altKey)) {
    return false;
  }

  const secondaryModifier = context.platform === "darwin" ? event.ctrlKey : event.metaKey;
  return !secondaryModifier;
}

export function createCommandRegistry(options = {}) {
  const maxCommands = Number.isInteger(options.maxCommands)
    ? options.maxCommands
    : DEFAULT_MAX_COMMANDS;
  const sequenceTimeoutMs = Number.isInteger(options.sequenceTimeoutMs)
    ? options.sequenceTimeoutMs
    : DEFAULT_SEQUENCE_TIMEOUT_MS;
  const scheduleTimeout = options.scheduleTimeout ?? globalThis.setTimeout.bind(globalThis);
  const cancelTimeout = options.cancelTimeout ?? globalThis.clearTimeout.bind(globalThis);

  if (maxCommands < 1 || sequenceTimeoutMs < 1) {
    throw registryError("COMMAND_REGISTRY_OPTIONS_INVALID");
  }

  const commands = new Map();
  let registrationSerial = 0;
  let destroyed = false;
  let sequenceState = null;
  let sequenceTimer = null;

  function assertActive() {
    if (destroyed) {
      throw registryError("COMMAND_REGISTRY_DESTROYED");
    }
  }

  function resetSequences() {
    if (sequenceTimer !== null) {
      cancelTimeout(sequenceTimer);
    }
    sequenceTimer = null;
    sequenceState = null;
  }

  function register(candidate) {
    assertActive();
    const validated = validateCommand(candidate);
    if (commands.has(validated.id)) {
      throw registryError("COMMAND_DUPLICATE");
    }
    if (commands.size >= maxCommands) {
      throw registryError("COMMAND_LIMIT");
    }

    const token = ++registrationSerial;
    commands.set(validated.id, { command: validated, token });
    let active = true;
    return () => {
      if (!active) {
        return false;
      }
      active = false;
      const current = commands.get(validated.id);
      if (current?.token !== token) {
        return false;
      }
      commands.delete(validated.id);
      resetSequences();
      return true;
    };
  }

  function unregister(id) {
    assertActive();
    const removed = commands.delete(id);
    if (removed) {
      resetSequences();
    }
    return removed;
  }

  function snapshot(context = {}) {
    assertActive();
    return [...commands.values()].map(({ command }) => snapshotCommand(command, context));
  }

  async function execute(id, context = {}) {
    assertActive();
    const entry = commands.get(id);
    if (!entry) {
      return unhandledResult();
    }

    const { available, unavailableReason } = availabilityFor(entry.command, context);
    if (!available) {
      return {
        handled: true,
        executed: false,
        commandId: entry.command.id,
        reason: unavailableReason,
      };
    }

    const value = await entry.command.run(context);
    return {
      handled: true,
      executed: true,
      commandId: entry.command.id,
      reason: "",
      value,
    };
  }

  function matchingSingleCommand(event, context) {
    for (const { command } of commands.values()) {
      if (!scopeAllows(command.scope, context)) {
        continue;
      }
      if (command.shortcuts.some((shortcut) => shortcutMatchesEvent(shortcut, event, context))) {
        return command;
      }
    }
    return null;
  }

  function matchingSequenceCandidates(key, context) {
    const candidates = [];
    for (const { command } of commands.values()) {
      if (!scopeAllows(command.scope, context)) {
        continue;
      }
      for (const shortcut of command.shortcuts) {
        if ("sequence" in shortcut && shortcut.sequence[0] === key) {
          candidates.push({ command, shortcut });
        }
      }
    }
    return candidates;
  }

  async function dispatch(event, context = {}) {
    assertActive();

    if (event?.type === "compositionstart") {
      resetSequences();
      return unhandledResult();
    }
    if (event?.type !== "keydown") {
      return unhandledResult();
    }

    if (context.compositionActive || event.isComposing) {
      resetSequences();
      return unhandledResult();
    }

    const currentToken = contextToken(context);
    if (sequenceState && sequenceState.contextToken !== currentToken) {
      resetSequences();
    }

    const key = normalizeKey(event.key);
    if (sequenceState) {
      const next = [...sequenceState.keys, key];
      const completed = sequenceState.candidates.find(({ shortcut }) => (
        shortcut.sequence.length === next.length
        && shortcut.sequence.every((part, index) => part === next[index])
      ));
      const continuing = sequenceState.candidates.filter(({ shortcut }) => (
        shortcut.sequence.length > next.length
        && next.every((part, index) => shortcut.sequence[index] === part)
      ));

      if (completed) {
        resetSequences();
        return execute(completed.command.id, context);
      }
      if (continuing.length > 0) {
        sequenceState = { ...sequenceState, keys: next, candidates: continuing };
        return pendingSequenceResult();
      }
      resetSequences();
    }

    const single = matchingSingleCommand(event, context);
    if (single) {
      return execute(single.id, context);
    }

    if (
      event.ctrlKey
      || event.metaKey
      || event.altKey
      || event.shiftKey
      || event.repeat
      || TEXT_TARGETS.has(context.targetKind)
    ) {
      return unhandledResult();
    }

    const candidates = matchingSequenceCandidates(key, context);
    if (candidates.length === 0) {
      return unhandledResult();
    }

    sequenceState = {
      keys: [key],
      candidates,
      contextToken: currentToken,
    };
    sequenceTimer = scheduleTimeout(() => {
      sequenceTimer = null;
      sequenceState = null;
    }, sequenceTimeoutMs);
    return pendingSequenceResult();
  }

  function destroy() {
    if (destroyed) {
      return;
    }
    resetSequences();
    commands.clear();
    destroyed = true;
  }

  return Object.freeze({
    register,
    unregister,
    snapshot,
    execute,
    dispatch,
    resetSequences,
    destroy,
  });
}
