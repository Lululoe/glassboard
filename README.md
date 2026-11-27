# Glassboard

A modern, aesthetic personal dashboard inspired by the design language of iCloud. Built to provide a beautiful and responsive interface for your self-hosted services and Home Assistant integrations.

## Motivation
This project was born out of a desire for a dashboard that didn't just function well, but looked stunning. Existing solutions often felt utilitarian or didn't quite match my specific design notions. I wanted something that felt premium, with deep glassmorphism effects, fluid animations, and a cohesive "Apple-like" aesthetic.

**Design Inspiration:** The clean, tile-based layout and frosted glass elements of the iCloud website were a primary influence for the visual direction of this project.

## Features

### 🎨 Aesthetic & UX
-   **Glassmorphism UI**: Heavy use of backdrop filters, translucency, and subtle gradients.
-   **Responsive Layout**: Adapts from a multi-column desktop grid to a single-column mobile view.
-   **Multi-Page Support**:
    -   **Desktop**: Hover-triggered navigation zones on the screen edges.
    -   **Mobile**: Smooth swipe gestures to switch pages.
    -   **Hide pages by URL**: `?hide=servers,media` leaves those pages (by id or name) out entirely on that device, for example a wall tablet.
-   **Theming**: Unified color palette with support for Light/Dark modes (system adaptable).

