# Lynx Setup Playbook

This guide documents how the committed Rspeedy scaffold under `apps/mobile/thoughtz-lynx` integrates with the Thoughtz monorepo. Follow these steps after cloning the repository and installing Node.js 18 or later.

## 1. Install Workspace Dependencies

```bash
pnpm install
```

The command hydrates shared dependencies across `apps/*` and `packages/*`, including the Rspeedy-generated Lynx host.

## 2. Launch the Lynx Dev Server

```bash
pnpm dev:mobile
```

- The script proxies into `apps/mobile/thoughtz-lynx` and starts `rspeedy dev`.
- When the bundler boots, a QR code and bundle URL appear in the terminal.
- Open the Lynx Explorer app on a device or simulator, scan the QR code, or paste the URL into **Enter Card URL → Go** to load the Thoughtz playground UI.

## 3. Edit the Mobile Experience

- The Lynx entry point lives at `apps/mobile/thoughtz-lynx/src/App.tsx` and reuses types from `@thoughtz/core`.
- Co-locate additional Lynx UI modules in `apps/mobile/thoughtz-lynx/src`. Keep shared logic inside `packages/` packages for cross-platform reuse.

## 4. Debugging & DevTools

- Launch the Lynx DevTool desktop app for log streaming, network inspection, and performance graphs.
- Connect real devices via USB or rely on the simulator to mirror Explorer sessions.

## 5. Keeping the Scaffold Current

- To upgrade the Rspeedy template, rerun:

  ```bash
  cd apps/mobile
  pnpm create rspeedy -- --dir thoughtz-lynx --template react-ts --override
  ```

  Review diffs carefully, retaining local integrations with `@thoughtz/core` and Thoughtz-specific UI.

## 6. Troubleshooting

- Ensure Node.js ≥18 and rerun `pnpm install` if `rspeedy dev` fails to boot.
- Delete `apps/mobile/thoughtz-lynx/node_modules` and reinstall to reset the Lynx toolchain.
- Reference the Lynx debugging guide for runtime errors, device logs, and network insight.

Document updates should land in `docs/setup/lynx.md` as the native host evolves.
