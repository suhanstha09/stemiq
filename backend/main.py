"""
StemIQ — FastAPI backend
Handles audio upload, runs Demucs stem separation, streams progress via SSE,
and serves separated stems.
"""

import os
import uuid
import json
import asyncio
import subprocess
import shutil
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

# ── Config ────────────────────────────────────────────────────
UPLOAD_DIR  = Path("data/uploads")
STEMS_DIR   = Path("data/stems")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
STEMS_DIR.mkdir(parents=True, exist_ok=True)

# Demucs model: htdemucs splits into vocals / drums / bass / other
DEMUCS_MODEL = "htdemucs"
STEM_NAMES   = ["vocals", "drums", "bass", "other"]

app = FastAPI(title="StemIQ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve separated stems as static files
app.mount("/stems", StaticFiles(directory=str(STEMS_DIR)), name="stems")


# ── Upload & Separate ─────────────────────────────────────────
@app.post("/api/upload")
async def upload_audio(file: UploadFile = File(...)):
    """
    Accept an audio file, return a job_id.
    Actual separation is triggered via /api/separate/{job_id} (SSE).
    """
    # Validate file type
    allowed = {"audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac",
               "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/aiff"}
    if file.content_type not in allowed and not file.filename.endswith(
        (".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aiff")
    ):
        raise HTTPException(400, "Unsupported audio format")

    job_id   = str(uuid.uuid4())
    ext      = Path(file.filename).suffix or ".mp3"
    in_path  = UPLOAD_DIR / f"{job_id}{ext}"

    with open(in_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return {
        "job_id":   job_id,
        "filename": file.filename,
        "size":     len(content),
    }


@app.get("/api/separate/{job_id}")
async def separate_stems(job_id: str):
    """
    SSE endpoint. Runs Demucs in a subprocess, streams progress events,
    then returns stem URLs when done.
    """
    # Find the uploaded file
    matches = list(UPLOAD_DIR.glob(f"{job_id}.*"))
    if not matches:
        raise HTTPException(404, "Job not found")
    in_path = matches[0]

    out_dir = STEMS_DIR / job_id

    return StreamingResponse(
        _run_separation(job_id, in_path, out_dir),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _run_separation(
    job_id: str, in_path: Path, out_dir: Path
) -> AsyncGenerator[str, None]:
    """
    Run demucs as a subprocess, parse its stderr for progress,
    and yield SSE events.
    """

    def sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    yield sse("status", {"stage": "loading", "message": "Loading model…", "progress": 5})

    cmd = [
        "python", "-m", "demucs",
        "--name", DEMUCS_MODEL,
        "--out",  str(STEMS_DIR),
        "--filename", "{track}/{stem}.{ext}",
        str(in_path),
    ]

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        yield sse("status", {"stage": "separating", "message": "Separating stems…", "progress": 15})

        # Stream stderr for progress
        progress = 15
        async for line in process.stderr:
            text = line.decode("utf-8", errors="replace").strip()
            if not text:
                continue

            # Demucs prints lines like: "Separating track | 45%"
            # or "Segment N/M"
            if "%" in text:
                try:
                    pct_str = [s for s in text.split() if "%" in s][0].replace("%", "")
                    pct     = float(pct_str)
                    progress = int(15 + pct * 0.75)  # map to 15-90%
                    yield sse("progress", {"progress": progress, "message": text})
                except Exception:
                    pass
            elif text:
                yield sse("log", {"message": text})

        await process.wait()

        if process.returncode != 0:
            stderr_out = await process.stderr.read()
            yield sse("error", {"message": f"Demucs failed: {stderr_out.decode()[:300]}"})
            return

    except FileNotFoundError:
        yield sse("error", {"message": "Demucs not installed. Run: pip install demucs"})
        return
    except Exception as e:
        yield sse("error", {"message": str(e)})
        return

    yield sse("status", {"stage": "finalizing", "message": "Finalizing…", "progress": 92})

    # Demucs outputs to: STEMS_DIR / model_name / track_name / stem.wav
    # With our --filename flag it goes to: STEMS_DIR / track_name / stem.wav
    track_name = in_path.stem  # job_id
    stem_out   = STEMS_DIR / track_name

    # Fallback: demucs may put them under model subdir
    if not stem_out.exists():
        model_dir = STEMS_DIR / DEMUCS_MODEL / track_name
        if model_dir.exists():
            stem_out.mkdir(parents=True, exist_ok=True)
            for f in model_dir.iterdir():
                shutil.copy(f, stem_out / f.name)

    stems_found = {}
    for stem in STEM_NAMES:
        for ext in ["wav", "mp3", "flac"]:
            p = stem_out / f"{stem}.{ext}"
            if p.exists():
                stems_found[stem] = f"/stems/{track_name}/{stem}.{ext}"
                break

    if not stems_found:
        yield sse("error", {"message": "Separation completed but no stem files found."})
        return

    yield sse("done", {
        "progress": 100,
        "message":  "Done",
        "stems":    stems_found,
        "job_id":   job_id,
    })


# ── Stems info ────────────────────────────────────────────────
@app.get("/api/stems/{job_id}")
async def get_stems(job_id: str):
    """Return stem URLs for an already-processed job."""
    track_name = job_id
    stem_out   = STEMS_DIR / track_name
    if not stem_out.exists():
        raise HTTPException(404, "Stems not found for this job")

    stems = {}
    for stem in STEM_NAMES:
        for ext in ["wav", "mp3", "flac"]:
            p = stem_out / f"{stem}.{ext}"
            if p.exists():
                stems[stem] = f"/stems/{track_name}/{stem}.{ext}"
                break
    return {"stems": stems, "job_id": job_id}


# ── Health ────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    # Check if demucs is installed
    result = subprocess.run(
        ["python", "-m", "demucs", "--help"],
        capture_output=True
    )
    return {
        "status":         "ok",
        "demucs_ready":   result.returncode == 0,
    }
