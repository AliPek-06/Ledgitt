# Ledgitt

Group-work contribution tracker. Teams agree a charter (who does what, when), log
contributions in an append-only ledger that teammates confirm or dispute, and get
early warnings at time checkpoints when someone falls behind their own plan.

- API contract: [docs/API.md](docs/API.md)
- Business rules: [docs/RULES.md](docs/RULES.md)

## Backend (Python 3.11, FastAPI, SQLModel + SQLite)

```bash
cd backend
python3.11 -m venv .venv   # any Python >= 3.11 works
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API at http://localhost:8000, interactive docs at http://localhost:8000/docs.

Load the demo story (wipes the database, sets demo time to 20% of the timeline):

```bash
curl -X POST localhost:8000/api/demo/seed
```

Run tests:

```bash
cd backend && pytest
```

## Frontend (React + TypeScript, Vite, Tailwind)

```bash
cd frontend
npm install
npm run dev
```

App at http://localhost:5173.

To run the frontend without the backend, using the Group 7 fixtures in
`frontend/src/mocks/`:

```bash
npm run dev:mocks          # or set VITE_USE_MOCKS=true in frontend/.env.local
```

## Guided presentation

Open http://localhost:5173/demo for a presenter-driven walkthrough of the whole
story (charter, document, ledger, checkpoints, progress, teacher) in about two
minutes. It uses scripted data only, so the backend does not need to be running.

| Key | Action |
|---|---|
| Enter / Space / → | Next step (or finish the current animation) |
| ← | Previous step |
| R | Restart |
| H | Hide/show the caption bar |
| Esc | Exit to the normal app |

Press F11 (Ctrl+Cmd+F on a Mac) for browser fullscreen; the 1280x720 stage scales
to fit any screen.
