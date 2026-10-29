# Server API Documentation

The server exposes one service endpoint, a configuration endpoint and a configuration change stream.

## Base URL
All APIs are prefixed with `/api`. Unknown `/api/...` paths return `404` with a JSON body.

The API is meant for the dashboard served from the same origin; no CORS headers are sent.

## Errors
Errors are returned as JSON with a matching HTTP status:

```json
{ "error": "Entity not authorized: lock.front_door" }
```

| Status | Meaning |
|--------|---------|
| `400` | Missing or invalid parameters. |
| `403` | The request targets something not present in `config.yaml` (an entity, an action). |
| `404` | Unknown service, card or API path. |
| `502` | The upstream service (Home Assistant, Proxmox, ...) returned an error. |
| `503` | The service is not configured in `services.yaml` / environment variables. |
| `500` | Unexpected server error. |

Outside production (`NODE_ENV !== 'production'`) the body also contains a `stack` field.

---

## 1. Service API
**Endpoint**: `POST /api` (JSON body) or `GET /api` (query parameters)
**Description**: Single entry point for all dashboard services. Dispatch is based on the `service` parameter.

| Name | Type | Description |
|------|------|-------------|
| `service` | string | Required. One of the services below. |
| `...params` | mixed | Service-specific parameters. |

Services are registered in `server/services/index.js`.

In demo mode (`demo: true` in `config.yaml`, or `GLASSBOARD_DEMO=true`) every service is answered by the
simulated handlers in `server/services/demo.js` instead, with the same response shapes and validation errors
for missing parameters. Home Assistant actions change the simulated state in memory only.

### `transmission`
- **Parameters**: None.
- **Response**:
  ```json
  {
    "torrents": [
      { "id": 1, "name": "Linux ISO", "progress": 50, "speedDown": "2.00 MB/s", "status": 4, ... }
    ],
    "totalRateDown": 2048000,
    "totalRateUp": 1024,
    "totalCount": 1
  }
  ```

### `media`
- **Parameters**:
  - `start` (string): Start date, `YYYY-MM-DD`.
  - `end` (string): End date, `YYYY-MM-DD`.
- **Response**: Events from all configured Sonarr/Radarr instances, sorted by date.
  ```json
  [
    {
      "id": "sonarr-123",
      "type": "sonarr",
      "title": "Series Name",
      "secondary": "1x05",
      "datetime": "2023-10-27T20:00:00Z",
      "status": "upcoming",
      "url": "http://sonarr.local/series/series-name"
    }
  ]
  ```

### `homeassistant`
Only entities that appear on an `hacontrol` card can be read, and only the
`on_action` / `off_action` configured for an entity can be called.

- **Get several states**: `{ "service": "homeassistant", "endpoint": "states", "entity_ids": ["light.office", "switch.fan"] }`
  returns `{ "light.office": { ...state }, "switch.fan": null }` (`null` when a single state could not be fetched).
- **Get one state**: `{ "service": "homeassistant", "endpoint": "states/light.office" }`
- **Call an action**: `{ "service": "homeassistant", "endpoint": "services", "entity_id": "light.office", "action": "light.turn_on" }`

### `weather`
- **Parameters**:
  - `cardId` (string): Id of a `weather` card. Its `latitude`/`longitude` or `location` and `units` are used.
  - `type` (string): `daily` (default, 7 days) or `hourly` (next 24 hours).
- **Response**: Forecast from the public Open-Meteo API, cached for 30 minutes:
  ```json
  {
    "units": "metric",
    "forecast": [
      { "datetime": "2026-10-27T12:00:00+01:00", "condition": "Partly cloudy", "temperature": 14.2, "templow": 4.8, "precipitation": 10 }
    ]
  }
  ```
  `templow` is only present for daily forecasts; `precipitation` is the probability in percent.

### `proxmox`
- **Parameters**: None.
- **Response**:
  ```json
  {
    "nodes": [
      { "id": 100, "name": "docker-host", "type": "vm", "status": "running", "cpu": 5.5, "ram": 40.2, "disk": 12.0 }
    ],
    "summary": { "running": 5, "total": 6, "cpuAvg": 10 }
  }
  ```

### `serverstats`
- **Parameters**: None.
- **Response** (sizes in GB, network in bytes):
  ```json
  {
    "info": { "hostname": "server", "ip": "192.168.1.10" },
    "cpu": 15.2,
    "ram": { "used": 8.5, "total": 16 },
    "storage": { "used": 120.4, "free": 380.1, "total": 500.5 },
    "network": { "in": 1048576, "out": 524288 },
    "temp": 45
  }
  ```

### `appstatus`
- **Parameters**:
  - `cardId` (string): Id of an `appgrid` card. The app URLs (`statusUrl` or `url`) are read from that
    card's configuration, or from `launcher.apps` when the card has none; they cannot be passed in the request.
- **Response** (one entry per app, `null` when not checked; results cached for 30 seconds per URL):
  ```json
  { "statuses": [true, false, null] }
  ```

### `git`
- **Parameters**:
  - `cardId` (string): Id of a `git` card. The repositories and filters are read from that card's
    configuration on the server; they cannot be passed in the request.
- **Response** (cached for one minute per card):
  ```json
  {
    "prs": [ { "id": "github-1", "title": "...", "repo": "owner/repo", "state": "open", ... } ],
    "stats": { "count": 1, "open": 1 }
  }
  ```

---

## 2. Configuration API
**Endpoint**: `GET /api/config`
**Description**: Returns the frontend configuration. The `services` section is removed and credential-like
keys (`apiKey`, `token`, `secret`, `tokenId`, `password`, `username`) are stripped at any depth.

```json
{
  "pages": [ ... ],
  "theme": "default",
  "demo": false
}
```

`demo` is always present and reflects both the config and the `GLASSBOARD_DEMO` environment variable.

## 3. Configuration Change Stream
**Endpoint**: `GET /api/config/events`
**Description**: [Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) stream.
A `config` event is sent whenever `config.yaml`, `services.yaml`, `theme.yaml` or `layout.yaml` changes; open
dashboards reload their configuration when they receive it.

## 4. Layout API
Used by edit mode to store the dashboard in `layout.yaml`. Both endpoints answer `403` when `editable: false` is
set, and the config reloads right away.

### `PUT /api/config/layout`
Saves the whole dashboard. `pages` maps each grid page key (the page `id`, the page's index for pages without one,
or `default` for a top-level `cards` list) to its cards in order, with all their properties. Every grid page must
be included, and every card needs a unique `id` and a `type` (`400` otherwise). Cards from `config.yaml` that are
missing are stored as removed; cards with unknown ids are stored as new cards. Credential-like keys the browser
never received are kept from the server's copy of the card.

```json
{
  "pages": {
    "home": [{ "id": "weather", "type": "weather", "colSpan": 2, "location": "Berlin" }],
    "admin": [{ "id": "gap", "type": "spacer", "tileSize": "half", "hideOn": ["phone"] }]
  }
}
```

### `DELETE /api/config/layout`
Removes everything saved from the browser, so the dashboard goes back to `config.yaml`.
