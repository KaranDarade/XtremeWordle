"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "ew_arena_sound";

/**
 * Tiny Web Audio sound effects — synthesised oscillators, so there are no audio
 * files to download and nothing plays unless the player opts in.
 */
export function useArenaSound() {
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(false);
  const contextRef = useRef<AudioContext | null>(null);

  // Read the preference after mount so the server and first client render match.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === "1");
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const tone = useCallback(
    (frequency: number, durationMs: number, type: OscillatorType = "sine", delayMs = 0) => {
      if (!enabledRef.current) return;

      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      try {
        const context = (contextRef.current ??= new Ctor());
        const start = context.currentTime + delayMs / 1000;
        const end = start + durationMs / 1000;

        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
      } catch {
        // Audio is a nicety; never let it break gameplay.
      }
    },
    [],
  );

  const playRoundStart = useCallback(() => tone(520, 120, "triangle"), [tone]);
  const playWin = useCallback(() => {
    tone(660, 140, "sine");
    tone(880, 200, "sine", 140);
  }, [tone]);
  const playLoss = useCallback(() => {
    tone(320, 200, "sawtooth");
    tone(220, 260, "sawtooth", 180);
  }, [tone]);

  function toggle() {
    setEnabled((previous) => {
      const next = !previous;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return { soundEnabled: enabled, toggleSound: toggle, playRoundStart, playWin, playLoss };
}
