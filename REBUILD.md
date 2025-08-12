### Awesome Copilot Toolkit — Rebuild and Reproduction Guide

This document explains what the extension does, how it’s structured, and provides a step‑by‑step path to recreate the exact same extension from a clean environment or package/publish it as‑is.

## What this extension is

- **Name**: Awesome Copilot Toolkit
- **ID/Publisher**: `awesome-copilot-toolkit`
- **Purpose**: Browse, preview, search, and install content from `github/awesome-copilot` (Custom Instructions, Reusable Prompts, Custom Chat Modes) directly inside VS Code. Includes a status bar entry, a sidebar explorer, quick pick flows, caching, and GitHub API rate limit awareness.
- **VS Code engine**: >= 1.85.0
- **Node runtime target**: Node 18

## Features overview

- **Multiple entry points**: Status bar menu, sidebar tree view, command palette, explorer context menu.
- **Browsing and search**: Browse all or by type (`instruction`, `prompt`, `chatmode`); keyword search with suggestions.
- **Preview**: Rich markdown webview preview with actions (open preview, copy, open raw, view on GitHub, install).
- **Install**: One‑click install to workspace (under `.github/` subfolders) or open as untitled; optional deep link for Chat Instructions.
- **Caching**: Global state cache with TTL (configurable).
- **GitHub API care**: One‑shot repo tree fetch, light index, small inter‑request delays, status bar indicator, and “Show Rate Limit” command.
- **Telemetry**: Logged to an output channel and respects VS Code telemetry settings.

## Commands and contributions

- Commands (activation events and palette titles):
  - `awesomeCopilotToolkit.browseAll` — Awesome Copilot: Browse All
  - `awesomeCopilotToolkit.browseCustomInstructions` — Awesome Copilot: Browse Custom Instructions
  - `awesomeCopilotToolkit.browseReusablePrompts` — Awesome Copilot: Browse Reusable Prompts
  - `awesomeCopilotToolkit.browseCustomChatModes` — Awesome Copilot: Browse Custom Chat Modes
  - `awesomeCopilotToolkit.searchByKeywords` — Awesome Copilot: Search by Keywords
  - `awesomeCopilotToolkit.refreshIndex` — Awesome Copilot: Refresh Index
  - `awesomeCopilotToolkit.clearCache` — Awesome Copilot: Clear Cache
  - `awesomeCopilotToolkit.showRateLimit` — Awesome Copilot: Show Rate Limit
  - `awesomeCopilotToolkit.statusBarMenu` — Awesome Copilot
  - `awesomeCopilotToolkit.installToWorkspace` — Install Copilot Item Here
  - `awesomeCopilotToolkit.quickSearch` — Quick Search Copilot Items

- Views and UI contributions:
  - Activity bar container `awesome-copilot-sidebar` with view `awesome-copilot-explorer` (title: Copilot Items)
  - ViewsWelcome for `awesome-copilot-explorer` with links to browse/search/rate limit
  - Explorer context menu items for quick install and quick search
  - Status bar toolbar item wired to `awesomeCopilotToolkit.statusBarMenu`

- Configuration (under `awesomeCopilotToolkit`):
  - `defaultInstallLocation`: `workspace` | `untitled` | `both` (default: `workspace`)
  - `cacheTtlHours`: number (default: 24)
  - `useDeepLinksWhenAvailable`: boolean (default: true)
  - `contentRepo`: owner/repo (default: `github/awesome-copilot`)
  - `contentBranch`: string (default: `main`)
  - `maxItems`: number (default: 15; governs listing size and API usage)

## Architecture and key modules

- `src/extension.ts`: Extension activation. Registers commands; wires services; registers sidebar provider; initial activation UX; background index refresh.
- `src/services/indexService.ts`: Builds a lightweight catalog index from the repo tree; caches items in `globalState`; supports keyword‑based expansion; emits change notifications.
- `src/services/fetch.ts` (`GitHubFetchService`): GitHub API interactions (rate limit checks, branch → tree fetch, file content, last commit info); central logging and throttling.
- `src/services/preview.ts` (`PreviewService`): Renders markdown preview in a webview with action buttons; can open built‑in preview; calls installer for install action.
- `src/services/installer.ts` (`InstallerService`): Installs items to workspace `.github/` subfolders, or opens as untitled; attempts Chat Instructions deep link when enabled.
- `src/services/searchService.ts` (`SearchService`): In‑memory keyword search against cheap fields; suggestions and validation.
- `src/services/statusBar.ts` (`StatusBarService`): Two status bar items (main menu and API status) and periodic rate limit updates.
- `src/services/telemetry.ts` (`TelemetryService`): Output‑channel telemetry respecting VS Code telemetry settings.
- `src/ui/quickPick.ts` (`QuickPickService`): Orchestrates browse/search quick picks and actions; integrates with installer and preview.
- `src/ui/sidebarProvider.ts` (`SidebarProvider`): Tree view with categories, actions (refresh/search/rate limit), and items; delegates to preview and installer.
- `src/types.ts`: Shared types for items, GitHub content, and options.
- Tests under `src/test/` using `@vscode/test-electron` and Mocha.

## Data flow (high level)

