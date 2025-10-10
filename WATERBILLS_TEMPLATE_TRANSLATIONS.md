# Water Bills Email Templates - Translation Reference

## Quick Comparison: English vs Spanish

### Subject Lines

| English | Spanish |
|---------|---------|
| Water Bill for Unit | Estado de Cuenta de Agua - Unidad |
| Due | Vencimiento |

**Full Subject Lines:**
- **EN:** `💧 Water Bill for Unit {{UnitNumber}} - {{BillingPeriod}} | Due: {{DueDate}}`
- **ES:** `💧 Estado de Cuenta de Agua - Unidad {{UnitNumber}} - {{BillingPeriod}} | Vencimiento: {{DueDate}}`

---

## Key Text Translations

### Header & Title
| English | Spanish |
|---------|---------|
| Water Bill Statement | Estado de Cuenta de Agua |
| Unit | Unidad |

### Status Messages (from templateVariables.js)
| Status | English | Spanish |
|--------|---------|---------|
| paid | ✅ PAID - Thank you for your payment | ✅ PAGADO - Gracias por su pago |
| unpaid | ⏰ PAYMENT DUE - Please pay by the due date to avoid penalties | ⏰ PAGO PENDIENTE - Por favor pague antes de la fecha límite para evitar recargos |
| overdue | ⚠️ OVERDUE - Late penalties have been applied | ⚠️ VENCIDO - Se han aplicado recargos por pago tardío |

### Bill Summary Section
| English | Spanish |
|---------|---------|
| Total Amount Due | Monto Total a Pagar |
| Due Date | Fecha de Vencimiento |
| Bill Date | Fecha de Emisión |

### Water Consumption Section
| English | Spanish |
|---------|---------|
| Water Consumption | Consumo de Agua |
| Monthly Usage | Uso Mensual |
| Previous | Anterior |
| Current | Actual |
| Usage | Consumo |
| Reading taken on | Lectura tomada el |
| Rate | Tarifa |
| per m³ | por m³ |

### Meter Readings
| English | Spanish |
|---------|---------|
| Last month | Mes anterior |
| This month | Este mes |

### Warnings
| English | Spanish |
|---------|---------|
| High Water Usage Notice | Aviso de Consumo Alto |
| Your consumption of {{X}} m³ is significantly above average. | Su consumo de {{X}} m³ está significativamente por encima del promedio. |
| Please check for possible leaks or consider water conservation measures. | Por favor revise posibles fugas o considere medidas de conservación de agua. |

### Service Charges Section
| English | Spanish |
|---------|---------|
| Service Charges | Cargos por Servicio |
| Water Consumption | Consumo de Agua |
| Car Wash Services | Servicio de Lavado de Auto |
| Boat Wash Services | Servicio de Lavado de Lancha |
| wash(es) | lavado(s) |
| each | cada uno |

### Overdue Section
| English | Spanish |
|---------|---------|
| OVERDUE - Balance Breakdown | VENCIDO - Desglose de Saldo |
| Previous unpaid balance | Saldo anterior no pagado |
| Current month charges | Cargos del mes actual |
| Late penalties | Recargos por pago tardío |

### Totals Section
| English | Spanish |
|---------|---------|
| Current Month Charges | Cargos del Mes Actual |
| Late Payment Penalties | Recargos por Pago Tardío |
| Total Amount Due | Monto Total a Pagar |

### Penalty Notice
| English | Spanish |
|---------|---------|
| Late Payment Penalty Applied | Recargo por Pago Tardío Aplicado |
| A {{X}} penalty has been applied to your unpaid balance. | Se ha aplicado un recargo de {{X}} a su saldo no pagado. |
| To avoid future penalties, please ensure payment is received by the due date. | Para evitar recargos futuros, por favor asegúrese de que el pago se reciba antes de la fecha de vencimiento. |

### Payment Information Section
| English | Spanish |
|---------|---------|
| Payment Information | Información de Pago |
| Payment Methods Accepted | Métodos de Pago Aceptados |
| Bank Transfer (SPEI) | Transferencia Bancaria (SPEI) |
| Cash Payment at Management Office | Pago en Efectivo en la Oficina de Administración |
| Electronic Transfer | Transferencia Electrónica |
| Bank Details | Datos Bancarios |
| Bank | Banco |
| Account | Cuenta |
| Reference | Referencia |
| Payment Reference | Referencia de Pago |
| Please ensure payment is received by | Por favor asegúrese de que el pago se reciba antes del |
| to avoid | para evitar |
| penalty charges after | recargos de ... después de |
| days | días |

### Additional Notes
| English | Spanish |
|---------|---------|
| Additional Notes | Notas Adicionales |

### Footer
| English | Spanish |
|---------|---------|
| This is an automated billing statement. Please retain for your records. | Este es un estado de cuenta automatizado. Por favor consérvelo para sus registros. |

---

