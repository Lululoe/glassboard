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
| `icon` | string | URL (svg/png) or [Lucide icon name](https://lucide.dev/icons) (e.g. `sh-plex`, `lu-Mail`). |
| `bgColor` | string | Optional. CSS background property (color or gradient) for the icon container. |

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
Set `themeToggle: true` at the top level of `config.yaml` to show a light/dark mode button in the header.
By default the dashboard follows the system appearance. Choosing the other mode with the button is remembered
in the browser; switching back to the system's mode clears it, so the dashboard follows the system again.

---

## Demo Label
In demo mode (`demo: true` or `GLASSBOARD_DEMO=true`) the header shows a "Demo" label next to the title, so
simulated data is never mistaken for real data.

```yaml
themeToggle: true
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
