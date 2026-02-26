"use client";

import { useEffect, useRef } from "react";

/**
 * Draws a static waveform for an audio URL onto a canvas element.
 * Uses OfflineAudioContext to decode + sample the buffer.
 */
export function useWaveform(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  url: string | undefined,
  color: string,
) {
  const drawn = useRef<string | null>(null);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    if (drawn.current === url) return;
    drawn.current = url;

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx) return;

    (async () => {
      try {
        const res    = await fetch(url);
        const buf    = await res.arrayBuffer();
        const offCtx = new OfflineAudioContext(1, 1, 44100);
        const decoded = await offCtx.decodeAudioData(buf);

        const data     = decoded.getChannelData(0);
        const W        = canvas.width;
        const H        = canvas.height;
        const samples  = W * 2; // two samples per pixel for density
        const blockSize = Math.floor(data.length / samples);

        ctx.clearRect(0, 0, W, H);

        // Draw peaks
        ctx.beginPath();
        for (let i = 0; i < samples; i++) {
          let min = 1, max = -1;
          for (let j = 0; j < blockSize; j++) {
            const v = data[i * blockSize + j] ?? 0;
            if (v < min) min = v;
            if (v > max) max = v;
          }
          const x  = (i / samples) * W;
          const yH = ((1 + max) / 2) * H;
          const yL = ((1 + min) / 2) * H;
          if (i === 0) ctx.moveTo(x, yH);
          else         ctx.lineTo(x, yH);
          // We'll fill top half then mirror
        }
        // Reverse for bottom (mirrored)
        for (let i = samples - 1; i >= 0; i--) {
          let min = 1, max = -1;
          for (let j = 0; j < blockSize; j++) {
            const v = data[i * blockSize + j] ?? 0;
            if (v < min) min = v;
            if (v > max) max = v;
          }
          const x  = (i / samples) * W;
          const yL = ((1 + min) / 2) * H;
          ctx.lineTo(x, yL);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      } catch {
        // Silently fail — waveform is decorative
      }
    })();
  }, [url, canvasRef, color]);
}
