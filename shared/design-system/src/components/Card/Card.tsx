import React, { HTMLAttributes, forwardRef } from 'react';
import './Card.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', padding = 'md', hoverable = false, className = '', style, ...props }, ref) => {
    const classNames = [
      'ds-card',
      `ds-card--${variant}`,
      `ds-card--padding-${padding}`,
      hoverable && 'ds-card--hoverable',
      className,
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={classNames} style={style} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, action, children, className = '', ...props }, ref) => {
    const classNames = ['ds-card__header', className].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={classNames} {...props}>
        <div className="ds-card__header-content">
          {title && <h3 className="ds-card__title">{title}</h3>}
          {subtitle && <p className="ds-card__subtitle">{subtitle}</p>}
          {children}
        </div>
        {action && <div className="ds-card__action">{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ children, className = '', ...props }, ref) => {
    const classNames = ['ds-card__body', className].filter(Boolean).join(' ');
    return <div ref={ref} className={classNames} {...props}>{children}</div>;
  }
);

CardBody.displayName = 'CardBody';

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', ...props }, ref) => {
    const classNames = ['ds-card__footer', className].filter(Boolean).join(' ');
    return <div ref={ref} className={classNames} {...props}>{children}</div>;
  }
);

CardFooter.displayName = 'CardFooter';