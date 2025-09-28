# AI Setup Guide

This guide outlines how to enable the local AI helper that powers capture suggestions, semantic search, and note summaries.

## 1. Configure Environment

1. Copy `.env.sample` to `.env` (if you have not already).
2. Ensure the following keys are present and tuned for your environment:

```
AI_ENABLED=true
AI_MODE=local
AI_MODEL_URL=http://127.0.0.1:11434
AI_TIMEOUT_SECONDS=12.0
ENSO_AI_URL=http://127.0.0.1:8000
VITE_ENSO_AI_URL=http://127.0.0.1:8000
```

- Set `AI_MODE=stub` to return deterministic sample responses during UI development.
- Use `AI_MODE=remote` with a hosted inference endpoint; `AI_MODE=auto` lets the backend choose based on availability.

## 2. Start the Model Runner

You can point `AI_MODEL_URL` at any HTTP endpoint that implements `/suggest`, `/search`, and `/summary`. For local development, we recommend an Ollama or `llama.cpp` server.

### Example: Ollama

```bash
ollama serve &
ollama run mistral "Generate tags for focus work"
```

Expose an HTTP translation layer that forwards to Ollama (or run the forthcoming `services/model-runner`). Update `AI_MODEL_URL` to that adapter URL.

### Example: llama.cpp

```bash
./main -m models/mistral.bin -c 2048 --port 11434
```

## 3. Launch the FastAPI AI Service

The primary backend now exposes `/api/ai/*`. Restart the API after updating environment variables:

```bash
cd services/backend
uvicorn enso_api.main:app --reload
```

Verify the health endpoint:

```bash
curl http://127.0.0.1:8000/api/ai/health
```

You should see a JSON payload indicating the current mode and availability.

## 4. Frontend Integration Checklist

- The web shell reads `VITE_ENSO_AI_URL` during build and runtime. Restart `pnpm dev:web` after changing environment values.
- Mobile (Lynx) hosts should mirror the same configuration via `ENSO_AI_URL`.
- Use the `configureAIClient` helper to toggle AI features per session when wiring up UI.

## 5. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/api/ai/suggest` returns 503 | Ensure `AI_ENABLED=true` and the model runner is reachable at `AI_MODEL_URL`. Check logs for connection errors. |
| Suggestions are always empty | You may be running in `stub` mode; set `AI_MODE=local` once the model is ready. |
| Frontend still calls old URL | Confirm `.env` updates are reflected in `VITE_ENSO_AI_URL` and restart the dev server. |

## 6. Next Steps

- Implement worker adapters that translate between your chosen model runtime and the required `/suggest`, `/search`, `/summary` schema.
- Add smoke tests under `services/backend/tests` once the real model bridge is available.
