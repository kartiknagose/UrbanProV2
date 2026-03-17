// Select component — Premium rebuild matching Input.jsx design
// Features better focus states, micro-animations, and consistent typography

import { forwardRef, useId, useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export const Select = forwardRef(function Select(
  {
    label,
    error,
    hint,
    icon: Icon,
    required = false,
    disabled = false,
    className = '',
    selectClassName = '',
    children,
    value,
    defaultValue,
    ...props
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);
  const autoId   = useId();
  const selectId = props.id || autoId;

  const getContainerClass = () => {
    if (error) return 'shadow-lg shadow-error-500/10 ring-4 ring-error-500/10';
    if (isFocused) return 'shadow-2xl shadow-brand-500/20 ring-4 ring-brand-500/20';
    return 'hover:shadow-lg hover:shadow-brand-500/5 hover:bg-neutral-100 dark:hover:bg-dark-700/50';
  };


  return (
    <div className={`w-full group ${className}`}>
      <div className="relative">
        <Motion.div
           animate={{
            scale: isFocused ? 1.005 : 1,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`
            relative min-h-[74px] rounded-2xl transition-all duration-300 ease-out flex items-center
            ${disabled ? 'bg-neutral-100 dark:bg-dark-900 opacity-60' : ''}
            ${!disabled && isFocused ? 'bg-white dark:bg-dark-800' : 'bg-neutral-50 dark:bg-dark-900/55'}
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
                absolute top-3.5 z-30 pointer-events-none select-none transition-all duration-300
                text-[10px] font-black uppercase tracking-widest leading-none
                ${isFocused ? 'text-brand-600 dark:text-brand-400' : 'text-neutral-400 dark:text-neutral-500'}
                ${Icon ? 'left-12' : 'left-5'}
              `}
            >
              {label}
              {required && <span className="text-error-500 ml-0.5">*</span>}
            </div>
          )}

          {/* 3. The Main Select (Zero Boundary) */}
          <select
            id={selectId}
            disabled={disabled}
            value={value}
            defaultValue={defaultValue}
            className={`
              block w-full h-full bg-transparent !border-0 !outline-none !ring-0 !shadow-none
              focus:!border-0 focus:!outline-none focus:!ring-0 focus:!shadow-none
              focus-visible:!outline-none focus-visible:!ring-0
              text-gray-900 dark:text-white font-medium cursor-pointer transition-all
              rounded-2xl
              ${Icon ? 'pl-12' : 'pl-5'}
              pr-10
              ${label ? 'pt-8 pb-3' : 'py-5'}
              ${selectClassName}
            `}
            style={{
              colorScheme: 'light dark',
              optionColorScheme: 'light',
            }}
            ref={ref}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          >
            {children}
          </select>

          {/* 4. Arrow Overlay */}
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 dark:text-neutral-500 transition-colors duration-200 group-hover:text-brand-500 z-30">
            {error ? <AlertCircle size={18} className="text-error-500" /> : <ChevronDown size={18} strokeWidth={3} />}
          </div>
        </Motion.div>
      </div>

      <AnimatePresence mode="wait">
        {error ? (
          <Motion.p
            key="error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-1.5 px-1 text-[10px] font-black uppercase tracking-widest text-error-600 dark:text-error-400 flex items-center gap-1.5"
          >
            <AlertCircle size={10} strokeWidth={3} />
            {error}
          </Motion.p>
        ) : hint ? (
          <Motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5"
          >
            <div className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-dark-600" />
            {hint}
          </Motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
});
