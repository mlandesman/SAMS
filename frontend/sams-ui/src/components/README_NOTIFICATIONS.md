# Notification Modal System

A reusable notification modal system for SAMS with built-in support for success, error, warning, and info messages.

## Components

### NotificationModal
A flexible modal component for displaying notifications with different types and styles.

### useNotification Hook
A custom React hook that provides easy-to-use functions for managing notifications.

## Usage

### Basic Usage

```jsx
import React from 'react';
import NotificationModal from './components/NotificationModal';
import { useNotification } from './hooks/useNotification';

const MyComponent = () => {
  const { 
    notification, 
    closeNotification, 
    showSuccess, 
    showError, 
    showWarning, 
    showInfo 
  } = useNotification();

  const handleSuccess = () => {
    showSuccess(
      'Operation Successful!',
      'Your action has been completed successfully.',
      [
        { label: 'Transaction ID', value: 'TXN-12345' },
        { label: 'Amount', value: 'MX$ 1,000.00' }
      ]
    );
  };

  const handleError = () => {
    showError(
      'Operation Failed',
      'Something went wrong. Please try again.',
      [{ label: 'Error Code', value: 'ERR-404' }]
    );
  };

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
      
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={closeNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        details={notification.details}
      />
    </div>
  );
};
```

### Email-Specific Notifications

```jsx
const { showEmailSuccess } = useNotification();

// After successful email sending
showEmailSuccess(
  ['owner@example.com', 'tenant@example.com'], // recipients
  ['manager@property.com'],                     // cc list
  'PH4D',                                      // unit number
  'MX$ 20,000.00'                             // amount
);
```

### WhatsApp-Specific Notifications (Future)

```jsx
const { showWhatsAppSuccess } = useNotification();

// After successful WhatsApp sending
showWhatsAppSuccess(
  '+52 998 123 4567', // phone number
  'PH4D',            // unit number
  'MX$ 20,000.00'    // amount
);
```

## Props

### NotificationModal Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | false | Whether the modal is visible |
| `onClose` | function | required | Function to close the modal |
| `type` | string | 'success' | Modal type: 'success', 'error', 'warning', 'info' |
| `title` | string | required | Modal title |
| `message` | string | required | Main message content |
| `details` | array | [] | Array of detail objects with `label` and `value` |
| `actionButton` | object | null | Optional action button with `text` and `onClick` |
| `autoClose` | boolean | false | Whether to auto-close the modal |
| `autoCloseDelay` | number | 3000 | Auto-close delay in milliseconds |

### Detail Object Structure

```jsx
{
  label: 'Field Name',
  value: 'Field Value'
}
```

### Action Button Structure

```jsx
{
  text: 'Button Text',
  onClick: () => { /* action function */ }
}
```

## Styling

The notification modal uses CSS classes for styling:

- `.notification-modal-success` - Green accent for success
- `.notification-modal-error` - Red accent for errors
- `.notification-modal-warning` - Orange accent for warnings
- `.notification-modal-info` - Blue accent for information

## Features

- ✅ **Responsive Design** - Works on desktop and mobile
- ✅ **Keyboard Support** - ESC key to close
- ✅ **Click Outside** - Click overlay to close
- ✅ **Animations** - Smooth fade-in and slide-in effects
- ✅ **Auto-close** - Optional automatic closing
- ✅ **Flexible Content** - Support for details and action buttons
- ✅ **Reusable** - Works with any component via hook
- ✅ **Type-specific** - Different styles for different message types

## Integration Examples

### Digital Receipt Email
Currently integrated in `DigitalReceipt.jsx` for email sending feedback.

### Future Integrations
- WhatsApp sharing notifications
- File upload status
- Form validation feedback
- API operation results
- User action confirmations

## File Structure

```
src/
├── components/
│   ├── NotificationModal.jsx     # Main modal component
│   └── NotificationModal.css     # Modal styles
├── hooks/
│   └── useNotification.js        # Notification hook
└── components/
    └── DigitalReceipt.jsx        # Example integration
```