## Template Variables Used (Same in Both Languages)

Both English and Spanish templates use the same Handlebars variable names for substitution:

### Client & Unit Information
- `{{ClientName}}`
- `{{ClientLogoUrl}}`
- `{{UnitNumber}}`
- `{{BillingPeriod}}`
- `{{ClientPhone}}`
- `{{ClientEmail}}`
- `{{ClientAddress}}`

### Dates
- `{{DueDate}}`
- `{{BillDate}}`
- `{{ReadingDate}}`

### Amounts (Currency)
- `{{TotalAmountDue}}`
- `{{CurrentMonthTotal}}`
- `{{WaterCharge}}`
- `{{CarWashCharge}}`
- `{{BoatWashCharge}}`
- `{{PenaltyAmount}}`
- `{{PreviousBalance}}`

### Consumption & Readings
- `{{WaterConsumption}}`
- `{{PriorReading}}`
- `{{CurrentReading}}`
- `{{LastMonthUsage}}`
- `{{UsageChangeDisplay}}`

### Service Counts
- `{{CarWashCount}}`
- `{{BoatWashCount}}`

### Rates
- `{{RatePerM3}}`
- `{{CarWashRate}}`
- `{{BoatWashRate}}`
- `{{PenaltyRate}}`
- `{{PenaltyDays}}`

### Conditional Flags (Handlebars #if)
- `{{#if ShowPaidStatus}}`
- `{{#if ShowComparison}}`
- `{{#if IsHighUsage}}`
- `{{#if ShowCarWash}}`
- `{{#if ShowBoatWash}}`
- `{{#if IsOverdue}}`
- `{{#if ShowPenalties}}`
- `{{#if PaymentBankName}}`
- `{{#if PaymentNotes}}`
- `{{#if BillNotes}}`
- `{{#if ClientPhone}}`
- `{{#if ClientEmail}}`
- `{{#if ClientLogoUrl}}`

### Status Messages
- `{{StatusMessage}}` - Pre-translated based on language in `templateVariables.js`

### Colors (Branding)
- `{{PrimaryColor}}`
- `{{AccentColor}}`

### Payment Details (Optional)
- `{{PaymentBankName}}`
- `{{PaymentAccountName}}`
- `{{PaymentClabe}}`
- `{{PaymentReference}}`
- `{{PaymentNotes}}`

### Additional Notes
- `{{BillNotes}}`

---

## Usage Comparison Display

The usage comparison text is built dynamically in `templateVariables.js` based on the language:

### English
```javascript
// buildUsageChangeDisplay(usageChange, 'en')
// Returns: "+5 m³ ↗️" or "-3 m³ ↘️" or "No change"
```

### Spanish
```javascript
// buildUsageChangeDisplay(usageChange, 'es')
// Returns: "+5 m³ ↗️" or "-3 m³ ↘️" or "Sin cambio"
```

Full display in template:
- **EN:** `Last month: 15 m³, This month: 18 m³ (+3 m³ ↗️)`
- **ES:** `Mes anterior: 15 m³, Este mes: 18 m³ (+3 m³ ↗️)`

---

## Professional Spanish Notes

The Spanish translations follow these principles:

1. **Formal Address:** Uses "usted" form (e.g., "Su consumo", "Por favor asegúrese")
2. **Mexican Market:** Terminology appropriate for Mexico (SPEI, CLABE)
3. **Professional Tone:** Business-appropriate language for property management
4. **Clear Communication:** Avoids ambiguity in financial/legal terms
5. **Consistent Terminology:** Same terms used throughout for consistency

### Key Mexican Financial Terms
- **SPEI:** Sistema de Pagos Electrónicos Interbancarios (Mexican electronic transfer system)
- **CLABE:** Clave Bancaria Estandarizada (standardized bank code for transfers in Mexico)
- **Recargo:** Late payment penalty/surcharge
- **Lavado:** Wash/washing service

---

## Testing Both Languages

When testing, verify:

1. ✅ Subject lines display correctly in both languages
2. ✅ All dates format properly (English: "July 20, 2025" / Spanish: "20 de Julio, 2025")
3. ✅ Currency displays consistently (both use same format from templateVariables.js)
4. ✅ Conditional sections appear/disappear correctly
5. ✅ Status messages match expected payment state
6. ✅ Mobile rendering works for both templates
7. ✅ Special characters display correctly (á, é, í, ó, ú, ñ, ¿, ¡)

---

## Language Selection Logic

The email service (`backend/controllers/emailService.js`) selects the template language:

```javascript
// User's preferred language from their profile
const userLanguage = 'es'; // or 'en'

// Select template
const templateLang = userLanguage === 'es' ? 'es' : 'en';
const bodyTemplate = waterBillTemplates[`body_${templateLang}`];
const subjectTemplate = waterBillTemplates[`subject_${templateLang}`];
```

Default is English if language preference is not set or is invalid.


