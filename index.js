import {
  HOUR_MS,
  MINUTE_MS,
  SECOND_MS,
  TimerModel,
  describeAdjustment,
  formatDuration,
  toIsoDuration,
} from "./timer-core.js";
import { initializeRain } from "./rain.js";

const elements = {
  timeDisplay: document.querySelector("#time-display"),
  timeSlots: [...document.querySelectorAll("[data-time-slot]")],
  watchState: document.querySelector("#watch-state"),
  progressWrap: document.querySelector("#progress-wrap"),
  progress: document.querySelector("#countdown-progress"),
  statusMessage: document.querySelector("#status-message"),
  unitLabelPath: document.querySelector("#unit-label-path"),
  hardwareStart: document.querySelector("#hardware-start"),
  hardwarePause: document.querySelector("#hardware-pause"),
  hardwareReset: document.querySelector("#hardware-reset"),
  hardwareStopwatch: document.querySelector("#hardware-stopwatch"),
  hardwareCountdown: document.querySelector("#hardware-countdown"),
  hardwareIncrease: document.querySelector("#hardware-increase"),
  hardwareDecrease: document.querySelector("#hardware-decrease"),
  hardwareUnit: document.querySelector("#hardware-unit"),
};

const timer = new TimerModel();
const hardwareControls = [
  elements.hardwareStart,
  elements.hardwarePause,
  elements.hardwareReset,
  elements.hardwareStopwatch,
  elements.hardwareCountdown,
  elements.hardwareIncrease,
  elements.hardwareDecrease,
  elements.hardwareUnit,
];
const dialLabels = new Map(
  [...document.querySelectorAll(".dial-copy")].map((label) => [
    label.dataset.label,
    label,
  ]),
);
const controlLabels = new Map([
  [elements.hardwareStart, "start"],
  [elements.hardwarePause, "pause"],
  [elements.hardwareReset, "reset"],
  [elements.hardwareStopwatch, "stopwatch"],
  [elements.hardwareCountdown, "countdown"],
  [elements.hardwareIncrease, "increase"],
  [elements.hardwareDecrease, "decrease"],
  [elements.hardwareUnit, "unit"],
]);

let tickHandle = null;
let feedbackHandle = null;
let watchFeedback = null;
let audioContext = null;

function adjustmentUnitName() {
  if (timer.adjustmentMs === HOUR_MS) return "HOURS";
  if (timer.adjustmentMs === MINUTE_MS) return "MINUTES";
  return "SECONDS";
}

function setStatus(message, feedback = null, feedbackDuration = 0) {
  elements.statusMessage.textContent = message;
  window.clearTimeout(feedbackHandle);
  feedbackHandle = null;
  watchFeedback = feedback;

  if (feedback && feedbackDuration > 0) {
    feedbackHandle = window.setTimeout(() => {
      watchFeedback = null;
      feedbackHandle = null;
      render();
    }, feedbackDuration);
  }
}

function clearFeedback() {
  window.clearTimeout(feedbackHandle);
  feedbackHandle = null;
  watchFeedback = null;
}

function updateDialLabels() {
  dialLabels
    .get("stopwatch")
    ?.classList.toggle("selected", timer.mode === "stopwatch");
  dialLabels
    .get("countdown")
    ?.classList.toggle("selected", timer.mode === "countdown");
  elements.unitLabelPath.textContent = adjustmentUnitName();
}

