import test from "node:test";
import assert from "node:assert/strict";

import {
  HOUR_MS,
  MAX_DURATION_MS,
  MINUTE_MS,
  SECOND_MS,
  TimerModel,
  clampDuration,
  describeAdjustment,
  formatDuration,
  parseDuration,
  splitDuration,
} from "../timer-core.js";

test("formats and splits durations consistently", () => {
  const duration = HOUR_MS + MINUTE_MS + SECOND_MS;

  assert.equal(formatDuration(duration), "01:01:01");
  assert.deepEqual(splitDuration(duration), {
    hours: 1,
    minutes: 1,
    seconds: 1,
  });
  assert.equal(formatDuration(1_001, "ceil"), "00:00:02");
});

test("clamps invalid and out-of-range durations", () => {
  assert.equal(clampDuration(-SECOND_MS), 0);
  assert.equal(clampDuration(Number.NaN), 0);
  assert.equal(clampDuration(MAX_DURATION_MS + HOUR_MS), MAX_DURATION_MS);
  assert.equal(
    parseDuration({ hours: 100, minutes: 90, seconds: 80 }),
    MAX_DURATION_MS,
  );
});

test("stopwatch is calculated from timestamps and does not drift", () => {
  let now = 10_000;
  const timer = new TimerModel(() => now);

  assert.equal(timer.start(), true);
  assert.equal(
    timer.start(),
    false,
    "a repeated start must not restart the clock",
  );
  now += 2_450;
  assert.equal(timer.getValue(), 2_450);
  now += 60_000;
  assert.equal(timer.getValue(), 62_450);

  timer.pause();
  now += HOUR_MS;
  assert.equal(timer.getValue(), 62_450, "paused time must remain stable");
});

test("countdown cannot be adjusted below zero", () => {
  const timer = new TimerModel();
  timer.setMode("countdown");

  assert.equal(timer.adjust(-1), 0);
  assert.equal(formatDuration(timer.getValue()), "00:00:00");
});

test("countdown completes after delayed execution", () => {
  let now = 0;
  const timer = new TimerModel(() => now);
  timer.setMode("countdown");
  timer.setDuration(5 * SECOND_MS);
  timer.start();

  now = 2_250;
  assert.equal(timer.getValue(), 2_750);
  assert.equal(timer.consumeCompletion(), null);

  now = 8_000;
  assert.equal(timer.consumeCompletion(), "countdown");
  assert.equal(timer.getValue(), 0);
  assert.equal(timer.running, false);
});

test("reset restores a configured countdown and resets its adjustment unit", () => {
  let now = 0;
  const timer = new TimerModel(() => now);
  timer.setMode("countdown");
  timer.setDuration(5 * MINUTE_MS);
  timer.setAdjustment(HOUR_MS);
  timer.start();
  now = MINUTE_MS;
  timer.pause();

  timer.reset();

  assert.equal(timer.getValue(), 5 * MINUTE_MS);
  assert.equal(timer.adjustmentMs, SECOND_MS);
  assert.equal(describeAdjustment(timer.adjustmentMs), "1 second");
});

test("cycles through explicit countdown adjustment units", () => {
  const timer = new TimerModel();
  timer.setMode("countdown");

  assert.equal(timer.cycleAdjustment(), MINUTE_MS);
  assert.equal(timer.cycleAdjustment(), HOUR_MS);
  assert.equal(timer.cycleAdjustment(), SECOND_MS);
});

test("progress decreases with the remaining countdown", () => {
  let now = 0;
  const timer = new TimerModel(() => now);
  timer.setMode("countdown");
  timer.setDuration(10 * SECOND_MS);
  timer.start();

  now = 2_500;
  assert.equal(timer.getProgress(), 75);
});
