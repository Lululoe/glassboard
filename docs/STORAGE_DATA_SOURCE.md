# Storage data source

Live data for the `storage` card (and a planned `zfspool` card). A scanner on the Proxmox host (`pve-01`) writes metrics that
Prometheus scrapes, so the cards read Prometheus rather than talking to Proxmox. The scanner lives in the homelab repo
as the Ansible role `proxmox_storage_scan`. Its README lists every metric.

## Where to read it

- **API:** `http://192.168.68.59:9090/api/v1/query?query=<PromQL>` is the Prometheus instant-query API. It's on the
  LAN, with no auth.
- **Response:** `data.result[]` contains objects of the form `{ metric: {labels…}, value: [ts, "string number"] }`.
  Values arrive as strings, so parse them as numbers.
- **Where to call it:** call it from the Glassboard server, like the other services in `server/services/`, and not
  from the browser. Make the Prometheus URL a service config entry (env `PROMETHEUS_URL`).
- **Units:** all values are **bytes**, ratios from 0 to 1, or Unix seconds. The cards use decimal GB, so divide
  bytes by `1e9`.
- **Labels on every series:**
  - `instance="pve-01"` and `job="proxmox-storage"`.
  - `target` is the guest or host that a filesystem belongs to: `proxmox`, `docker-node-01`, `docker-node-02`,
    `docker-node-03`, `tailscale` or `ansible-runner`.

## How fresh it is

| Scan | Runs | Covers |
|---|---|---|
| `health` | every 5 min | Pool state, vdevs, errors, scrub, SMART |
| `usage` | every 15 min | Filesystem sizes, Proxmox storages, Docker, cleanup estimates |
| `content` | 03:30 nightly | What uses the space: category and file type, largest folders |

A finished run updates `storage_scan_last_success_timestamp_seconds{mode="health|usage|content"}`. If a value is
much older than the schedule above, the card should show that its data is stale.

## `zfspool` card ← health metrics (planned, not built yet)

Use these queries with `pool="tank"`:

| Card field | PromQL | Notes |
|---|---|---|
| `name` | label `pool` | |
| `state` | `storage_zpool_health{pool="tank"} == 1` → label `state` | There is one series per possible state, and only the current state has value 1. |
| `size` | `storage_zpool_size_bytes` | ÷ 1e9 |
| `alloc` | `storage_zpool_allocated_bytes` | ÷ 1e9 |
| `frag` | `storage_zpool_fragmentation_ratio` | × 100 |
| `scan.end` | `storage_zpool_scrub_last_end_timestamp_seconds` | Unix seconds. Label `function` is `scrub` or `resilver` and gives `scan.type`. |
| `scan.errors` | `storage_zpool_scrub_errors` | |
| `scan.state` | `storage_zpool_scan_in_progress` | 1 means `running`, 0 means `finished`. |
| `vdevs` | `storage_zpool_vdev_online{pool="tank"}` | Each series carries the labels `vdev`, `vdev_type` (`mirror`, `raidz2`, `disk`…), `state`, `parent` (only on disks) and `path`. A top-level vdev has no `parent`. A disk's `parent` is its vdev. |
| disk `read`/`write`/`cksum` | `storage_zpool_vdev_errors{pool="tank"}` | Label `kind` is `read`, `write` or `checksum`, and the series joins to the vdev on the label `vdev`. |

What the metrics don't provide:
- **Scrub progress:** there is no `scan.progress`, `scan.eta` or `scan.repaired`. Show a running scrub without a
  percentage.
- **Status message:** there is no `status` text.
- **Disk names:** a disk's `vdev` label can be a long id such as `gptid/88ef8b62-…`. Show the basename of `path`
  (`sda2`) when it exists, or a shortened id otherwise.

**Current state:** `tank` is a two-disk mirror running DEGRADED. Disk `sda2` is ONLINE, and the other disk is
REMOVED. That means the card's warning states will show up in real data straight away.

SMART health per physical disk (optional):
- `storage_smart_passed{device}` is 1 when the disk passes.
- `storage_smart_temperature_celsius{device}` gives the temperature.
- `storage_smart_info{device,model,serial,capacity_bytes,rotational}` gives the disk's identity.

## `storage` card ← usage and content metrics

The card needs `total` and `categories[{name, size}]` in GB. Two volumes make sense.

**1. The tank pool** (media, photos, backups):

```promql
storage_zpool_size_bytes{pool="tank"}                                          # total
sum by (category) (storage_content_bytes{target="proxmox", category=~"zfs_.*"})  # categories
```

- **Categories:** `zfs_media`, `zfs_photos`, `zfs_proxmox` (VM disks and dumps), `zfs_datashare`, `zfs_backups`,
  `zfs_paperless`.
- **Totals:** the categories add up to less than `storage_zpool_allocated_bytes`, because snapshots and metadata
  aren't in any folder. Add the difference as an extra category (for example "Snapshots & other") so that used space
  matches the pool.

**2. A guest's root disk**, for example `docker-node-01`:

```promql
storage_fs_size_bytes{target="docker-node-01", mount="/"}                      # total
sum by (category) (storage_content_bytes{target="docker-node-01", mount="/"})   # categories
```

- **Other mounts:** `docker-node-02` has a second disk at `mount="/mnt/downloads"`.
- **Used space:** `storage_fs_used_bytes` gives it every 15 min. The content walk only runs nightly.

**Category labels and suggested names:**

| Label | Name |
|---|---|
| `system` | System |
| `app_data` | Apps |
| `docker_images` | Docker images |
| `docker_volumes` | Docker volumes |
| `docker_build_cache` | Build cache |
| `downloads` | Downloads |
| `downloads_incomplete` | Downloads (incomplete) |
| `journal` | Journal |
| `logs` | Logs |
| `cache` | Cache |
| `temp` | Temp |
| `home` | Home |
| `pve_backups` | Proxmox backups |
| `pve_templates` | Templates |
| `pve_import` | Import |
| `zfs_media` | Media |
| `zfs_photos` | Photos |
| `zfs_proxmox` | VM disks & dumps |
| `zfs_datashare` | Data share |
| `zfs_backups` | Backups |
| `zfs_paperless` | Paperless |

**Other useful series:**
- **By file type:** `storage_content_bytes` also has a `filetype` label: `video`, `image`, `audio`, `document`,
  `archive`, `disk_image`, `database`, `backup`, `log`, `subtitle` and `other`. Sum by it to show a file-type view
  instead of categories.
- **Cleanup estimates:** `storage_reclaimable_bytes{target,item,risk,detail}` estimates how much a cleanup would
  free. `risk` is `safe` or `review`, and `detail` is a short hint such as `apt-get clean`. A good card description is
  "X GB can be freed".
- **Hidden space:** `storage_content_unaccounted_bytes{target,mount}` counts space the walk can't see, for example
  data hidden under a mount point.
