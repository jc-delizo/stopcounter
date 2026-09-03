# JCNESS Stopwatch & Countdown

A responsive, accessible stopwatch and countdown timer styled as a physical timepiece. The app runs entirely in the browser and is deployed as a static site.

Live site: <https://jc-delizo.github.io/stopcounter/>

## Features

- Timestamp-based stopwatch and countdown timing that stays accurate after delayed browser execution
- Physical dial controls for stopwatch/countdown mode and time adjustment
- Explicit seconds, minutes, or hours adjustment feedback on the dial
- Start, pause, reset, progress, and disabled-state feedback
- Mechanical button tones and an automatic three-tone countdown completion sound
- Procedural rain with wood, glass, and metal impact effects plus a persistent on/off control
- Keyboard controls and accessible names for every action
- Responsive physical-watch design with precisely curved, state-aware dial labels
- No application framework or runtime dependencies

## Keyboard shortcuts

| Key     | Action                |
| ------- | --------------------- |
| `Space` | Start or pause        |
| `R`     | Reset                 |
| `S`     | Select stopwatch mode |
| `C`     | Select countdown mode |

Shortcuts are ignored while focus is on a button.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:43817>.

## Quality checks

```bash
npm run check
```

The check command runs ESLint, Prettier verification, HTML validation, timer-model unit tests, and Playwright browser tests.

Individual commands are also available:

```bash
npm run test:unit
npm run test:e2e
npm run validate:html
npm run lint
npm run format:check
```

Local end-to-end tests use the installed Google Chrome channel.

## Project structure

```text
.
├── index.html                 # Semantic app interface
├── index.css                  # Responsive physical-watch design
├── index.js                   # DOM behavior, audio, and keyboard controls
├── rain.js                    # Procedural rain and surface-impact simulation
├── timer-core.js              # Framework-independent timer state model
├── images/                    # Responsive, optimized production images
├── fonts/                     # Self-hosted Orbitron font and license
├── scripts/serve.js           # Minimal local static server
├── tests/timer-core.test.js   # Unit tests
└── tests/e2e/app.spec.js      # Browser and responsive-layout tests
```

## Timing design

The timer does not assume that `setTimeout` runs at an exact interval. `TimerModel` stores a start timestamp and derives the current value from the actual elapsed time. The UI refresh loop may be throttled in a background tab, but the displayed time catches up correctly when execution resumes.

Countdown values are clamped between zero and `99:59:59`, preventing negative or malformed output.

## Deployment

The app is a static site. GitHub Pages publishes it directly from the `master` branch, so a successful push updates the live site without a build step.

## Asset optimization

The original 34 MB background PNG was resized and converted to WebP: roughly 250 KB for desktop and 60 KB for mobile. Decorative 500×500 images were resized to their actual rendered dimensions. The display font is self-hosted to remove a third-party render-blocking request. Original image files remain recoverable through Git history.
