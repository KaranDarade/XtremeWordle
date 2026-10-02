import { describe, expect, it } from "vitest";

import {
  matchClock,
  roundCycleMs,
  roundForGuess,
  roundWindow,
  totalMatchMs,
  type MatchTiming,
} from "@/lib/arena/clock";

/** Compact timings: 1s countdown, 4s play, 2s reveal, 3 rounds. */
const TIMING: MatchTiming = {
  startedAt: new Date("2026-09-21T10:00:00Z"),
  roundCount: 3,
  roundMs: 4000,
  breakMs: 2000,
  countdownMs: 1000,
};

const at = (ms: number) => new Date(TIMING.startedAt.getTime() + ms);

describe("durations", () => {
  it("computes the round cycle and total match length", () => {
    expect(roundCycleMs(TIMING)).toBe(6000);
    expect(totalMatchMs(TIMING)).toBe(1000 + 3 * 6000);
  });

  it("exposes per-round windows", () => {
    const first = roundWindow(TIMING, 1);
    expect(first.playStartsAt.toISOString()).toBe(at(1000).toISOString());
    expect(first.playEndsAt.toISOString()).toBe(at(5000).toISOString());
    expect(first.roundEndsAt.toISOString()).toBe(at(7000).toISOString());

    const third = roundWindow(TIMING, 3);
    expect(third.playStartsAt.toISOString()).toBe(at(13000).toISOString());
  });
});

describe("matchClock", () => {
  it("starts in the countdown", () => {
    const clock = matchClock(TIMING, at(0));
    expect(clock.phase).toBe("countdown");
    expect(clock.round).toBe(1);
    expect(clock.msRemaining).toBe(1000);
  });

  it("opens play on round 1 when the countdown ends", () => {
    const clock = matchClock(TIMING, at(1000));
    expect(clock.phase).toBe("play");
    expect(clock.round).toBe(1);
    expect(clock.msRemaining).toBe(4000);
  });

  it("switches to reveal mid-round", () => {
    const clock = matchClock(TIMING, at(5000));
    expect(clock.phase).toBe("reveal");
    expect(clock.round).toBe(1);
    expect(clock.msRemaining).toBe(2000);
  });

  it("advances to the next round after the break", () => {
    const clock = matchClock(TIMING, at(7000));
    expect(clock.phase).toBe("play");
    expect(clock.round).toBe(2);
    expect(clock.roundStartedAt.toISOString()).toBe(at(7000).toISOString());
  });

  it("walks through every round and then finishes", () => {
    expect(matchClock(TIMING, at(12999)).round).toBe(2);
    expect(matchClock(TIMING, at(13000)).round).toBe(3);
    expect(matchClock(TIMING, at(18000)).phase).toBe("reveal");
    expect(matchClock(TIMING, at(19000)).phase).toBe("finished");
    expect(matchClock(TIMING, at(99999)).phase).toBe("finished");
  });

  it("reports phase progress between 0 and 1", () => {
    const clock = matchClock(TIMING, at(3000));
    expect(clock.phase).toBe("play");
    expect(clock.phaseProgress).toBeCloseTo(0.5, 5);
    expect(clock.msRemaining).toBe(2000);
  });

  it("treats a clock before the start as the countdown", () => {
    expect(matchClock(TIMING, new Date(TIMING.startedAt.getTime() - 5000)).elapsedMs).toBe(0);
  });
});

describe("roundForGuess", () => {
  it("accepts guesses during play", () => {
    expect(roundForGuess(TIMING, at(2000))).toEqual({ round: 1, accepted: true });
  });

  it("rejects guesses during the countdown", () => {
    expect(roundForGuess(TIMING, at(200))).toEqual({ round: 1, accepted: false });
  });

  it("accepts a late guess aimed at the round that just ended", () => {
    // Play ends at 5000; a guess arriving at 5200 is still inside the grace window.
    expect(roundForGuess(TIMING, at(5200), 500)).toEqual({ round: 1, accepted: true });
  });

  it("rejects a guess made long after the round closed", () => {
    expect(roundForGuess(TIMING, at(6500), 500)).toEqual({ round: 1, accepted: false });
  });

  it("accepts a last-instant guess on the final round", () => {
    const endOfLastPlay = 1000 + 2 * 6000 + 4000; // 17000
    expect(roundForGuess(TIMING, at(endOfLastPlay + 300), 500)).toEqual({
      round: 3,
      accepted: true,
    });
  });

  it("rejects everything once the match is over", () => {
    expect(roundForGuess(TIMING, at(30000), 500).accepted).toBe(false);
  });
});
