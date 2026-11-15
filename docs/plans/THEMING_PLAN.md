# Theming & Visuals Expansion — Plan

Branch: `feature/theming`

Items marked **❓ INPUT** need a decision from you before (or during) that phase.

## Decisions (2026-11-14)

| # | Topic | Decision |
| :--- | :--- | :--- |
| 1 | Scope | **Style + palette are global** (whole dashboard). **Background is per page** (as today). |
| 3 | Liquid glass refraction | Pending — see the comparison mockup `docs/plans/mockups/liquid-glass.html`. |
| 4 | Material flavour | **Material Design 3.** |
| 6/7 | Terminal depth / app icons | Pending — see drafts A/B/C in `docs/plans/mockups/terminal.html`. |
| 8 | Color variants | **Accent color only.** Page background and card surfaces are not tinted (also not in Material). |
| 9 | Accent from wallpaper | Dropped for now (accent is chosen, not extracted). |
| 10 | Status colors | Stay fixed (red/orange/green carry meaning). |
| 12 | Hardware | Mostly desktop + phones/tablets; **must remain usable on a Raspberry Pi** → heavy effects (WebGL, refraction) opt-in or auto-off, CSS-transform animations as defaults. |
| 14 | Delivery | **One PR per phase.** |
| — | Process | Build clickable examples of all styles (`docs/plans/mockups/themes.html`) before implementing them fully. |

### Mockups

Static, clickable examples in `docs/plans/mockups/` (no build; serve the folder, e.g. `python3 -m http.server 3031 --directory docs/plans/mockups`, or the `theming-mockups` launch config):

- `themes.html` — all four styles × light/dark × accent swatches × page backgrounds (gradient, plain, picture, aurora, blobs, matrix).
- `liquid-glass.html` — today's glass vs. liquid glass CSS-only vs. liquid glass with refraction, with sliders for bend / rim width / frost and a draggable bar.
- `terminal.html` — terminal depth drafts A (skin), B (hybrid), C (full ASCII), side by side.

Still open: 2 (config shape — default: new `appearance:` block), 5 (bundle Roboto Flex / JetBrains Mono?), 11 (first batch of animated backgrounds), 13 (live weather source).

---

## 0. Where we are today

- A **theme** is only a set of CSS color variables per mode (`theme.yaml` → `ThemeContext` writes them onto `:root`). Selected with `theme:` in `config.yaml`; no picker in the UI.
- Structural look is fixed in CSS: `--radius-card: 11px`, `backdrop-filter: blur(15px) saturate(86%)` in ~15 files, the iCloud-style `--bg-card-surface` / `--shadow-tile` tokens in `src/index.css`.
- Not everything is tokenised yet: **~325 hardcoded colors** and **~173 literal `border-radius` values** across `src/**/*.css` (worst: `index.css`, `MediaPlayerCard.css`, `IconEditor.css`, `BentoGrid.css`, `CardEditor.css`).
- Backgrounds: theme gradient, or per-page `background` (`color` → generated gradient, or uploaded `image` + `dim`), first paint is rendered server-side (`server/initialHead.js`). Particles exist via tsparticles, configured only in `theme.yaml`, and ignored under `prefers-reduced-motion`.

## 1. Core idea: split "theme" into independent axes

Instead of one theme blob, four orthogonal settings:

| Axis | Values | Mechanism |
| :--- | :--- | :--- |
| **Style** (design language) | `glass` (current), `liquid-glass`, `material`, `terminal` | `data-style` attribute on `<html>` + a CSS file per style that overrides *structural* tokens and, where needed, component rules |
| **Palette** (color variant) | presets + custom accent | color variables, generated from 1–2 seed colors |
| **Mode** | light / dark / system | unchanged (`data-theme`) |
| **Background** | theme, color, image, animated | `PageBackground` + new animated layer |

Existing `theme.yaml` themes keep working: they become "palette overrides" layered last, so custom themes still win.

```yaml
# config.yaml (proposed)
appearance:
  style: liquid-glass
  palette: ocean          # preset id, or:
  # accent: "#ff6a00"
  background:
    type: aurora          # theme | color | image | aurora | mesh | particles | matrix | ...
    speed: 0.5
```

**❓ INPUT 1 — Scope of the setting:** global only, or overridable **per page** (like `background` is today)? Per-page style switching (e.g. one terminal page) is doable but doubles the testing surface. My suggestion: style + palette global, background per page (as today).

**❓ INPUT 2 — Config shape:** new `appearance:` block (cleaner) vs. extending the existing top-level `theme` / `themes` keys (no migration)? I'd do the new block and auto-migrate `theme:` → `appearance.palette`.

## 2. Phase 1 — Token cleanup (prerequisite, no visual change)

Every later phase depends on components reading tokens instead of literals.

