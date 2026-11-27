# Plugins

Every card in Glassboard comes from a plugin. The cards most dashboards use are built in; others can be
installed as plugins, the way Home Assistant installs custom components. A plugin can add card types in the
browser, services on the server, or both.

This page covers using plugins and writing your own. For the cards inside Glassboard itself, see
[Creating New Cards](CREATING_NEW_CARDS).

## Using Plugins

### The Plugins folder

Glassboard loads every plugin in its plugins folder when it starts: `plugins/` next to `config.yaml`, or the
folder `PLUGINS_DIR` names. Each plugin has its own folder, named after its id:

```
plugins/
  hello/
    plugin.json
    server.js
    dist/
      client.js
      style.css
```

In Docker the folder is `/app/plugins`. Mount it as a volume to keep plugins across updates of the image (see
`docker-compose.yml`). Glassboard runs as uid 1000 there, so to install plugins from the settings window the folder
must be writable by it.

A plugin that fails to load is skipped and listed under **Couldn't Load** in the Plugins section of the
settings window, with the reason. It never stops Glassboard from starting.

### Installing from the settings window

Plugins can be installed from a GitHub repository in **Settings → Plugins → Add Plugin**. This is off by
default, since a plugin's code runs on the server with access to every credential in `services.yaml`. To turn
it on, set both of these in `config.yaml`:

```yaml
editable: true
plugins:
  install: true
```

Changing plugins needs the edit password, like every other change (see
[Card Configuration](CARD_CONFIGURATION)).

Enter the repository as `owner/repository` or its URL and choose **Review**. Glassboard downloads its latest
release: a `.tgz` or `.tar.gz` attached to the release if there is one, else the release's source, else the
default branch. Add `@v1.2.0` (or `#main`) for a particular tag, branch or commit.

Nothing is installed yet. The review shows what to check first:

- the plugin's name, version and description, and whether it runs code on the server;
- its repository on GitHub, its owner, stars, when it was created (new repositories are pointed out) and last
  changed, and whether it is archived;
- the release, the exact commit, and the SHA-256 hash of the download, and the release notes;
- a warning when it isn't from a release, but from a branch as it is right now.

**Install** installs exactly that download, within 10 minutes. Installed plugins load at once, with no restart.

Glassboard records where each plugin came from in its folder, in `.glassboard-source.json`: the repository, the
release, the commit and the hash. **Update…** looks up the newest release and shows the same review, with the
installed and new versions. Updates never happen on their own. If the installed release's tag now points at
different code, or the file attached to it was replaced, Glassboard refuses it and says so: someone changed the
release after you installed it. If the new version fails to load, the old one is put back.

**Remove** deletes the plugin's folder; cards of its types stay in the layout and say their plugin isn't
installed.

When an update or removal replaces a plugin's server part, the old code may stay in memory until Glassboard
restarts. The settings window says so when it matters.

Only install plugins you trust. Turn installing off again when you don't need it.

## Writing a Plugin

