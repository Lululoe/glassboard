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
  style: liquid      # glass (default) | liquid | material | neon | terminal
```

| Style | Look |
| :--- | :--- |
| `glass` | Frosted tiles with small rounded corners and a soft offset shadow. |
| `liquid` | Liquid Glass: clear glass with a lit rim, large round corners, and no header bar: the header buttons float as round glass buttons over the page and grow out of the one nearest the edge as they appear. |
| `material` | Material Design 3: solid neutral surfaces without blur, tonal elevation, round icon buttons, and the accent as tonal containers. Uses Roboto Flex or Roboto when installed, else the system font. |
| `neon` | A near-black page with solid zinc cards, round buttons and Inter. Every card has its own color, taken from its icon: the icon's background, the icon's own color or, for a logo on the neutral background, the logo's main color (read from the image when its site allows it). Thermostats are orange, and blue while cooling; cards without a colored icon use the accent. A card with a colored icon has its header in that color and its body the same but darker; a thermostat is filled with its color while it is on. The color tints the card's hairline edge, the card glows in it from underneath, and selected options are a gradient of it. The app grid stays neutral, and its icons glow in their own colors. Anything that is off, such as an off tile or thermostat, has a plain edge and a grey glow. Color shows where something is on: an on Home Assistant tile becomes a deep gradient of its color, the entity's `color` or else the accent, with lit text and a soft glow, and selected controls are a pale tint of the accent. Header buttons float over the page, and the name fades out when the page is scrolled. In light mode, cards are white and on tiles pastel. |
| `terminal` | Monospace type, square corners, flat dark panels outlined in the accent, and card titles in `[ brackets ]`. Graphs are drawn with block characters (`▁▃▅█`) and the forecast with ASCII art; app icons turn monochrome. Without a page background of its own, the page is a dark screen. |

The Theme menu offers Glass, Liquid Glass, Material and Neon. Terminal is held back from the menu for now: it can
still be set in `config.yaml`, and the menu shows it while the dashboard uses it.

To lock the theme, set `locked: true`. The style, accent and transparency of `config.yaml` then always apply: the
Theme menu shows them but can't change them, and choices saved in the Theme menu before are ignored. Light and dark,
refraction and screen effects stay a choice of each browser.

```yaml
appearance:
  style: material
  accent: "#30d158"
  locked: true
```

A style chosen in the Theme menu is saved in `layout.yaml` and wins over `config.yaml`; picking the style of
`config.yaml` again removes it from `layout.yaml`. Unless `editable: true` is set, the style can only be set in
`config.yaml`. `themeToggle: false` hides the Theme button.

### Transparency
With Glass and Liquid Glass, the **Transparency** slider in the Theme menu sets how see-through the cards are: from
solid on the left, through each style's own look in the middle, to clear glass on the right. Like the style, it applies
to the whole dashboard. In `config.yaml` it is a number from `0` (solid) to `1` (clearest); `0.5` is the default:

```yaml
appearance:
  style: liquid
  transparency: 0.7
```

It changes the card surfaces only. Menus and pop-ups keep their own frosting, so they stay readable, and with
Reduce Transparency every surface is solid whatever the slider says.

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
