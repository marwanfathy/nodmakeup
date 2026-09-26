import React, { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import './Input.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, fullWidth = false, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;

    const classNames = [
      'ds-input-wrapper',
      fullWidth && 'ds-input-wrapper--full-width',
      error && 'ds-input-wrapper--error',
      className,
    ].filter(Boolean).join(' ');

    return (
      <div className={classNames} style={{ width: fullWidth ? '100%' : undefined }}>
        {label && (
          <label htmlFor={inputId} className="ds-input__label">
            {label}
          </label>
        )}
        <div className="ds-input__inner">
          {leftIcon && <span className="ds-input__icon ds-input__icon--left" aria-hidden="true">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className="ds-input"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={`${errorId || ''} ${hintId || ''}`.trim() || undefined}
            {...props}
          />
          {rightIcon && <span className="ds-input__icon ds-input__icon--right" aria-hidden="true">{rightIcon}</span>}
        </div>
        {error && (
          <p id={errorId} className="ds-input__error" role="alert">{error}</p>
        )}
        {hint && !error && (
          <p id={hintId} className="ds-input__hint">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, fullWidth = false, className = '', id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${textareaId}-error` : undefined;
    const hintId = hint ? `${textareaId}-hint` : undefined;

    const classNames = [
      'ds-input-wrapper',
      'ds-input-wrapper--textarea',
      fullWidth && 'ds-input-wrapper--full-width',
      error && 'ds-input-wrapper--error',
      className,
    ].filter(Boolean).join(' ');

    return (
      <div className={classNames} style={{ width: fullWidth ? '100%' : undefined }}>
        {label && (
          <label htmlFor={textareaId} className="ds-input__label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className="ds-input ds-input--textarea"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={`${errorId || ''} ${hintId || ''}`.trim() || undefined}
          {...props}
        />
        {error && (
          <p id={errorId} className="ds-input__error" role="alert">{error}</p>
        )}
        {hint && !error && (
          <p id={hintId} className="ds-input__hint">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, fullWidth = false, className = '', id, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${selectId}-error` : undefined;
    const hintId = hint ? `${selectId}-hint` : undefined;

    const classNames = [
      'ds-input-wrapper',
      fullWidth && 'ds-input-wrapper--full-width',
      error && 'ds-input-wrapper--error',
      className,
    ].filter(Boolean).join(' ');

    return (
      <div className={classNames} style={{ width: fullWidth ? '100%' : undefined }}>
        {label && (
          <label htmlFor={selectId} className="ds-input__label">
            {label}
          </label>
        )}
        <div className="ds-input__inner ds-input__inner--select">
          <select
            ref={ref}
            id={selectId}
            className="ds-input ds-input--select"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={`${errorId || ''} ${hintId || ''}`.trim() || undefined}
            {...props}
          >
            {placeholder && <option value="" disabled>{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {error && (
          <p id={errorId} className="ds-input__error" role="alert">{error}</p>
        )}
        {hint && !error && (
          <p id={hintId} className="ds-input__hint">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';