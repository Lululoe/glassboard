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

## Auto-Hide
`headerAutoHide` at the top level of `config.yaml` lets the header bar hide itself, so the page gets the whole
screen:

| Value | The bar |
|-------|---------|
| `never` (default) | always shows. |
| `with-page-header` | hides on pages that show a [page header](#page-header), which has the time already. |
| `always` | hides on every page. |

A hidden bar comes back when the pointer moves to the top edge of the screen, when the handle at the top of a
touch screen is tapped, or when it is reached with the keyboard (Tab). It stays while it is used and while its
menu is open, then hides again: a moment after the pointer leaves it, or a few seconds after the last tap. It
never hides in edit mode, so **Done** is always at hand.

```yaml
headerAutoHide: with-page-header
```

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

---

## Page Header
An optional header above the cards of a page: a large title line (the time by default) under a smaller subtitle
(the date by default), with small widgets next to or below them.

The header is off unless `pageHeader` is set. Set it at the top level of `config.yaml` for every page, on a page for
that page only, or both: a page's `pageHeader` is merged over the top-level one, and `pageHeader: false` on a page
turns it off there. Iframe pages never show it.

```yaml
pageHeader: true                # the defaults: date above a 24-hour clock, left aligned

pages:
  - id: home                    # uses the header above
  - id: media
    pageHeader: false           # no header on this page
  - id: house
    pageHeader:                 # only changes the title on this page
      title: { type: greeting, color: primary }
```

| Option | Type | Description |
|--------|------|-------------|
| `align` | string | `left` (default): the lines on the left, the widgets on the right. `right`: mirrored. `center`: everything in the middle. |
| `layout` | string | Where the widgets go. `auto` (default): next to the lines while they all fit in one row, otherwise below. `side-by-side`: always next to the lines, wrapping into more rows, until not even the widest widget fits. `stacked`: always below. |
| `style` | string | `colored` (default): widgets in their own colors and lines in theirs. `monochrome`: everything in the text color, like the lock screen; line colors are ignored and the subtitle is shown a little quieter. |
| `locale` | string | Language for month and weekday names, e.g. `de-DE`. The browser's language by default. |
| `title` | object, string or `false` | The large line. A string is shown as text; `false` leaves it out. |
| `subtitle` | object, string or `false` | The smaller line above it. A string is shown as text; `false` leaves it out. |
| `widgets` | list | Small widgets showing Home Assistant entities, see [Widgets](#widgets). A page's own list replaces that of all pages. |
| `enabled` | boolean | `false` turns the header off while keeping its settings. |

Next to each other, the widgets line up with the bottom of the title's letters.

### Widgets
Widgets show the value of a Home Assistant entity, like the widgets on a lock screen. They need Home Assistant to be
set up (see [Card Configuration](CARD_CONFIGURATION)); in demo mode sensors show simulated values.

```yaml
pageHeader:
  widgets:
    - type: ring                         # a ring filled up to the value
      entity_id: sensor.living_room_humidity
      color: teal
    - type: gauge                        # an open ring with a dot at the value
      entity_id: sensor.outside_temperature
      min: -10
      max: 35
    - type: number                       # icon and value, no ring
      entity_id: sensor.cpu_usage
      icon: mdi:cpu-64-bit
    - type: rectangle                    # one or two values, three circles wide
      entity_id: sensor.power
      entity_id2: sensor.energy_today
      color: yellow
      condition:                         # only shown while the power is above 1000
        operator: above
        value: 1000
```

| Option | Type | Description |
|--------|------|-------------|
| `type` | string | `ring` (default), `gauge`, `number` or `rectangle`. |
| `entity_id` | string | The entity whose value is shown. |
| `entity_id2` | string | `rectangle` only: a second value, shown under the first. |
| `name` | string | `rectangle` only: shown under the value when there is no second entity. The entity's name by default. |
| `min` / `max` | number | `gauge`: the lowest and highest value (0 and 100 by default). `ring`: `max`. Entities measured in `%` always run from 0 to 100. |
| `icon` | string | An icon such as `mdi:thermometer` or `lu-Zap`. By default the entity's icon in Home Assistant, or one that fits its unit. |
| `color` | string | As for the lines; the text color by default. Ignored in a monochrome header. |
| `condition` | object | Shows the widget only while its entity's value matches: `operator` is `above`, `below` (numbers), `equals` or `not_equals` (the state, ignoring case), and `value` what it is compared with. |
| `id` | string | Set by the editor; identifies the widget. |

Values update every 10 seconds. In circles, values of 10 and more are rounded to whole numbers and temperatures get a
degree sign. The dashboard reads only the entities of its cards and widgets from Home Assistant.

### Editing in the browser
In edit mode the header has its own editors, like the cards:

- **Header** (the pencil on its corner): show or hide it, its style (colored or monochrome), its alignment, where the
  widgets go, and the language.
- **Title** and **Subtitle** (tap the line): what it shows, the clock or date format (common formats, or a custom
  one), the text, and the color. A hidden line keeps a dashed button to add it back.
- **Widgets**: each widget has a pencil that opens its editor (kind, entity, range, icon, color, condition, or
  remove it), and **+** after the last one adds a widget. Widgets hidden by their condition are shown dimmed while
  editing. A new entity's value shows once the dashboard is saved with **Done**. On the **This page** tab of
  **Header**, **Widgets: Own** gives the page its own widgets, starting as a copy of those of all pages.
- **Add Header**: shown where a page has no header.

Each editor has two tabs: **All pages**, and **This page**, which follows all pages or has its own settings. Changes
are saved to `layout.yaml` and replace the `pageHeader` of `config.yaml` (and a page's own `pageHeader`) until
**Reset**. Template lines can be recolored, hidden or switched to something else in the browser, but their templates
are always the ones written in `config.yaml`: the browser can't add or change a template, and templates in
`layout.yaml` are ignored.

### Lines
`title` and `subtitle` take the same options.

| Option | Type | Description |
|--------|------|-------------|
| `type` | string | `clock` (the title's default), `date` (the subtitle's default), `text`, `greeting` or `template`. |
| `format` | string | For `clock` and `date`: how the time or date is written, see below. `HH:mm` and `dddd, D MMMM` by default. |
| `text` | string | For `text`: the text to show. |
| `template` | string | For `template`: a Home Assistant template, see below. |
| `refresh` | number | For `template`: seconds between updates, at least 10. 60 by default. |
| `color` | string | `text` (the title's default), `red` (the subtitle's default), `primary`, `secondary`, `orange`, `yellow`, `green`, `teal`, `cyan`, `blue`, `indigo`, `purple`, `pink`, `gray`, `white`, `black`, or a `#hex`, `rgb()`, `hsl()` or `var(--…)` color. Named colors follow light and dark mode. |

`greeting` says "Good morning" from 5:00, "Good afternoon" from 12:00, "Good evening" from 18:00 and "Good night"
from 22:00.

#### Time and date formats
| Token | Shows | | Token | Shows |
|-------|-------|-|-------|-------|
| `YYYY` / `YY` | 2026 / 26 | | `HH` / `H` | 24-hour, 09 / 9 |
| `MMMM` / `MMM` | November / Nov | | `hh` / `h` | 12-hour, 09 / 9 |
| `MM` / `M` | 11 / 11 | | `mm` / `m` | minutes, 05 / 5 |
| `dddd` / `ddd` | Tuesday / Tue | | `ss` / `s` | seconds, 07 / 7 |
| `DD` / `D` | 10 / 10 | | `A` / `a` | AM / am |

Text in square brackets is shown as it is: `H [Uhr] mm` shows "9 Uhr 05". A clock with seconds updates every second,
otherwise every minute.

```yaml
pageHeader:
  align: center
  locale: en-US
  title: { type: clock, format: "h:mm A" }
  subtitle: { type: date, format: "dddd, MMMM D", color: secondary }
```

### Home Assistant templates
A line of `type: template` shows a [Home Assistant template](https://www.home-assistant.io/docs/configuration/templating/),
rendered by Home Assistant and updated every `refresh` seconds:

```yaml
pageHeader:
  title:
    type: template
    template: "{{ states('sensor.living_room_temperature') }} °C"
  subtitle:
    type: template
    template: "{{ states('sensor.people_home') }} people home"
    refresh: 300
```

Templates are rendered safely:

- **Only from the config.** The browser asks for "the title of page `home`", never sends a template, and the server
  renders only the template written in the config files for that line. Templates can't be set in the browser.
- **Read-only.** Home Assistant renders templates in a sandbox: they can read states but can't call services or
  change anything. They can read every entity the access token can, so the token decides what a template could show.
- **Plain text.** The result is shown as text, never as HTML, on one line of at most 200 characters.
- **Rate-limited.** Each template is rendered at most once every 10 seconds, however many browsers show it, and a
  render that takes longer than 5 seconds is given up.

While a template loads the line shows "…", and it stays empty if Home Assistant reports an error. In demo mode
`{{ … }}` parts show a simulated number.
