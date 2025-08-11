# Awesome Copilot Toolkit — VS Code Extension Plan

Build a TypeScript VS Code extension that lets users browse and install items from the GitHub repository github/awesome-copilot. Focus on three content types: Custom Instructions, Reusable Prompts, and Custom Chat Modes. Provide a polished UX with commands, quick picks, preview, and one-click install.

## Goals

- Enable discovery and installation of:
  - Custom Instructions: instructions/*.instructions.md
  - Reusable Prompts: prompts/*.prompt.md
  - Custom Chat Modes: chatmodes/*.chatmode.md
- Deliver a smooth VS Code UI:
  - Command Palette browsing
  - Quick Pick search and filtering
  - Detail preview for Markdown
  - One-click install into workspace

## Tech Stack

- VS Code Extension API (TypeScript)
- Node 18+
- esbuild for bundling
- ESLint + Prettier
- @vscode/test-electron for E2E smoke tests
- Strict TypeScript config

## Core Features

### 1) Content Indexing

- Build a local catalog for three content types:
  - instructions/*.instructions.md
  - prompts/*.prompt.md
  - chatmodes/*.chatmode.md
- Fetch lists from GitHub (default branch main) using:
  - GitHub REST API: /repos/github/awesome-copilot/contents/?ref=main
  - Or raw.githubusercontent.com as fallback
- Cache the index in globalState with TTL (default 24h).
- Index entry fields:
  - id
  - type (instruction | prompt | chatmode)
  - title (from filename and frontmatter if present)
  - path
  - raw URL (download_url)
  - lastModified (optional from commits API)
  - short description (first heading/paragraph or JSON description)

### 2) Quick Pick Browser

- Commands:
  - Awesome Copilot: Browse All
  - Awesome Copilot: Browse Custom Instructions
  - Awesome Copilot: Browse Reusable Prompts
  - Awesome Copilot: Browse Custom Chat Modes
- Quick Pick item fields:
  - label: human-readable title
  - description: type + summary
  - detail: filename + lastModified (if available)
- Features:
  - Search-as-you-type filtering
  - Sorting by type/title/date
  - On select: open detail view

### 3) Detail + Preview

- Markdown items:
  - Render in a WebviewPanel using markdown-it
  - Option to open with VS Code’s built-in markdown preview
  - Chat modes:
  - Markdown preview with syntax highlighting
- Actions:
  - Copy content
  - Install
  - Open Raw
  - Open in GitHub

### 4) One-click Install

- Destinations in workspace:
  - .github/copilot-instructions/.instructions.md
  - .github/copilot-prompts/.prompt.md
  - .github/copilot-chatmodes/.chatmode.md
- Behaviors:
  - Ensure directories exist; write with overwrite allowed
  - If no workspace open, create Untitled file fallback
- Deep link for Chat Instructions (if supported):
  - vscode:chat-instructions/install?url=
  - If deep link fails or disabled, write file instead
- Post-install notification:
  - “Install complete” with actions:
    - Open file
    - Reveal in Explorer
    - Copy path

### 5) Sync and Refresh

- Commands:
  - Awesome Copilot: Refresh Index
  - Awesome Copilot: Clear Cache
- Background refresh when cache older than TTL

### 6) Error Handling and Offline

- If network fails:
  - Use last cached catalog; mark items as “stale”
- Handle rate limits:
  - Backoff and display “Try again later”
- OutputChannel for logs with “Show Output” action on errors

### 7) Telemetry (Optional, Anonymous)

- Event counts:
  - index_built
  - item_installed
  - preview_opened
- Respect telemetry.enableTelemetry setting
- No PII

## Project Structure

- package.json
  - contributes.commands
  - activationEvents
  - configuration:
    - awesomeCopilotToolkit.defaultInstallLocation: workspace | untitled | both (default: workspace)
    - awesomeCopilotToolkit.cacheTtlHours: number (default: 24)
    - awesomeCopilotToolkit.useDeepLinksWhenAvailable: boolean (default: true)
  - scripts (build, watch, test, package)
- tsconfig.json (strict)
- .eslintrc.js, .prettierrc
- .vscode/
  - tasks.json
  - launch.json
- src/
  - extension.ts (activate/deactivate, register commands)
  - types.ts (ItemType, CatalogItem)
  - services/
    - indexService.ts (fetch, cache, parse)
    - fetch.ts (GitHub helpers, ETag support)
    - installer.ts (write files, ensure dirs, deep links)
    - preview.ts (markdown/json rendering)
    - telemetry.ts (noop if disabled)
  - ui/
    - quickPick.ts (listing, search, sort)
    - itemActions.ts (open raw, copy, install)
- media/
  - icon.svg
  - preview styles
- test/
  - e2e smoke test (activate, build index, open quick pick, open preview)
- scripts/
  - build, watch, package with esbuild
- README.md (usage, screenshots placeholders)
- CHANGELOG.md
- LICENSE (MIT)
- .vscodeignore (exclude dev files)

## Implementation Details

### Index Building

  - Use GitHub REST API:
  - GET https://api.github.com/repos/github/awesome-copilot/contents/instructions?ref=main
  - GET https://api.github.com/repos/github/awesome-copilot/contents/prompts?ref=main
  - GET https://api.github.com/repos/github/awesome-copilot/contents/chatmodes?ref=main
- Store per-file:
  - name, path, download_url, sha
- Optional lastModified:
  - Use commits API to get latest commit for the path (first page only)
- Description extraction:
  - Markdown: fetch first ~2KB and take first heading/paragraph
  - Chat modes: read first heading/paragraph from markdown

### Caching

- globalState keys:
  - catalog:data
  - catalog:updatedAt
  - etag:
- TTL hours from configuration (default 24)
- Manual refresh and clear cache commands

### Slugification

- Generate slugs from titles:
  - lowercase, hyphens, strip extensions and non-alphanumerics

### Installation

- Write files into:
  - .github/copilot-instructions/
  - .github/copilot-prompts/
  - .github/copilot-chatmodes/
- Use vscode.workspace.fs.writeFile with create/overwrite behavior
- Handle no-folder-opened by creating Untitled document

### Deep Links

- If enabled and item.type === instructions:
  - Try vscode:chat-instructions/install?url=
  - Use env.openExternal; on failure, fallback to file write

### Preview

- Markdown:
  - WebviewPanel + markdown-it
  - Sanitize/escape HTML; minimal CSS
  - Action: “Open with Built-in Preview”
- JSON:
  - Pretty-print with  and syntax highlighting
  - “Copy JSON” button

### Commands and UX Polish

- Command prefix: “Awesome Copilot: …”
- Status bar item: “Awesome Copilot” opens Browse All
- Progress notifications for fetch/install
- Error notifications with “Show Output” to open logs

### Testing

- E2E smoke with @vscode/test-electron:
  - Activate extension
  - Build index
  - Open “Browse All”
  - Open preview for a sample item
- Mock fetch with Nock for local runs; CI can hit GitHub with minimal requests

### Packaging

- Scripts:
  - npm run build: esbuild → out/extension.js
  - npm run watch
  - npm run test
  - npm run package: vsce package
- .vscodeignore:
  - Exclude tests, configs, node_modules not needed in package

## Deliverables

1) package.json with contributes.commands, activationEvents, configuration, dependencies, scripts  
2) tsconfig.json, .eslintrc.js, .prettierrc, .vscode/tasks.json, .vscode/launch.json  
3) src implementation as per structure (working with TODOs where needed)  
4) README.md with usage and screenshot placeholders  
5) Smoke test under test/e2e/ that activates and invokes “Browse All”

## Notes and Extensibility

- Use exact repo paths and file patterns as specified
- Add more folders later by extending indexService.ts
- Consider adding:
  - Favorites and pinning
  - Workspace recommendations
  - GitHub auth for higher rate limits (optional)
  - Multi-repo support via configuration array

## Risks and Mitigations

- GitHub rate limits:
  - Use ETags, minimal requests, optional commits API
- Network failures:
  - Serve cached catalog with “stale” label
- Deep link support varies:
  - Always provide file-write fallback
- No workspace open:
  - Use Untitled fallback with clear instructions

## Success Criteria

- Users can search, preview, and install items from github/awesome-copilot within VS Code
- End-to-end flow verified via smoke test
- Minimal friction setup: build, run F5, browse, install within minutes

[1] https://chatgpt.com/c/6898dcb3-70e8-8321-9292-c9ecf1ec505b