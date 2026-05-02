# Creating New Cards

This guide walks you through adding a new card type to the dashboard.

## 1. Create Feature Directory
Create a new directory in `src/features/[FeatureName]`.
Example: `src/features/MyCard`.

## 2. Implement the Component
Create your card component, typically using `BaseCard` or `TwoToneBase`.

```jsx
// src/features/MyCard/MyCard.jsx
import React from 'react';
import TwoToneBase from '../../components/Shared/TwoToneBase';

const MyCard = ({ config }) => {
    return (
        <TwoToneBase
            colSpan={config.colSpan || 1}
            title="My Card"
            title="My Card"
            icon={{ source: 'lucide', value: 'Star' }}
            subtitle="Custom Feature"
        >
            <div className="my-card-content">
                Hello World
            </div>
        </TwoToneBase>
    );
};


## 3. Register the Card
New cards are automatically registered if they follow the same naming convention as the existing cards (e.g. `src/features/[FeatureName]/[FeatureName].jsx`) and export a default component. Cards need to end in *Card.jsx.

## 4. Add to Configuration
Update `config.yaml` to include your new card.
- id: my_card_1
  type: mycard
  colSpan: 1
```

## 5. Styling
Create a CSS file (e.g., `MyCard.css`) and import it in your JSX. Use unique class names to avoid collisions.
