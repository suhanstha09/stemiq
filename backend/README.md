# StemIQ — Backend

FastAPI server running Facebook Demucs for true AI stem separation.

## Setup 

```bash
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# Install dependencies
# Note: torch install may take a few minutes (~2GB download)
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

## First run

On first separation, Demucs will download the `htdemucs` model (~300MB).
This only happens once; it's cached in `~/.cache/torch/hub/`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload audio file → returns `job_id` |
| GET | `/api/separate/{job_id}` | SSE stream of separation progress + stem URLs |
| GET | `/api/stems/{job_id}` | Get stem URLs for completed job |
| GET | `/api/health` | Check server + demucs status |
| GET | `/stems/{job_id}/{stem}.wav` | Download/stream a separated stem |

## Output stems (Demucs htdemucs model)

- `vocals` — Lead and backing vocals
- `drums` — Full drum kit (kick, snare, cymbals, toms)
- `bass` — Bass guitar / bass synth
- `other` — Everything else (guitar, keys, strings, synths)

## Notes

- Separation time: ~30s–3min depending on track length and CPU/GPU
- GPU (CUDA) will be used automatically if available
- All uploads and stems are stored in `data/` directory
- The server does NOT auto-delete files — add a cleanup cron if needed
