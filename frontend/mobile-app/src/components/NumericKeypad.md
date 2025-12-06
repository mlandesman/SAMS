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
| `maxValue` | `number` | No | Maximum allowed value (default: `100`) |
| `maxDigits` | `number` | No | Maximum number of digits allowed (optional, no limit if not specified) |
| `suffix` | `string` | No | Display suffix shown after value (default: `'%'`) |
| `doneLabel` | `string` | No | Text for the Done button (default: `'Listo'`) |

### Features

- **Slide-up Animation**: Smooth slide-up from bottom using Material-UI `Slide` component
- **Backdrop**: Semi-transparent backdrop that closes keypad on tap
- **Number Buttons**: Large touch targets (60px) for 0-9
- **Backspace**: Delete last entered digit
- **Clear**: Clear entire value
- **Done Button**: Customizable button text (default: "Listo") to close keypad
- **Value Display**: Shows current value at top of keypad with customizable suffix
- **Range Validation**: Built-in validation for max value and max digits (configurable via props)

### Styling

The component uses Material-UI theming and includes:
- Rounded top corners (16px border radius)
- Fixed positioning at bottom of screen
- Maximum height of 50vh
- Green "Done" button with checkmark icon
- Red "Clear" button for destructive action
- Gray number buttons with hover states

### Customization

The component is now fully customizable via props. No code changes needed:

```jsx
// Propane Tank Entry (0-100%, 3 digits max)
<NumericKeypad
  open={keypadOpen}
  onClose={handleKeypadClose}
  onInput={handleKeypadInput}
  value={currentValue}
  maxValue={100}
  maxDigits={3}
  suffix="%"
  doneLabel="Listo"
/>

// Water Meter Entry (0-99999, 5 digits max)
<NumericKeypad
  open={keypadOpen}
  onClose={handleKeypadClose}
  onInput={handleKeypadInput}
  value={currentValue}
  maxValue={99999}
  maxDigits={5}
  suffix=" m³"
  doneLabel="Listo"
/>
```

## Examples

### Propane Tank Entry

See `PropaneReadingEntry.jsx` for a complete implementation:

```jsx
<NumericKeypad
  open={keypadOpen}
  onClose={handleKeypadClose}
  onInput={handleKeypadInput}
  value={currentValue}
  // Uses defaults: maxValue={100}, suffix="%", doneLabel="Listo"
/>
```

**Configuration:**
- `maxValue`: 100 (default, no prop needed)
- `maxDigits`: 3 (optional, for propane percentages)
- `suffix`: "%" (default, no prop needed)
- `doneLabel`: "Listo" (default, no prop needed)

### Water Meter Entry

See `WaterMeterEntryNew.jsx` for a complete implementation:

```jsx
<NumericKeypad
  open={keypadOpen}
  onClose={handleKeypadClose}
  onInput={handleKeypadInput}
  value={focusedUnitId ? (currentReadings[focusedUnitId] || '') : ''}
  maxValue={99999}
  maxDigits={5}
  suffix=" m³"
  doneLabel="Listo"
/>
```

**Configuration:**
- `maxValue`: 99999 (5-digit water meter readings)
- `maxDigits`: 5 (enforces 5-digit limit)
- `suffix`: " m³" (cubic meters unit)
- `doneLabel`: "Listo" (default)

**Integration Pattern:**
1. State management for keypad visibility and focused field
2. TextField with `readOnly: true` when `onFieldFocus` is provided
3. `onFocus` handler to open keypad and track focused field
4. Value synchronization between TextField and keypad
5. Validation handled by keypad props (maxValue, maxDigits)

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
