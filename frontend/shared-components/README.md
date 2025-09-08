# @sams/shared-components

Shared UI components library for SAMS Desktop and Mobile applications.

## Components

### LoadingSpinner

A unified loading spinner component with consistent styling and behavior across all SAMS applications.

#### Features
- Multiple size variants (small, medium, large)
- Color variants (primary, secondary, white)
- Custom logo variant support
- Full-screen overlay option
- Accessibility compliant
- Reduced motion support

#### Props
```typescript
interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'white';
  variant?: 'default' | 'logo';
  message?: string;
  fullScreen?: boolean;
  className?: string;
  show?: boolean;
}
```

#### Usage
```jsx
import { LoadingSpinner } from '@sams/shared-components';

// Basic usage
<LoadingSpinner />

// With message
<LoadingSpinner message="Loading data..." />

// Custom logo variant
<LoadingSpinner variant="logo" size="large" />

// Full-screen overlay
<LoadingSpinner fullScreen message="Processing..." />
```

## Hooks

### useLoadingSpinner

State management hook for loading operations with timeout protection.

#### Features
- Automatic timeout handling
- Error state management
- Async operation wrapper
- Cleanup on unmount

#### Usage
```jsx
import { useLoadingSpinner } from '@sams/shared-components';

const MyComponent = () => {
  const { isLoading, withLoading, error } = useLoadingSpinner({
    timeout: 10000
  });

  const handleOperation = async () => {
    await withLoading(async () => {
      // Your async operation
      await api.saveData();
    });
  };

  return (
    <div>
      {isLoading && <LoadingSpinner />}
      {error && <div>Error: {error.message}</div>}
      <button onClick={handleOperation}>Save</button>
    </div>
  );
};
```

## Installation

This package is designed to be used as a local dependency within the SAMS monorepo.

## Development

```bash
# Build the shared components
npm run build

# Watch for changes during development
npm run dev
```

## Custom Logo Integration

To use a custom Sandyland logo:

1. Replace `src/assets/sams-logo-spinner.svg` with your logo
2. Use the `variant="logo"` prop on LoadingSpinner components
3. The logo will automatically animate and scale to different sizes

## Architecture

This shared component library ensures:
- Consistent UI/UX across desktop and mobile
- Single source of truth for loading states
- Easy maintenance and updates
- Type safety with TypeScript
- Optimal bundle size with tree-shaking