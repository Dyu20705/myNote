const MAX_RESULT_POLICIES = 16;
const MAX_POLICY_ID_LENGTH = 64;

function createPipelineError(message, code) {
  const error = new TypeError(message);
  error.code = code;
  return error;
}

function validateIds(ids, code) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    throw createPipelineError("Invalid search result IDs", code);
  }
  return [...ids];
}

function validatePolicy(policy) {
  const valid = policy
    && typeof policy === "object"
    && typeof policy.id === "string"
    && policy.id.length > 0
    && policy.id.length <= MAX_POLICY_ID_LENGTH
    && typeof policy.apply === "function";
  if (!valid) {
    throw createPipelineError("Invalid search result policy", "INVALID_SEARCH_RESULT_POLICY");
  }
}

export class SearchResultPipeline {
  #policies = new Map();

  register(policy) {
    validatePolicy(policy);
    if (this.#policies.has(policy.id)) {
      throw createPipelineError("Duplicate search result policy", "DUPLICATE_SEARCH_RESULT_POLICY");
    }
    if (this.#policies.size >= MAX_RESULT_POLICIES) {
      throw createPipelineError("Search result policy limit reached", "SEARCH_RESULT_POLICY_LIMIT");
    }

    this.#policies.set(policy.id, policy);
    return () => {
      if (this.#policies.get(policy.id) === policy) {
        this.#policies.delete(policy.id);
      }
    };
  }

  async apply(ids, context = {}) {
    let result = validateIds(ids, "INVALID_SEARCH_RESULT_IDS");
    for (const policy of this.#policies.values()) {
      const next = await policy.apply([...result], context);
      result = validateIds(next, "INVALID_SEARCH_RESULT_POLICY_OUTPUT");
    }
    return result;
  }
}

export function createSearchResultPipeline() {
  return new SearchResultPipeline();
}
