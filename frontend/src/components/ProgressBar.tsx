"use client";

import type { SeparationStage } from "@/types";
import styles from "./ProgressBar.module.css";

interface Props {
  stage:    SeparationStage;
  progress: number;
  message:  string;
  filename: string | null;
}

const STAGE_LABELS: Record<SeparationStage, string> = {
  idle:       "",
  uploading:  "Uploading",
  loading:    "Loading model",
  separating: "Separating",
  finalizing: "Finalizing",
  done:       "Done",
  error:      "Error",
};

export default function ProgressBar({ stage, progress, message, filename }: Props) {
  const isError = stage === "error";
  const isDone  = stage === "done";

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.left}>
          {filename && <span className={styles.filename}>{filename}</span>}
          <span className={`${styles.stage} ${isError ? styles.errorText : ""}`}>
            {STAGE_LABELS[stage]}
          </span>
        </div>
        <span className={styles.pct}>{progress}%</span>
      </div>

      <div className={styles.track}>
        <div
          className={`${styles.fill} ${isError ? styles.errorFill : ""} ${isDone ? styles.doneFill : ""}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {message && !isDone && (
        <p className={`${styles.message} ${isError ? styles.errorText : ""}`}>
          {message}
        </p>
      )}
    </div>
  );
}
