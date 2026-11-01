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
| `tileSize` | string | | `half` or `quarter` for a card smaller than one tile (see below). Overrides `colSpan`. |
| `hideOn` | array | | Screen sizes the card is hidden on: `phone`, `tablet` and/or `desktop`. |
| `primaryColor` | string | | Sets `--card-primary` for the card (overrides theme/default). |

---

## Card Sizes
The grid has three columns on wide screens, two on tablets (up to 1024px) and one on phones (up to 768px). Rows
are as tall as a column is wide, so a one-wide card is always square.

| Size | Config | Shape |
|------|--------|-------|
| Quarter | `tileSize: quarter` | A quarter of a tile. Up to four share one tile. |
| Half | `tileSize: half` | Full tile width, half height. Two share one tile, stacked. |
| One wide | `colSpan: 1` (default) | One square tile. |
| Two wide | `colSpan: 2` | Two tiles side by side. |
| Three wide | `colSpan: 3` | A full row. |

Half and quarter cards that follow each other in the config fill a shared tile in order, each taking the first
free spot; a card that no longer fits starts a new tile. A full-size card in between also starts a new tile.

On smaller screens cards wider than the grid are narrowed to fit: a three-wide card is two wide on a tablet, and
two- and three-wide cards are one wide on a phone. The card is told its narrower width, so it shows its one-wide
layout rather than a squeezed wide one. On tablets later cards move up to fill gaps left by wide cards.

Not every card works at every size. In edit mode each card only offers the sizes its type supports; most cards
support one to three wide, `hacontrol` and `spacer` also support half and quarter, and `thermostat` and
`mediaplayer` support quarter, half and one wide. A size set in
`config.yaml` is always used, even if edit mode would not offer it.

## Editing the Dashboard
Long-press a card, or click the pencil button in the header, to edit the dashboard. The cards wiggle and stop
reacting to taps:

- **Move**: drag a card to a new place. On touch screens rest your finger for a moment before dragging, so a
  quick swipe still scrolls the page.
- **Move to another page**: drag a card to the left or right edge of the screen and hold it there. The edge
  lights up, and after a moment the previous or next page opens with the card still under your finger.
- **Resize**: drag the round handle in a card's bottom-right corner, or tap it to step through the sizes.
- **Edit**: tap the pencil on a card's top-left corner. **Settings** has the card's size, the screen sizes it is
  shown on, and a form for the card's options if it has one (Weather, App Grid and HA Control do). **YAML**
  edits every option of the card, exactly as in `config.yaml`. The card can also be removed here.
- **Add**: the **+** button in the header lists every card type, including **Empty Space** (see below). New cards
  go to the end of the current page and open in the editor.
- **Keyboard**: Tab to a card, then use the arrow keys to move it and `+` / `-` to resize it.
- **Done** saves everything; tapping the background or pressing Escape does the same.
- **Reset** throws away every change made in the browser, including added cards, and goes back to `config.yaml`.

### Hiding cards on some screens
Each card can be hidden on phones, tablets or desktops with the switches in its editor, or with `hideOn`:

```yaml
- id: big_chart
  type: serverstats
  colSpan: 3
  hideOn: [phone]
```

While editing, hidden cards stay visible but dimmed, labelled "Hidden on phone" (or tablet/desktop), so they can
still be moved and edited.

### Where changes are saved
Changes are saved to `layout.yaml` next to `config.yaml`, never to `config.yaml` itself, so your comments and
formatting stay untouched. Every device sees the saved dashboard. For cards from `config.yaml`, `layout.yaml`
only stores the page, position, size and visibility, unless the card's options were changed in the browser; then
it stores the whole card, and later edits to that card in `config.yaml` are ignored until you reset. Cards added
in the browser live only in `layout.yaml`, and cards removed in the browser are listed under `removed`. Cards added
to `config.yaml` later appear after the saved ones. Deleting `layout.yaml` (or **Reset**) restores the dashboard
from `config.yaml`.

Saving needs an `id` on every card. Secrets such as API keys and passwords are never sent to the browser; when a
card is saved, the server keeps the values it already has.

> **Security**: the dashboard has no login yet. While editing is on, anyone who can open the dashboard can change
> any card, including Home Assistant entities and actions and the URLs the server connects to (sometimes with
> credentials from `services.yaml`). Only expose Glassboard on networks you trust, or turn editing off.

Set `editable: false` at the top level of `config.yaml` to turn edit mode off, e.g. for a wall display:

