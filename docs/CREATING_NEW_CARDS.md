# Creating New Cards

This guide walks you through adding a new card type to the dashboard.

## 1. Create a Feature Directory
Create a new directory in `src/features/[FeatureName]`, e.g. `src/features/MyCard`.

## 2. Implement the Component
Cards receive their config entry as `config` and the full dashboard config as `globalConfig`.
Use `BaseCard` or `TwoToneBase` for the standard look. The grid applies `colSpan` itself.

The grid passes the size the card is shown at: on narrow screens `config.colSpan` is lowered to the number of
columns, and half and quarter cards get `config.tileSize`. Base the layout on these values rather than on the
window width, so the card adapts when it is resized in edit mode.

```jsx
// src/features/MyCard/MyCard.jsx
import TwoToneBase from '../../components/Shared/TwoToneBase';

/**
 * Example card.
 * @param {Object} props
 * @param {Object} props.config - Card configuration from config.yaml.
 * @returns {JSX.Element} The rendered card.
 */
const MyCard = ({ config }) => (
    <TwoToneBase title="My Card" icon={config.icon || 'lu-Star'} subtitle="Custom Feature">
        <div className="my-card-content">Hello World</div>
    </TwoToneBase>
);

export default MyCard;
```

## 3. Register the Card
Add the component to `src/features/registry.js`. The key is the `type` used in `config.yaml` (lowercase):

```js
import MyCard from './MyCard/MyCard';

export const cardRegistry = {
    // ...
    mycard: MyCard,
};
```

Each card is wrapped in an error boundary, so a crash shows an error in that card instead of breaking the dashboard.

To make the card available in edit mode's **Add Card** list, describe it in `cardInfo` in the same file:

```js
import MyCardEditor from './MyCard/MyCardEditor';

export const cardInfo = {
    // ...
    mycard: {
        name: 'My Card',
        description: 'One line about what it shows',
        icon: 'lu-Star',
        sizes: ['quarter', 'half', '1', '2'], // optional, defaults to 1–3 columns
        defaults: { colSpan: 1, title: 'Hello' }, // optional, properties of a new card
        Editor: MyCardEditor,                    // optional settings form
        headerIcon: true,                        // optional, see below
    },
};
```

Set `headerIcon` when the card's `TwoToneBase` header reads `config.icon`, `config.iconColor` and
`config.iconBackground`. The card editor then shows the real card and offers those settings. It draws the card with its
saved options, inert and with a live icon and size, so the card must also render before it has its data.

Without `sizes`, edit mode offers one, two and three columns; list `half` and `quarter` only if the card works at
those sizes.

The optional `Editor` is a settings form shown in the card editor next to the YAML view. It receives the card's
config and an `onChange` that takes the updated config. Build it from the controls in
`src/components/Editor/EditorFields.jsx` (`TextField`, `NumberField`, `SegmentedField`, `ToggleField`, `ListField`)
and update values with `setIn` from `src/components/Editor/setIn.js`, which drops cleared fields:

```jsx
import { TextField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';

const MyCardEditor = ({ config, onChange }) => (
    <TextField label="Title" value={config.title} onChange={(v) => onChange(setIn(config, ['title'], v))} />
);
```

Cards without an editor can still be edited as YAML. Size and screen-size visibility are part of every editor
and do not need to be handled by the card.

## 4. Load Data (optional)
If the card needs data from a backend service, fetch it with `usePolling` and `callService`:

```js
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

export const useMyData = (cardId) => {
    const { data, loading, error } = usePolling(
        () => callService('myservice', { cardId }),
        { interval: 30000 }
    );
    return { items: data || [], loading, error };
};
```

`usePolling` pauses while the card's page is not shown or the browser tab is hidden, never runs two requests for
the same card at once, and keeps the last data when a request fails. Identical concurrent `callService` calls
(e.g. two cards of the same type) share one request.

## 5. Add a Backend Service (optional)
1. Create `server/services/myservice.js` exporting an async handler that receives the request parameters.
   Read credentials with `getServiceConfig` (environment variables, then `services.yaml`) and throw
   `HttpError` from `server/errors.js` for errors the client should see with a specific status.
2. Register the handler in `server/services/index.js` under the name the frontend passes to `callService`.
3. Never trust targets sent by the browser (URLs, repositories, entity ids). Pass a `cardId` and read the
   card's configuration with `findCard` instead, or validate against the config.

```js
import { findCard, getServiceConfig } from '../config.js';
import { HttpError, upstreamError } from '../errors.js';

export async function handleMyServiceRequest({ cardId }) {
    const card = findCard(cardId);
    if (!card) throw new HttpError(404, `Card not found: ${cardId}`);

    const { url, apiKey } = getServiceConfig('myservice', {
        url: { env: ['MYSERVICE_URL'] },
        apiKey: { env: ['MYSERVICE_API_KEY'] },
    });
    if (!url || !apiKey) throw new HttpError(503, 'MyService not configured');

    const response = await fetch(`${url}/api/items`, { headers: { 'X-Api-Key': apiKey } });
    if (!response.ok) throw await upstreamError('MyService', response);
    return response.json();
}
```

## 6. Add to Configuration
```yaml
- id: my_card_1
  type: mycard
  colSpan: 1
```

## 7. Styling
Create a CSS file (e.g., `MyCard.css`) and import it in your JSX. Use unique class names to avoid collisions.

## 8. Tests and Docs
Add Vitest tests next to the component, hook and service, and document the card's options in
[CARD_CONFIGURATION.md](CARD_CONFIGURATION.md).
