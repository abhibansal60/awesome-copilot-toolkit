Awesome Copilot Toolkit – Agent Guide

Build/lint/test
- Extension: npm i; npm run build; npm run watch; npm run test (requires prior build).
- Lint: npx eslint "src/**/*.ts" (rules in [.eslintrc.js](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/.eslintrc.js)); format: npx prettier -w . (config in [.prettierrc](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/.prettierrc)).
- Single test: Current runner ([runTest.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/test/runTest.ts) + [suite/index.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/test/suite/index.ts)) loads all tests and has no grep. Run via VS Code Test UI or temporarily narrow the glob in suite/index.ts. If needed, add env-based grep support before relying on CLI filtering.
- MCP server (separate repo): cd ../mcp-awesome-copilot/server && npm i && npm run build && npm start (scripts in [server/package.json](file:///c:/Users/Administrator/git/mcp-awesome-copilot/server/package.json)).
- Sample client (moved): cd ../mcp-awesome-copilot/client/sample-client && npm i && npm run build && npm start (scripts in [client/sample-client/package.json](file:///c:/Users/Administrator/git/mcp-awesome-copilot/client/sample-client/package.json)).
}
Architecture & structure
- VS Code extension entry: [src/extension.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/extension.ts); UI in [src/ui](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/ui), services in [src/services](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/services), types in [src/types.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/types.ts).
- Indexing: [IndexService](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/services/indexService.ts) builds a lightweight catalog from github/awesome-copilot via GitHub API ([fetch.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/services/fetch.ts)); caching uses globalState with TTL.
- UI: Quick pick ([ui/quickPick.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/ui/quickPick.ts)) and tree view ([ui/sidebarProvider.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/ui/sidebarProvider.ts)); installer writes to .github/copilot-* ([services/installer.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/services/installer.ts)).
- External APIs: GitHub REST; rate-limit aware calls in FetchService; no database.
- MCP server mirrors features for agents ([mcp-server/src/index.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/mcp-server/src/index.ts)); sample client in [clients/sample-client/src/index.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/clients/sample-client/src/index.ts).

Code style & conventions
- TypeScript strict mode ([tsconfig.json](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/tsconfig.json)); CommonJS out for extension (esbuild via [package.json](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/package.json)).
- ESLint: no unused vars (error), prefer explicit return types (warn), avoid any (warn).
- Prettier: single quotes, semi: true, trailingComma: es5, printWidth: 100, tabWidth: 2.
- Naming: feature-based folders; types and interfaces in types.ts; VS Code commands prefixed "awesomeCopilotToolkit.*".
- Error handling: catch, log to output channel, and show user message (see [extension.ts](file:///c:/Users/Administrator/git/awesome-copilot-toolkit/src/extension.ts)); avoid leaking tokens.
