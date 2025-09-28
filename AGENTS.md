# Repository Guidelines

## Project Structure & Module Organization
- Treat `PRD.md` as the live scope reference; align all new modules with its milestones.
- Target layout: `apps/mobile`, `apps/web`, `packages/core`, `packages/ui`, `packages/lynx`, and `docs/`; keep assets inside each app’s `assets/` folder.
- Keep `packages/core` UI-free, publish shared primitives from `packages/ui`, and let `packages/lynx` encapsulate the Lynx/React bridge so platform hosts stay thin.
- The committed Rspeedy scaffold resides in `apps/mobile/thoughtz-lynx`; integrate platform-specific views there.

## Build, Test, and Development Commands
- Run `pnpm install` once to hydrate workspace dependencies.
- Use `pnpm dev:web` for the Vite web shell.
- Use `pnpm dev:mobile` to start the Rspeedy-powered Lynx dev server (auto-installs dependencies on first run).
- Execute `pnpm test` (append `--watch` while iterating), `pnpm lint`, and `pnpm typecheck` before raising a pull request.

## Coding Style & Naming Conventions
- Ship TypeScript (`.ts`/`.tsx`) with two-space indentation, trailing commas, and the repo’s Prettier defaults.
- Prefer functional React components and hooks; name components in PascalCase, hooks in camelCase starting with `use`, and exported constants in UPPER_SNAKE_CASE.
- Extract services or utilities once files exceed ~200 lines and keep shared modules platform agnostic.

## Testing Guidelines
- Standard stack: Vitest with React Testing Library co-located as `*.test.ts[x]` beside source files.
- House Lynx runtime tests in `packages/lynx` and `apps/mobile/thoughtz-lynx` (when applicable), web UI specs under `apps/web/src/__tests__`, and mobile fallback flows under `apps/mobile/src/__tests__`.
- Target ≥80% coverage, emphasizing offline sync, linking behaviors, and runtime bridging; reserve snapshots for design-system components only.

## Commit & Pull Request Guidelines
- Initialize git locally and follow Conventional Commits (`feat:`, `fix:`, `chore:`); reference PRD sections or issue IDs in commit bodies for traceability.
- Provide PR descriptions with a summary, testing notes, and UI artifacts when visuals change; keep diffs to ≲400 added lines.
- Confirm `pnpm lint`, `pnpm test`, and `pnpm typecheck` succeed before requesting review or merging.

## Documentation & Planning
- Update `PRD.md` whenever scope or milestones shift and append a short changelog entry.
- Store ADRs in `docs/adr/` using `YYYY-MM-DD-title.md`; capture runtime integration decisions here first.
- Track configuration in `docs/configuration.md`, expose required keys via `.env.sample`, and never commit real secrets.
- Follow `docs/setup/lynx.md` for operating the committed Rspeedy scaffold and refreshing Lynx tooling.
