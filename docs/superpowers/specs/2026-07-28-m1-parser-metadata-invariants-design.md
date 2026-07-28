# M1 parser metadata invariants design

## Scope

Issue #37 establishes the pure parser contract for `parseDocument`, `parseMarkdown`, `extractTags`, `parseWikiLinks`, `extractCodeBlocks`, and `tokenize`. It changes only parser behavior, parser tests, the explicit unit-test command, and parser documentation. Canonical note normalization, task metadata, schema/version/checksum ownership, persistence, search workers, backlinks, UI, and migrations remain out of scope.

## Chosen approach

Use one private, line-oriented structural scan inside `core/parser/index.js`. The scan normalizes CRLF/CR line endings to LF, tracks whether each line is outside or inside a triple-backtick fence, and returns ordinary Markdown nodes, fenced code blocks, and separate metadata-visible segments. Bounded linear derivation then extracts tags and links from those segments and tokens from the complete normalized source. Segment boundaries prevent malformed tag/link syntax on opposite sides of a fence from being joined into synthetic metadata. The exported helpers continue to accept the same values and return the same shapes; `parseDocument` consumes one shared analysis result so aggregate fields cannot drift from helper behavior.

An opening fence is a trimmed line containing three backticks followed by an optional existing language identifier (`[a-z0-9_-]*`, case-insensitive). A trimmed line containing only three backticks closes it. Closed and unclosed fences both produce one deterministic code block/code AST node. Fence delimiter lines and code-body lines do not also become paragraph nodes. Code bodies and language identifiers are normalized consistently; an omitted language remains `txt`. Unsupported info syntax remains ordinary text under this deliberately bounded grammar.

Tags and wiki links are extracted only from metadata-visible text outside fenced regions. Tags retain the current ASCII grammar, lowercase normalization, deduplication, and first-seen order. Wiki links retain trimming, exact-value deduplication, and first-seen order. Ordinary headings and paragraphs retain their current shapes, and wiki-link AST nodes remain derived from the filtered link list.

Tokenization intentionally receives the complete normalized source, including fenced code content. This preserves code-content searchability while metadata extraction ignores code. No parser library or new dependency is introduced.

## Intentional behavior changes

- Closed fenced code no longer leaks apparent tags or wiki links into note metadata.
- Unclosed fenced code is treated as code through end-of-input, produces one code node, and cannot leak apparent metadata.
- Fence delimiters and code-body lines are no longer duplicated as paragraph nodes.
- CRLF and CR inputs are normalized to the same LF-based parser result.
- Leading/trailing whitespace around an otherwise valid fence delimiter is ignored.

Tag grammar, wiki-link grammar, token grammar, heading recognition, output field names, and the default `txt` language remain unchanged.

## Tests and RED evidence

`tests/unit/parser.metadata.test.mjs` uses Node's built-in test runner and imports the real parser exports. Individually named tests cover the four required RED failures plus explicit null-like helper outputs, non-string values, repeatability, metadata ordering, language defaults, multiple/empty fences, trimmed delimiters, rejected unsupported fence info syntax, headings/paragraphs, aggregate/helper consistency, LF/CRLF/CR parity, and code token searchability. The existing browser-oriented `tests/parser.invariant.test.js` and its Node adapter remain intact.

The targeted test is run before production code changes. Expected RED is behavioral: current code returns fenced `#tags`/`[[links]]`, duplicates fence/body paragraphs, and leaks metadata from an unclosed fence. Syntax, import, or harness errors do not count as RED.

## Compatibility, migration, and rollback

The public function signatures and return shapes do not change. Existing consumers in `core/model.js` continue to call `parseDocument`; no consumer or stored schema changes. Newly parsed metadata becomes more accurate, but this work does not rewrite stored notes or alter checksum/version semantics, so no schema migration is required.

Rollback is a clean revert of the parser implementation, parser unit test, package script, invariant documentation, design, and plan. There is no user-data rollback.

## Security, privacy, and performance

Fixtures are synthetic and no note title/body is emitted to CI artifacts. Fenced content remains inert text. The structural scan and its derived metadata/token passes remain O(n) in source length with bounded arrays proportional to input size, add no cache, and avoid repeated full-document fence scanning inside `parseDocument`. Browser and Node compatibility are preserved by using standard JavaScript only.
