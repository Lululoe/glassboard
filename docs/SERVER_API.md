# Server API Documentation

The server exposes a centralized API endpoint for various services and a configuration endpoint.

## Base URL
All APIs are prefixed with `/api`.

---

## 1. Centralized Service API
**Endpoint**: `POST /api` or `GET /api`  
**Description**: Single entry point for all dashboard services. Dispatch is based on the `service` parameter.

### Parameters
| Name | Type | Params Type | Description |
|------|------|--------|-------------|
| `service` | string | Body/Query | Required. The service identifier. |
| `...params` | mixed | Body/Query | Service-specific parameters. |

> **Note**: For `POST` requests, parameters should be in the JSON body. For `GET` requests, use query parameters.

### Supported Services

#### `transmission`
- **Description**: Fetches active torrents and global stats.
- **Parameters**: None.
- **Response**:
  ```json
  {
    "torrents": [
      { "id": 1, "name": "Linux ISO", "progress": 50, "speedDown": "2 MB/s", "status": "downloading", ... }
    ],
    "totalRateDown": 2048000,
    "totalRateUp": 1024,
    "totalCount": 1
  }
  ```

#### `media`
- **Description**: Fetches calendar/upcoming events from configured Media services (Sonarr/Radarr).
- **Parameters**:
  - `start` (string): ISO start date.
  - `end` (string): ISO end date.
- **Response**: Array of event objects.
  ```json
  [
    {
      "id": 123,
      "type": "sonarr",
      "title": "Series Name",
      "secondary": "1x05",
      "datetime": "2023-10-27T20:00:00Z",
      "status": "upcoming"
    }
  ]
  ```

#### `homeassistant`
- **Description**: Proxies requests to Home Assistant.
- **Parameters**:
  - `endpoint` (string): **Required**. Either `'states/:entity_id'` or `'services'`.
- **Sub-Endpoints**:
  - **Get State**: `{ service: 'homeassistant', endpoint: 'states/light.living_room' }`
  - **Call Service**:
    - `endpoint`: `'services'`
    - `entity_id`: Target entity (e.g., `light.living_room`)
    - `service`: Service call (e.g., `light.turn_on`)

#### `weather`
- **Description**: Fetches weather forecast from Home Assistant.
- **Parameters**:
  - `entity_id` (string): Weather entity ID.
  - `type` (string): Forecast type (`daily` or `hourly`). Default: `daily`.

#### `proxmox`
- **Description**: Fetches status of Proxmox VMs and LXC containers.
- **Parameters**: None.
- **Response**:
  ```json
  {
    "nodes": [
      { "id": 100, "name": "docker-host", "status": "running", "cpu": 5.5, "ram": 40.2, ... }
    ],
    "summary": { "running": 5, "total": 6, "cpuAvg": 10 }
  }
  ```

#### `serverstats`
- **Description**: Fetches system resources via Glances.
- **Parameters**: None (currently).
- **Response**:
  ```json
  {
    "cpu": 15.2,
    "ram": { "used": "8.5", "total": "16.0" },
    "temp": 45
  }
  ```

#### `git`
- **Description**: Fetches Pull Requests from configured repositories.
- **Parameters**:
  - `repos` (string/array): Optional override.
  - `filterStatus` (array): e.g. `["open"]`.
- **Response**:
  ```json
  {
    "prs": [ ... ],
    "stats": { "count": 1, "open": 1, ... }
  }
  ```

---

## 2. Configuration API
**Endpoint**: `GET /api/config`  
**Description**: Returns the sanitized frontend configuration (secrets removed).

**Response**:
```json
{
  "pages": [ ... ],
  "theme": "dark"
}
```
