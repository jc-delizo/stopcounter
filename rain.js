const STORAGE_KEY = "jcness-rain-enabled";
const TWO_PI = Math.PI * 2;

function between(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function storedRainPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveRainPreference(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // The effect still works when storage is unavailable.
  }
}

function pointInsideRotatedRectangle(x, y, rectangle) {
  const deltaX = x - rectangle.x;
  const deltaY = y - rectangle.y;
  const cosine = Math.cos(rectangle.rotation);
  const sine = Math.sin(rectangle.rotation);
  const localX = deltaX * cosine + deltaY * sine;
  const localY = -deltaX * sine + deltaY * cosine;

  return (
    Math.abs(localX) <= rectangle.width / 2 &&
    Math.abs(localY) <= rectangle.height / 2
  );
}

class RainScene {
  constructor(canvas, toggle, toggleLabel) {
    this.canvas = canvas;
    this.toggle = toggle;
    this.toggleLabel = toggleLabel;
    this.context = canvas.getContext("2d", { alpha: true });
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.effectScale = 1;
    this.enabled = false;
    this.animationFrame = null;
    this.lastFrameAt = 0;
    this.drops = [];
    this.particles = [];
    this.ripples = [];
    this.beads = [];
    this.watchSurfaces = null;
    this.controlSurfaces = [];
    this.motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    this.hasSavedPreference = storedRainPreference() !== null;

    if (!this.context) {
      toggle.hidden = true;
      return;
    }

    this.handleResize = () => this.resize();
    this.handleScroll = () => this.measureSurfaces();
    this.handleVisibility = () => {
      if (document.hidden) {
        this.stopAnimation();
      } else {
        this.startAnimation();
      }
    };
    this.handleMotionPreference = (event) => {
      if (!this.hasSavedPreference) this.setEnabled(!event.matches, false);
    };

    toggle.addEventListener("click", () => {
      this.hasSavedPreference = true;
      this.setEnabled(!this.enabled, true);
    });
    window.addEventListener("resize", this.handleResize, { passive: true });
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.motionPreference.addEventListener(
      "change",
      this.handleMotionPreference,
    );

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      const watch = document.querySelector(".watch-assembly");
      if (watch) this.resizeObserver.observe(watch);
    }

    this.resize();
    const savedPreference = storedRainPreference();
    const initiallyEnabled =
      savedPreference === "on" ||
      (savedPreference === null && !this.motionPreference.matches);
    this.setEnabled(initiallyEnabled, false);
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
    this.measureSurfaces();

    const desiredDropCount = clamp(
      Math.round((this.width * this.height) / 18_000),
      20,
      56,
    );

    if (this.drops.length > desiredDropCount) {
      this.drops.length = desiredDropCount;
    }