1. Add structural tokens to `src/index.css`:
   - Shape: `--radius-card`, `--radius-control`, `--radius-pill`, `--radius-popup`, `--radius-icon`
   - Material: `--surface-blur`, `--surface-saturate`, `--surface-border`, `--surface-highlight` (inner edge light), `--shadow-tile`, `--shadow-popup`
   - Type: `--font-family`, `--font-mono`, `--font-weight-title`, `--letter-spacing-title`
   - Motion: `--ease-standard`, `--duration-standard`, `--motion-scale` (0 for terminal/reduced motion)
2. Replace the 173 literal radii and 15 `backdrop-filter` declarations with tokens.
3. Replace hardcoded colors with semantic tokens (`--bg-fill`, `--text-tertiary`, `--system-*`, …). Some (MediaPlayer artwork overlays) legitimately stay literal.
4. Add a lint check (stylelint or a small vitest scan) that fails on new literal colors/radii outside `index.css` and style files.
5. Visual regression baseline: screenshot each test dashboard in light/dark before & after; diff must be ~zero.

## 3. Phase 2 — Style system + the four styles

Infrastructure: `ThemeContext` sets `data-style`; `src/styles/<style>.css` files, each scoped under `:root[data-style="…"]`. Server injects `data-style` in `initialHead.js` so the first paint is correct.

### 3a. Glass (current) — default, unchanged

### 3b. Liquid Glass (Apple iOS 26 / macOS Tahoe look)
- Larger radii (≈ 22–28px cards, capsule controls), more transparent surfaces, stronger blur + saturation boost (`blur(24px) saturate(180%)`).
- Specular edge: inner highlight via layered `box-shadow: inset` + a gradient border (`border-image` / mask) that is brighter top-left.
- Optional **real refraction**: SVG `feDisplacementMap` filter via `backdrop-filter: url(#liquid)` — gives the true lensing edge, but only works in Chromium. Safari/Firefox fall back to the blur-only version.
- Floating, capsule-shaped header/sidebar, controls lift slightly on press.

**❓ INPUT 3 — Refraction:** accept a Chromium-only "true" liquid effect with graceful fallback, or keep it CSS-only so every browser looks identical? (Also: it costs GPU on wall-mounted tablets.)

### 3c. Material Design (Material 3 / "Material You")
- Opaque tonal surfaces (`surface-container-low/high`), no blur; elevation via tone + soft shadow.
- Radii: 12px cards, 20px dialogs, full-pill buttons; Roboto / Roboto Flex font.
- Palette generated from one seed color with **tonal palettes** (HCT) — ties directly into the color-variant work (Phase 4). Library option: `@material/material-color-utilities` (~small, MIT) vs. an OKLCH approximation we write ourselves.
- State layers (8%/12% overlay on hover/press), ripple optional.

**❓ INPUT 4 — Material flavour:** Material 3 (rounded, tonal, "You") or Material 2 (flatter, sharper, more saturated)? I'm assuming M3.
**❓ INPUT 5 — Fonts:** may we bundle web fonts (Roboto Flex for Material, a mono like JetBrains Mono / IBM Plex Mono for terminal) into the image, or must it stay system fonts only (offline/self-hosted concern)? Bundling ≈ 100–300 KB.

### 3d. ASCII / Terminal
- Monospace everything, `--radius-*: 0`, no blur/shadow, 1px or box-drawing borders (`┌─┐` via `border-image` or pseudo-elements on card headers), card title rendered like `[ Weather ]`.
- Palette presets: phosphor green, amber, solarized, plus palette accent.
- Optional effects (each toggleable): scanlines, slight CRT glow (`text-shadow`), blinking cursor in headers, flicker. All off under reduced motion.
- Hard parts — components that are inherently graphical:
  - Usage bars → `[██████░░░░] 60%`
  - Graphs → keep SVG but stroke-only, monochrome, stepped; or render as braille/block sparkline (`▁▂▃▅▇`)
  - Icons (MDI/Lucide/app icons) → monochrome tint, or replaced by text glyphs
  - Thermostat dial, vacuum map, media artwork → simplified/dithered

**❓ INPUT 6 — How deep should terminal go?** (a) *Skin*: monospace + flat + green, components keep their shapes — cheap, ~1–2 days. (b) *Real ASCII*: bars, graphs, sparklines and icons rendered as text characters — needs per-card `variant="ascii"` rendering, considerably more work and ongoing cost for every new card. I'd do (a) first and (b) for bars/graphs/sparklines only.
**❓ INPUT 7 — App icons in terminal:** keep the colored app icons, tint them monochrome, or hide them for text labels?

### Per-card rendering hook
For styles that need more than CSS: `useStyle()` returns the active style so a card can switch small render details (e.g. `UsageBar` ASCII mode). Kept to shared components (`UsageBar`, `StatusPill`, `LineBarChart`, `Icon`) so individual cards rarely need changes. Documented in `docs/CREATING_NEW_CARDS.md`.

## 4. Phase 3 — Color variants

