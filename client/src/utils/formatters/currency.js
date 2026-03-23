/**
 * Currency Formatter
 * Formats numbers as Indian Rupee (₹) with proper thousand separators
 * 
 * Example: 12345.67 → ₹12,345.67
 * Example: 100000 → ₹1,00,000 (Indian style with 2-digit grouping)
 * 
 * User requirement: Clean human-friendly INR format (no raw long decimals)
 */

/**
 * Format number to Indian Rupee with proper formatting
 * @param {number} amount - The amount to format
 * @param {boolean} showDecimals - Whether to show decimal places (default: true)
 * @param {number} decimals - Number of decimal places to show (default: 2)
 * @returns {string} Formatted string like "₹12,345.67" or "₹12,34,567"
 */
export function formatCurrency(amount, showDecimals = true, decimals = 2) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }

  const num = parseFloat(amount);
  const isNegative = num < 0;
  const absAmount = Math.abs(num);

  // Indian numbering system: split into groups of 2 after first 3 digits
  const integerPart = Math.floor(absAmount);
  const decimalPart = showDecimals
    ? (absAmount - integerPart).toFixed(decimals).slice(2)
    : '';

  // Format integer part with Indian thousand separators
  const integerStr = integerPart.toString();
  let formattedInteger = '';

  if (integerStr.length <= 3) {
    formattedInteger = integerStr;
  } else {
    // First 3 digits from right
    formattedInteger = integerStr.slice(-3);
    // Rest of digits in groups of 2
    let remaining = integerStr.slice(0, -3);
    while (remaining.length > 0) {
      formattedInteger = remaining.slice(-2) + ',' + formattedInteger;
      remaining = remaining.slice(0, -2);
    }
  }

  let result = '₹' + formattedInteger;
  if (showDecimals && decimalPart) {
    result += '.' + decimalPart;
  }

  return isNegative ? '-' + result : result;
}

/**
 * Format currency for display in wallet/payment contexts
 * Removes decimals for whole amounts, shows decimals for precise amounts
 * @param {number} amount
 * @returns {string} Formatted like "₹12,345" or "₹100.50"
 */
export function formatCurrencyCompact(amount) {
  if (!amount || isNaN(amount)) return '₹0';

  const num = parseFloat(amount);
  if (num === Math.floor(num)) {
    // Whole number - no decimals
    return formatCurrency(num, false);
  } else {
    // Has decimals - show 2 decimal places
    return formatCurrency(num, true, 2);
  }
}

/**
 * Format currency for input fields or API requests
 * Removes ₹ symbol and formatting for processing
 * @param {string} formatted - Like "₹12,345.67"
 * @returns {number} Parsed number
 */
export function parseCurrency(formatted) {
  if (!formatted) return 0;
  // Remove ₹ symbol and all commas, parse to float
  return parseFloat(formatted.replace(/₹|,/g, ''));
}

/**
 * Format currency in short form for UI (e.g., "₹1.2L" for ₹1,20,000)
 * Useful for large amounts on dashboards
 * @param {number} amount
 * @returns {string} Short format like "₹1.2L" or "₹50K"
 */
export function formatCurrencyShort(amount) {
  if (!amount || isNaN(amount)) return '₹0';

  const num = Math.abs(parseFloat(amount));
  let divisor = 1;
  let unit = '';

  if (num >= 10000000) {
    // 1 Crore = 10,000,000
    divisor = 10000000;
    unit = 'Cr';
  } else if (num >= 100000) {
    // 1 Lakh = 100,000
    divisor = 100000;
    unit = 'L';
  } else if (num >= 1000) {
    divisor = 1000;
    unit = 'K';
  }

  const result = (num / divisor).toFixed(1);
  const formatted = result.endsWith('.0') ? result.slice(0, -2) : result;

  return (parseFloat(amount) < 0 ? '-' : '') + '₹' + formatted + unit;
}

/**
 * Get currency symbol (always ₹ for this app)
 * @returns {string} '₹'
 */
export function getCurrencySymbol() {
  return '₹';
}

/**
 * Check if value is a valid currency amount
 * @param {*} value
 * @returns {boolean}
 */
export function isValidCurrency(value) {
  if (value === null || value === undefined) return false;
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num);
}
