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
States are answered from a live copy that the server keeps over Home Assistant's websocket API, or fetched over
REST while that connection is down, so polling is cheap.
Only entities that appear on an `hacontrol` card, as the `entity_id` of a `thermostat` card, in the first six
`rooms` of a `thermostats` card or as a player or speaker of a `mediaplayer` card can be read. Of
`hacontrol` entities only the configured `on_action` / `off_action` and the control dialog actions below can be called; thermostat entities only accept
the climate actions below.

- **Get several states**: `{ "service": "homeassistant", "endpoint": "states", "entity_ids": ["light.office", "switch.fan"] }`
  returns `{ "light.office": { ...state }, "switch.fan": null }` (`null` when a single state could not be fetched).
  With `"icons": true`, each state also has an `icon` (e.g. `"mdi:lightbulb-off"`): the icon Home Assistant shows for
  the entity, picked like its frontend does (an icon set on the entity, its `icon` attribute, its integration's icon,
  its domain's icon for the device class and state). Without the live connection, only the attribute and a fallback
  per domain are used.
- **Get one state**: `{ "service": "homeassistant", "endpoint": "states/light.office" }`
- **Call an action**: `{ "service": "homeassistant", "endpoint": "services", "entity_id": "light.office", "action": "light.turn_on" }`
- **Control a thermostat**: `{ "service": "homeassistant", "endpoint": "climate", "entity_id": "climate.living", "action": "set_temperature", "temperature": 21.5 }`.
  `action` is one of:
  For a room of a `thermostats` card, the room's `presets`, `hvac_mode`, `min` and `max` apply, falling back to the card's.
  - `set_temperature` with `temperature`, within the card's `min`/`max` if set (`400` otherwise),
  - `set_preset_mode` with `preset_mode`; when the card has `presets`, only their `preset` values (`403` otherwise),
  - `set_hvac_mode` with `hvac_mode` `off` or the card's `hvac_mode` (default `heat`).
- **Control a media player**: `{ "service": "homeassistant", "endpoint": "media", "entity_id": "media_player.living_room", "action": "volume_set", "volume_level": 0.4 }`.
  The entity must be a player or speaker of a `mediaplayer` card. `action` is one of `media_play_pause`,
  `media_next_track`, `media_previous_track`, `media_seek` (with `seek_position` in seconds), `volume_set` (with
  `volume_level` 0–1), `join` (with `group_members`, other players or speakers of media player cards) and `unjoin`.
- **Load a graph card**: `{ "service": "homeassistant", "endpoint": "graph", "card_id": "temperatures", "range": "24h" }`
  returns `{ "chart": "line", "range": "24h", "minutes": 10, "times": [...], "end": 1793530000000, "series": [{ "entity_id", "name", "unit", "color", "kind", "current", "values": [...] }] }`:
  one value per period (starting at `times`, `minutes` long, the last ending at `end`) for each sensor of the card,
  `null` where there is no data. `range` must be one of the card's ranges (the week comparison ignores it and returns
  14 days). `kind` is `mean` (an average) or `change` (what a meter used). Values come from Home Assistant's long-term
  statistics where it keeps them and from the state history otherwise; answers are cached for 30 seconds.
- **Load a control dialog**: `{ "service": "homeassistant", "endpoint": "details", "entity_id": "group.living_room" }`
  returns `{ "entity": { ...state }, "members": { "light.lamp": { ...state } }, "favorites": { "light.lamp": [{ "hs_color": [24, 85] }, { "color_temp_kelvin": 2700 }] } }`.
  The entity must be on an `hacontrol` card; `members` lists the states of a group's `entity_id` attribute (empty for
  single entities). The entity and member states include their `icon`, as with `"icons": true` above. `favorites` has the favorite colors set in Home Assistant for the lights among them, each with one of
  `hs_color`, `rgb_color`, `rgbw_color`, `rgbww_color`, `xy_color` or `color_temp_kelvin`; lights without favorites
  are left out.
- **Control from a dialog**: `{ "service": "homeassistant", "endpoint": "control", "entity_ids": ["light.lamp"], "action": "turn_on", "brightness_pct": 60 }`.
  Every entity must be on an `hacontrol` card or a member of a group on one (members are read from Home Assistant,
  `403` otherwise); 1–50 entities. `action` is `turn_on` or `turn_off`. Lights are called with `light.turn_on` /
  `light.turn_off` and, for `turn_on`, optional `brightness_pct` (1–100), `color_temp_kelvin` (1000–12000) or
  `hs_color` (`[hue 0–360, saturation 0–100]`); other entities with `homeassistant.turn_on` / `turn_off`.

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

### Material Design Icons
`GET /api/icons/mdi/<name>.svg` returns a Material Design Icon (the icons Home Assistant uses) as SVG, e.g.
`/api/icons/mdi/lightbulb-off.svg`; `404` for unknown names. Responses may be cached for a week.

### Media player artwork
**Endpoint**: `GET /api/ha/artwork?entity_id=media_player.living_room`
**Description**: Returns the cover art of a player or speaker of a `mediaplayer` card. The server reads the picture
URL from the entity's state and fetches it with the Home Assistant token (external picture URLs without it). `404`
when there is no artwork, including in demo mode; `403` for other entities.

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
