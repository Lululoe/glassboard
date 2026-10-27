# Card Configuration Guide

This document defines the configuration options for all available dashboard cards in [config.yaml](../config.yaml).

> **Note**: Service credentials and connection details (like API keys or URLs for Sonarr, Radarr, etc.) should be configured in **[services.yaml](../services.yaml)**. This keeps your layout configuration separate from your secrets.
>
> The server validates `config.yaml` on startup and on every change, and logs problems such as missing card ids, duplicate ids or an invalid `colSpan` (e.g. `Config: pages[0].cards[2].colSpan: ...`). Edits are picked up without a restart and open dashboards reload automatically.

## Global Options
All cards support these base options:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | string | required | Unique identifier for the card (across all pages). |
| `type` | string | required | The component type of the card. |
| `colSpan` | number | 1 | Width of the card in grid columns (1-3). |
| `primaryColor` | string | | Sets `--card-primary` for the card (overrides theme/default). |

---

## App Grid (`appgrid`)
Displays a grid of application shortcuts.

### Configuration
| Option | Type | Description |
|--------|------|-------------|
| `columns` | number | Optional. Number of columns in the grid (default: 3). |
| `data.apps` | array | List of apps to display. If empty, falls back to `launcher.apps` defined in header config. |

**App Object**:
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name. |
| `url` | string | URL to open when clicked. |
| `icon` | string/object | URL (svg/png), Lucide icon name, or object `{ source, value }`. |
| `bgColor` | string | Optional CSS background (e.g., gradient). |

### Example
```yaml
- id: my_apps
  type: appgrid
  colSpan: 1
  data:
    apps:
      - name: "Plex"
        url: "http://plex.local:32400"
        icon: "https://example.com/plex.svg"
      - name: "Sonarr"
        url: "http://sonarr.local:8989"
        icon: "video"
```

---

## Git (`git`)
Displays Pull Requests from GitHub, GitLab, or Gitea.

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `hideEmpty` | boolean | `false` | If true, hides the card when no PRs are found. |
| `filterLabels`| array | `[]` | Only show PRs with these labels. |
| `filterStatus`| array | `[]` | Filter by status (`open`, `merged`, `draft`). |
| `repositories`| array | required | List of repositories to watch. Read by the server only; the browser cannot request other repositories. |
| `url` | string | | Fallback URL for the card header. |

**Repository Object**:
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `github`, `gitlab`, or `gitea`. |
| `owner` | string | Repository owner. For GitLab this may include subgroups (`group/subgroup`). |
| `repo` | string | Repository name. |
*(String shorthand supported: `"owner/repo"` defaults to GitHub)*

### Example
```yaml
- id: prs
  type: git
  colSpan: 3
  hideEmpty: true
  filterStatus: ["open"]
  repositories:
    - "glassboard/frontend"
    - type: "gitlab"
      owner: "mygroup"
      repo: "backend"
```

---

## HA Control (`hacontrol`)
Control Home Assistant entities (lights, switches, etc.).

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `data.entities`| array | required | List of entities to control. |

**Entity Object**:
| Field | Type | Description |
|-------|------|-------------|
| `entity_id` | string | HA Entity ID (e.g. `light.living_room`). |
| `name` | string | Display name. |
| `icon` | string/object | Icon name (Lucide or simple names like `lamp`) or object `{ source, value }`. |
| `on_state` | string | State value considered "on". If unset, anything except `off`, `unavailable` and `unknown` counts as on. |
| `off_state` | string | State value considered "off" (used when `on_state` is not set). |
| `attributes` | array | List of attributes to show in secondary text. |
| `color` | string | Highlight color when active. |
| `on_action` | object | `{ service: 'domain.service' }` to call when turning on. |
| `off_action` | object | `{ service: 'domain.service' }` to call when turning off. |

Only the entities listed here can be read through the API, and only their `on_action`/`off_action` can be called. The tile is clickable when both actions are set.

### Example
```yaml
- id: lights
  type: hacontrol
  data:
    entities:
      - entity_id: light.office
        name: "Office Light"
        icon: "lamp"
        attributes: ["brightness"]
        color: "#f1c40f"
```

---

## Media (`media`)
Displays upcoming episodes and movies from Sonarr/Radarr (via backend aggregator).

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | | URL for the card header. |
| `services` | array | | Optional list of `{ type: sonarr\|radarr, url, apiKey }`. Overrides `services.sonarr` / `services.radarr`. Prefer `services.yaml` for API keys. |

### Example
```yaml
- id: media_calendar
  type: media
  colSpan: 3
```

---

## Proxmox (`proxmox`)
Displays status of Proxmox VMs and LXC containers.

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | | URL for the card header (link to Proxmox UI). Also used for the API when `services.proxmox.url` is not set. |

### Example
```yaml
- id: pve
  type: proxmox
  url: "https://proxmox.local:8006"
```

---

## Server Stats (`serverstats`)
Displays server resource usage (CPU, RAM, Disk, etc.).

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `data.sensors` | array | see desc | List of sensors: `cpu`, `ram`, `storage`, `network`, `temp`. |

### Example
```yaml
- id: server
  type: serverstats
  colSpan: 1
  data:
    sensors: ["cpu", "ram", "temp"]
```

---

## Transmission (`transmission`)
Displays active torrent downloads/seeds.

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | | URL for the card header. Also used for the RPC connection when `services.transmission.url` is not set. |
| `downloadsUrl` | string | | Optional link shown as a folder button in the header. |

### Example
```yaml
- id: downloads
  type: transmission
  colSpan: 2
  url: "http://transmission.local:9091"
```

---

## Weather (`weather`)
Displays a daily (7 days) or hourly (24 hours) weather forecast from the free [Open-Meteo](https://open-meteo.com) API. No API key or Home Assistant is required. The forecast refreshes every 30 minutes.

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `latitude` / `longitude` | number | — | Coordinates of the forecast location. Takes precedence over `location`. |
| `location` | string | — | Place name (e.g. `Berlin`), resolved via Open-Meteo geocoding. Required if no coordinates are set. |
| `units` | string | `metric` | `metric` (°C) or `imperial` (°F). |
| `icon` | string/object | — | Custom icon for the card header. |

### Example
```yaml
- id: local_weather
  type: weather
  colSpan: 2
  location: Berlin # or latitude: 52.52 / longitude: 13.41
  units: metric
  icon: "lu-Sun" # Optional override
  iconColor: "gold" # Optional override
  iconBackground: "#000" # Optional override
```

---

## Common Styling Overrides (TwoToneBase Cards)
Cards that use the standard layout (Weather, Media, Git, Transmission, Proxmox) support these optional styling overrides:

| Option | Type | Description |
|--------|------|-------------|
| `icon` | string/object | Override default icon. |
| `iconColor` | string | Override icon color. |
| `iconBackground` | string | Override the icon box background (color or gradient). |
