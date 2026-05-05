## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Chrome Extension Project-Specific Guidelines

### Source reference
- Derived from: `https://github.com/PatrickJS/awesome-cursorrules/tree/main/rules/chrome-extension-dev-js-typescript-cursorrules-pro`
- Primary source files reviewed:
  - `.cursorrules`
  - `README.md`
  - `chrome-extension-general-rules.mdc`
  - `javascript-typescript-code-style.mdc`
  - `typescript-usage-rules.mdc`
  - `extension-architecture-rules.mdc`
  - `manifest-and-permissions-rules.mdc`
  - `security-and-privacy-rules.mdc`
  - `browser-api-usage-rules.mdc`
  - `ui-and-styling-rules.mdc`
  - `performance-optimization-rules.mdc`
  - `code-output-rules.mdc`

### Scope
- Manifest: `manifest.json`
- Background logic: `background_worker.js` or the project's MV3 background service worker equivalent
- Content scripts: `content_script.js`
- Popup UI: `popup.html`, `popup.js`
- Options UI: `options.html`, `options.js`
- Shared source: `**/*.{js,ts,html,css}`

### Stack expectations
- Chrome Extension development using JavaScript or TypeScript.
- Prefer TypeScript for type safety and developer experience.
- HTML and CSS power popup/options UI.
- Tailwind, Radix UI, or shadcn/ui may be used when the project already uses them.
- Use Web APIs and Chrome extension APIs according to official Chrome Extension documentation.
- For a new TypeScript-based extension, prefer WXT as the default project scaffold.
- Use `pnpm dlx wxt@latest init` to create the project. `npx wxt@latest init` and `bunx wxt@latest init` are acceptable alternatives when pnpm is not available.
- Treat WXT as the default because it is TypeScript-first, framework-agnostic, supports file-based entrypoints, and provides fast reload/HMR for extension development.
- Default to Manifest V3 for new work unless a verified project constraint requires otherwise.
- During setup, keep the scaffold minimal: choose TypeScript, keep MV3, and only add a UI framework integration when the project already needs one.
- If the project is explicitly React-centric and wants a more batteries-included extension workflow, Plasmo is an acceptable alternative scaffold.
- Use `pnpm create plasmo` for that path. Prefer `pnpm create plasmo --with-tailwindcss` only when Tailwind is already part of the project's intended UI stack.
- After scaffolding, install dependencies, start the dev server, and load the generated development build as an unpacked extension in Chrome during development.

### File and naming conventions
- Keep extension concerns split by runtime boundary: manifest, background, content scripts, popup, options.
- Use lowercase with underscores for file names when creating extension-specific files.
  - Examples: `content_script.js`, `background_worker.js`
- Use camelCase for variables and functions.
- Use PascalCase for class names only when a class is actually warranted.
- Use descriptive names that make permission state, feature flags, and runtime intent obvious.
  - Examples: `isExtensionEnabled`, `hasPermission`

### JavaScript and TypeScript rules
- Write concise, technical JavaScript/TypeScript.
- Use modern JavaScript features and current best practices.
- Prefer functional patterns and minimize classes.
- Use interfaces for message contracts and API response shapes.
- Use union types and type guards where runtime distinction matters.
- Before adding new types or helpers, look for an existing message or storage pattern and reuse it.

### Extension architecture rules
- Preserve a clear separation of concerns between extension components.
- Background code owns orchestration, alarms, and extension lifecycle work.
- Content scripts interact with web pages and should stay narrowly scoped.
- Popup and options pages own user-facing controls and settings UI.
- Use message passing for communication across extension boundaries.
- Use `chrome.storage` for extension state management instead of ad hoc global state.
- Always review the current project structure before adding a new component so you do not duplicate an existing responsibility.

### Manifest and permissions rules
- Default to Manifest V3 unless there is a verified project constraint requiring V2.
- Follow least privilege for all permissions.
- Request optional permissions where possible instead of broad install-time permissions.
- Keep permissions aligned with actual runtime behavior; if code no longer needs a permission, remove it.
- Keep manifest changes explicit and minimal so reviewers can reason about extension capabilities.

### Security and privacy rules
- Define and maintain Content Security Policy in `manifest.json`.
- Use HTTPS for all network requests.
- Sanitize user input and validate data from external sources.
- Treat page data, runtime messages, and remote API payloads as untrusted input.
- Implement proper error handling and logging for security-relevant flows.
- Prefer privacy-preserving designs for stored or collected user data.

### Browser API usage rules
- Use `chrome.*` APIs deliberately and only where they fit the runtime boundary.
  - Common examples from the source material: `chrome.tabs`, `chrome.storage`, `chrome.runtime`
- Handle API errors explicitly for every Chrome API interaction.
- Use `chrome.alarms` for scheduled work instead of `setInterval`.
- When cross-browser support matters, prefer WebExtensions-compatible patterns where possible.
- Gracefully degrade when a browser-specific capability is unavailable.

### UI and styling rules
- Build responsive popup and options experiences.
- Use CSS Grid or Flexbox for layout.
- Keep styling consistent across popup, options, and other extension UI surfaces.
- Prefer the project's existing UI system before introducing Tailwind, Radix UI, or shadcn/ui.

### Performance rules
- Minimize resource usage in background scripts.
- Prefer event-driven/background service worker behavior over persistent background processing when possible.
- Lazy load non-critical features.
- Keep content scripts lean to reduce page-performance impact.
- Avoid work in content scripts that can be done once in the background context.

### Testing and debugging rules
- Use Chrome DevTools for debugging.
- Test by loading the unpacked extension through Chrome's extension tooling during development.
- Write unit tests for core extension functionality.
- Verify message passing, storage behavior, permission flows, and manifest changes when those areas are touched.

### Context-aware development rules
- Always consider the whole project context before suggesting or generating code.
- Avoid duplicate functionality and conflicting implementations.
- Ensure new code integrates cleanly with the existing project structure and architecture.
- Before changing a feature, review the current project state so the result stays consistent.
- When answering follow-up questions, account for already-implemented features to avoid contradictions.

### Output rules for agent-generated code
- When the user asks for code, provide complete and functional file content unless they explicitly ask for a diff-only answer.
- Include necessary imports, declarations, and surrounding code so the file can stand on its own.
- Add comments only for significant or non-obvious changes.
- If a file is too large to show in full, provide the most relevant complete section and clearly state where it belongs.
