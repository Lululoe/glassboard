# Theming Guide

Glassboard supports a powerful theming system that allows you to customize the look and feel via `theme.yaml`. You can create multiple themes and switch between them (or let the system default based on preference).

`theme.yaml` is optional: without it, the default themes from `theme.example.yaml` are used. Themes in `config.yaml` with the same `id` are merged over the theme file, and `theme: <id>` in `config.yaml` selects the active theme.

The page background can also be set without a theme, from edit mode or with `background` in `config.yaml` (a color
the gradient is made from, or a picture); see [Page background](CARD_CONFIGURATION.md#page-background). It takes the
place of `--bg-page-gradient`.

## Styles
A style is the dashboard's design language: the shape, material and type of every card, bar and menu. It applies to
the whole dashboard, for everyone using it. Pick it in the **Theme** menu (the palette button in the header bar) or in
`config.yaml`:

```yaml
appearance:
  style: liquid      # glass (default) | liquid | material | terminal
```

| Style | Look |
| :--- | :--- |
| `glass` | Frosted tiles with small rounded corners and a soft offset shadow. |
| `liquid` | Liquid Glass: clear glass with a lit rim, large round corners, and a header bar that floats as a capsule. |
| `material` | Material Design 3: solid neutral surfaces without blur, tonal elevation, round icon buttons, and the accent as tonal containers. Uses Roboto Flex or Roboto when installed, else the system font. |
| `terminal` | Monospace type, square corners, flat dark panels outlined in the accent, and card titles in `[ brackets ]`. Graphs are drawn with block characters (`▁▃▅█`) and the forecast with ASCII art; app icons turn monochrome. Without a page background of its own, the page is a dark screen. |

A style chosen in the Theme menu is saved in `layout.yaml` and wins over `config.yaml`; picking the style of
`config.yaml` again removes it from `layout.yaml`. When `editable: false` is set, the style can only be set in
`config.yaml`. `themeToggle: false` hides the Theme button.

### Accent color
The accent colors buttons, highlights, switches, selections and graphs. Pick a preset or any other color in the Theme
menu, or set it in `config.yaml`; without one, the theme's `--color-primary` is used. Like the style, it applies to the
whole dashboard. Page backgrounds and card surfaces are not tinted, and status colors (up, warning, down) stay red,
orange and green.

```yaml
appearance:
  accent: "#ff375f"
```

### Light and dark
The Theme menu's **Appearance** picks Automatic (follow the system), Light or Dark. This is kept per browser.

### Liquid Glass refraction
In Chrome, Edge, Android and other Chromium browsers, the rim of Liquid Glass surfaces also bends what is behind it, like
the edge of a lens. It is most visible over a picture or a moving background. Safari, Firefox and all iOS browsers can't
draw it and show the frosted glass alone. Refraction is on by default where supported, can be turned off in the Theme
menu (for example on a Raspberry Pi, to save power), and is kept per browser. It is also off when the system asks for
reduced transparency.

### Terminal screen effects
The Terminal style adds scanlines, a darker rim and a phosphor glow on text, like an old monitor, and a blinking
cursor after the dashboard's name. They are on by default, can be turned off with **Screen effects** in the Theme
menu, and are kept per browser. The cursor stays still with reduced motion, and the lines and glow are left out
with increased contrast.

Themes (below) set colors; they apply in every style, but a style replaces the card, bar and menu surfaces it needs.

## Custom CSS
Place a `custom.css` in the project root (or mount it to `/app/custom.css` in Docker) to add your own styles. It is loaded after the built-in styles. Changes apply on page reload.

## Defining Themes in `theme.yaml`
Configuration is simple. Each theme has an `id` (must be unique) and a `colors` object containing `light` and `dark` mode definitions.

```yaml
themes:
  - id: "ocean"
    name: "Ocean Blue"
    colors:
      light:
        "--bg-page-gradient": "linear-gradient(135deg, #003780 0%, #0061d4 50%, #207ff3 100%)"
        "--bg-card-glass": "rgba(255, 255, 255, 0.6)"
      dark:
        "--bg-page-gradient": "linear-gradient(135deg, #001f4d 0%, #003780 100%)"
        "--bg-card-glass": "rgba(0, 0, 0, 0.5)"
```

## CSS Variables
The application uses the following CSS variables which you can override in your themes.

### Global Backgrounds
| Variable | Description |
| :--- | :--- |
| `--bg-page-gradient` | The main background of the entire dashboard page. |
| `--bg-card-glass` | Background color for the glass cards (backdrop-filter is applied automatically). |
| `--bg-card-glass-header` | Slightly more opaque background for card headers. |
| `--bg-card-border` | Subtle border color for glass cards. |
| `--shadow-card` | Box shadow for cards to give depth. |

### Text Colors
| Variable | Description |
| :--- | :--- |
| `--text-primary` | Main text color (Headings, titles). |
| `--text-secondary` | Secondary text color (Subtitles, metadata). |
| `--color-separator` | Color for divider lines. |

### Tiles & Interactive Elements
| Variable | Description |
| :--- | :--- |
| `--bg-tile` | Background for interactive tiles (e.g. Home Assistant buttons) when **ON**. |
| `--bg-tile-off` | Background for interactive tiles when **OFF**. |
| `--bg-popup` | Background for modal popups (Launcher, etc). |

### Icon Styling
| Variable | Description |
| :--- | :--- |
| `--icon-background` | Default background for App Icons. |
| `--icon-border-color` | Border color for App Icons. |

### Brand/Accent Colors
Used for syntax highlighting, graphs, or specific status indicators.
- `--color-primary`, `--color-primary-light`, `--color-primary-dark`
- `--color-secondary`, ... (light/dark)
- `--color-tertiary`, ...
- `--color-quaternary`, ...
