/**
 * Transaction Schema Definition
 * 
 * Defines validation rules for transaction documents
 * Used by validateDocument() to ensure data integrity
 */

export const transactionSchema = {
  collectionName: 'transactions',
  
  // Required fields for create operations
  required: ['date', 'amount', 'type', 'clientId'],
  
  // Field definitions with validation rules
  fields: {
    // Transaction basics
    date: { 
      type: 'timestamp', 
      required: true,
      description: 'Transaction date'
    },
    amount: { 
      type: 'number', 
      required: true,
      description: 'Amount in dollars (will be converted to cents for storage)'
    },
    type: { 
      type: 'enum', 
      values: ['expense', 'income'], 
      required: true,
      description: 'Transaction type - MUST be "expense" or "income", not "transactionType"'
    },
    
    // Denormalized vendor fields (both or neither)
    vendorId: { 
      type: 'string', 
      required: false,
      description: 'Vendor unique identifier'
    },
    vendorName: { 
      type: 'string', 
      required: false,
      description: 'Vendor display name'
    },
    
    // Denormalized category fields (both or neither)
    categoryId: { 
      type: 'string', 
      required: false,
      description: 'Category unique identifier'
    },
    categoryName: { 
      type: 'string', 
      required: false,
      description: 'Category display name'
    },
    
    // Account fields (normalized - accountId and accountType only)
    accountId: { 
      type: 'string',
      requiredWith: ['accountType'],
      description: 'Account unique identifier'
    },
    accountName: { 
      type: 'string',
      optional: true,  // Legacy field - no longer required
      description: 'Account display name (deprecated - use lookup via accountId)'
    },
    accountType: { 
      type: 'enum', 
      values: ['bank', 'cash', 'credit'],
      requiredWith: ['accountId'],
      description: 'Account type for balance aggregation'
    },
    
    // Reference fields
    clientId: { 
      type: 'string', 
      required: true,
      description: 'Client identifier'
    },
    propertyId: { 
      type: 'string', 
      required: true,
      description: 'Property identifier'
    },
    unitId: { 
      type: ['string', 'null'], 
      required: false,
      description: 'Unit identifier for multi-unit properties (null for general expenses)'
    },
    
    // Transaction details
    paymentMethod: { 
      type: 'string', 
      required: false,
      description: 'Payment method used'
    },
    notes: { 
      type: 'string', 
      required: false,
      maxLength: 500,
      description: 'Transaction notes'
    },
    checkNumber: { 
      type: 'string', 
      required: false,
      description: 'Check number if payment method is check'
    },
    reference: {
      type: 'string',
      required: false,
      description: 'External reference number'
    },
    
    // Document references
    documents: { 
      type: 'array', 
      items: 'string', 
      required: false,
      description: 'Array of document IDs'
    },
    
    // Metadata
    enteredBy: { 
      type: 'string', 
      required: true,
      description: 'Email of user who entered transaction'
    },
    created: { 
      type: 'timestamp', 
      autoGenerate: true,
      description: 'Creation timestamp - auto-generated'
    },
    updated: { 
      type: 'timestamp', 
      autoGenerate: true,
      description: 'Last update timestamp - auto-generated'
    },
    
    // HOA-specific fields (when category is 'HOA Dues')
    duesDistribution: {
      type: 'array',
      required: false,
      description: 'HOA dues distribution details'
    },
    metadata: {
      type: 'object',
      required: false,
      description: 'Additional metadata for special transaction types'
    }
  },
  
  // Forbidden fields that should NEVER be used
  forbidden: [
    'vendor',           // Use vendorId + vendorName
    'category',         // Use categoryId + categoryName
    'account',          // Use accountId + accountName + accountType
    'client',           // Use clientId
    'unit',             // Use unitId
    'transactionType',  // Use type
    'createdAt',        // Use created
    'updatedAt'         // Use updated
  ],
  
  // Custom validation functions
  customValidations: [
    {
      name: 'amountSign',
      validate: (data) => {
        // Skip if type or amount is missing (caught by required field validation)
        if (!data.type || data.amount === undefined) return null;
        
        if (data.type === 'expense' && data.amount > 0) {
          return 'Expense amounts must be negative';
        }
        if (data.type === 'income' && data.amount < 0) {
          return 'Income amounts must be positive';
        }
        return null;
      }
    },
    {
      name: 'checkNumberValidation',
      validate: (data) => {
        // If payment method is check, checkNumber should be provided
        if (data.paymentMethod && data.paymentMethod.toLowerCase() === 'check' && !data.checkNumber) {
          return 'Check number is required when payment method is check';
        }
        return null;
      }
    }
  ]
};