function render(at = Date.now()) {
  const currentValue = timer.getValue(at);
  const rounding = timer.mode === "countdown" ? "ceil" : "floor";
  const displayValue = formatDuration(currentValue, rounding);
  const isCountdown = timer.mode === "countdown";
  const hasElapsedStopwatchTime =
    timer.mode === "stopwatch" && currentValue > 0;
  const isCountdownAwayFromStart =
    isCountdown && currentValue !== timer.configuredDurationMs;
  const canStart = !timer.running && (!isCountdown || currentValue > 0);
  const canAdjust = isCountdown && !timer.running;
  const canReset =
    timer.running ||
    hasElapsedStopwatchTime ||
    isCountdownAwayFromStart ||
    timer.adjustmentMs !== SECOND_MS;
  const defaultWatchState = timer.running
    ? "Running"
    : isCountdown
      ? currentValue <= 0
        ? `Set ${adjustmentUnitName().toLowerCase()}`
        : currentValue === timer.configuredDurationMs
          ? "Ready"
          : "Paused"
      : currentValue > 0
        ? "Paused"
        : "Ready";

  const displayDigits = displayValue.replaceAll(":", "");
  elements.timeSlots.forEach((slot, index) => {
    slot.textContent = displayDigits[index];
  });
  elements.timeDisplay.dateTime = toIsoDuration(currentValue, rounding);
  elements.timeDisplay.setAttribute(
    "aria-label",
    `${timer.mode} time ${displayValue.replaceAll(":", " ")}`,
  );
  elements.watchState.textContent = watchFeedback ?? defaultWatchState;

  const countdownProgress = timer.getProgress(at);
  elements.progressWrap.classList.toggle("inactive", !isCountdown);
  elements.progress.value = countdownProgress;
  elements.progress.textContent = `${Math.round(countdownProgress)}%`;
  elements.progress.setAttribute("aria-disabled", String(!isCountdown));

  elements.hardwareStart.disabled = timer.running || !canStart;
  elements.hardwarePause.disabled = !timer.running;
  elements.hardwareReset.disabled = !canReset;
  elements.hardwareStopwatch.disabled = timer.running || !isCountdown;
  elements.hardwareCountdown.disabled = timer.running || isCountdown;
  elements.hardwareIncrease.disabled = !canAdjust;
  elements.hardwareDecrease.disabled = !canAdjust || currentValue <= 0;
  elements.hardwareUnit.disabled = !canAdjust;
  elements.hardwareStopwatch.setAttribute("aria-pressed", String(!isCountdown));
  elements.hardwareCountdown.setAttribute("aria-pressed", String(isCountdown));

  updateDialLabels();
  document.body.dataset.mode = timer.mode;
  document.title = timer.running
    ? `${displayValue} · ${isCountdown ? "Countdown" : "Stopwatch"}`
    : "JCNESS Stopwatch & Countdown";
}

function stopTicking() {
  if (tickHandle !== null) {
    window.clearTimeout(tickHandle);
    tickHandle = null;
  }
}

function scheduleTick() {
  stopTicking();

  if (timer.running) {
    tickHandle = window.setTimeout(tick, 100);
  }
}

function tick() {
  tickHandle = null;
  const completion = timer.consumeCompletion();

  if (completion === "countdown") {
    setStatus("Time is up. Countdown complete.", "TIME IS UP");
    render();
    playCompletionTone();
    return;
  }

  if (completion === "maximum") {
    setStatus("The stopwatch reached its 99-hour limit.", "LIMIT REACHED");
    render();
    return;
  }

  render();
  scheduleTick();
}

function ensureAudioContext() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext ??= new AudioContextClass();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return audioContext;
  } catch {
    audioContext = null;
    return null;
  }
}

function playButtonTone() {
  const context = ensureAudioContext();
  if (!context) return;

  const startAt = context.currentTime;
  const clickLayers = [
    {
      type: "sine",
      startFrequency: 1_100,
      endFrequency: 650,
      volume: 0.022,
      duration: 0.018,
    },
    {
      type: "triangle",
      startFrequency: 260,
      endFrequency: 150,
      volume: 0.038,
      duration: 0.052,
    },
  ];

  for (const layer of clickLayers) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = layer.type;
    oscillator.frequency.setValueAtTime(layer.startFrequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(
      layer.endFrequency,
      startAt + layer.duration,
    );
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(layer.volume, startAt + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + layer.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + layer.duration);
  }
}

function playCompletionTone() {
  const context = ensureAudioContext();
  if (!context) return;

  const startAt = context.currentTime;

  [0, 0.24, 0.48].forEach((delay, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = index === 2 ? 880 : 660;
    gain.gain.setValueAtTime(0.0001, startAt + delay);
    gain.gain.exponentialRampToValueAtTime(0.18, startAt + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + delay + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt + delay);
    oscillator.stop(startAt + delay + 0.2);
  });
}

