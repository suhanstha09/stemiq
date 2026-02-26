# StemIQ

Separate any song into **vocals, drums, bass, and guitar/keys** using Facebook's Demucs neural network — fully local, no API keys needed.

```
stemiq/
├── backend/          FastAPI server + Demucs
│   ├── main.py
│   ├── requirements.txt
│   └── data/         uploads + separated stems (auto-created)
└── frontend/         Next.js 14 app
    └── src/
        ├── app/
        ├── components/
        └── lib/
```

---

## Quick start

### 1. Backend

```bash
cd backend

# Create virtualenv
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install (torch is ~2GB first time)
pip install -r requirements.txt

# Run
uvicorn main:app --reload --port 8000
```

On first use, Demucs downloads the `htdemucs` model (~300MB, cached to `~/.cache/`).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## How it works

```
Browser                      FastAPI                     Demucs
  │                             │                           │
  │── POST /api/upload ────────>│                           │
  │<── { job_id } ──────────────│                           │
  │                             │                           │
  │── GET /api/separate/{id} ──>│── subprocess demucs ─────>│
  │<── SSE: progress 15% ───────│<── stderr "15%" ──────────│
  │<── SSE: progress 60% ───────│<── stderr "60%" ──────────│
  │<── SSE: done + stem URLs ───│<── process exit 0 ────────│
  │                             │                           │
  │── fetch /stems/{id}/vocals.wav
  │── fetch /stems/{id}/drums.wav
  │── fetch /stems/{id}/bass.wav
  │── fetch /stems/{id}/other.wav
  │
  └── Web Audio API: synchronized multi-track playback
```

## Output stems

| Stem | What it contains |
|------|-----------------|
| `vocals` | Lead vocals, backing vocals, harmonies |
| `drums` | Kick, snare, hi-hats, cymbals, toms — full kit |
| `bass` | Bass guitar, bass synth, sub bass |
| `other` | Guitar, piano, keys, strings, synths, everything else |

## System requirements

- Python 3.10+
- Node.js 18+
- ~4GB RAM minimum (8GB recommended)
- CUDA GPU optional but speeds up separation 5–10×

## Notes

- Separated files are stored in `backend/data/stems/` — add a cleanup cron for production
- GPU (CUDA/MPS) detected automatically by PyTorch
- `htdemucs` is the most accurate Demucs model as of 2024
