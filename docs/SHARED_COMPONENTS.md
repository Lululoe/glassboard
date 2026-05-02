# Shared Components

This document outlines the reusable components available for building dashboard cards.

## BaseCard

`src/components/Shared/BaseCard.jsx`

The foundational container for all cards. It handles the grid positioning (`colSpan`) and basic styling (glassmorphism effect).

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `colSpan` | number | 1 | Number of grid columns the card should span. |
| `children` | node | | Content to render inside the card. |
| `className` | string | | Additional CSS classes. |
| `style` | object | | Inline styles. |
| `hoverable` | boolean | true | Whether to apply hover scale effect. |

---

## TwoToneBase

`src/components/Shared/TwoToneBase.jsx`

A specialized card layout used by most feature cards (Weather, Media, etc.). It features a styled header with an icon, titles, and actions, followed by a content area.

### Props
| Prop | Type | Description |
|------|------|-------------|
| `colSpan` | number | Grid span. |
| `title` | string | Main title text. |
| `subtitle` | node | Secondary title or status text. |
| `icon` | string | Icon name (Lucide) or URL. |
| `iconBackground` | string | CSS background for the icon container. |
| `iconColor` | string | CSS color for the icon. |
| `actions` | node | React node for header actions (buttons). |
| `url` | string | URL the header should link to. |
| `children` | node | Card body content. |

---

## AppIcon

`src/components/Shared/AppIcon.jsx`

Renders an icon inside a rounded-square container, resembling a mobile app icon.

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | string | | Icon name or URL. |
| `background` | string | `var(--icon-background)` | CSS background for the box. |
| `color` | string | | Icon color. |
| `size` | string/number | `100%` | Size of the inner icon. |
| `className` | string | | Additional CSS classes (e.g., scoping styles). |

---

## Icon

`src/components/Shared/Icon.jsx`

Universal icon component that supports:
1. Lucide React icons (by name, e.g., "lu-Home").
2. Simple icons (by name, e.g., "sh-github").
3. Image URLs (http/https).

### Props
| Prop | Type | Description |
|------|------|-------------|
| `icon` | string | The icon identifier. |
| `size` | number | Size in pixels. |
| `className` | string | CSS class. |

## Icon Configuration

The system now primarily supports a structured object format for icons, allowing explicit definition of source, value, and optional color. String formats are supported for backward compatibility.

### Object Format (Recommended)
```yaml
icon:
  source: "lucide" # Options: "lucide", "sh", "local", "url"
  value: "Server"  # The icon name or URL
  color: "#ff0000" # Optional: Override icon color
```

### Sources

#### 1. Lucide
*   **Source**: `lucide`
*   **Value**: PasalCase icon name (e.g., `Home`, `HardDrive`).
*   **Legacy String**: `lu-Home`

#### 2. Dashboard Icons (SH)
*   **Source**: `sh`
*   **Value**: Kebab-case name (e.g., `home-assistant`, `plex`).
*   **Legacy String**: `sh-home-assistant`

#### 3. Local Icons
Icons stored in `public/icons`.
*   **Source**: `local`
*   **Value**: Filename without extension (e.g., `my-icon`).
*   **Legacy String**: `local-my-icon`

#### 4. URLs
*   **Source**: `url`
*   **Value**: Full HTTP/HTTPS URL.
*   **Legacy String**: `https://...`
