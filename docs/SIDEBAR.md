# Sidebar

The sidebar is an optional, floating rail of the dashboard's pages. It sits at the left edge on wide screens and
above the bottom edge on phones. Each page has an icon, pages can be grouped in folders that open beside the
rail, and an icon shows a colored bubble when cards on its page need attention.

The sidebar is off by default. With it on, it replaces the page dots and the previous/next arrows; swiping and
the arrow keys still go through the pages in the order of `config.yaml`.

## Turning it on

In edit mode, use the sidebar button in the header bar, then **Done**. Or in `config.yaml`:

```yaml
sidebar:
  enabled: true
```

That is all it needs. Every page shows with the first letter of its name, in the order of the dashboard.
Hidden pages (`hidden: true`) are left out, except in edit mode.

## Arranging icons

In edit mode the icons have a dashed outline and can be arranged directly:

- **Drag** an icon to move it. A blue line shows where it lands.
- **Drop an icon on the middle of another** to put both in a new folder, or on a folder to add it to the folder.
  A blue ring shows the icon it would join.
- **Open a folder** and drag its pages to reorder them, or out onto the rail to take them out. A folder that is
  down to one page opens up by itself.
- **Select an icon** to change it: the same icon picker, icon color and background as the icons of cards and
  apps. The pencil button at the end of an open folder changes the folder's name and icon, or removes it while keeping
  its pages.
- With the keyboard, **Shift and an arrow key** moves the focused icon. **Escape** cancels a drag.

Changes are saved with the rest of the dashboard in `layout.yaml` when you press **Done**.

## Configuration

Everything set in the browser can also be written in `config.yaml`:

```yaml
sidebar:
  enabled: true
  items:
    - page: home
      icon: lu-House
    - page: admin
      icon: mdi:server
      iconBackground: "#5e5ce6"
      iconColor: "#ffffff"
    - folder: rooms
      name: Rooms
      icon: lu-DoorOpen
      pages:
        - page: living
          icon: lu-Sofa
        - page: kitchen
          icon: lu-Utensils
```

| Option | Description |
|--------|-------------|
| `enabled` | Shows the sidebar. Off by default. |
| `items` | Pages and folders in order. Pages that are not listed follow at the end, so new pages always show. |
| `page` | The page's `id` (or its position from 0 for pages without one). |
| `folder` | Id of a folder; folders can't be inside folders. |
| `name` | A folder's name. Pages show their own `name`. |
| `pages` | A folder's pages. |
| `icon`, `iconColor`, `iconBackground` | The icon, as for [card icons](CARD_CONFIGURATION#editing-icons). Without an icon, a page shows its first letter and a folder a folder icon. |

## Notifications

Cards can tell the sidebar that something needs attention, and the sidebar needs no settings for it. Each icon
shows a bubble with a count; a folder adds up its pages. Pointing at an icon lists what each card reported.

| Bubble | Level | Meaning | Examples |
|--------|-------|---------|----------|
| Red | `alert` | Something is broken | An app is offline, a VM stopped |
| Blue | `todo` | Something waits for you | Open pull requests, a paused print |
| Green | `activity` | Something is running | A print or download in progress |

The most urgent level decides the bubble's color and number. A card can be kept out with `notify: false`, or
only some levels with e.g. `notify: { activity: false }` (see [Card Configuration](CARD_CONFIGURATION#global-options)).

### What each card reports

| Card | 🔴 Alert | 🔵 To do | 🟢 Activity |
|------|---------|---------|-------------|
| App Grid | Apps that fail their status check | | |
| Pull Requests | | Open pull requests (not drafts) | |
| Vacuum, Multiple Vacuums | A robot with an error | Parts that need replacing, as their bars show | A robot cleaning or returning to its dock |
| 3D Printer | A failed print, or one the printer paused itself (e.g. filament ran out) | A print you paused | A print in progress |
| Transmission | Torrents with an error, or Transmission can't be reached | Stalled torrents | Downloads in progress |
| Server Stats | Temperature at 85 °C or more, storage 90 % full or more (only rows the card shows) | | |
| Proxmox | The host can't be reached | | |
| Media Calendar | | Releases that have come out but aren't downloaded | |
| HA Control | The device is unavailable | A lock that is unlocked or open | |
| Thermostat, Multiroom Thermostat | A thermostat that is unavailable | | |

Graph, Weather, Media Player, Container and Empty Space report nothing: a graph or forecast has nothing to act
on, and music playing would show as activity all day. The cards inside a Container report as themselves.

Cards keep checking at a slower pace while their page isn't shown (every minute for Home Assistant cards, every
five minutes for the others), so the bubbles stay current. A hidden browser tab pauses them.

How a card reports is described in [Creating New Cards](CREATING_NEW_CARDS#9-report-notices-optional).
