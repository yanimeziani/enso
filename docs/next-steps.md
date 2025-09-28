# Next Steps

- Integrate the official Lynx native host: replace the console renderer in `apps/mobile/scripts/dev.ts` once the Lynx SDK is available and hook into device deployment commands.
- Expand the domain layer: model notebooks, tags, and sync queues defined in the PRD, and persist them through an offline-first storage adapter.
- Flesh out navigation: add Lynx-native navigation primitives for capture, list, and daily review flows, mirroring the Phase 1 milestones.
- Implement real data sync: design the storage API in `@thoughtz/core` to support optimistic updates and background sync targets described in the PRD.
- Establish CI gates: wire `pnpm lint`, `pnpm test`, and type-checking into continuous integration, enforcing ≥80% coverage on core and UI packages.