A complete example is in [`examples/hello-plugin`](https://github.com/Lululoe/glassboard/tree/main/examples/hello-plugin):
a card that shows a greeting from its own server service.

### `plugin.json`

```json
{
  "id": "hello",
  "name": "Hello",
  "version": "1.0.0",
  "description": "Greets you with the server's time.",
  "glassboard": "^2.0.0",
  "assets": "dist",
  "client": "client.js",
  "style": "style.css",
  "server": "server.js",
  "repository": "https://github.com/you/glassboard-hello"
}
```

| Field | | |
| --- | --- | --- |
| `id` | required | Lowercase letters, digits and dashes, starting with a letter. The folder must have this name. |
| `name` | required | Shown in the settings window. |
| `version` | required | Such as `1.0.0`. |
| `glassboard` | required | The Glassboard versions it works with, as an npm-style range such as `^2.0.0` or `>=2.0.0 <3`. |
| `assets` | | The folder the browser may load files from. Defaults to `dist`. Nothing else in the plugin's folder is served. |
| `client` | | The browser module, relative to `assets`. |
| `style` | | A stylesheet, relative to `assets`. |
| `server` | | The server module, relative to the plugin's folder. |
| `description`, `repository` | | Shown in the settings window. |

A plugin needs a `client` or a `server`, or both.

### The browser part

The browser module's default export is the plugin, with the same id as `plugin.json`. Its `register` function
adds card types exactly like the built-in plugins do (see [Creating New Cards](CREATING_NEW_CARDS)):

```jsx
import HelloCard from './HelloCard';
import HelloEditor from './HelloEditor';

export default {
    id: 'hello',
    name: 'Hello',
    register(api) {
        api.registerCard('hello', {
            Component: HelloCard,
            name: 'Hello',
            description: 'A greeting from the server',
            icon: 'lu-Hand',
            sizes: ['1', '2'],
            defaults: { name: '' },
            Editor: HelloEditor,
        });
    },
};
```

Card types are global: a plugin can't register a type another plugin, or Glassboard, already has.

#### React and the SDK

A plugin uses the dashboard's own React and components. Import them as usual; Glassboard's page has an import
map that points these imports at the copies the dashboard runs:

| Import | |
| --- | --- |
| `react`, `react/jsx-runtime`, `react-dom` | The dashboard's React. Hooks only work with this copy. |
| `@glassboard/sdk` | Glassboard's components and helpers. |

`@glassboard/sdk` exports:

- **Cards**: `BaseCard`, `TwoToneBase`, `StatusPill`, `UsageBar`, `EmptyState`, `Icon`
  (see [Shared Components](SHARED_COMPONENTS))
- **Editor forms**: `Field`, `Group`, `TextField`, `NumberField`, `SegmentedField`, `ToggleField`, `ListField`,
  `EntityPicker`, `EntityListPicker`, `setIn`
- **Data**: `callService`, `usePolling`, `BACKGROUND_FAST`, `BACKGROUND_SLOW`, `useHomeAssistant`, `useNow`,
  `useCardNotice`
- **Layout and theme**: `useElementSize` (follows an element's size), `useTheme` (light or dark, the style and
  accent)
- **Formatting**: `formatUsage`, `formatRelativeTime`, `formatFullTime`, `plural`, `usageLevel`, `chartColor`
  (the graph card's colors, by name or in order)
- `GLASSBOARD_VERSION`

Leave these imports out of the bundle. Bundle anything else the plugin needs.

#### Building

Build the browser part as one ES module with Vite's library mode:

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        cssCodeSplit: false,
        lib: { entry: 'src/index.jsx', formats: ['es'], fileName: () => 'client.js', cssFileName: 'style' },
        rollupOptions: { external: ['react', 'react/jsx-runtime', 'react-dom', '@glassboard/sdk'] },
    },
});
```

Use the theme's CSS variables (`--text-primary`, `--bg-fill`, `--color-primary` and so on, see
[Theming](THEMING)) so the card follows the theme, and prefix class names with the plugin's id so they don't
clash.

### The server part

The server module exports `setup(ctx)`, which returns the plugin's services:

```js
export function setup(ctx) {
    const hello = ({ cardId }) => {
        const card = ctx.config.findCard(cardId);
        if (card?.type !== 'hello') throw new ctx.errors.HttpError(404, `Not a hello card: ${cardId}`);
        return { greeting: `Hello, ${card.name || 'there'}!` };
    };
    return { services: { hello }, demo: { hello } };
}
```

`setup` runs once and must not be `async`. It returns:

| | |
| --- | --- |
| `services` | Functions the browser calls with `callService(name, params)`. They get the request's parameters and return JSON, or a promise of it. Service names are global, like card types. |
| `demo` | The same services for demo mode, returning made-up data. |
| `routes(router)` | Adds Express routes under `/api/plugins/<id>/`, for what JSON can't carry, such as pictures. |

`ctx` gives the plugin:

| | |
| --- | --- |
| `ctx.id` | The plugin's id. |
| `ctx.config` | `findCard(id)`, `getAllCards()`, `getConfig()`, and `getServiceConfig(name)` for credentials from `services.yaml`. |
| `ctx.errors` | `HttpError(status, message)` to answer with an error, and `upstreamError`. |
| `ctx.logger` | `info`, `warn` and `error`, tagged with the plugin's id. |
| `ctx.isDemoMode()` | Whether Glassboard runs in demo mode. |
| `ctx.homeassistant` | Calls to Home Assistant with the dashboard's token: `request`, `fetchRaw`, `getEntityState`, `liveCommand`, and `registerEntityIds(source)` to allow the entities the plugin's cards name. |

Take what a service acts on from the card's settings (`findCard(cardId)`), never from the request, so a request
can't reach entities or hosts the dashboard's owner didn't configure.

The server module can import Node's built-in modules. It can't import npm packages Glassboard doesn't have:
bundle them into the file.

### Publishing

Put the plugin in a GitHub repository with `plugin.json` at its top. Either commit the built `dist` folder,
or attach a `.tgz` of the plugin's folder to a GitHub release, which Glassboard prefers. Tag releases with the
version in `plugin.json`.

Never move a tag or replace a release's file after publishing: Glassboard refuses to update a plugin whose
installed release changed, since that is what a hijacked repository looks like. Publish a new version instead.
