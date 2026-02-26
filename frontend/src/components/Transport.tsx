"use client";

import styles from "./Transport.module.css";

interface Props {
  isPlaying:   boolean;
  currentTime: number;
  duration:    number;
  onPlay:      () => void;
  onPause:     () => void;
  onSeek:      (s: number) => void;
  onReset:     () => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return `${m}:${sec}`;
}

export default function Transport({
  isPlaying, currentTime, duration, onPlay, onPause, onSeek, onReset,
}: Props) {
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className={styles.transport}>
      {/* Play / Pause */}
      <button
        className={styles.playBtn}
        onClick={isPlaying ? onPause : onPlay}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying
          ? <PauseIcon />
          : <PlayIcon />
        }
      </button>

      {/* Reset */}
      <button className={styles.iconBtn} onClick={onReset} aria-label="Return to start">
        <RewindIcon />
      </button>

      {/* Time */}
      <span className={styles.time}>{fmt(currentTime)}</span>

      {/* Seek bar */}
      <div className={styles.seekWrap}>
        <div
          className={styles.seekTrack}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            onSeek(((e.clientX - rect.left) / rect.width) * duration);
          }}
        >
          <div className={styles.seekFill} style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <span className={styles.time}>{fmt(duration)}</span>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
  );
}

function RewindIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 .49-3.86"/>
    </svg>
  );
}