### 🏠 Home Automation
-   **Home Assistant Integration**: Direct control of entities (Lights, Switches, Media Players, Climate, Vacuums).
-   **Live State**: Real-time status updates and attribute displays (e.g., brightness, temperature).
-   **Single Thermostat**: Target slider, heating state and presets for one climate entity, as a quarter, half or full tile.
-   **Multiroom Thermostat**: Up to six rooms in one card, as rows or columns, with per-room presets.
-   **Media Player**: Cover art, playback controls, seeking, and per-speaker volume and grouping for Home Assistant players.
-   **Vacuum**: Start, stop and dock, fan speed, mop wetness, room selection, consumables, a Valetudo map and camera, for one robot or several.
-   **Graph**: History of up to eight sensors as lines, (stacked) bars, or this week against last week.
-   **More cards as plugins**: The 3D printer, storage and litter box cards come as the Glassboard Cards plugin (see [Plugins](https://github.com/Lululoe/glassboard/wiki/PLUGINS)).

### 🎬 Media Center
-   **Unified Media Card**: A powerful, consolidated view for **Sonarr** and **Radarr**.
    -   Shows upcoming episodes and movies in a unified calendar.
    -   Different icons for TV (Sonarr) and Movies (Radarr).
    -   Status indicators (Downloaded, Downloading, Missing, Upcoming).
-   **Transmission**: Monitor active torrents, download speeds, and progress directly from the dashboard.

### 🛠️ Developer & DevOps
-   **Git Integration**: View Pull Requests from GitHub, GitLab, and Gitea.
    -   Supports private repositories (via tokens).
    -   Filters by status (open, merged) and labels.
-   **Proxmox Cluster**: Monitor node status (CPU, RAM, Uptime) for your virtualization cluster.
-   **Server Stats**: Real-time resource usage (CPU, RAM, Disk, Network) via Glances integration.

### ☀️ Dashboard Utilities
-   **Weather**: Daily and hourly forecast from the free [Open-Meteo](https://open-meteo.com) API — no API key or Home Assistant needed.
-   **App Grid**: Quick launcher for your self-hosted services (Plex, TrueNAS, etc.).
-   **Global Launcher**: A persistent popup launcher in the header for quick access to apps from anywhere.
-   **Page Header**: An optional clock, date, greeting, text or Home Assistant template above the cards, with lock screen style widgets for Home Assistant entities, for all pages or per page. See [Page Header](docs/HEADER_CONFIGURATION.md#page-header).

## Configuration

Configuration is managed through `config.yaml` (layout), `services.yaml` (secrets), and an optional `theme.yaml` (styles) in the root directory. Changes are picked up without a restart, and open dashboards reload automatically.

Cards can also be moved, resized, edited, added and removed in the browser: long-press a card or click the pencil button in the header. These changes are saved to `layout.yaml`, so `config.yaml` is never rewritten. Editing is off by default because there is no login yet: set `editable: true` in `config.yaml` to turn it on, and only on dashboards that strangers can't reach. See [Editing the Dashboard](docs/CARD_CONFIGURATION.md#editing-the-dashboard).

### Structure (`config.yaml`)
```yaml
# 1. Themes (Optional overrides)
themes:
  - id: "custom_dark"
    name: "Deep Space"
    colors:
      dark:
        "--bg-page-gradient": "linear-gradient(to right, #000, #333)"

# 2. Pages & Layout
pages:
  - id: home
    name: "Main"
    cards:
      - id: weather
        type: weather
        colSpan: 2
        location: "Berlin" # or latitude/longitude

      - id: proxmox
        type: proxmox
        colSpan: 1
        url: "https://proxmox.local:8006"

      - id: git
        type: git
        colSpan: 3
        repositories:
          - type: "github"
            owner: "Lululoe"
            repo: "docker-media"

  - id: status
    name: "Monitor"
    type: iframe
    url: "https://uptime.example.com/status"
```

### Services & Secrets (`services.yaml`)
```yaml
services:
  homeassistant:
    url: "http://homeassistant.local:8123"
    token: "YOUR_LONG_LIVED_TOKEN"
  sonarr:
    url: "http://192.168.1.10:8989"
    apiKey: "..."
  git:
    github:
      token: "..."
```

Glassboard keeps one websocket connection to Home Assistant open and gets every state change of the entities on
your cards as it happens, so cards answer from a live copy instead of asking Home Assistant on each poll. While the
connection is down (e.g. Home Assistant restarting), it falls back to the REST API and reconnects on its own.

## Security
This project uses a **Backend-for-Frontend (BFF)** architecture.
-   **No Secrets in Client**: API keys and tokens are stored server-side and never sent to the browser.
-   **Sanitized Config**: The frontend receives a stripped-down version of the configuration.
-   **Proxying**: All requests to internal services (Sonarr, HA, etc.) are proxied and validated by the Node.js server. Only the entities, actions and repositories listed in `config.yaml` can be reached.
-   **No authentication**: The dashboard itself has no login. Run it on a trusted network or behind a reverse proxy that handles authentication.
-   **Editing is opt-in and needs a password**: Edit mode stays off until `editable: true` is set, since whoever can edit cards decides which Home Assistant entities and actions the dashboard may control. It also needs an edit password in `EDIT_PASSWORD`; without one editing stays off. Browsers keep it until they are locked in the settings.
-   **No cross-site calls**: The service endpoint only takes JSON `POST` requests, so another website can't make your browser switch lights through a link or image. Glassboard only answers to IP addresses, local names and the names in `ALLOWED_HOSTS`, so a website can't reach it through your browser by pointing its own name at your network.
-   **Downloads stay on the internet**: Pictures downloaded for backgrounds can't come from addresses in your network.
-   **Plugins are trusted code**: A plugin's server part runs with access to every credential. Installing plugins from the settings window is off until both `editable: true` and `plugins.install: true` are set, needs the edit password, and shows where a plugin comes from before installing it. The exact commit and download are recorded, so an update refuses a release that was changed after it was installed.

## Documentation
All documentation is hosted on the [Glassboard GitHub Wiki](https://github.com/Lululoe/glassboard/wiki).

- **[Configuration Guide](https://github.com/Lululoe/glassboard/wiki/CARD_CONFIGURATION)**: Detailed reference for `config.yaml` options and card setups.
- **[Server API](https://github.com/Lululoe/glassboard/wiki/SERVER_API)**: Documentation for the backend API endpoints and services.
- **[Plugins](https://github.com/Lululoe/glassboard/wiki/PLUGINS)**: Installing plugins with more cards, and writing your own.
- **[Creating New Cards](https://github.com/Lululoe/glassboard/wiki/CREATING_NEW_CARDS)**: Developer guide for extending the dashboard with new features.
- **[Theming Guide](https://github.com/Lululoe/glassboard/wiki/THEMING)**: Customizing colors and aesthetics.
- **[Shared Components](https://github.com/Lululoe/glassboard/wiki/SHARED_COMPONENTS)**: Components library reference (`BaseCard`, `TwoToneBase`, etc.) for developers.

## Setup & Running

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

### 🐳 Docker (Recommended)
1.  **Configure**:
    Create a `.env` file from the example:
    ```bash
    cp .env.example .env
    ```
    Ensure `config.yaml` and `services.yaml` exist. To keep layout changes made in the browser, keep installed plugins, or to override the default themes or add `custom.css`, uncomment the matching volumes in `docker-compose.yml`.

    The container runs as the unprivileged `node` user (uid 1000), with no Linux capabilities. Folders it writes to, `data` for the layout and backgrounds and `plugins`, must be writable by uid 1000:
    ```bash
    mkdir -p data plugins && sudo chown 1000:1000 data plugins
    ```
    Or set `user:` in `docker-compose.yml` to the owner of those folders. With rootless Podman, run it with `--userns=keep-id` so files keep your own owner.

    Upgrading from a version that ran as root: `chown` the folders and files you mount for writing (such as `layout.yaml`, `backgrounds`, `plugins`) to uid 1000, or Glassboard can't save changes. To move to the `data` folder, put `layout.yaml` and `backgrounds/` into `data/`.

2.  **Run**:
    ```bash
    docker-compose up -d
    ```
    Access at `http://localhost:3001` (or your configured port).

### 💻 Manual Setup
1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configure**:
    Copy `config.example.yaml` to `config.yaml` and `services.example.yaml` to `services.yaml`, then adjust them.
    Node.js 22.19 or newer is required.

### 🧪 Demo Mode
To try the dashboard without any services, set `demo: true` in `config.yaml` (or `GLASSBOARD_DEMO=true` in the environment). Every card is then filled with simulated data that changes slowly over time, Home Assistant toggles work in memory, and the header shows a "Demo" label. No requests are sent to your services while demo mode is on.

```bash
cp config.example.yaml config.yaml
GLASSBOARD_DEMO=true npm run dev
```

### 🔐 Environment Variables
You can override any service configuration using environment variables. This is useful for Docker setups to keep secrets out of files.

**Convention**: `SERVICES__<SERVICE_NAME>__<KEY>` (Double underscores, uppercase).

| Variable | Description |
| :--- | :--- |
| `PORT` | Server port (default: 3001) |
| `GLASSBOARD_DEMO` | `true` fills every card with simulated data (overrides `demo` in `config.yaml`) |
| `EDIT_PASSWORD` | The password edit mode asks for, at least 8 characters. Without it, editing stays off |
| `ALLOWED_HOSTS` | Host names Glassboard answers to besides IP addresses and local names, such as the domain of your reverse proxy: `dash.example.com,*.example.org` |
| `PLUGINS_DIR` | Folder plugins are loaded from and installed to (default: `plugins`) |
| `LAYOUT_FILE` | The layout overlay edit mode saves to (default: `layout.yaml`; `/app/data/layout.yaml` in `docker-compose.yml`). Its backup and uploaded backgrounds go next to it |
| `SERVICES__HOMEASSISTANT__TOKEN` | Override HA Token |
| `SERVICES__SONARR__APIKEY` | Override Sonarr API Key |
| `SERVICES__GIT__GITHUB__TOKEN` | Override GitHub Token |

Service-specific variables are also supported: `HA_URL`, `HA_TOKEN`, `SONARR_URL`, `SONARR_API_KEY`, `RADARR_URL`, `RADARR_API_KEY`, `TRANSMISSION_URL`, `TRANSMISSION_USERNAME`, `TRANSMISSION_PASSWORD`, `PROXMOX_URL`, `PROXMOX_TOKEN_ID`, `PROXMOX_SECRET`, `PROXMOX_VERIFY_TLS`, `GLANCES_URL`, `GITHUB_TOKEN`, `GITLAB_URL`, `GITLAB_TOKEN`, `GITEA_URL`, `GITEA_TOKEN`.

Example (`.env`):
```bash
SERVICES__HOMEASSISTANT__URL=http://homeassistant.local:8123
SERVICES__HOMEASSISTANT__TOKEN=ey...
SERVICES__SONARR__APIKEY=abc123...
```

3.  **Start Server**:
    The backend server proxies the API and serves the frontend.
    ```bash
    npm run build
    npm start
    ```
    For development with hot reload, run `npm run dev` instead.
    Access the dashboard at `http://localhost:3001`.

## Development Note
I am relatively new to full-stack development. This project has been built with the assistance of advanced AI coding agents. Call it vibe coding if you want, but I made pretty much all the considerations when it comes to the structure of the project and how it works. I went into this project with html, css and js knowledge, but I learned a lot about react and nodejs along the way. Working on this showed me how AI assisted coding can be a powerful tool to speed up development, but doesn't replace knowledge about structuring readable code, auditing code for security vulnerabilities, and proper documentation.