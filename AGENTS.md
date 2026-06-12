# AGENTS — Guidance for AI coding agents

Purpose: short, actionable instructions so AI agents can be productive in this repository.

Quick facts
- **Project type**: VS Code extension (TypeScript) with an optional Node/Express backend in `backend/`.
- **Build (extension)**: `npm run compile` (root). Watch mode: `npm run watch`.
- **Test (extension)**: `npm test` (root uses `vscode-test`).
- **Backend**: see `backend/package.json` — `npm run build`, `npm run dev`, `npm run test`.

Where to start
- Extension entry: `src/extension.ts` (compile target `out/extension.js`).
- Frontend features: `src/features/` contains main extension features (activity, code-review, session management).
- Backend server: `backend/src/index.ts` and `backend/src/routes/`.

Conventions & notes for agents
- Use `AGENTS.md` as the canonical agent instructions file; prefer linking existing docs instead of duplicating content.
- Preserve existing scripts in `package.json` and use them to run build/test commands.
- TypeScript compilation target: project root `tsconfig.json` and `backend/tsconfig.json` for backend.
- Avoid changing public APIs (commands and configuration in `package.json`) unless the change is requested.

Quick checks before edits
- Run `npm run compile` at repo root to verify the extension compiles.
- For backend changes, run `npm run dev` in `backend/` and run unit tests with `npm test`.

Useful links
- README: [README.md](README.md)
- Extension entry: [src/extension.ts](src/extension.ts)
- Backend package.json: [backend/package.json](backend/package.json)

Suggested next agent customizations
- Create a small `skill` describing the extension's runtime lifecycle (activation, commands, contexts).
- Add a `dev-hooks` instruction file for local dev environment setup (node version, env vars, DB reset script at `backend/scripts/reset-db.sh`).

If you want, I can now create a `.github/copilot-instructions.md` variant, a `skill` file, or a dev-hooks instruction. Which would you prefer?