function startTimer() {
  clearFeedback();
  ensureAudioContext();

  if (!timer.start()) {
    if (timer.mode === "countdown") {
      setStatus(
        `Use Up to add ${describeAdjustment(timer.adjustmentMs)} before starting.`,
        "SET TIME",
        900,
      );
    }
    render();
    return;
  }

  setStatus(
    `${timer.mode === "countdown" ? "Countdown" : "Stopwatch"} running.`,
  );
  render();
  scheduleTick();
}

function pauseTimer() {
  clearFeedback();
  if (!timer.pause()) return;
  stopTicking();
  setStatus(
    `${timer.mode === "countdown" ? "Countdown" : "Stopwatch"} paused.`,
  );
  render();
}

function toggleTimer() {
  if (timer.running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  clearFeedback();
  timer.reset();
  stopTicking();
  setStatus(
    timer.mode === "countdown"
      ? "Countdown reset. Adjustment unit reset to seconds."
      : "Stopwatch reset.",
    "RESET",
    650,
  );
  render();
}

function selectMode(mode) {
  if (timer.running || timer.mode === mode) return;
  clearFeedback();
  timer.setMode(mode);
  setStatus(
    mode === "countdown"
      ? "Countdown selected. Use Unit, Up, and Down to set the time."
      : "Stopwatch ready.",
  );
  render();
}

function cycleAdjustment() {
  clearFeedback();
  timer.cycleAdjustment();
  const unit = adjustmentUnitName();
  setStatus(
    `Adjustment unit set to ${describeAdjustment(timer.adjustmentMs)}.`,
    unit,
    700,
  );
  render();
}

function adjustCountdown(direction) {
  clearFeedback();
  timer.adjust(direction);
  const verb = direction < 0 ? "decreased" : "increased";
  setStatus(`Countdown ${verb} by ${describeAdjustment(timer.adjustmentMs)}.`);
  render();
}

function setDialPressed(labelName, pressed) {
  dialLabels.get(labelName)?.classList.toggle("pressed", pressed);
}

for (const control of hardwareControls) {
  const labelName = controlLabels.get(control);

  control.addEventListener("pointerdown", () =>
    setDialPressed(labelName, true),
  );
  control.addEventListener("pointerup", () => setDialPressed(labelName, false));
  control.addEventListener("pointercancel", () =>
    setDialPressed(labelName, false),
  );
  control.addEventListener("pointerleave", () =>
    setDialPressed(labelName, false),
  );
  control.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) setDialPressed(labelName, true);
  });
  control.addEventListener("keyup", () => setDialPressed(labelName, false));
  control.addEventListener("blur", () => setDialPressed(labelName, false));
  control.addEventListener("click", playButtonTone);
}

elements.hardwareStart.addEventListener("click", startTimer);
elements.hardwarePause.addEventListener("click", pauseTimer);
elements.hardwareReset.addEventListener("click", resetTimer);
elements.hardwareStopwatch.addEventListener("click", () =>
  selectMode("stopwatch"),
);
elements.hardwareCountdown.addEventListener("click", () =>
  selectMode("countdown"),
);
elements.hardwareIncrease.addEventListener("click", () => adjustCountdown(1));
elements.hardwareDecrease.addEventListener("click", () => adjustCountdown(-1));
elements.hardwareUnit.addEventListener("click", cycleAdjustment);

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isInteractive =
    target instanceof HTMLButtonElement ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable;

  if (isInteractive || event.repeat) return;

  if (event.code === "Space") {
    event.preventDefault();
    ensureAudioContext();
    toggleTimer();
  } else if (event.key.toLowerCase() === "r") {
    resetTimer();
  } else if (event.key.toLowerCase() === "s") {
    selectMode("stopwatch");
  } else if (event.key.toLowerCase() === "c") {
    selectMode("countdown");
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && timer.running) {
    tick();
  }
});

render();
initializeRain();
