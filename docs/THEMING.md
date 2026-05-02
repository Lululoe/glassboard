# Theming Guide

Glassboard supports a powerful theming system that allows you to customize the look and feel via `theme.yaml`. You can create multiple themes and switch between them (or let the system default based on preference).

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
