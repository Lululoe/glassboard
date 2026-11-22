# Kiosk Mode

Kiosk mode turns a wall tablet into something like a smart display. When nobody uses the
screen it shows a clock, and it shows the dashboard once someone touches it or looks at it. It
turns the screen off when the room is empty. A full-screen player takes over while music plays,
and a control center slides down from the top.

## Turning it on

Kiosk mode is set **per browser**: add `?kiosk` to the dashboard's address, e.g.
`https://glassboard.local/?kiosk` (`?kiosk=1` and `?kiosk=true` also work; `?kiosk=0`, `false`, `off` and `no`
leave it off). Other screens that open the same dashboard are not affected.

The options are stored under `kiosk` in `config.yaml`. They can also be changed from edit mode in
**Settings** (the gear in the header) → **Kiosk Mode**, whether or not the screen is in kiosk mode; the clock
faces are drawn there to pick from. Options changed in edit mode are
saved in `layout.yaml`, like the rest of the layout. Every option is optional.

```yaml
kiosk:
  # Players that take over the screen when they start playing
  media_players: [media_player.kitchen, media_player.living_room]
  # The player whose volume the control center sets (default: the first player)
  volume_entity: media_player.kitchen
  # Seconds a paused player keeps the screen (default 300)
  pause_timeout: 300

  # lockscreen, analog, standby or stacked (default lockscreen)
  clock: lockscreen
  # A light sensor: below night_below lux the clock turns dark red (default 10)
  illuminance_entity: sensor.kitchen_illuminance
  night_below: 10
  # Weather shown on the clock
  weather_entity: weather.home

  # Control center: a brightness slider and up to 12 toggles
  brightness_entity: number.tablet_brightness
  toggles: [light.kitchen_ceiling, switch.extractor_hood, input_boolean.guest_mode]

  # Presence: someone in the room, a face looking at the screen, and the screen itself
  presence_entity: binary_sensor.kitchen_presence
  face_entity: binary_sensor.tablet_face_looking
  screen_entity: switch.tablet_screen
  # Seconds without a touch or a look before the clock comes back (default 60)
  idle_timeout: 60

  # Who is logged in on the tablet, shown in a bubble next to the app menu
  user_entity: sensor.tablet_face_id_person
  logout_entity: button.tablet_face_id_logout
```

| Option | Entities | Description |
| :--- | :--- | :--- |
| `media_players` | `media_player` | Up to 12 players that take over the screen. |
| `volume_entity` | `media_player` | The player the control center's volume slider sets. |
| `pause_timeout` | | Seconds (0–86400) a paused player keeps the screen. |
| `clock` | | The clock face: `lockscreen`, `analog`, `standby` or `stacked`. |
| `illuminance_entity` | `sensor` | Light level in lux; without one the clock is in night colours from 21:00 to 7:00. |
| `night_below` | | Lux (0–100000) below which it is night. |
| `weather_entity` | `weather` | Weather shown on the clock faces. |
| `brightness_entity` | `number`, `input_number` | The screen brightness, set within the entity's min and max. |
| `toggles` | `switch`, `input_boolean`, `light`, `fan` | Up to 12 on/off tiles in the control center. |
| `presence_entity` | `binary_sensor`, `input_boolean` | `on` while someone is in the room. |
| `face_entity` | `binary_sensor`, `input_boolean` | `on` while a face looks at the screen. |
| `screen_entity` | `switch`, `input_boolean` | Turns the tablet's display on and off. |
| `idle_timeout` | | Seconds (5–3600) the dashboard stays after the last touch or look. |
| `user_entity` | `sensor`, `text`, `input_text` | Who is logged in: its state is the person's name, or `none`. |
| `logout_entity` | `button`, `input_button`, `script` | Pressed (or run) by the bubble's Log Out button. |

## What the screen shows

- **Dashboard** while the screen is touched or a face looks at it (`face_entity` is `on`), and for `idle_timeout`
  seconds after that.
- **Clock** when someone is in the room (or presence is unknown) but nobody is using the screen.
- **Off** when `presence_entity` is `off`: the page goes black and, with a `screen_entity`, the display is
  switched off. It is switched on again when someone comes in. A touch always brings the dashboard back.

### Night colours

With a light sensor, the clock turns dark red on black below `night_below` lux. It turns back only once the light
is clearly brighter (1.5 times the threshold, or 2 lux more), so it doesn't flicker around the threshold.

## Media player takeover

When one of `media_players` starts playing, it fills the screen with its artwork, the track, a progress bar, the
transport controls and the volume. It stays as long as it plays, and for `pause_timeout` seconds once paused. It
goes away at once when the player stops. It never goes away just because nobody touches it.

To dismiss it, **swipe it down** (or tap the chevron). Every player that is playing or paused at that moment
stays dismissed until it starts playing again, so a grouped speaker doesn't take over right after. Tapping the now
playing tile in the control center brings the player back.

## Control center

Drag down from the top edge of the screen to open it, and tap outside it or press Escape to close it. It has:

- the now playing tile, with play/pause and skip (tap it for the full-screen player),
- tall sliders for brightness and volume (drag, or use the arrow keys),
- a tile for each toggle, with the icon Home Assistant shows for it,
- a **Clock** tile that shows the clock right away, until the screen is touched again.

## Who is logged in

With a `user_entity`, a round bubble with the person's initial appears next to the app menu in the header, but
only on kiosk screens and only while someone is logged in. The entity's state is the person's name. `none`, an
empty state, `unknown` and `unavailable` mean nobody is logged in. It is made for a face recognition sensor on
the tablet, but any sensor or text entity holding a name works.

The bubble shows the person's profile picture from Home Assistant, and their initial when they have none. The
picture is the one of the `person` entity with that display name, or with that name as its id (`Anna Maria` finds
`person.anna_maria`). Set it under **Settings › People** in Home Assistant.

Tapping the bubble shows the name and, when the entity has `since` and `expires` attributes (ISO times), since
when the person is logged in and until when. With a `logout_entity`, a **Log Out** button presses it (a script is
run instead). The bubble disappears at once, and comes back if the entity still names someone at the next
reading.

## Security

The browser can read only the entities named in the kiosk options, apart from the logout entity, which it can only
press. It can change only the brightness (within the entity's range), the screen switch and the toggles, and it
can control the media players. See
[Server API](SERVER_API#homeassistant).

## Things to set up on the tablet

- Open the dashboard with `?kiosk` in its address.
- Turn off any idle blanking of the tablet itself (a screensaver or `swayidle`). Otherwise it turns the screen off
  while kiosk mode wants the clock to show.
