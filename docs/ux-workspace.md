# Web Workspace UX Notes

## Layout Strategy
- Single capture rail at the centre: every note, command, or search begins in one textarea with inline token parsing (`#tag`, `@project`, `!focus`).
- Left panel only surfaces the "Now" stack and a compact inbox queue; everything else is hidden behind the command palette or advanced views.
- Right panel delivers lightweight telemetry (captured today, high-energy count) plus context for the active thought (momentum, tags).
- Optional timeline/graph access lives on contextual controls to keep the primary canvas frictionless.

## Interaction Model
- `CaptureBox` parses inline tokens and surfaces microcopy feedback; `Cmd+Enter` captures instantly while `Cmd+K` opens the universal palette.
- Auto organisation suggestions are rendered as chips beneath the capture box (tag prompts, focus hints). They will wire into local embeddings once backend lands.
- `useWorkspace` tracks mutable thought state, synthesises "Now"/"Inbox" views, and exposes status mutators for contextual actions (Done/Focus/Archive).

## Responsive Behaviour
- Capture box and context stack gracefully collapse into a single column on narrow viewports while keeping the "Now" list ahead of the inbox.
- Typography, tokens, and chips reuse the shared CSS custom properties for consistent theming (light/dark ready).

## Backend Integration TODOs
- Replace `workspaceEntries` with streaming API data; extend the payload to include status (`now`, `inbox`, `archive`) and AI-suggested tags/energy metadata.
- Swap the local capture mutations for optimistic FastAPI calls; return applied suggestions/embeddings so the UI reflects confidence scores.
- Expose real command palette operations (search, open timeline, run automations) via `/commands` endpoint.
- Feed local embedding service to populate auto-tag/focus hints and context-sensitive actions.
