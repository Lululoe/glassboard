# Header Configuration Guide

The header component provides access to the application launcher and quick links. It is configured via the `launcher` section in [config.yaml](../config.yaml).

## Launcher Apps
The launcher menu (grid icon in header) displays a list of applications.

### Configuration
Defined under `launcher.apps`.

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Display name of the application. |
| `url` | string | URL to open when clicked. |
| `icon` | string/object | URL (svg/png) or icon name (e.g. `sh-plex`, `lu-Mail`, `mdi:lightbulb`), or `{ source, value, color }` for an icon with a color. |
| `bgColor` | string | Optional. CSS background property (color or gradient) for the icon container. |

The menu can also be edited in the browser: in edit mode, the grid button with the pencil opens it, with the apps and
links arranged directly on the menu. See [Editing icons](CARD_CONFIGURATION#editing-icons). The menu shows the first 12
apps; further ones wait under **Won't show**. Changes are saved to `layout.yaml` and then replace `launcher` from
`config.yaml` as a whole, until **Reset**.

### Example
```yaml
launcher:
  apps:
    - name: "Home Assistant"
      url: "http://homeassistant.local:8123"
      icon: "sh-home-assistant"
      bgColor: "var(--color-primary-light)"
    - name: "Plex"
      url: "http://plex.local:32400"
      icon: "sh-plex"
```

---

## Theme Toggle
The header shows a light/dark mode button. Set `themeToggle: false` at the top level of `config.yaml` to hide it.
By default the dashboard follows the system appearance. Choosing the other mode with the button is remembered
in the browser; switching back to the system's mode clears it, so the dashboard follows the system again.

---

## Edit Button
The pencil button turns on edit mode, where cards can be moved, resized, edited, added and removed; the header
then shows **+** (add a card), the header menu's editor, **Reset** and **Done**. See [Editing the Dashboard](CARD_CONFIGURATION#editing-the-dashboard).
The button is hidden on iframe pages and when `editable: false` is set.

---

## Demo Label
In demo mode (`demo: true` or `GLASSBOARD_DEMO=true`) the header shows a "Demo" label next to the title, so
simulated data is never mistaken for real data.

```yaml
themeToggle: false
```

---

## Quick Links
A list of links displayed below the apps in the launcher popup.

### Configuration
Defined under `launcher.links`.

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Link text. |
| `url` | string | URL to open. |
| `icon` | string | [Lucide icon name](https://lucide.dev/icons) (e.g. `lu-Server`). Prefix with `lu-` for standard icons. |

### Example
```yaml
launcher:
  links:
    - name: "Proxmox"
      url: "https://pve.local"
      icon: "lu-Server"
    - name: "Router"
      url: "http://192.168.1.1"
      icon: "lu-Wifi"
```
