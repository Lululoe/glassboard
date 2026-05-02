# Welcome to the Glassboard Wiki

**Glassboard** is a modern, aesthetic personal dashboard inspired by the design language of iCloud. It is built to provide a beautiful and responsive interface for your self-hosted services and Home Assistant integrations.

## Why Glassboard?
This project was born out of a desire for a dashboard that didn't just function well, but looked stunning. Existing solutions often felt utilitarian or didn't quite match my specific design notions. I wanted something that felt premium, with deep glassmorphism effects, fluid animations, and a cohesive "Apple-like" aesthetic.

## Documentation Index

Navigate through the wiki using the sidebar or the links below to configure and customize your Glassboard:

- 🛠️ **[Card Configuration](CARD_CONFIGURATION)**: Detailed reference for setting up dashboard cards (Weather, Media, Proxmox, Git, etc.).
- 🎨 **[Theming Guide](THEMING)**: Learn how to customize colors, aesthetics, and create your own themes.
- ⚙️ **[Header Configuration](HEADER_CONFIGURATION)**: Configure the persistent popup launcher and top bar.
- 🖥️ **[Server API](SERVER_API)**: Documentation for the Node.js backend API endpoints and services proxy.
- 🧱 **[Shared Components](SHARED_COMPONENTS)**: Component library reference (`BaseCard`, `TwoToneBase`, etc.) for building your own elements.
- 🚀 **[Creating New Cards](CREATING_NEW_CARDS)**: Developer guide for extending the dashboard with completely new custom cards.

## Setup & Running
Glassboard utilizes a Backend-for-Frontend (BFF) architecture. The Node.js server securely stores your API keys and proxies requests to your internal services, while the React frontend provides the glassmorphic UI.

### 🐳 Docker (Recommended)
1. **Configure**: Create a `.env` file from the example and ensure your `.yaml` config files exist.
    ```bash
    cp .env.example .env
    ```
2. **Run**:
    ```bash
    docker-compose up -d
    ```

### 💻 Manual Setup
1. **Install Dependencies**:
    ```bash
    npm install
    ```
2. **Configure**: Copy `config.example.yaml` to `config.yaml` and configure your layout. Copy `services.example.yaml` to `services.yaml` for your secrets.
3. **Start**:
    ```bash
    npm run start:server
    ```

Access the dashboard at `http://localhost:3001`.
