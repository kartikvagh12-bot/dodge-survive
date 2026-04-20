# CLAUDE.md — Dodge & Survive

This file is persistent memory and guidance for future development of this project. Read it first in every session before making changes.

---

## Project Overview

- 2D browser-based **Dodge & Survive** game
- Built with **HTML, CSS, vanilla JavaScript** — no frameworks, no build step
- Rendering: **HTML5 Canvas** (DPR-aware) for the game world; **DOM** for HUD and overlays
- Deployed via **GitHub Pages** at `https://kartikvagh12-bot.github.io/dodge-survive/`
- Works on **both desktop and mobile**

---

## File Structure

```
dodge-survive/
├── index.html    # Canvas + DOM HUD/overlays + GA4 snippet
├── style.css     # Fullscreen canvas, HUD, overlays, skin picker
├── script.js     # All game logic (single IIFE, ~770 lines)
└── CLAUDE.md     # This file
```

---

## Current Features

- Smooth player movement (WASD/arrows on desktop, delta-drag on mobile)
- Enemies spawn from edges and chase the player
- Smooth difficulty curve over time (spawn interval + enemy speed)
- Score (survival seconds) + best score persisted in `localStorage`
- Instant restart on tap/click/keypress
- Particle effects (death burst, pickup burst, enemy vaporize)
- Snake-like fading trail (white, 25-point cap, alpha = i/length)
- Power-ups: **Shield**, **Slow-Mo**, **Speed Boost** (with HUD chip timers)
- Skin system: 6 skins unlocked by best-score milestones
- Level system: bumps every 10s with toast animation
- Clean HUD: score, best, level pill, active power-up chips
- Death feedback: screen shake + red flash
- Google Analytics (gtag) tracking: `game_start`, `game_over`, `session_end` with persistent `playerId`

---

## Controls

- **Desktop** → WASD or Arrow keys
- **Mobile** → **delta drag movement** only (touch position is *not* used as a target)
  - Pure delta: `player.x += (currentTouch.x - prevTouch.x) * sens`
  - No joystick, no atan2/direction-to-target logic
  - Player must **never** be hidden under the finger
- Tap or any keypress on start/gameover overlay → start/restart instantly

---

## Design Philosophy (VERY IMPORTANT)

- Keep the game **SIMPLE**
- Do **NOT** add unnecessary complexity
- Focus on: **smooth feel**, **responsiveness**, **replayability**
- Avoid: heavy systems, complicated UI, unnecessary features

---

## Constraints

- **No external libraries** — vanilla JS only
- **No backend** (for now)
- Must remain **GitHub Pages compatible** (static files only)
- Must run **instantly** in the browser (no build, no bundler)
- Performance must stay **smooth on mobile** (target 60fps)

---

## Current Goal

- Improve **retention** and **replayability**
- Understand **player behavior** via analytics
- Grow user base **organically**

---

## Analytics

- Provider: **Google Analytics (gtag)** — live measurement ID `G-W14F2MPXMC` in `index.html`
- Persistent `playerId` stored in `localStorage` (random 8-char string)
- Events tracked:
  - `game_start` — `{ playerId }`
  - `game_over` — `{ playerId, score, best }`
  - `session_end` — `{ playerId, duration, score }` (duration in seconds)
- Implementation is **lightweight** — keep it that way. Do not add heavy event tracking.

---

## Future Direction (Do NOT rush)

Only consider AFTER analytics validation shows demand:

- Simple leaderboard
- Daily challenge
- Minimal monetization (**no ads**)

---

## Development Rules

- Do **NOT** break existing gameplay
- Do **NOT** refactor large parts unnecessarily
- Always prioritize **simplicity** over features
- Changes should be **incremental and safe**
- Test on both desktop and mobile (touch) before pushing
- Commit and push every change to GitHub (live deploy validates instantly)

---

## Key Implementation Notes

- **Game loop:** `requestAnimationFrame` with `dt` clamped to 50ms
- **Frame-rate-independent smoothing:** `k = 1 - Math.exp(-dt * 28)` for keyboard velocity lerp
- **Touch input** writes directly to `player.x/y` (bypasses velocity pipeline) — keep these two paths separate
- **Trail** is pushed every frame regardless of input method — do not gate on input vector magnitude
- **Difficulty curve:** `baseInterval = max(0.18, 1.0 / (1 + elapsed * 0.045))`; enemy speed `80 + elapsed*2.4` to `140 + elapsed*3.4`
- **Touch prevention:** document-level `touchmove` `preventDefault`, `touch-action: none`, `overscroll-behavior: none`
- **State machine:** `STATE.START`, `STATE.PLAYING`, `STATE.GAMEOVER` — single `state` variable
- **localStorage keys:** `dodgeSurviveBest`, `dodgeSurviveSkin`, `playerId`

---

## Deployment

- Repo: `kartikvagh12-bot/dodge-survive` on GitHub
- Live URL: `https://kartikvagh12-bot.github.io/dodge-survive/`
- Deploy: just `git push` to `main` — GitHub Pages auto-rebuilds in ~30s
- No `.nojekyll` needed (no underscore-prefixed assets)

---

## 🚀 Deployment Rules (CRITICAL)

- Every code change **MUST** be committed to the repository
- Every commit **MUST** be pushed to the `main` branch
- GitHub Pages **must** reflect the latest changes

### ✅ After every task, Claude MUST:

1. **Apply** changes to actual project files (not just show them)
2. **Commit** changes with a clear, descriptive message
3. **Push** to `main` branch
4. **Confirm** deployment is complete (Pages build success)

### ❗ Important

- Do **NOT** only suggest code changes
- Do **NOT** return code without applying it
- Do **NOT** skip the deployment step
- Do **NOT** report a task as "done" until it is live on GitHub Pages

### 🔍 Verification Requirement

After deployment, Claude **must** confirm:

- Changes are visible in the repository (commit present on `main`)
- Changes are visible on the live GitHub Pages site (curl / HTTP 200 + content check)

### Goal

Ensure all changes are **fully applied and live** — not just suggested.
