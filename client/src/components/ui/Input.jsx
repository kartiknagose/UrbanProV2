// Input component — Premium Rebuild with Floating Labels, Micro-animations & Glassmorphism
// Uses framer-motion for smooth transitions and professional look

import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, CheckCircle, AlertCircle, X } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export const Input = forwardRef(function Input(
  {
    label,
    type = 'text',
    size = 'default',
    placeholder,
    error,
    success = false,
    icon: Icon,
    rightElement,       // custom right slot
    hint,               // helper text shown below input
    required = false,
    disabled = false,
    showClear = false,  // option to show clear button
    onClear,            // callback for clear button
    className = '',
    inputClassName = '',
    value,              // for controlled component detection
    defaultValue,
    ...props
  },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const autoId = useId();
  const inputId = props.id || autoId;
  const isCompact = size === 'compact';

  // Determine if input has content (for floating label)
  const currentHasValue = !!(value || defaultValue || props.value);

  const actualType = type === 'password' && showPassword ? 'text' : type;

  const getContainerClass = () => {
    if (error) return 'shadow-lg shadow-error-500/10 ring-4 ring-error-500/10';
    if (success) return 'shadow-lg shadow-success-500/10 ring-4 ring-success-500/10';
    if (isFocused) return 'shadow-2xl shadow-brand-500/20 ring-4 ring-brand-500/20';
    return 'hover:shadow-lg hover:shadow-brand-500/5 hover:bg-neutral-100 dark:hover:bg-dark-700/50';
  };

  return (
    <div className={`w-full group ${className}`}>
      {/* Container Wrapper */}
      <div className="relative">
        {/* The Premium Glow Layer (inspired by correctly implemented search tray) */}
        {!disabled && (
          <div className={`
            absolute -inset-0.5 ${isCompact ? 'rounded-[1.15rem]' : 'rounded-[2.1rem]'} blur opacity-0 transition duration-500
            ${error ? 'bg-error-500/20 opacity-40' : success ? 'bg-success-500/20 opacity-40' : 'bg-gradient-to-r from-brand-500 to-accent-500 group-hover:opacity-20'}
            ${isFocused ? 'opacity-40 blur-md duration-200' : ''}
          `} />
        )}

        <Motion.div
          animate={{
            scale: isFocused ? 1.01 : 1,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`
            relative ${isCompact ? 'min-h-[58px] rounded-[1rem]' : 'min-h-[74px] rounded-[2rem]'} transition-all duration-300 ease-out flex items-center
            ${disabled ? 'bg-neutral-100 dark:bg-dark-900/50 opacity-60' : ''}
            ${!disabled && isFocused ? 'bg-white dark:bg-dark-800' : 'bg-neutral-50/80 dark:bg-dark-900/40 backdrop-blur-sm'}
            ${!disabled && !isFocused ? 'border border-neutral-200/50 dark:border-white/5' : 'border border-transparent'}
            ${getContainerClass()}
          `}
        >
          {/* 1. Icon Overlay */}
          {Icon && (
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 pointer-events-none transition-colors duration-300 ${isFocused ? 'text-brand-500' : 'text-neutral-400 dark:text-neutral-500'}`}>
              <Icon size={18} strokeWidth={2.5} />
            </div>
          )}

          {/* 2. Fixed Label Overlay */}
          {label && (
            <div
              className={`
                absolute ${isCompact ? 'top-2.5' : 'top-3'} z-30 pointer-events-none select-none transition-all duration-300
                ${isCompact ? 'text-[10px] tracking-[0.14em]' : 'text-xs tracking-widest'} font-bold uppercase leading-none
                ${isFocused ? 'text-brand-600 dark:text-brand-400' : 'text-neutral-400 dark:text-neutral-500'}
                ${Icon ? 'left-12' : 'left-5'}
              `}
            >
              {label}
              {required && <span className="text-error-500 ml-0.5">*</span>}
            </div>
          )}

          {/* 3. The Main Input (Zero Boundary) */}
          <input
            id={inputId}
            ref={ref}
            type={actualType}
            placeholder={placeholder}
            disabled={disabled}
            value={value}
            defaultValue={defaultValue}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={`
              block w-full h-full bg-transparent !border-0 !outline-none !ring-0 !shadow-none
              focus:!border-0 focus:!outline-none focus:!ring-0 focus:!shadow-none
              focus-visible:!outline-none focus-visible:!ring-0
              text-gray-900 dark:text-white font-medium appearance-none selection:bg-brand-500/30
              placeholder:text-neutral-400/40 dark:placeholder:text-neutral-500/40
              autofill:!text-gray-900 dark:autofill:!text-white
              autofill:!shadow-[inset_0_0_0px_1000px_rgba(255,255,255,1)] dark:autofill:!shadow-[inset_0_0_0px_1000px_rgba(25,28,35,1)]
              ${isCompact ? 'rounded-xl' : 'rounded-2xl'}
              ${Icon ? 'pl-12' : 'pl-5'}
              ${(type === 'password' || rightElement || success || error || showClear) ? 'pr-20' : 'pr-5'}
              ${label ? (isCompact ? 'pt-5 pb-1.5' : 'pt-7 pb-2') : (isCompact ? 'py-3.5' : 'py-5')}
              ${inputClassName}
            `}
            {...props}
          />

          {/* 4. Right Action Overlay */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 shrink-0 z-30">
            {showClear && currentHasValue && !disabled && (
              <button
                type="button"
                onClick={onClear}
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-dark-700 text-neutral-400 dark:text-neutral-500 transition-colors"
                tabIndex={-1}
              >
                <X size={14} />
              </button>
            )}

            {type === 'password' ? (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`p-1.5 rounded-xl transition-all ${isFocused ? 'text-brand-500 bg-brand-500/5' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'}`}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            ) : rightElement ? (
              <div className="flex items-center">{rightElement}</div>
            ) : error ? (
              <Motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-error-500 p-1"
              >
                <AlertCircle size={20} fill="currentColor" className="text-error-50 dark:text-error-500/20" />
              </Motion.div>
            ) : success ? (
              <Motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-success-500 p-1"
              >
                <CheckCircle size={20} fill="currentColor" className="text-success-50 dark:text-success-500/20" />
              </Motion.div>
            ) : null}
          </div>
        </Motion.div>
      </div>

      {/* Sub-label info area */}
      <AnimatePresence mode="wait">
        {error ? (
          <Motion.p
            key="error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-1.5 px-1 text-xs font-bold uppercase tracking-widest text-error-600 dark:text-error-400 flex items-center gap-1.5"
          >
            <AlertCircle size={10} strokeWidth={3} />
            {error}
          </Motion.p>
        ) : hint ? (
          <Motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1.5 px-1 text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5"
          >
            <div className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-dark-600" />
            {hint}
          </Motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
});
