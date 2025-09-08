# LoadingSpinner Component System

A unified loading spinner system for SAMS that provides consistent loading feedback across all database operations. Extracted from the excellent spinner implementation in UserManagement and enhanced for system-wide use.

## Components

### LoadingSpinner Component

A flexible, accessible loading spinner component that provides consistent visual feedback.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | Size of the spinner |
| `color` | `'primary' \| 'secondary' \| 'white'` | `'primary'` | Color scheme of the spinner |
| `message` | `string` | `''` | Optional loading message to display |
| `fullScreen` | `boolean` | `false` | Whether to show as full-screen overlay |
| `className` | `string` | `''` | Additional CSS classes |
| `show` | `boolean` | `true` | Whether to show the spinner |

#### Basic Usage

```jsx
import { LoadingSpinner } from '../components/common';

// Basic spinner
<LoadingSpinner />

// With message
<LoadingSpinner message="Loading data..." />

// Small spinner for buttons
<LoadingSpinner size="small" color="white" />

// Full-screen loading overlay
<LoadingSpinner fullScreen message="Processing your request..." />
```

### useLoadingSpinner Hook

A React hook that provides loading state management with automatic error handling and timeout protection.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `30000` | Timeout in milliseconds (0 to disable) |
| `onTimeout` | `function` | `null` | Callback when timeout occurs |
| `onError` | `function` | `null` | Callback when error occurs |

#### Returned Values

| Property | Type | Description |
|----------|------|-------------|
| `isLoading` | `boolean` | Current loading state |
| `error` | `Error \| null` | Current error state |
| `startLoading` | `function` | Start loading state |
| `stopLoading` | `function` | Stop loading state |
| `setLoadingError` | `function` | Set error and stop loading |
| `withLoading` | `function` | Execute async function with loading state |
| `reset` | `function` | Reset all states |

#### Hook Usage

```jsx
import { useLoadingSpinner } from '../components/common';

const MyComponent = () => {
  const { isLoading, withLoading, error } = useLoadingSpinner({
    timeout: 10000,
    onTimeout: (error) => console.error('Operation timed out:', error)
  });

  const handleSave = async () => {
    await withLoading(async () => {
      const result = await api.saveData(data);
      // Handle success
    });
  };

  return (
    <div>
      {isLoading && <LoadingSpinner message="Saving..." />}
      {error && <div className="error">{error.message}</div>}
      <button onClick={handleSave} disabled={isLoading}>
        Save
      </button>
    </div>
  );
};
```

## Implementation Patterns

### 1. Basic Component Loading

For simple data loading states:

```jsx
const MyList = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await api.getData();
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading data..." />;
  }

  return <div>{/* Render data */}</div>;
};
```

### 2. Form Submission Loading

For form submissions with loading feedback:

```jsx
const MyForm = () => {
  const { isLoading, withLoading } = useLoadingSpinner();

  const handleSubmit = async (formData) => {
    await withLoading(async () => {
      await api.saveForm(formData);
      onSuccess();
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LoadingSpinner size="small" color="white" />
            <span>Saving...</span>
          </div>
        ) : (
          'Save'
        )}
      </button>
    </form>
  );
};
```

### 3. Button Loading States

For buttons that trigger async operations:

```jsx
const ActionButton = ({ onClick, children }) => {
  const { isLoading, withLoading } = useLoadingSpinner();

  const handleClick = async () => {
    await withLoading(onClick);
  };

  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? (
        <LoadingSpinner size="small" color="white" />
      ) : (
        <FontAwesomeIcon icon={faIcon} />
      )}
      <span>{children}</span>
    </button>
  );
};
```

### 4. Inline Loading

For loading states within larger components:

```jsx
const TransactionRow = ({ transaction }) => {
  const [isRecalculating, setIsRecalculating] = useState(false);

  return (
    <div className="transaction-row">
      {isRecalculating ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LoadingSpinner size="small" />
          <span>Recalculating...</span>
        </div>
      ) : (
        <div>{/* Normal content */}</div>
      )}
    </div>
  );
};
```

## Accessibility Features

- **ARIA Labels**: Proper `role="status"` and `aria-live="polite"` attributes
- **Screen Reader Support**: Loading messages are announced to screen readers
- **Reduced Motion**: Respects `prefers-reduced-motion` preference with shimmer animation fallback
- **Semantic Markup**: Uses appropriate HTML elements for accessibility

## Size and Color Variants

### Sizes
- **Small (20px)**: For buttons and inline elements
- **Medium (40px)**: Default size for most use cases
- **Large (60px)**: For major loading operations

### Colors
- **Primary**: Blue theme (default)
- **Secondary**: Gray theme
- **White**: For dark backgrounds and buttons

## Performance Considerations

- **Lightweight**: Minimal CSS and JavaScript overhead
- **No External Dependencies**: Pure CSS animations
- **Timeout Protection**: Prevents infinite loading states
- **Memory Leak Prevention**: Automatic cleanup on unmount

## Best Practices

1. **Always provide feedback**: Show loading states for operations > 200ms
2. **Use appropriate sizes**: Small for buttons, medium for components, large for full-screen
3. **Include meaningful messages**: Help users understand what's happening
4. **Handle timeouts**: Set reasonable timeouts for operations
5. **Disable interactions**: Prevent user actions during loading
6. **Consistent placement**: Keep loading indicators in predictable locations

## Migration from Old Loading States

### Before (UserManagement pattern)
```jsx
{loading && (
  <div className="user-management-loading">
    <div className="loading-spinner"></div>
    <p>Loading users...</p>
  </div>
)}
```

### After (New LoadingSpinner)
```jsx
{loading && <LoadingSpinner message="Loading users..." />}
```

### Before (Material-UI pattern)
```jsx
<CircularProgress size={30} />
<Typography variant="body2">Loading...</Typography>
```

### After (New LoadingSpinner)
```jsx
<LoadingSpinner message="Loading..." size="medium" />
```

## Integration Examples

### UserManagement (Preserved original functionality)
- Maintains exact same visual appearance
- Uses new component for consistency
- No breaking changes

### TransactionsView
- Balance recalculation with inline spinner
- Receipt generation button loading
- Transaction loading feedback

### HOADuesView
- Data loading with improved spinner
- Consistent with other components

### VendorFormModal
- Form submission loading
- Category loading feedback
- Button state management

### ModernBaseList
- Replaced Material-UI spinner
- Consistent loading experience
- Better accessibility

## Troubleshooting

### Common Issues

1. **Spinner not showing**: Check that `show` prop is `true` or not set
2. **Timeout not working**: Verify timeout value is > 0
3. **Accessibility warnings**: Ensure proper ARIA attributes are preserved
4. **Animation not smooth**: Check for CSS conflicts with transform properties

### Browser Support

- **Modern browsers**: Full animation support
- **Older browsers**: Graceful fallback to static indicator
- **Reduced motion**: Shimmer animation instead of rotation

This documentation provides comprehensive guidance for using the LoadingSpinner system consistently throughout SAMS.