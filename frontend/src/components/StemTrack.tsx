"use client";

import { useRef } from "react";
import type { StemTrack as StemTrackType, StemName } from "@/types";
import { useWaveform } from "@/lib/useWaveform";
import styles from "./StemTrack.module.css";

const STEM_COLORS: Record<StemName, string> = {
  vocals: "rgba(99,  102, 241, 0.35)",  // indigo
  drums:  "rgba(239, 68,  68,  0.35)",  // red
  bass:   "rgba(234, 179, 8,   0.35)",  // amber
  other:  "rgba(34,  197, 94,  0.35)",  // green
};

const STEM_DOT: Record<StemName, string> = {
  vocals: "#6366f1",
  drums:  "#ef4444",
  bass:   "#eab308",
  other:  "#22c55e",
};

interface Props {
  track:        StemTrackType;
  isPlaying:    boolean;
  currentTime:  number;
  duration:     number;
  onVolume:     (name: StemName, v: number) => void;
  onMute:       (name: StemName) => void;
  onSolo:       (name: StemName) => void;
  onSeek:       (s: number) => void;
}

export default function StemTrack({
  track, isPlaying, currentTime, duration,
  onVolume, onMute, onSolo, onSeek,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveform(canvasRef, track.url, STEM_COLORS[track.name]);

  const progress  = duration > 0 ? currentTime / duration : 0;
  const isSilent  = track.muted;

  const handleWaveClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onSeek(frac * duration);
  };

  return (
    <div className={`${styles.row} ${isSilent ? styles.silent : ""}`}>

      {/* Label column */}
      <div className={styles.label}>
        <span className={styles.dot} style={{ background: STEM_DOT[track.name] }} />
        <span className={styles.name}>{track.label}</span>
      </div>

      {/* Waveform + playhead */}
      <div className={styles.waveWrap} onClick={handleWaveClick} role="slider"
        aria-valuemin={0} aria-valuemax={duration} aria-valuenow={currentTime}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={800}
          height={48}
        />
        {/* Playhead */}
        <div className={styles.playhead} style={{ left: `${progress * 100}%` }} />
      </div>

      {/* Controls column */}
      <div className={styles.controls}>
        {/* Volume */}
        <input
          type="range"
          className={styles.vol}
          min={0} max={1} step={0.01}
          value={track.volume}
          onChange={e => onVolume(track.name, parseFloat(e.target.value))}
          aria-label={`${track.label} volume`}
        />

        {/* Mute */}
        <button
          className={`${styles.btn} ${track.muted ? styles.btnActive : ""}`}
          onClick={() => onMute(track.name)}
          title="Mute"
          aria-pressed={track.muted}
        >
          M
        </button>

        {/* Solo */}
        <button
          className={`${styles.btn} ${track.soloed ? styles.btnActive : ""}`}
          onClick={() => onSolo(track.name)}
          title="Solo"
          aria-pressed={track.soloed}
        >
          S
        </button>

        {/* Download */}
        <a
          className={styles.btn}
          href={track.url}
          download={`${track.label.toLowerCase()}.wav`}
          title="Download stem"
          onClick={e => e.stopPropagation()}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </a>
      </div>
    </div>
  );
}
