const TWO_PI = Math.PI * 2;

function between(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function intensityAt(progress, reducedMotion) {
  const keyframes = reducedMotion
    ? [
        [0, 0],
        [0.2, 0.34],
        [0.62, 0.26],
        [1, 0],
      ]
    : [
        [0, 0],
        [0.06, 0.92],
        [0.17, 0.1],
        [0.3, 0.68],
        [0.48, 0.13],
        [1, 0],
      ];

  for (let index = 1; index < keyframes.length; index += 1) {
    const [endProgress, endValue] = keyframes[index];
    const [startProgress, startValue] = keyframes[index - 1];

    if (progress <= endProgress) {
      const distance = endProgress - startProgress;
      const amount = distance ? (progress - startProgress) / distance : 1;
      return startValue + (endValue - startValue) * amount;
    }
  }

  return 0;
}

function fillPolygon(context, points) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index][0], points[index][1]);
  }
  context.closePath();
  context.fill();
}

class LightningScene {
  constructor(canvas, toggle, toggleLabel) {
    this.canvas = canvas;
    this.toggle = toggle;
    this.toggleLabel = toggleLabel;
    this.context = canvas.getContext("2d", { alpha: true });
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.enabled = false;
    this.flashTimer = null;
    this.animationFrame = null;
    this.flashStartedAt = 0;
    this.flashDuration = 1_050;
    this.watch = null;
    this.motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    if (!this.context) {
      toggle.hidden = true;
      return;
    }

    toggle.addEventListener("click", () => this.setEnabled(!this.enabled));
    window.addEventListener("resize", () => this.resize(), { passive: true });
    window.addEventListener("scroll", () => this.measureWatch(), {
      passive: true,
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.cancelScheduledFlash();
        this.cancelActiveFlash();
      } else if (this.enabled) {
        this.scheduleFlash(true);
      }
    });

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      const watch = document.querySelector(".watch-assembly");
      if (watch) this.resizeObserver.observe(watch);
    }

    this.resize();
    this.setEnabled(false);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.measureWatch();
  }

  measureWatch() {
    const bounds = document
      .querySelector(".watch-body")
      ?.getBoundingClientRect();
    const faceBounds = document
      .querySelector(".watch-face")
      ?.getBoundingClientRect();
    this.watch = bounds
      ? {
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
          radius: bounds.width / 2,
          faceRadius: (faceBounds?.width ?? bounds.width * 0.84) / 2,
        }
      : null;
  }

  updateToggle() {
    this.toggle.setAttribute("aria-pressed", String(this.enabled));
    this.toggle.setAttribute(
      "aria-label",
      this.enabled ? "Turn lightning off" : "Turn lightning on",
    );
    this.toggle.title = this.enabled
      ? "Turn lightning off"
      : "Turn lightning on";
    this.toggleLabel.textContent = this.enabled
      ? "LIGHTNING ON"
      : "LIGHTNING OFF";
    document.body.dataset.lightning = this.enabled ? "on" : "off";
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.updateToggle();
    this.cancelScheduledFlash();
    this.cancelActiveFlash();

    if (enabled && !document.hidden) this.scheduleFlash(true);
  }

  scheduleFlash(firstFlash = false) {
    if (!this.enabled || document.hidden || this.flashTimer !== null) return;
    // Give immediate feedback when lightning is switched on, while retaining
    // an irregular interval between subsequent flashes.
    const delay = firstFlash ? between(180, 450) : between(6_200, 10_200);
    this.flashTimer = window.setTimeout(() => {
      this.flashTimer = null;
      this.startFlash();
    }, delay);
  }

  cancelScheduledFlash() {
    window.clearTimeout(this.flashTimer);
    this.flashTimer = null;
  }

  cancelActiveFlash() {
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.context.clearRect(0, 0, this.width, this.height);
  }

  startFlash() {
    if (!this.enabled || document.hidden) return;
    this.flashStartedAt = performance.now();
    this.flashDuration = this.motionPreference.matches ? 1_150 : 1_050;
    this.animationFrame = window.requestAnimationFrame((timestamp) =>
      this.drawFlash(timestamp),
    );
  }

  drawFlash(timestamp) {
    this.animationFrame = null;
    if (!this.enabled || document.hidden) return;

    const progress = clamp(
      (timestamp - this.flashStartedAt) / this.flashDuration,
      0,
      1,
    );
    const intensity = intensityAt(progress, this.motionPreference.matches);
    this.render(intensity);

    if (progress < 1) {
      this.animationFrame = window.requestAnimationFrame((nextTimestamp) =>
        this.drawFlash(nextTimestamp),
      );
    } else {
      this.context.clearRect(0, 0, this.width, this.height);
      this.scheduleFlash();
    }
  }

  drawLightWash(intensity) {
    const context = this.context;
    context.save();
    context.globalCompositeOperation = "screen";
    context.fillStyle = `rgba(190, 207, 242, ${intensity * 0.42})`;
    context.fillRect(0, 0, this.width, this.height);

    const bloom = context.createRadialGradient(
      this.width * 0.12,
      0,
      0,
      this.width * 0.12,
      0,
      Math.hypot(this.width, this.height),
    );
    bloom.addColorStop(0, `rgba(245, 249, 255, ${intensity * 0.46})`);
    bloom.addColorStop(0.42, `rgba(184, 204, 243, ${intensity * 0.18})`);
    bloom.addColorStop(1, "rgba(105, 125, 170, 0)");
    context.fillStyle = bloom;
    context.fillRect(0, 0, this.width, this.height);
    context.restore();
  }

  drawWatchGlint(intensity) {
    if (!this.watch) return;
    const { x, y, radius, faceRadius } = this.watch;
    const context = this.context;

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(x, y, radius + 1, 0, TWO_PI);
    context.fill();
    context.restore();

    const glassHighlight = context.createLinearGradient(
      x - faceRadius,
      y - faceRadius,
      x + faceRadius * 0.45,
      y - faceRadius * 0.1,
    );
    glassHighlight.addColorStop(0, "rgba(221, 233, 255, 0)");
    glassHighlight.addColorStop(
      0.48,
      `rgba(246, 250, 255, ${intensity * 0.24})`,
    );
    glassHighlight.addColorStop(1, "rgba(218, 232, 255, 0)");

    context.save();
    context.beginPath();
    context.arc(x, y, faceRadius * 0.92, -2.78, -1.08);
    context.lineCap = "round";
    context.lineWidth = Math.max(2, faceRadius * 0.045);
    context.strokeStyle = glassHighlight;
    context.shadowBlur = faceRadius * 0.055;
    context.shadowColor = `rgba(225, 237, 255, ${intensity * 0.32})`;
    context.stroke();
    context.restore();

    const rimHighlight = context.createLinearGradient(
      x - radius,
      y - radius,
      x + radius * 0.25,
      y,
    );
    rimHighlight.addColorStop(0, "rgba(218, 230, 252, 0)");
    rimHighlight.addColorStop(0.55, `rgba(250, 252, 255, ${intensity * 0.32})`);
    rimHighlight.addColorStop(1, "rgba(215, 228, 252, 0)");
    context.save();
    context.beginPath();
    context.arc(x, y, radius - 2, -2.92, -1.02);
    context.lineCap = "round";
    context.lineWidth = Math.max(1.5, radius * 0.015);
    context.strokeStyle = rimHighlight;
    context.shadowBlur = radius * 0.035;
    context.shadowColor = `rgba(218, 232, 255, ${intensity * 0.28})`;
    context.stroke();
    context.restore();
  }

  drawWindowFrame(intensity) {
    const context = this.context;
    const bar = clamp(Math.min(this.width, this.height) * 0.038, 16, 42);
    const lean = this.width * 0.13;
    context.save();
    context.fillStyle = `rgba(3, 5, 9, ${0.16 + intensity * 0.48})`;
    context.filter = `blur(${clamp(bar * 0.09, 1.5, 4)}px)`;
    context.shadowBlur = bar * 0.42;
    context.shadowColor = `rgba(0, 0, 0, ${intensity * 0.4})`;

    const verticalBar = (topX) =>
      fillPolygon(context, [
        [topX - bar / 2, -bar],
        [topX + bar / 2, -bar],
        [topX + lean + bar / 2, this.height + bar],
        [topX + lean - bar / 2, this.height + bar],
      ]);
    verticalBar(this.width * 0.2);
    verticalBar(this.width * 0.66);

    fillPolygon(context, [
      [-bar, this.height * 0.35 - bar / 2],
      [this.width + bar, this.height * 0.48 - bar / 2],
      [this.width + bar, this.height * 0.48 + bar / 2],
      [-bar, this.height * 0.35 + bar / 2],
    ]);
    context.restore();
  }

  render(intensity) {
    this.context.clearRect(0, 0, this.width, this.height);
    if (intensity <= 0.002) return;
    this.drawLightWash(intensity);
    this.drawWatchGlint(intensity);
    this.drawWindowFrame(intensity);
  }
}

export function initializeLightning() {
  const canvas = document.querySelector("#lightning-canvas");
  const toggle = document.querySelector("#lightning-toggle");
  const toggleLabel = document.querySelector("#lightning-toggle-label");

  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(toggle instanceof HTMLButtonElement) ||
    !(toggleLabel instanceof HTMLElement)
  ) {
    return null;
  }

  return new LightningScene(canvas, toggle, toggleLabel);
}
