# Ledger

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