```yaml
editable: false
```

With Docker, mount a `layout.yaml` so edits survive a container rebuild (see `docker-compose.yml`). The path can
also be changed with the `LAYOUT_FILE` environment variable.

---

## App Grid (`appgrid`)
Displays a grid of application shortcuts.

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `size` | string | `medium` | Icon size: `small`, `medium` or `large`. Each size is a fixed layout that scales with the card, so a square card always shows the same grid (small 5×4, medium 4×3, large 3×2; one more row without labels). Wide cards (`colSpan` 2–3) switch to the next larger icons, e.g. medium shows 6×2 at `colSpan: 2`. Apps fill from the top left. |
| `showLabels` | boolean | `true` | Show app names under the icons. |
| `columns` | number | | Optional. Fixed number of columns instead of fitting to the card width. |
| `maxApps` | number | | Optional. Limit the number of apps shown. The grid never shows more apps than fit in full rows; extra apps are hidden. |
| `statusCheck` | boolean | `true` | Check whether each app is reachable and show a red badge on apps that are offline. |
| `data.apps` | array | | List of apps to display. If empty, falls back to `launcher.apps` defined in header config. |

**App Object**:
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name. |
| `url` | string | URL to open when clicked. |
| `icon` | string/object | URL (svg/png), Lucide icon name, or object `{ source, value }`. |
| `bgColor` | string | Optional CSS background (e.g., gradient). |
| `statusUrl` | string | Optional. URL the server checks instead of `url` (e.g. an internal address). |
| `statusCheck` | boolean | Optional. Set to `false` to skip the status check for this app. |

**Status check**: the server sends a `HEAD` request to each app every 60 seconds (results cached for 30 seconds, 5 second timeout, TLS certificates not verified). Any response below 500 counts as online, so login pages and `401`/`403` responses are fine; timeouts, connection errors and `5xx` responses mark the app offline. The URLs are read from the server-side config only.

### Example
```yaml
- id: my_apps
  type: appgrid
  colSpan: 1
  size: small
  showLabels: false
  data:
    apps:
      - name: "Plex"
        url: "http://plex.local:32400"
        icon: "https://example.com/plex.svg"
      - name: "Sonarr"
        url: "http://sonarr.local:8989"
        icon: "video"
        statusUrl: "http://10.0.0.5:8989/ping"
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

## Graph (`graph`)
The history of one or more Home Assistant sensors: as lines, as bars, or as this week against last week. One to three
wide.

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entities` | array | required | Up to eight sensors: entity ids, or objects `{ entity_id, name, color }`. |
| `title` | string | `Graph` | Card title. |
| `chart` | string | `line` | `line`, `bar` or `week`. The card has no switch between them. |
| `ranges` | array/boolean | `[24h, 7d, 30d]` | Time ranges in the header, in hours (`h`), days (`d`) or weeks (`w`); the first is shown when the card loads. `false` hides the selector. |
| `range` | string | `24h` | The time range with `ranges: false`. |
| `stack` | boolean | auto | Whether bars stack. By default energy, gas and water meters with the same unit stack. |
| `breakdown` | boolean | `true` | Week chart: show the list that breaks the selected day down by sensor (two and three wide, stacked). |
| `icon` | string/object | chart icon | Header icon. |

**Sensor colors**: `blue`, `orange`, `green`, `purple`, `teal`, `pink`, `yellow`, `red`, `indigo`, or any CSS color.
Without one, sensors take these colors in order.

### Charts
- **Lines** (`line`): sensors with the same unit share an axis; with two units the first gets the left axis and the
  second the right. Hover or press and slide (arrow keys on a keyboard) to read every sensor at that time. Up to two
  days come from the state history in detail; longer ranges from Home Assistant's long-term statistics.
- **Bars** (`bar`): per hour up to two days, per day beyond. Meters (`state_class: total_increasing` or `total`) show
  what they used in each period, other sensors their average. Stacked bars add up to a total, which the tooltip
  shows too.
- **Week** (`week`): each day of the last week next to the same day the week before, with today last. Sensors with the
  same unit stack: hover or tap a part to see its sensor and value, and two-wide cards break the selected day down in
  a list (`breakdown: false` hides it). Sensors with different units get a switch above the chart instead.

One wide, chips under the header hide or show sensors; two and three wide, a list beside the chart does, and shows each
sensor's current value (lines) or total over the range (bars). Sensors need to be recorded by Home Assistant; long-term
statistics need a `state_class`, and without them the card works out the values from the state history.