- **Palette presets** per style, each defining light + dark: e.g. Blue (current), Purple, Rose, Orange, Green, Teal, Graphite, plus style-specific ones (Terminal: Phosphor, Amber, Solarized; Material: dynamic).
- **Generated palettes**: from a seed color compute the full token set (accent ramp, page gradient, tinted surfaces, tile-on color) in **OKLCH**, with contrast guaranteed ≥ 4.5:1 for text tokens (unit-tested). Reuses/extends `shared/pageBackground.js` `gradientFrom`.
- **Accent from background image** (optional): extract dominant color from the uploaded picture server-side on upload → seed palette. "Material You" for the dashboard.
- Card-level accent stays (`--card-primary`) and is untouched.
- Editor: an **Appearance** dialog (style tiles with live mini-preview, palette swatches, custom color picker, mode). Today there is no theme picker in the UI at all.

**❓ INPUT 8 — What does a "color variant" change?** Only the accent (buttons, highlights, graphs), or also the page background and the tint of card surfaces? I'd suggest: accent + page gradient by default, surface tinting as a toggle (it's the Material look, and can look muddy on glass).
**❓ INPUT 9 — Accent-from-wallpaper:** want it? Needs server-side image decoding (`sharp` adds ~30 MB native dependency to the Docker image; a pure-JS decoder is slower but light).
**❓ INPUT 10 — Status colors** (red/green/orange for up/down, usage levels): should palettes ever recolor these, or stay fixed for meaning? I'd keep them fixed except in terminal monochrome presets.

## 5. Phase 4 — Animated / live backgrounds

New `AnimatedBackground` layer behind `.App`, one renderer per type, lazy-loaded so unused ones cost nothing:

| Type | Tech | Cost | Notes |
| :--- | :--- | :--- | :--- |
| `aurora` / `mesh` | CSS animated gradients (`@property` animated colors) | very low | Colors come from palette — best default |
| `blobs` | CSS/SVG blurred shapes drifting | low | Looks great under liquid glass |
| `particles` | tsparticles (exists) | medium | Move config from theme.yaml to presets + editor UI |
| `waves` / `shader` | WebGL fragment shader (no lib, ~2 KB per shader) | medium GPU | Most "wow"; pause when tab hidden |
| `matrix` / `starfield` | Canvas 2D | low–medium | Natural fit for terminal style |
| `video` | `<video autoplay muted loop>` upload (mp4/webm) | decode cost | Extends existing upload pipeline |
| `live` | Data-driven: time-of-day sky, weather (rain/snow/clouds from existing weather service), sun position | low–medium | Unique to a dashboard |

Shared behaviour for all of them:
- Respect `prefers-reduced-motion` (render a static frame), pause on `visibilitychange`, cap FPS (default 30), honour `pageActive` so hidden pages don't animate.
- Global "performance mode" switch (static only) for low-power wall tablets.
- First paint stays the static gradient from `initialHead.js`; animation fades in.
- Editor: `BackgroundEditor` gets a "Animated" tab with presets, speed, intensity, and colors that default to the palette.

**❓ INPUT 11 — Which backgrounds first?** Proposed first batch: `aurora`, `blobs`, `particles` (presets), `matrix`. Then `shader` waves and `live` weather/time. Anything you specifically want (e.g. video wallpapers)?
**❓ INPUT 12 — Target hardware:** what does this mostly run on (desktop browser, iPad, cheap Android/Fire wall tablet, Raspberry Pi kiosk)? Decides whether WebGL/refraction are reasonable defaults or opt-in.
**❓ INPUT 13 — Live/weather background:** should it read the existing weather card's entity, or have its own location setting?

## 6. Phase order & rough effort

| # | Phase | Effort | Visible result |
| :--- | :--- | :--- | :--- |
| 1 | Token cleanup + lint + visual baseline | M | none (by design) |
| 2 | Style infra + Liquid Glass | M | new style |
| 3 | Palettes + Appearance dialog | M | color variants, UI picker |
| 4 | Material | M | new style |
| 5 | Animated backgrounds (batch 1) | M | aurora/blobs/particles/matrix |
| 6 | Terminal (skin, then ASCII components) | M–L | new style |
| 7 | Animated backgrounds (batch 2: shader, live, video) | M | — |

Each phase is its own commit series, tested with vitest + screenshots of `test-dashboards/` in all style × mode combinations. Docs: rewrite `docs/THEMING.md` around the axes, add a "Writing a style" section.

**❓ INPUT 14 — Delivery:** one long-lived `feature/theming` branch with one PR at the end, or a PR per phase (smaller reviews, Phase 1 can land early)? I'd suggest PR per phase.

## 7. Risks

- **Backdrop-filter cost**: liquid glass + animated background = re-blurring every frame. Mitigation: animated backgrounds render at reduced resolution, blur radius is a token the perf mode lowers.
- **Contrast** on animated/transparent surfaces — enforced via palette tests and a minimum surface opacity per style.
- **Custom CSS & existing `theme.yaml`** from users must keep working — covered by keeping the old variable names and layering custom themes last.
- **New cards** must follow tokens — lint rule from Phase 1.
