/**
 * VALIDATION SCHEMAS FOR SERVICES
 * 
 * What is this file?
 * This file defines the "rules" for service data that admins send to create services.
 * 
 * Why do we need validation?
 * - Prevents invalid data (e.g., service with empty name, negative price)
 * - Gives clear error messages to users
 * - Protects database integrity
 */

const { body } = require('express-validator');

/**
 * VALIDATION RULES FOR CREATING A SERVICE
 * 
 * When an admin wants to create a new service, they must provide:
 * 1. name - The service name (e.g., "Plumbing Repair", "House Cleaning")
 * 2. description - What this service includes (optional but recommended)
 * 3. category - Service category (e.g., "Plumbing", "Cleaning", "Electrical")
 * 4. basePrice - Starting price for this service (optional, worker can set their own)
 * 
 * Business Rules:
 * - Service names must be unique (we'll check this in the service layer)
 * - Categories help users filter services
 * - Base price is a guideline, not mandatory
 */
const createServiceSchema = [
  // Validate service name
  body('name')
    .notEmpty().withMessage('Service name is required') // Must not be empty
    .isString().withMessage('Service name must be text')
    .trim() // Remove extra spaces
    .isLength({ min: 3, max: 100 }).withMessage('Service name must be between 3 and 100 characters')
    // Example: "Plumbing Repair" ✅ | "ab" ❌ (too short)
    .matches(/^[a-zA-Z0-9\s\-&]+$/).withMessage('Service name can only contain letters, numbers, spaces, hyphens, and ampersands'),
    // Example: "House Cleaning & Maintenance" ✅ | "Service@#$%" ❌ (special chars)

  // Validate description (optional but recommended)
  body('description')
    .optional() // Not required, but if provided, validate it
    .isString().withMessage('Description must be text')
    .trim()
    .isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
    // Example: "Professional plumbing services including leak detection..." ✅

  // Validate category (optional but helps with filtering)
  body('category')
    .optional()
    .isString().withMessage('Category must be text')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Category must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-&]+$/).withMessage('Category can only contain letters, numbers, spaces, hyphens, and ampersands'),
    // Example: "Home Cleaning" ✅ | "Cleaning & Maintenance" ✅

  // Validate base price (optional guideline)
  body('basePrice')
    .optional()
    .isDecimal({ decimal_digits: '0,2' }).withMessage('Base price must be a valid number with up to 2 decimal places')
    // Example: 500.00 ✅ | 1200.50 ✅ | -100 ❌ (will be caught by next check)
    .custom((value) => {
      if (parseFloat(value) < 0) {
        throw new Error('Base price cannot be negative');
      }
      return true;
    }),
    // This custom validator ensures price is not negative
];

/**
 * FUTURE: You can add more validation schemas here
 * 
 * Examples:
 * - updateServiceSchema (for editing existing services)
 * - deleteServiceSchema (for removing services)
 * - searchServiceSchema (for filtering/search queries)
 */

// Export the validation schema so routes can use it
module.exports = {
  createServiceSchema,
};
