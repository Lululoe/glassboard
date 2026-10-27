# Creating New Cards

This guide walks you through adding a new card type to the dashboard.

## 1. Create a Feature Directory
Create a new directory in `src/features/[FeatureName]`, e.g. `src/features/MyCard`.

## 2. Implement the Component
Cards receive their config entry as `config` and the full dashboard config as `globalConfig`.
Use `BaseCard` or `TwoToneBase` for the standard look. The grid applies `colSpan` itself.

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