### Examples
```yaml
- id: temperatures
  type: graph
  title: Temperatures
  ranges: [6h, 24h, 7d]
  entities:
    - entity_id: sensor.living_room_temperature
      name: Living Room
    - entity_id: sensor.outside_temperature
      name: Outside
      color: teal

- id: electricity
  type: graph
  title: Electricity
  chart: week
  colSpan: 2
  entities:
    - { entity_id: sensor.heat_pump_energy, name: Heat pump }
    - { entity_id: sensor.kitchen_energy, name: Kitchen }

- id: living_room_climate
  type: graph
  title: Living Room
  ranges: false
  range: 24h
  entities: [sensor.living_room_temperature, sensor.living_room_humidity]
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
| `icon` | string/object | Icon: Lucide (`lu-Lamp` or simple names like `lamp`), Material Design (`mdi:ceiling-light`), or an object `{ source, value }`. Defaults to the icon Home Assistant shows for the entity, which follows its state (e.g. `mdi:lightbulb-off` when off). |
| `on_state` | string | State value considered "on". If unset, anything except `off`, `unavailable` and `unknown` counts as on. |
| `off_state` | string | State value considered "off" (used when `on_state` is not set). |
| `attributes` | array | List of attributes to show in secondary text. |
| `color` | string | Highlight color when active. |
| `on_action` | object | `{ service: 'domain.service' }` to call when turning on. |
| `off_action` | object | `{ service: 'domain.service' }` to call when turning off. |
| `dialog` | boolean | Set to `false` to switch the entity from its tile instead of opening the control dialog. |

Only the entities listed here can be read through the API, and only their `on_action`/`off_action` can be called. For other entities the tile is clickable when both actions are set.

### Control dialog
Tapping the tile of a light, group (`group.*` or a light group), switch, `input_boolean` or fan opens its control
dialog; tapping its icon switches it on or off (with `on_action`/`off_action` when set). What the dialog shows depends
on what the entity can do, as Home Assistant reports it:

- **Color lights**: presets, hue and saturation, white temperature, brightness and power.
- **White lights**: white presets, temperature, brightness and power.
- **Dimmable lights**: brightness and power.
- **Lights that only switch, switches and fans**: one large power button.
- **Groups**: a list of their members with a switch and a brightness slider for all of them; each member opens
  its own controls. Members can be switched, dimmed and colored even if they are not on a card.

The presets are the light's **favorite colors** from Home Assistant (open the light in Home Assistant and edit the
colors under its controls), so they stay the same in both places. Lights without favorites of their own show
Glassboard's defaults: Warm, Neutral, Daylight, Sunset, Rose, Lavender, Ocean and Forest, as do all lights when the
token can't read Home Assistant's entity settings.

On phones the dialog is a sheet at the bottom of the screen, with the main controls at its bottom edge.

The card shows as many entities as fit its size: one as a quarter tile, two at half height, four per column otherwise.

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
      - entity_id: group.living_room_lights
        name: "Living Room"
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

## Single Thermostat (`thermostat`)
Shows and controls one Home Assistant `climate` entity: a vertical slider for the target temperature with the room
temperature marked on it, the current state (heating, cooling, idle or off) and presets. The layout follows the
card's size:

| Size | Shows |
|------|-------|
| `tileSize: quarter` | Slider, name with a state dot, target. Tapping the tile (outside the slider) turns the thermostat on or off. |
| `tileSize: half` | Slider, name, state badge, target and room temperature, and a row of preset chips plus **Off**. |
| `colSpan: 1` (default) | Slider, name, state badge, target and room temperature, and a list of presets plus **Off**. |

Drag the slider (or use the arrow keys) to change the target; it is sent when you let go. Choosing a preset or
moving the slider while the thermostat is off turns it on first.

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity_id` | string | required | The climate entity, e.g. `climate.living_room`. |
| `name` | string | entity name | Name shown on the card. |
| `hvac_mode` | string | `heat` | Mode used to turn the thermostat on (`heat`, `cool`, `heat_cool`, `auto`, ...). |
| `min` / `max` | number | entity limits | Range of the slider. Targets outside it are rejected by the server. |
| `presets` | array | | Presets to show instead of the entity's preset modes (see below). |

