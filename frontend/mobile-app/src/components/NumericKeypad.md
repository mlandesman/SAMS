# NumericKeypad Component

## Overview

A reusable numeric keypad component for mobile PWA data entry. Provides a touch-friendly calculator-style interface that slides up from the bottom when a numeric input field is focused.

## Location

`frontend/mobile-app/src/components/NumericKeypad.jsx`

## Usage

### Basic Integration

```jsx
import NumericKeypad from './NumericKeypad.jsx';

const MyComponent = () => {
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [focusedFieldId, setFocusedFieldId] = useState(null);
  const [fieldValue, setFieldValue] = useState('');

  const handleTextFieldFocus = (fieldId) => {
    setFocusedFieldId(fieldId);
    setKeypadOpen(true);
  };

  const handleKeypadInput = (value) => {
    // Update your field value
    setFieldValue(value);
  };

  const handleKeypadClose = () => {
    setKeypadOpen(false);
    setFocusedFieldId(null);
  };

  return (
    <>
      <TextField
        value={fieldValue}
        onFocus={() => handleTextFieldFocus('myField')}
        inputProps={{ readOnly: true }} // Prevent native keyboard
      />
      
      <NumericKeypad
        open={keypadOpen}
        onClose={handleKeypadClose}
        onInput={handleKeypadInput}
        value={fieldValue}
      />
    </>
  );
};
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Controls keypad visibility |
| `onClose` | `function` | Yes | Callback when keypad is closed (via Done button or backdrop) |
| `onInput` | `function(value: string)` | Yes | Callback when a number is entered, backspace pressed, or cleared |
| `value` | `string \| number` | No | Current value to display at top of keypad (default: `''`) |

### Features

- **Slide-up Animation**: Smooth slide-up from bottom using Material-UI `Slide` component
- **Backdrop**: Semi-transparent backdrop that closes keypad on tap
- **Number Buttons**: Large touch targets (60px) for 0-9
- **Backspace**: Delete last entered digit
- **Clear**: Clear entire value
- **Done Button**: "Listo" button to close keypad
- **Value Display**: Shows current value at top of keypad
- **Range Validation**: Built-in validation prevents values over 100 (can be customized)

### Styling

The component uses Material-UI theming and includes:
- Rounded top corners (16px border radius)
- Fixed positioning at bottom of screen
- Maximum height of 50vh
- Green "Done" button with checkmark icon
- Red "Clear" button for destructive action
- Gray number buttons with hover states

### Customization

To customize the max value validation, modify the `handleNumberPress` function:

```jsx
const handleNumberPress = (num) => {
  const currentValue = value.toString();
  const newValue = currentValue + num;
  
  // Customize max value here
  const numValue = parseInt(newValue);
  if (numValue > YOUR_MAX_VALUE) {
    return;
  }
  
  onInput(newValue);
};
```

To change the "Done" button text, modify the button label in the component (currently "Listo").

## Example: Propane Reading Entry

See `PropaneReadingEntry.jsx` for a complete implementation:

1. State management for keypad visibility and focused field
2. TextField with `readOnly: true` to prevent native keyboard
3. `onFocus` handler to open keypad
4. Value synchronization between TextField and keypad
5. Validation (0-100 range) in the `handleKeypadInput` callback

## Reusability

This component is designed to be reusable across all PWA numeric input scenarios:
- Water meter readings
- Propane tank levels
- Expense amounts
- Any numeric data entry

Simply:
1. Import the component
2. Add state for `keypadOpen` and `focusedFieldId`
3. Set TextField `inputProps={{ readOnly: true }}`
4. Add `onFocus` handler to open keypad
5. Pass current field value to keypad `value` prop
6. Handle `onInput` to update your state

## Dependencies

- `@mui/material`: Slide, Backdrop, Paper, Button, Typography, Box
- `@mui/icons-material`: BackspaceIcon, CheckIcon

## Browser Compatibility

Works on all modern mobile browsers. The `Slide` animation requires CSS transitions support (all modern browsers).
