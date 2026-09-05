import { expect, test } from "@playwright/test";

function readDisplayedTime(page) {
  return page.locator("[data-time-slot]").evaluateAll((slots) => {
    const digits = slots.map((slot) => slot.textContent).join("");
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`;
  });
}

function readDigitPositions(page) {
  return page.locator("[data-time-slot]").evaluateAll((slots) =>
    slots.map((slot) => {
      const bounds = slot.getBoundingClientRect();
      return {
        left: Math.round(bounds.left * 100) / 100,
        width: Math.round(bounds.width * 100) / 100,
      };
    }),
  );
}

test("runs a countdown to completion without a blocking dialog", async ({
  page,
}) => {
  const dialogs = [];
  page.on("dialog", (dialog) => dialogs.push(dialog.message()));
  await page.goto("/");

  await page.getByRole("button", { name: "Switch to countdown mode" }).click();
  await page.getByRole("button", { name: "Increase countdown" }).click();
  await expect.poll(() => readDisplayedTime(page)).toBe("00:00:01");
  await page.getByRole("button", { name: "Start timer" }).click();

  await expect(page.locator("#status-message")).toContainText("Time is up", {
    timeout: 2_500,
  });
  await expect.poll(() => readDisplayedTime(page)).toBe("00:00:00");
  await expect(page.locator("#watch-state")).toHaveText("TIME IS UP");
  expect(dialogs).toEqual([]);
});

test("prevents negative values and clearly shows mode and adjustment selections", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to countdown mode" }).click();

  await expect(
    page.getByRole("button", { name: "Decrease countdown" }),
  ).toBeDisabled();
  await expect(page.locator("#unit-label-path")).toHaveText("SECONDS");
  await expect(page.locator('[data-label="countdown"]')).toHaveClass(
    /selected/,
  );
  await expect(page.locator('[data-label="stopwatch"]')).not.toHaveClass(
    /selected/,
  );

  await page
    .getByRole("button", { name: "Change countdown adjustment unit" })
    .click();
  await expect(page.locator("#unit-label-path")).toHaveText("MINUTES");
  await page.getByRole("button", { name: "Increase countdown" }).click();
  await expect.poll(() => readDisplayedTime(page)).toBe("00:01:00");
});

test("supports start, pause, reset, and mode keyboard shortcuts", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Space");
  await expect(page.locator("#watch-state")).toHaveText("Running");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");
  await expect(page.locator("#watch-state")).toHaveText("Paused");
  await page.keyboard.press("r");
  await expect.poll(() => readDisplayedTime(page)).toBe("00:00:00");

  await page.keyboard.press("c");
  await expect(page.locator('[data-label="countdown"]')).toHaveClass(
    /selected/,
  );
  await page.keyboard.press("s");
  await expect(page.locator('[data-label="stopwatch"]')).toHaveClass(
    /selected/,
  );
});

test("keeps every display digit anchored while the stopwatch advances", async ({
  page,
}) => {
  await page.goto("/");

  const initialPositions = await readDigitPositions(page);
  await page.getByRole("button", { name: "Start timer" }).click();
  await expect.poll(() => readDisplayedTime(page)).not.toBe("00:00:00");
  const advancingPositions = await readDigitPositions(page);

  expect(advancingPositions).toEqual(initialPositions);
});

test("spaces every physical button uniformly around the watch", async ({
  page,
}) => {
  await page.goto("/");

  const radii = await page.evaluate(() => {
    const watch = document.querySelector(".watch-body").getBoundingClientRect();
    const watchCenter = {
      x: watch.left + watch.width / 2,
      y: watch.top + watch.height / 2,
    };

    return [...document.querySelectorAll(".hardware-control")].map((button) => {
      const bounds = button.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2 - watchCenter.x;
      const y = bounds.top + bounds.height / 2 - watchCenter.y;
      return Math.hypot(x, y);
    });
  });

  expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.1);
});

test("keeps the countdown progress track visible but inactive in stopwatch mode", async ({
  page,
}) => {
  await page.goto("/");

  const progress = page.locator("#countdown-progress");
  await expect(page.locator("#watch-mode")).toHaveText(
    "STOPWATCH & COUNTDOWN TIMER",
  );
  await expect(page.locator("#progress-wrap")).toBeVisible();
  await expect(progress).toHaveAttribute("value", "0");
  await expect(progress).toHaveAttribute("aria-disabled", "true");

  await page.getByRole("button", { name: "Switch to countdown mode" }).click();
  await page.getByRole("button", { name: "Increase countdown" }).click();
  await expect(progress).toHaveAttribute("value", "100");
  await expect(progress).toHaveAttribute("aria-disabled", "false");
});

test("turns a dial label red only while its button is pressed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to countdown mode" }).click();

  const increaseButton = page.getByRole("button", {
    name: "Increase countdown",
  });
  const increaseLabel = page.locator('[data-label="increase"]');
  await increaseButton.dispatchEvent("pointerdown");
  await expect(increaseLabel).toHaveClass(/pressed/);
  await increaseButton.dispatchEvent("pointerup");
  await expect(increaseLabel).not.toHaveClass(/pressed/);
});

test("plays button tones and an automatic completion chime", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__toneStarts = 0;

    class FakeAudioParam {
      setValueAtTime() {}
      exponentialRampToValueAtTime() {}
    }

    class FakeOscillator {
      constructor() {
        this.frequency = new FakeAudioParam();
      }
      connect() {
        return this;
      }
      start() {
        window.__toneStarts += 1;
      }
      stop() {}
    }

    class FakeGain {
      constructor() {
        this.gain = new FakeAudioParam();
      }
      connect() {
        return this;
      }
    }

    class FakeAudioContext {
      constructor() {
        this.currentTime = 0;
        this.destination = {};
        this.state = "running";
      }
      createOscillator() {
        return new FakeOscillator();
      }
      createGain() {
        return new FakeGain();
      }
      resume() {}
    }

    Object.defineProperty(window, "AudioContext", { value: FakeAudioContext });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Switch to countdown mode" }).click();
  await page.getByRole("button", { name: "Increase countdown" }).click();
  await page.getByRole("button", { name: "Start timer" }).click();
  await expect(page.locator("#status-message")).toContainText("Time is up", {
    timeout: 2_500,
  });

  const toneStarts = await page.evaluate(() => window.__toneStarts);
  expect(toneStarts).toBeGreaterThanOrEqual(6);
});

test("keeps the watch and physical controls inside a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const viewportWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  const documentWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(documentWidth).toBe(viewportWidth);

  for (const control of await page.locator(".hardware-control").all()) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth);
  }
});

test("toggles and remembers the click-through rain effect", async ({
  page,
}) => {
  await page.goto("/");

  const canvas = page.locator("#rain-canvas");
  const toggle = page.getByRole("button", { name: "Turn rain off" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toHaveCSS("pointer-events", "none");
  await expect(page.locator("body")).toHaveAttribute("data-rain", "on");

  await toggle.click();
  await expect(
    page.getByRole("button", { name: "Turn rain on" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(canvas).toHaveClass(/is-off/);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Turn rain on" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("body")).toHaveAttribute("data-rain", "off");
});

test("activates window-frame lightning without person silhouettes", async ({
  page,
}) => {
  await page.goto("/");

  const canvas = page.locator("#lightning-canvas");
  const toggle = page.locator("#lightning-toggle");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAccessibleName("Turn lightning on");
  await expect(canvas).toHaveCSS("pointer-events", "none");
  await expect(page.locator("body")).toHaveAttribute("data-lightning", "off");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveAttribute("data-lightning", "on");
  await expect(canvas).not.toHaveAttribute("data-pose", /.+/);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await expect(page.locator("footer")).toContainText(
    "© 2023 JC Delizo. All rights reserved.",
  );
});

test("exposes an accessible name for every button", async ({ page }) => {
  await page.goto("/");

  const unnamedButtons = await page
    .locator("button")
    .evaluateAll(
      (buttons) =>
        buttons.filter(
          (button) =>
            !button.innerText.trim() && !button.getAttribute("aria-label"),
        ).length,
    );

  expect(unnamedButtons).toBe(0);
});