**Presets**: without `presets`, the card shows the entity's Home Assistant preset modes (except `none`) and
switches between them with `climate.set_preset_mode`; common modes get a matching icon. With `presets`, only these
are shown, in this order:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Label. |
| `temperature` | number | Sets this target temperature. |
| `preset` | string | Switches to this Home Assistant preset mode instead. With `presets` configured, only the modes listed here can be set. |
| `icon` | string | Lucide icon name, e.g. `Sun`, `Leaf`, `Moon`. |

The heating state comes from the entity's `hvac_action`, so it shows whether the heating is actually running.

### Example
```yaml
- id: living_climate
  type: thermostat
  entity_id: climate.living_room
  tileSize: half
  presets:
    - { name: Comfort, temperature: 21, icon: Sun }
    - { name: Eco, preset: eco, icon: Leaf }
    - { name: Night, temperature: 18.5, icon: Moon }
```

---

## Media Player (`mediaplayer`)
Now playing and controls for Home Assistant `media_player` entities, with cover art.

| Size | Shows |
|------|-------|
| `colSpan: 1` (default) | Cover art filling the card, the player name, a speaker button, and a frosted panel with a progress bar (drag it to seek), title, artist and previous / play / next. |
| `tileSize: half` | Cover on the left; name, speaker button, title, artist and controls on the right, progress along the bottom. |
| `tileSize: quarter` | Cover as background, name, title and a play/pause key. |

With several players the one-wide and half cards swipe between them (dots show which one is shown); the quarter
tile shows the first. Buttons a player does not support (e.g. seeking or skipping) are left out.

The speaker button opens a sheet with a volume slider for each speaker and, for players that support Home
Assistant grouping (e.g. Sonos), a check to add the speaker to the playing group or remove it. The number of grouped
speakers shows on the button.

Cover art is loaded through the Glassboard server, which adds the Home Assistant token, so the browser never needs
access to Home Assistant. Without art (and in demo mode) the card shows a gradient generated from the track.

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entities` | array | | Players to show: entity ids, or `{ entity_id, name }`. |
| `entity_id` | string | | A single player, instead of `entities`. |
| `speakers` | array | the players | Speakers listed in the speaker sheet: entity ids, or `{ entity_id, name }`. |

### Example
```yaml
- id: music
  type: mediaplayer
  entities:
    - media_player.living_room
    - { entity_id: media_player.kitchen_sonos, name: Kitchen }
  speakers:
    - media_player.living_room
    - media_player.kitchen_sonos
    - media_player.bedroom
```

---

## Multiroom Thermostat (`thermostats`)
Controls up to six Home Assistant `climate` entities in one card, loaded in a single request. The header shows how
many rooms are heating or cooling.

| Width | Shows |
|-------|-------|
| `colSpan: 1` | A row per room: name, state, room temperature and preset, then − target +. Tapping the room opens its presets. From five rooms on the rows are single-line. |
| `colSpan: 2` / `3` | A column per room: name, state badge, target, room temperature, a preset menu and ± keys. |

On phones the card is narrowed to one wide and shows rows. ± changes the target by the entity's step; on a room
that is off it turns the room back on at its last target. Each preset menu ends with **Off**.

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rooms` | array | required | Up to six rooms; further rooms are ignored. |
| `title` | string | `Climate` | Card title. |
| `presets` | array | | Presets for every room, instead of each room's Home Assistant preset modes. Same format as the [Single Thermostat](#single-thermostat-thermostat). |
| `hvac_mode` | string | `heat` | Mode used to turn a room on. |
| `min` / `max` | number | entity limits | Allowed target range. |

**Room Object**: `entity_id` (required) and `name`, plus `presets`, `hvac_mode`, `min` and `max` to override the
card's shared values for that room.

### Example
```yaml
- id: climate
  type: thermostats
  colSpan: 2
  presets:
    - { name: Comfort, temperature: 21, icon: Sun }
    - { name: Eco, preset: eco, icon: Leaf }
    - { name: Night, temperature: 18.5, icon: Moon }
  rooms:
    - entity_id: climate.living_room
    - entity_id: climate.bedroom
      presets:
        - { name: Sleep, temperature: 17, icon: Moon }
    - entity_id: climate.office
      name: Study
```

---

## Empty Space (`spacer`)
An invisible card that only takes up room, to shape the layout: to start a new row, leave a gap next to a wide
card, or fill the rest of a slot of half and quarter cards. It supports every size and has no options. In edit
mode it shows as a dashed outline. Spacers added in the browser are hidden on phones by default, where a single
column has no gaps to shape.

### Example
```yaml
- id: gap
  type: spacer
  tileSize: half
  hideOn: [phone]
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
