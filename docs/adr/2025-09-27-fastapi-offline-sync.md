# 2025-09-27: FastAPI Backend with Offline Sync Strategy

## Status
Accepted

## Context
Phase 1 of the PRD calls for an offline-first data model that can hydrate both the mobile Lynx host and the web workspace. We lacked a shared backend capable of storing thoughts, tags, and links, nor a sync contract to reconcile local caches after offline edits.

## Decision
We introduced a Python FastAPI service (`services/backend`) backed by SQLAlchemy and SQLite (swap-ready for Postgres). The service exposes:

- CRUD endpoints for thoughts, preserving tags and directional links.
- A `/sync/thoughts` endpoint that accepts batched client mutations, applies last-write-wins conflict resolution, and pages server-side changes using a monotonic cursor.
- SQL schema (thoughts, tags, links) managed via Alembic for future migrations.

The data contracts mirror the `@enso/core` `Thought` primitives so web and mobile clients can share validation logic.

## Consequences
- Clients can populate a local store, replay offline mutations, and request deltas by providing the last cursor they received.
- The backend now anchors source-of-truth timestamps, so clients should treat server ISO timestamps as authoritative.
- Future enhancements (auth, collaboration) can build on the established schema and Alembic workflow.
- We must add client adapters in `packages/core`/`apps` to call the new API before shipping Phase 1.