1) User triggers a browse/search command → `IndexService.buildIndex()` → `GitHubFetchService.fetchFullTree()` → produce lightweight `CatalogItem[]` and cache.
2) User selects an item → QuickPick/sidebar action → `PreviewService.showPreview()` fetches raw content on demand.
3) User clicks Install → `InstallerService.installItem()` writes into workspace `.github/copilot-*` or opens untitled; optionally deep‑links instructions.
4) Status bar periodically queries `getRateLimitInfo()` to show remaining quota.

## Rate limiting strategy

- Always checks `/rate_limit` before operations and introduces short delays between calls.
- Falls back to cached index if refresh fails; shows warnings and output channel logs.
- Status bar shows OK/Warning/Error states with remaining/limit context.

## Project layout (expected)

```
ext/
  package.json
  tsconfig.json
  README.md
  CHANGELOG.md
  LICENSE
  resources/
    icon.svg
    screenshots/
      ack-*.png
  src/
    extension.ts
    types.ts
    services/
      fetch.ts
      indexService.ts
      installer.ts
      preview.ts
      searchService.ts
      statusBar.ts
      telemetry.ts
    ui/
      quickPick.ts
      sidebarProvider.ts
    test/
      runTest.ts
      suite/
        extension.test.ts
        index.ts
```

## Exact build configuration

- Build tool: `esbuild`
- Output: `out/extension.js` (CJS)
- Platform/target: `node`, `node18`
- Scripts:
  - `npm run build`: bundle extension
  - `npm run watch`: watch mode
  - `npm run test`: run VS Code integration tests
  - `npm run package`: produce `.vsix` via `vsce`

### package.json (full)

```startLine:1:endLine:232:package.json
// ... existing code ...
```

### tsconfig.json (full)

```startLine:1:endLine:19:tsconfig.json
// ... existing code ...
```

## Reproduce the extension exactly (clean-room)

Follow either Path A (fastest from this repo) or Path B (clean scaffold). Assumes Windows PowerShell (your environment: win32) but works similarly on macOS/Linux.

### Path A — Build and package from this codebase

1. Install prerequisites:
   - Node.js 18+
   - VS Code 1.85+
   - `vsce` (`npm i -g vsce`) or use `npx vsce`
2. From the `ext/` folder, install deps:
   - `npm ci` (or `npm install`)
3. Build:
   - `npm run build`
4. Test (optional):
   - `npm run test`
5. Package:
   - `npm run package` → produces `awesome-copilot-toolkit-0.1.0.vsix`
6. Install locally:
   - In VS Code: Extensions view → “...” → Install from VSIX… → select the `.vsix`

### Path B — Clean scaffold + copy sources

1. Create a new empty folder (e.g., `awesome-copilot-toolkit`).
2. Create the following files with the exact contents from this repository:
   - `package.json` (see full content above)
   - `tsconfig.json` (see full content above)
   - `README.md`, `CHANGELOG.md`, `LICENSE` (copy as‑is)
   - `resources/icon.svg` and all images in `resources/screenshots/` (copy as‑is)
   - All files under `src/` exactly as present here (same names and contents)
3. Run:
   - `npm install`
   - `npm run build`
   - `npm run package`
4. Install the resulting VSIX in VS Code.

Notes:
- If you cannot copy files directly, open each file in this repo and copy its content verbatim into the matching path; ensure case‑sensitive names and folder structure.
- Do not alter `main` (points to `out/extension.js`) or `activationEvents`/`contributes` in `package.json`.

## Development and debugging

- Launch extension host: Press F5 in VS Code (from this workspace) after `npm install`.
- Live rebuild: `npm run watch` in a terminal, then reload Extension Host window.
- Logs: “Awesome Copilot Toolkit” output channel shows GitHub API + internal logs; another channel shows telemetry events.

## Publishing (Marketplace)

1. Ensure a publisher is configured in `package.json` (currently `awesome-copilot-toolkit`).
2. Set up a VS Code Marketplace publisher and a Personal Access Token.
3. Bump `version` in `package.json` as needed.
4. Build and publish:
   - `npm run build`
   - `vsce package` (or `npm run package`)
   - `vsce publish` (if you have rights and token configured)

## Behavioral details and guarantees

- Indexing is lightweight; file contents are fetched only when previewing/installing.
- Install locations:
  - Instructions → `.github/copilot-instructions/`
  - Prompts → `.github/copilot-prompts/`
  - Chat modes → `.github/copilot-chatmodes/`
- Deep link for instructions: `vscode:chat-instructions/install?url=...` attempted when enabled.
- Configuration allows swapping content repo/branch, TTL, install location, deep links, and item limit.

## Tests

- Integration tests validate activation, command registration, and configuration defaults via `@vscode/test-electron` and Mocha.

## Minimal API surface used

- VS Code APIs: `window`, `workspace`, `commands`, `ProgressLocation`, `StatusBarItem`, `TreeDataProvider`, `WebviewPanel`, `ThemeColor`, `env.clipboard`, `env.openExternal`, `globalState`, and FS APIs.
- External libs: `esbuild`, `markdown-it`, `@vscode/test-electron`, `Mocha`, ESLint/Prettier/TypeScript for dev.

## Troubleshooting quick tips

- “No items”: Run `Awesome Copilot: Refresh Index` or check network; see Output channel logs.
- “Rate limit”: Wait until reset (indicator shows time); avoid spamming refresh.
- “Install failed”: Ensure a workspace folder is open; permissions for `.github/` dirs.
- Build errors: Use Node 18; run `npm ci`; re‑run `npm run build`.


