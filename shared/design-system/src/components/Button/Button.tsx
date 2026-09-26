import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      icon,
      iconPosition = 'left',
      disabled,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const classNames = [
      'ds-button',
      `ds-button--${variant}`,
      `ds-button--${size}`,
      fullWidth && 'ds-button--full-width',
      loading && 'ds-button--loading',
      className,
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={classNames}
        disabled={disabled || loading}
        style={style}
        {...props}
      >
        {loading && <span className="ds-button__spinner" aria-hidden="true" />}
        {!loading && icon && iconPosition === 'left' && (
          <span className="ds-button__icon ds-button__icon--left" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="ds-button__text">{children}</span>
        {!loading && icon && iconPosition === 'right' && (
          <span className="ds-button__icon ds-button__icon--right" aria-hidden="true">
            {icon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';