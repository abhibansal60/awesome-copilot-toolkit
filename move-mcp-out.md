Move MCP server/client to a new repo and keep extension functionality stable

Goal

Create a new repo for the MCP server (and optional thin client).

Move current uncommitted MCP code from awesome-copilot-toolkit into the new repo.

Wire the VS Code extension to consume the server as a dependency/endpoint.

Add compatibility checks so future features don’t break either side.

Inputs to fill

New repo name: mcp-awesome-copilot (or your preference)

Local paths of current MCP code: e.g., mcp-server/, mcp-client/ inside the extension repo

Steps

Create new repo locally

Create a new empty repository directory:

mcp-awesome-copilot/

server/ (move your mcp-server code here)

client/ (optional, only if you want a separate Node client SDK)

protocol/ (JSON Schemas or types for requests/responses)

docs/, examples/, scripts/

Move code

Cut-and-paste the uncommitted code from awesome-copilot-toolkit to the new structure:

awesome-copilot-toolkit/<mcp-server-src> → mcp-awesome-copilot/server

awesome-copilot-toolkit/<mcp-client-src> → mcp-awesome-copilot/client (optional)

Ensure package.json and tsconfig.json exist per package.

Add a root workspace file if needed (pnpm-workspace.yaml or npm workspaces).

Minimal protocol and versioning

Add protocol/VERSION with “1.0”.

Put JSON Schemas under protocol/schemas.

Generate TS types at build time into server/src/types/protocol.ts.

In server startup, expose a handshake endpoint/method that returns:

serverVersion (from package.json)

protocolVersions: ["1.0"]

capabilities: ["listItems","search","install"] (adjust to your features)

Server build/run

Add scripts to server/package.json:

build, dev, start, test

Optional: publish config if you’ll publish to npm (name: @your-scope/mcp-awesome-copilot-server).

Wire the extension to the new server

In awesome-copilot-toolkit:

Remove the local MCP code and add:

A config to point to a server endpoint (default localhost:7777).

A command “Install/Start MCP Server” that runs npx @your-scope/mcp-awesome-copilot-server serve or starts a local process.

On activation, call the handshake and verify protocol compatibility:

If incompatible, show guided “Upgrade server” or “Update extension” prompt.

If you prefer bundling, you can add the server as a dependency and spawn it locally. Recommended default is to connect to a configured endpoint.

CI basics

New repo: lint, typecheck, unit tests, schema validation in PRs.

Extension repo: e2e smoke tests that:

Start the server (local process) and hit a couple of API calls.

Run test matrix for Node LTS versions if relevant.

Docs and guardrails

New repo README:

Quickstart: npm/npx run to start server, config, endpoints, capabilities

Compatibility table (Server 1.x ↔ Protocol 1.x; Extension vX requires Protocol 1.0)

Extension README:

How to connect to the server and minimum required server version

“Install local server” command instructions

Future feature stability

Treat protocol changes as additive; use capabilities or feature flags for new features.

Keep JSON Schemas as the contract; auto-generate types.

Add contract tests in the server; the extension consumes the schema version reported by handshake.

Only bump protocol version on breaking changes; show migration guidance in both repos.