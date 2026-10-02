/**
 * Time-derived match clock.
 *
 * The entire round/phase state machine is computed from `startedAt` plus the
 * configured durations, so no background worker or per-second job is needed:
 * any request (or the poll that follows a crash) can reconstruct exactly where
 * a match is. This module is pure and fully unit-tested.
 */

export type MatchPhase = "countdown" | "play" | "reveal" | "finished";

export interface MatchTiming {
  startedAt: Date;
  roundCount: number;
  roundMs: number;
  breakMs: number;
  countdownMs: number;
}

export interface MatchClock {
  phase: MatchPhase;
  /** 1-based round number; the countdown belongs to round 1. */
  round: number;
  roundStartedAt: Date;
  playEndsAt: Date;
  roundEndsAt: Date;
  msRemaining: number;
  phaseProgress: number;
  elapsedMs: number;
}

export function roundCycleMs(timing: Pick<MatchTiming, "roundMs" | "breakMs">): number {
  return timing.roundMs + timing.breakMs;
}

export function totalMatchMs(timing: MatchTiming): number {
  return timing.countdownMs + timing.roundCount * roundCycleMs(timing);
}

/** Window for a specific 1-based round, used to replay/bot-fill past rounds. */
export function roundWindow(timing: MatchTiming, round: number) {
  const cycle = roundCycleMs(timing);
  const start = timing.startedAt.getTime() + timing.countdownMs + (round - 1) * cycle;
  return {
    playStartsAt: new Date(start),
    playEndsAt: new Date(start + timing.roundMs),
    roundEndsAt: new Date(start + cycle),
  };
}

export function matchClock(timing: MatchTiming, now: Date = new Date()): MatchClock {
  const startedMs = timing.startedAt.getTime();
  const nowMs = now.getTime();
  const elapsedMs = Math.max(0, nowMs - startedMs);

  const clampRound = (value: number) => Math.min(Math.max(value, 1), timing.roundCount);

  // Countdown before round 1 opens.
  if (elapsedMs < timing.countdownMs) {
    const playEnds = startedMs + timing.countdownMs + timing.roundMs;
    const roundEnds = startedMs + timing.countdownMs + roundCycleMs(timing);

    return {
      phase: "countdown",
      round: 1,
      roundStartedAt: new Date(startedMs),
      playEndsAt: new Date(playEnds),
      roundEndsAt: new Date(roundEnds),
      msRemaining: timing.countdownMs - elapsedMs,
      phaseProgress: timing.countdownMs === 0 ? 1 : elapsedMs / timing.countdownMs,
      elapsedMs,
    };
  }

  const cycle = roundCycleMs(timing);
  const sinceStart = elapsedMs - timing.countdownMs;
  const index = Math.floor(sinceStart / cycle);
  const within = sinceStart - index * cycle;
  const round = clampRound(index + 1);

  const window = roundWindow(timing, round);

  if (index >= timing.roundCount) {
    return {
      phase: "finished",
      round: timing.roundCount,
      roundStartedAt: window.playStartsAt,
      playEndsAt: window.playEndsAt,
      roundEndsAt: window.roundEndsAt,
      msRemaining: 0,
      phaseProgress: 1,
      elapsedMs,
    };
  }

  const inPlay = within < timing.roundMs;

  return {
    phase: inPlay ? "play" : "reveal",
    round,
    roundStartedAt: window.playStartsAt,
    playEndsAt: window.playEndsAt,
    roundEndsAt: window.roundEndsAt,
    msRemaining: inPlay ? timing.roundMs - within : cycle - within,
    phaseProgress: inPlay
      ? timing.roundMs === 0
        ? 1
        : within / timing.roundMs
      : timing.breakMs === 0
        ? 1
        : (within - timing.roundMs) / timing.breakMs,
    elapsedMs,
  };
}

/**
 * Which round a guess belongs to, allowing a small grace window so a guess sent
 * just before the timer expires still counts for the round it was aimed at.
 */
export function roundForGuess(
  timing: MatchTiming,
  now: Date,
  graceMs = 500,
): { round: number; accepted: boolean } {
  const clock = matchClock(timing, now);
  const graceApplied = matchClock(timing, new Date(now.getTime() - graceMs));

  if (clock.phase === "countdown") return { round: 1, accepted: false };
  if (clock.phase === "finished") {
    // A guess that landed within the grace window of the final round still counts.
    if (graceApplied.phase === "play" && graceApplied.round === timing.roundCount) {
      return { round: timing.roundCount, accepted: true };
    }
    return { round: timing.roundCount, accepted: false };
  }

  if (clock.phase === "play") return { round: clock.round, accepted: true };

  // In the reveal break we only accept guesses aimed at the round that just ended.
  if (graceApplied.phase === "play" && graceApplied.round === clock.round) {
    return { round: clock.round, accepted: true };
  }
  return { round: clock.round, accepted: false };
}
