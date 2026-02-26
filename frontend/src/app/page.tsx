"use client";

import { useState, useCallback, useRef } from "react";
import type { SeparationState, StemName } from "@/types";
import { uploadAudio, startSeparation } from "@/lib/api";
import { useAudioEngine } from "@/lib/useAudioEngine";
import DropZone   from "@/components/DropZone";
import ProgressBar from "@/components/ProgressBar";
import StemTrack  from "@/components/StemTrack";
import Transport  from "@/components/Transport";
import styles     from "./page.module.css";

const INITIAL_STATE: SeparationState = {
  stage:    "idle",
  progress: 0,
  message:  "",
  stems:    null,
  jobId:    null,
  filename: null,
  error:    null,
};

export default function Home() {
  const [sep, setSep] = useState<SeparationState>(INITIAL_STATE);
  const abortRef = useRef<(() => void) | null>(null);

  const engine = useAudioEngine(sep.stems);

  const handleFile = useCallback(async (file: File) => {
    // Abort any in-flight separation
    abortRef.current?.();

    setSep({
      ...INITIAL_STATE,
      stage:    "uploading",
      progress: 2,
      message:  "Uploading…",
      filename: file.name,
    });

    try {
      const { job_id } = await uploadAudio(file);

      setSep(prev => ({ ...prev, stage: "loading", progress: 8, message: "Uploaded", jobId: job_id }));

      const abort = startSeparation(
        job_id,
        ev => {
          if (ev.type === "done" && ev.stems) {
            setSep(prev => ({
              ...prev,
              stage:    "done",
              progress: 100,
              message:  "Separation complete",
              stems:    ev.stems ?? null,
            }));
          } else if (ev.type === "error") {
            setSep(prev => ({
              ...prev,
              stage:   "error",
              message: ev.message,
              error:   ev.message,
            }));
          } else {
            setSep(prev => ({
              ...prev,
              stage:    (ev.stage ?? prev.stage) as SeparationState["stage"],
              progress: ev.progress ?? prev.progress,
              message:  ev.message ?? prev.message,
            }));
          }
        },
        () => { abortRef.current = null; },
      );
      abortRef.current = abort;

    } catch (err: unknown) {
      setSep(prev => ({
        ...prev,
        stage:   "error",
        message: (err as Error).message,
        error:   (err as Error).message,
      }));
    }
  }, []);

  const handleReset = () => {
    abortRef.current?.();
    engine.pause();
    setSep(INITIAL_STATE);
  };

  const isProcessing = ["uploading","loading","separating","finalizing"].includes(sep.stage);
  const hasTracks    = sep.stage === "done" && engine.tracks.length > 0;

  return (
    <div className={styles.page}>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.wordmark}>
          <span className={styles.stemWord}>stem</span>
          <span className={styles.iqWord}>iq</span>
        </div>
        <p className={styles.tagline}>AI stem separation — vocals, drums, bass, other</p>

        {sep.stage !== "idle" && (
          <button className={styles.resetBtn} onClick={handleReset}>
            New track
          </button>
        )}
      </header>

      <main className={styles.main}>

        {/* ── Upload state ──────────────────────────────────── */}
        {sep.stage === "idle" && (
          <div className={styles.uploadSection}>
            <DropZone onFile={handleFile} disabled={isProcessing} />
            <p className={styles.hint}>
              Uses <a href="https://github.com/facebookresearch/demucs" target="_blank" rel="noopener">Demucs htdemucs</a> model.
              Processing takes 30s–3min depending on track length.
            </p>
          </div>
        )}

        {/* ── Processing state ──────────────────────────────── */}
        {isProcessing && (
          <div className={styles.processingSection}>
            <ProgressBar
              stage={sep.stage}
              progress={sep.progress}
              message={sep.message}
              filename={sep.filename}
            />
            <div className={styles.processingNote}>
              <p>
                Demucs is analyzing the full mix and separating it into
                individual stems using a trained neural network.
                {sep.stage === "loading" && " The model is loading for the first time — this may take a moment."}
              </p>
            </div>
          </div>
        )}

        {/* ── Error state ───────────────────────────────────── */}
        {sep.stage === "error" && (
          <div className={styles.errorSection}>
            <p className={styles.errorTitle}>Separation failed</p>
            <p className={styles.errorMsg}>{sep.error}</p>
            <button className={styles.retryBtn} onClick={handleReset}>Try again</button>
          </div>
        )}

        {/* ── Stems / playback state ────────────────────────── */}
        {sep.stage === "done" && (
          <div className={styles.stemSection}>
            <div className={styles.trackHeader}>
              <div className={styles.trackInfo}>
                <span className={styles.trackName}>{sep.filename}</span>
                <span className={styles.trackMeta}>
                  {engine.tracks.length} stems · {engine.isLoading ? "Loading audio…" : "Ready"}
                </span>
              </div>
              <div className={styles.trackHints}>
                <span>M = mute</span>
                <span>S = solo</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                </svg>
                <span>= download stem</span>
              </div>
            </div>

            {engine.isLoading ? (
              <div className={styles.loadingTracks}>
                <div className={styles.loadingBar} />
                <p>Decoding audio…</p>
              </div>
            ) : (
              <>
                <Transport
                  isPlaying={engine.isPlaying}
                  currentTime={engine.currentTime}
                  duration={engine.duration}
                  onPlay={engine.play}
                  onPause={engine.pause}
                  onSeek={engine.seek}
                  onReset={() => engine.seek(0)}
                />

                <div className={styles.tracks}>
                  {engine.tracks.map(track => (
                    <StemTrack
                      key={track.name}
                      track={track}
                      isPlaying={engine.isPlaying}
                      currentTime={engine.currentTime}
                      duration={engine.duration}
                      onVolume={engine.setVolume}
                      onMute={engine.toggleMute}
                      onSolo={engine.toggleSolo}
                      onSeek={engine.seek}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <span>Demucs model: htdemucs</span>
        <span>·</span>
        <a href="https://github.com/facebookresearch/demucs" target="_blank" rel="noopener">
          Source
        </a>
      </footer>
    </div>
  );
}
