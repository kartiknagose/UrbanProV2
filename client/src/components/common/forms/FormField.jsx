/**
 * FormField Component
 * Reusable wrapper for form inputs: label + input + error message + hint
 * 
 * This eliminates repetition of label-input-error pattern throughout forms.
 * Provides consistent styling, spacing, and validation feedback.
 */

import { forwardRef } from 'react';
import { Input } from '../../ui/Input';
import { AlertCircle, CheckCircle } from 'lucide-react';

export const FormField = forwardRef(function FormField(
  {
    label,
    name,
    type = 'text',
    required = false,
    error,
    success = false,
    hint,
    disabled = false,
    icon: Icon,
    rightElement,
    showClear = false,
    onClear,
    size = 'default',
    placeholder,
    value,
    defaultValue,
    onChange,
    onBlur,
    className = '',
    inputClassName = '',
    ...props
  },
  ref
) {
  const hasError = !!error;

  return (
    <div className={`w-full space-y-2 ${className}`}>
      {/* Label with required indicator */}
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300"
        >
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Field */}
      <Input
        ref={ref}
        id={name}
        name={name}
        type={type}
        required={required}
        error={hasError}
        success={success && !hasError}
        disabled={disabled}
        icon={Icon}
        rightElement={rightElement}
        showClear={showClear}
        onClear={onClear}
        size={size}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onBlur={onBlur}
        className={inputClassName}
        {...props}
      />

      {/* Error Message */}
      {hasError && (
        <div className="flex items-start gap-2 mt-2 pt-1">
          <AlertCircle
            size={14}
            className="text-error-500 mt-0.5 shrink-0"
          />
          <p className="text-xs font-medium text-error-600 dark:text-error-400">
            {error}
          </p>
        </div>
      )}

      {/* Success Message */}
      {success && !hasError && (
        <div className="flex items-start gap-2 mt-2 pt-1">
          <CheckCircle
            size={14}
            className="text-success-500 mt-0.5 shrink-0"
          />
          <p className="text-xs font-medium text-success-600 dark:text-success-400">
            Looks good!
          </p>
        </div>
      )}

      {/* Hint Text */}
      {hint && !hasError && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 px-1">
          {hint}
        </p>
      )}
    </div>
  );
});

FormField.displayName = 'FormField';
