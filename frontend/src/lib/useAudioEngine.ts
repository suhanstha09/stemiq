"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { Stems, StemName, StemTrack } from "@/types";

const STEM_META: Record<StemName, { label: string }> = {
  vocals: { label: "Vocals"       },
  drums:  { label: "Drums"        },
  bass:   { label: "Bass"         },
  other:  { label: "Guitar / Keys" },
};

export function useAudioEngine(stems: Stems | null) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tracksRef   = useRef<Map<StemName, {
    source:  AudioBufferSourceNode | null;
    gain:    GainNode;
    buffer:  AudioBuffer;
  }>>(new Map());

  const [tracks,     setTracks]     = useState<StemTrack[]>([]);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [isLoading,  setIsLoading]  = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,   setDuration]   = useState(0);

  const startedAtRef  = useRef<number>(0);  // audioCtx.currentTime when play started
  const offsetRef     = useRef<number>(0);  // seek offset in seconds
  const rafRef        = useRef<number>(0);
  const playingRef    = useRef(false);

  // ── Load all stems into AudioBuffers ────────────────────────
  const loadStems = useCallback(async (stemsMap: Stems) => {
    setIsLoading(true);
    setTracks([]);

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const entries = Object.entries(stemsMap) as [StemName, string][];
    const loaded  = new Map<StemName, { gain: GainNode; buffer: AudioBuffer; source: null }>();
    let maxDuration = 0;

    await Promise.all(entries.map(async ([name, url]) => {
      const res     = await fetch(url);
      const buf     = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buf);
      const gain    = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.value = 1;
      if (decoded.duration > maxDuration) maxDuration = decoded.duration;
      loaded.set(name, { gain, buffer: decoded, source: null });
    }));

    tracksRef.current = loaded as typeof tracksRef.current;
    setDuration(maxDuration);

    const initialTracks: StemTrack[] = entries.map(([name, url]) => ({
      name,
      label:  STEM_META[name]?.label ?? name,
      url,
      volume: 1,
      muted:  false,
      soloed: false,
    }));
    setTracks(initialTracks);
    setIsLoading(false);
  }, []);

  // ── Play ─────────────────────────────────────────────────────
  const play = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || tracksRef.current.size === 0) return;
    if (ctx.state === "suspended") ctx.resume();

    // Stop any existing sources
    tracksRef.current.forEach(t => {
      if (t.source) { try { t.source.stop(); } catch {} }
    });

    const offset = offsetRef.current;
    startedAtRef.current = ctx.currentTime - offset;

    tracksRef.current.forEach((track, name) => {
      const src = ctx.createBufferSource();
      src.buffer = track.buffer;
      src.connect(track.gain);
      src.start(0, offset);
      track.source = src;
    });

    playingRef.current = true;
    setIsPlaying(true);

    const tick = () => {
      if (!playingRef.current) return;
      const t = ctx.currentTime - startedAtRef.current;
      setCurrentTime(Math.min(t, duration));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [duration]);

  // ── Pause ────────────────────────────────────────────────────
  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    offsetRef.current = ctx.currentTime - startedAtRef.current;
    tracksRef.current.forEach(t => {
      if (t.source) { try { t.source.stop(); } catch {} t.source = null; }
    });
    playingRef.current = false;
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Seek ─────────────────────────────────────────────────────
  const seek = useCallback((seconds: number) => {
    offsetRef.current = seconds;
    setCurrentTime(seconds);
    if (playingRef.current) {
      pause();
      setTimeout(() => play(), 50);
    }
  }, [pause, play]);

  // ── Volume ───────────────────────────────────────────────────
  const setVolume = useCallback((name: StemName, vol: number) => {
    const track = tracksRef.current.get(name);
    if (track) track.gain.gain.value = vol;
    setTracks(prev => prev.map(t => t.name === name ? { ...t, volume: vol } : t));
  }, []);

  // ── Mute ─────────────────────────────────────────────────────
  const toggleMute = useCallback((name: StemName) => {
    setTracks(prev => {
      const updated = prev.map(t =>
        t.name === name ? { ...t, muted: !t.muted } : t
      );
      // Apply gain
      updated.forEach(t => {
        const track = tracksRef.current.get(t.name);
        if (track) {
          const anySoloed = updated.some(x => x.soloed);
          const audible   = !t.muted && (!anySoloed || t.soloed);
          track.gain.gain.value = audible ? t.volume : 0;
        }
      });
      return updated;
    });
  }, []);

  // ── Solo ─────────────────────────────────────────────────────
  const toggleSolo = useCallback((name: StemName) => {
    setTracks(prev => {
      const updated = prev.map(t =>
        t.name === name ? { ...t, soloed: !t.soloed } : t
      );
      const anySoloed = updated.some(t => t.soloed);
      updated.forEach(t => {
        const track = tracksRef.current.get(t.name);
        if (track) {
          const audible = !t.muted && (!anySoloed || t.soloed);
          track.gain.gain.value = audible ? t.volume : 0;
        }
      });
      return updated;
    });
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Load when stems change ────────────────────────────────────
  useEffect(() => {
    if (stems) {
      audioCtxRef.current?.close();
      offsetRef.current   = 0;
      playingRef.current  = false;
      setIsPlaying(false);
      setCurrentTime(0);
      loadStems(stems);
    }
  }, [stems, loadStems]);

  return {
    tracks,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    toggleSolo,
  };
}
