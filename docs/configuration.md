# Configuration

| Key | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./enso.db` | SQLAlchemy connection string for the FastAPI backend. Point to Postgres (`postgresql+psycopg://...`) in shared environments. |
| `API_DEBUG` | `false` | Enables verbose SQL logging for troubleshooting when set to `true`. |
| `SYNC_PAGE_SIZE` | `100` | Maximum number of records returned per sync page from `/sync/thoughts`. |
| `ENSO_API_URL` | `http://127.0.0.1:8000` | Base URL used by the web and mobile shells to reach the FastAPI service. |
| `AI_ENABLED` | `false` | Toggles AI-assisted features on the backend. When `false`, `/api/ai/*` returns graceful fallbacks. |
| `AI_MODE` | `stub` | Chooses the inference strategy: `stub`, `local`, `remote`, or `auto`. Stub returns deterministic sample data. |
| `AI_MODEL_URL` | `http://127.0.0.1:11434` | Base URL for the on-device or remote model runner (Ollama, llama.cpp, etc.) that FastAPI forwards requests to. |
| `AI_TIMEOUT_SECONDS` | `8.0` | Maximum seconds to wait for the model runner before returning `503`. |
| `ENSO_AI_URL` | `http://127.0.0.1:8000` | Explicit override for the AI base URL used by clients (defaults to `ENSO_API_URL`). |
| `VITE_ENSO_AI_URL` | `http://127.0.0.1:8000` | Vite-friendly alias for `ENSO_AI_URL` so the web shell can resolve the AI endpoint at build time. |
