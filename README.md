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
-   **Theming**: Unified color palette with support for Light/Dark modes (system adaptable).

### 🏠 Home Automation
-   **Home Assistant Integration**: Direct control of entities (Lights, Switches, Media Players, Climate, Vacuums).
-   **Live State**: Real-time status updates and attribute displays (e.g., brightness, temperature).

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
-   **Weather**: Daily forecast card integrated with Home Assistant weather entities.
-   **App Grid**: Quick launcher for your self-hosted services (Plex, TrueNAS, etc.).
-   **Global Launcher**: A persistent popup launcher in the header for quick access to apps from anywhere.

## Configuration

Configuration is managed through `config.yaml` (layout), `services.yaml` (secrets), and `theme.yaml` (styles) in the root directory.

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
        entity_id: "weather.home"

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

## Security
This project uses a **Backend-for-Frontend (BFF)** architecture.
-   **No Secrets in Client**: API keys and tokens are stored server-side and never sent to the browser.
-   **Sanitized Config**: The frontend receives a stripped-down version of the configuration.
-   **Proxying**: All requests to internal services (Sonarr, HA, etc.) are proxied and validated by the Node.js server to prevent CORS issues and expose only necessary endpoints.

## Documentation
All documentation is hosted on the [Glassboard GitHub Wiki](https://github.com/Lululoe/glassboard/wiki).

- **[Configuration Guide](https://github.com/Lululoe/glassboard/wiki/CARD_CONFIGURATION)**: Detailed reference for `config.yaml` options and card setups.
- **[Server API](https://github.com/Lululoe/glassboard/wiki/SERVER_API)**: Documentation for the backend API endpoints and services.
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
    Ensure `config.yaml`, `services.yaml`, and `theme.yaml` exist.

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
    Copy `config.yaml.example` (if available) or create `config.yaml` in the root directory following the structure above.
    Ensure `theme.yaml` is present for default styles.

### 🔐 Environment Variables
You can override any service configuration using environment variables. This is useful for Docker setups to keep secrets out of files.

**Convention**: `SERVICES__<SERVICE_NAME>__<KEY>` (Double underscores, uppercase).

| Variable | Description |
| :--- | :--- |
| `PORT` | Server port (default: 3001) |
| `SERVICES__HOMEASSISTANT__TOKEN` | Override HA Token |
| `SERVICES__SONARR__APIKEY` | Override Sonarr API Key |
| `SERVICES__GIT__GITHUB__TOKEN` | Override GitHub Token |

Example (`.env`):
```bash
SERVICES__HOMEASSISTANT__URL=http://homeassistant.local:8123
SERVICES__HOMEASSISTANT__TOKEN=ey...
SERVICES__SONARR__APIKEY=abc123...
```

3.  **Start Server**: hiding
    The backend server handles API proxying (to avoid CORS) and serves the frontend.
    ```bash
    npm run start:server
    ```
    Access the dashboard at `http://localhost:3001`.

## Development Note
I am relatively new to full-stack development. This project has been built with the assistance of advanced AI coding agents. Call it vibe coding if you want, but I made pretty much all the considerations when it comes to the structure of the project and how it works. I went into this project with html, css and js knowledge, but I learned a lot about react and nodejs along the way. Working on this showed me how AI assisted coding can be a powerful tool to speed up development, but doesn't replace knowledge about structuring readable code, auditing code for security vulnerabilities, and proper documentation.