    while (this.drops.length < desiredDropCount) {
      const drop = {};
      this.resetDrop(drop, true);
      this.drops.push(drop);
    }
  }

  measureSurfaces() {
    const body = document.querySelector(".watch-body")?.getBoundingClientRect();
    const face = document.querySelector(".watch-face")?.getBoundingClientRect();

    this.watchSurfaces =
      body && face
        ? {
            x: body.left + body.width / 2,
            y: body.top + body.height / 2,
            outerRadius: body.width / 2,
            faceRadius: face.width / 2,
          }
        : null;
    this.effectScale = clamp((body?.width ?? 400) / 400, 0.8, 1.4);

    this.controlSurfaces = [
      ...document.querySelectorAll(".hardware-control"),
    ].map((control) => {
      const bounds = control.getBoundingClientRect();
      const styles = window.getComputedStyle(control);
      const orbitAngle = Number.parseFloat(
        styles.getPropertyValue("--orbit-angle"),
      );

      return {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
        width: Number.parseFloat(styles.width),
        height: Number.parseFloat(styles.height),
        rotation: ((orbitAngle + 90) * Math.PI) / 180,
      };
    });
  }

  surfaceAt(x, y) {
    if (
      this.controlSurfaces.some((surface) =>
        pointInsideRotatedRectangle(x, y, surface),
      )
    ) {
      return "metal";
    }

    if (this.watchSurfaces) {
      const distance = Math.hypot(
        x - this.watchSurfaces.x,
        y - this.watchSurfaces.y,
      );

      if (distance <= this.watchSurfaces.faceRadius) return "glass";
      if (distance <= this.watchSurfaces.outerRadius) return "metal";
    }

    return "wood";
  }

  resetDrop(drop, distributeAcrossFlight = false) {
    const depth = between(0.24, 1);
    const targetX = between(4, Math.max(5, this.width - 4));
    const targetY = between(8, Math.max(9, this.height - 8));
    const startY = -between(24, Math.max(25, this.height * 0.52));
    const speed = between(560, 790) + depth * 470;
    const wind = between(22, 45) + depth * 25;
    const travel = targetY - startY;
    const flightTime = travel / speed;
    const startX = targetX - wind * flightTime;
    const progress = distributeAcrossFlight ? Math.random() : 0;

    drop.depth = depth;
    drop.speed = speed;
    drop.wind = wind;
    drop.length = (between(12, 20) + depth * 22) * this.effectScale;
    drop.width = (0.9 + depth * 1.5) * this.effectScale;
    drop.alpha = 0.18 + depth * 0.38;
    drop.targetX = targetX;
    drop.targetY = targetY;
    drop.x = startX + wind * flightTime * progress;
    drop.y = startY + travel * progress;
  }

  createImpact(x, y, depth) {
    const surface = this.surfaceAt(x, y);
    const isClock = surface !== "wood";
    const color =
      surface === "wood"
        ? [166, 199, 214]
        : surface === "metal"
          ? [225, 242, 250]
          : [204, 236, 250];
    const particleCount = Math.round(
      (isClock ? between(3, 6) : between(3, 5)) + depth * 2,
    );
    const radialAngle = this.watchSurfaces
      ? Math.atan2(y - this.watchSurfaces.y, x - this.watchSurfaces.x)
      : -Math.PI / 2;

    for (let index = 0; index < particleCount; index += 1) {
      const angle = isClock
        ? radialAngle + between(-0.72, 0.72)
        : between(Math.PI * 1.08, Math.PI * 1.92);
      const speed =
        (between(45, 105) + depth * between(55, 115)) * this.effectScale;
      const maximumLife = between(0.22, 0.48) + depth * 0.15;

      this.particles.push({
        x,
        y,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        gravity: isClock ? 75 : 250,
        size: (between(0.9, 1.8) + depth * 1.4) * this.effectScale,
        life: maximumLife,
        maximumLife,
        color,
      });
    }

    const rippleLife = between(0.2, 0.34);
    this.ripples.push({
      x,
      y,
      life: rippleLife,
      maximumLife: rippleLife,
      maximumRadius:
        (between(8, 14) + depth * (isClock ? 14 : 10)) * this.effectScale,
      verticalScale: surface === "glass" ? 0.42 : 0.26,
      color,
    });

    if (
      isClock &&
      this.watchSurfaces &&
      this.beads.length < 20 &&
      Math.random() < 0.18
    ) {
      const beadLife = between(1.7, 3.8);
      const deltaX = x - this.watchSurfaces.x;
      const deltaY = y - this.watchSurfaces.y;
      const distanceFromCenter = Math.hypot(deltaX, deltaY);
      const beadSize = (between(1.6, 2.8) + depth * 1.8) * this.effectScale;
      const maximumRadius =
        this.watchSurfaces.outerRadius - beadSize * 1.75 - 1;
      const directionAngle =
        distanceFromCenter > 1
          ? Math.atan2(deltaY, deltaX)
          : between(0, TWO_PI);

      if (distanceFromCenter < maximumRadius) {
        this.beads.push({
          x,
          y,
          directionX: Math.cos(directionAngle),
          directionY: Math.sin(directionAngle),
          speed: between(14, 25) * this.effectScale,
          acceleration: between(8, 16) * this.effectScale,
          size: beadSize,
          centerX: this.watchSurfaces.x,
          centerY: this.watchSurfaces.y,
          maximumRadius,
          life: beadLife,
          maximumLife: beadLife,
        });
      }
    }
  }

  update(deltaTime) {
    for (const drop of this.drops) {
      drop.x += drop.wind * deltaTime;
      drop.y += drop.speed * deltaTime;

      if (drop.y >= drop.targetY) {
        this.createImpact(drop.targetX, drop.targetY, drop.depth);
        this.resetDrop(drop);
      }
    }

    for (const particle of this.particles) {
      particle.velocityY += particle.gravity * deltaTime;
      particle.x += particle.velocityX * deltaTime;
      particle.y += particle.velocityY * deltaTime;
      particle.life -= deltaTime;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);

    for (const ripple of this.ripples) ripple.life -= deltaTime;
    this.ripples = this.ripples.filter((ripple) => ripple.life > 0);

    for (const bead of this.beads) {
      bead.speed += bead.acceleration * deltaTime;
      bead.x += bead.directionX * bead.speed * deltaTime;
      bead.y += bead.directionY * bead.speed * deltaTime;
      bead.life -= deltaTime;
    }
    this.beads = this.beads.filter(
      (bead) =>
        bead.life > 0 &&
        Math.hypot(bead.x - bead.centerX, bead.y - bead.centerY) <=
          bead.maximumRadius,
    );
  }

  drawDrops() {
    const context = this.context;
    context.lineCap = "round";
    context.globalCompositeOperation = "screen";

    for (const drop of this.drops) {
      const trailTime = drop.length / drop.speed;
      context.beginPath();
      context.moveTo(drop.x - drop.wind * trailTime, drop.y - drop.length);
      context.lineTo(drop.x, drop.y);
      context.lineWidth = drop.width;
      context.strokeStyle = `rgba(190, 222, 238, ${drop.alpha})`;
      context.stroke();

      if (drop.depth > 0.55) {
        context.beginPath();
        context.arc(drop.x, drop.y, drop.width * 0.62, 0, TWO_PI);
        context.fillStyle = `rgba(220, 241, 250, ${drop.alpha * 0.72})`;
        context.fill();
      }
    }
  }

  drawParticles() {
    const context = this.context;

    for (const particle of this.particles) {
      const opacity = (particle.life / particle.maximumLife) ** 1.6;
      const [red, green, blue] = particle.color;
      context.beginPath();
      context.moveTo(
        particle.x - particle.velocityX * 0.012,
        particle.y - particle.velocityY * 0.012,
      );
      context.lineTo(particle.x, particle.y);
      context.lineWidth = particle.size;
      context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${opacity * 0.72})`;
      context.stroke();
    }
  }

  drawRipples() {
    const context = this.context;

    for (const ripple of this.ripples) {
      const progress = 1 - ripple.life / ripple.maximumLife;
      const radius = 1 + ripple.maximumRadius * progress;
      const opacity = (1 - progress) ** 1.8;
      const [red, green, blue] = ripple.color;
      context.beginPath();
      context.ellipse(
        ripple.x,
        ripple.y,
        radius,
        Math.max(0.7, radius * ripple.verticalScale),
        0,
        0,
        TWO_PI,
      );
      context.lineWidth = Math.max(0.45, 1.2 - progress * 0.7);
      context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${opacity * 0.46})`;
      context.stroke();
    }
  }

  drawBeads() {
    const context = this.context;

    for (const bead of this.beads) {
      const opacity = Math.min(1, bead.life / 0.4);
      const rotation =
        Math.atan2(bead.directionY, bead.directionX) - Math.PI / 2;
      context.beginPath();
      context.moveTo(
        bead.x - bead.directionX * bead.size * 2.7,
        bead.y - bead.directionY * bead.size * 2.7,
      );
      context.lineTo(bead.x, bead.y);
      context.lineCap = "round";
      context.lineWidth = bead.size * 1.1;
      context.strokeStyle = `rgba(185, 222, 239, ${opacity * 0.18})`;
      context.stroke();
      context.beginPath();
      context.ellipse(
        bead.x,
        bead.y,
        bead.size,
        bead.size * 1.65,
        rotation,
        0,
        TWO_PI,
      );
      context.fillStyle = `rgba(190, 225, 241, ${opacity * 0.28})`;
      context.fill();
      context.beginPath();
      context.arc(
        bead.x - bead.size * 0.28,
        bead.y - bead.size * 0.42,
        Math.max(0.3, bead.size * 0.24),
        0,
        TWO_PI,
      );
      context.fillStyle = `rgba(250, 255, 255, ${opacity * 0.65})`;
      context.fill();
    }
  }

  draw() {
    this.context.clearRect(0, 0, this.width, this.height);
    this.drawDrops();
    this.drawRipples();
    this.drawParticles();
    this.drawBeads();
    this.context.globalCompositeOperation = "source-over";
  }

  animate = (timestamp) => {
    this.animationFrame = null;
    if (!this.enabled || document.hidden) return;

    const deltaTime = this.lastFrameAt
      ? Math.min((timestamp - this.lastFrameAt) / 1000, 0.04)
      : 0;
    this.lastFrameAt = timestamp;
    this.update(deltaTime);
    this.draw();
    this.animationFrame = window.requestAnimationFrame(this.animate);
  };

  startAnimation() {
    if (!this.enabled || document.hidden || this.animationFrame !== null)
      return;
    this.lastFrameAt = performance.now();
    this.animationFrame = window.requestAnimationFrame(this.animate);
  }

  stopAnimation() {
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  setEnabled(enabled, persist) {
    this.enabled = enabled;
    this.toggle.setAttribute("aria-pressed", String(enabled));
    this.toggle.setAttribute(
      "aria-label",
      enabled ? "Turn rain off" : "Turn rain on",
    );
    this.toggle.title = enabled ? "Turn rain off" : "Turn rain on";
    this.toggleLabel.textContent = enabled ? "RAIN ON" : "RAIN OFF";
    this.canvas.classList.toggle("is-off", !enabled);
    document.body.dataset.rain = enabled ? "on" : "off";

    if (persist) saveRainPreference(enabled);

    if (enabled) {
      this.startAnimation();
    } else {
      this.stopAnimation();
      this.context.clearRect(0, 0, this.width, this.height);
      this.particles = [];
      this.ripples = [];
      this.beads = [];
    }
  }
}

export function initializeRain() {
  const canvas = document.querySelector("#rain-canvas");
  const toggle = document.querySelector("#rain-toggle");
  const toggleLabel = document.querySelector("#rain-toggle-label");

  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(toggle instanceof HTMLButtonElement) ||
    !(toggleLabel instanceof HTMLElement)
  ) {
    return null;
  }

  return new RainScene(canvas, toggle, toggleLabel);
}
