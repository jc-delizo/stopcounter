export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const MAX_DURATION_MS = (99 * 60 * 60 + 59 * 60 + 59) * SECOND_MS;
export const ADJUSTMENT_STEPS = [SECOND_MS, MINUTE_MS, HOUR_MS];

export function clampDuration(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(MAX_DURATION_MS, Math.max(0, Math.round(numericValue)));
}

export function parseDuration({ hours = 0, minutes = 0, seconds = 0 } = {}) {
  const safeHours = Math.min(99, Math.max(0, Math.trunc(Number(hours) || 0)));
  const safeMinutes = Math.min(
    59,
    Math.max(0, Math.trunc(Number(minutes) || 0)),
  );
  const safeSeconds = Math.min(
    59,
    Math.max(0, Math.trunc(Number(seconds) || 0)),
  );

  return clampDuration(
    safeHours * HOUR_MS + safeMinutes * MINUTE_MS + safeSeconds * SECOND_MS,
  );
}

export function splitDuration(milliseconds) {
  const totalSeconds = Math.floor(clampDuration(milliseconds) / SECOND_MS);

  return {
    hours: Math.floor(totalSeconds / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function formatDuration(milliseconds, rounding = "floor") {
  const safeMilliseconds = clampDuration(milliseconds);
  const round = rounding === "ceil" ? Math.ceil : Math.floor;
  const totalSeconds = Math.min(
    Math.floor(MAX_DURATION_MS / SECOND_MS),
    round(safeMilliseconds / SECOND_MS),
  );
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function toIsoDuration(milliseconds, rounding = "floor") {
  const safeMilliseconds = clampDuration(milliseconds);
  const round = rounding === "ceil" ? Math.ceil : Math.floor;
  const totalSeconds = round(safeMilliseconds / SECOND_MS);

  return `PT${totalSeconds}S`;
}

export function describeAdjustment(milliseconds) {
  if (milliseconds === HOUR_MS) return "1 hour";
  if (milliseconds === MINUTE_MS) return "1 minute";
  return "1 second";
}

export class TimerModel {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.mode = "stopwatch";
    this.running = false;
    this.valueMs = 0;
    this.configuredDurationMs = 0;
    this.adjustmentMs = SECOND_MS;
    this.startedAt = null;
    this.startValueMs = 0;
  }

  getValue(at = this.now()) {
    if (!this.running || this.startedAt === null) {
      return clampDuration(this.valueMs);
    }

    const elapsed = Math.max(0, at - this.startedAt);
    const nextValue =
      this.mode === "stopwatch"
        ? this.startValueMs + elapsed
        : this.startValueMs - elapsed;

    return clampDuration(nextValue);
  }

  setMode(mode) {
    if (!["stopwatch", "countdown"].includes(mode)) {
      throw new TypeError(`Unsupported timer mode: ${mode}`);
    }

    if (mode === this.mode) {
      return;
    }

    this.pause();
    this.mode = mode;
    this.valueMs = mode === "countdown" ? this.configuredDurationMs : 0;
    this.startValueMs = this.valueMs;
    this.adjustmentMs = SECOND_MS;
  }

  setDuration(milliseconds) {
    this.pause();
    const duration = clampDuration(milliseconds);
    this.configuredDurationMs = duration;
    this.valueMs = duration;
    this.startValueMs = duration;
  }

  setAdjustment(milliseconds) {
    const numericValue = Number(milliseconds);
    this.adjustmentMs = ADJUSTMENT_STEPS.includes(numericValue)
      ? numericValue
      : SECOND_MS;
  }

  cycleAdjustment() {
    const currentIndex = ADJUSTMENT_STEPS.indexOf(this.adjustmentMs);
    const nextIndex = (currentIndex + 1) % ADJUSTMENT_STEPS.length;
    this.adjustmentMs = ADJUSTMENT_STEPS[nextIndex];
    return this.adjustmentMs;
  }

  adjust(direction) {
    if (this.mode !== "countdown" || this.running) {
      return this.getValue();
    }

    const multiplier = direction < 0 ? -1 : 1;
    const nextValue = clampDuration(
      this.valueMs + multiplier * this.adjustmentMs,
    );
    this.valueMs = nextValue;
    this.configuredDurationMs = nextValue;
    this.startValueMs = nextValue;
    return nextValue;
  }

  start() {
    if (this.running) {
      return false;
    }

    if (this.mode === "countdown" && this.valueMs <= 0) {
      return false;
    }

    this.startValueMs = this.valueMs;
    this.startedAt = this.now();
    this.running = true;
    return true;
  }

  pause() {
    if (!this.running) {
      return false;
    }

    this.valueMs = this.getValue();
    this.startValueMs = this.valueMs;
    this.startedAt = null;
    this.running = false;
    return true;
  }

  reset() {
    this.running = false;
    this.startedAt = null;
    this.valueMs = this.mode === "countdown" ? this.configuredDurationMs : 0;
    this.startValueMs = this.valueMs;
    this.adjustmentMs = SECOND_MS;
  }

  consumeCompletion(at = this.now()) {
    if (!this.running) {
      return null;
    }

    const value = this.getValue(at);
    const isCountdownComplete = this.mode === "countdown" && value <= 0;
    const isStopwatchAtMaximum =
      this.mode === "stopwatch" && value >= MAX_DURATION_MS;

    if (!isCountdownComplete && !isStopwatchAtMaximum) {
      return null;
    }

    this.valueMs = isCountdownComplete ? 0 : MAX_DURATION_MS;
    this.startValueMs = this.valueMs;
    this.startedAt = null;
    this.running = false;
    return isCountdownComplete ? "countdown" : "maximum";
  }

  getProgress(at = this.now()) {
    if (this.mode !== "countdown" || this.configuredDurationMs <= 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(100, (this.getValue(at) / this.configuredDurationMs) * 100),
    );
  }
}
