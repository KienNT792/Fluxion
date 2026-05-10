import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'toolbar';
  isActive?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'secondary', size = 'md', isActive, disabled, children, style, ...props }, ref) => {
    // Determine styles based on variant
    const getVariantStyle = (): React.CSSProperties => {
      switch (variant) {
        case 'primary':
          return {
            background: isActive ? 'var(--color-primary-active)' : 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            border: '1px solid transparent',
            fontWeight: 500,
          };
        case 'danger':
          return {
            background: 'var(--color-surface-card)',
            color: 'var(--color-semantic-error)',
            border: '1px solid var(--color-semantic-error)',
            fontWeight: 500,
          };
        case 'ghost':
          return {
            background: isActive ? 'var(--color-surface-strong)' : 'transparent',
            color: isActive ? 'var(--color-ink)' : 'var(--color-muted)',
            border: '1px solid transparent',
          };
        case 'secondary':
        default:
          return {
            background: isActive ? 'var(--color-surface-strong)' : 'var(--color-surface-card)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-hairline)',
            fontWeight: 500,
          };
      }
    };

    // Determine padding based on size
    const getSizeStyle = (): React.CSSProperties => {
      switch (size) {
        case 'sm':
          return { minHeight: '32px', padding: '0 12px', fontSize: '13px' };
        case 'lg':
          return { minHeight: '40px', padding: '0 18px', fontSize: '15px' };
        case 'icon':
          return {
            width: '32px',
            height: '32px',
            minWidth: '32px',
            padding: '0',
            fontSize: '14px',
          };
        case 'toolbar':
          return { minHeight: '32px', padding: '0 12px', fontSize: '13px' };
        case 'md':
        default:
          return { height: '40px', minHeight: '40px', padding: '0 17px', fontSize: '14px' };
      }
    };

    // Disabled styles override
    const getDisabledStyle = (): React.CSSProperties => {
      if (!disabled) return {};
      return {
        background: 'var(--color-canvas-soft)',
        color: 'var(--color-muted-soft)',
        borderColor: variant === 'secondary' ? 'var(--color-hairline)' : 'transparent',
        cursor: 'not-allowed',
        opacity: 0.8,
      };
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${className}`}
        style={{
          fontFamily: 'var(--font-sans)',
          lineHeight: 1,
          letterSpacing: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...getSizeStyle(),
          ...getVariantStyle(),
          ...style,
          ...getDisabledStyle(),
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          if (variant === 'primary') e.currentTarget.style.background = 'var(--color-primary-active)';
          if (variant === 'secondary') e.currentTarget.style.background = 'var(--color-canvas-soft)';
          if (variant === 'ghost') {
            e.currentTarget.style.background = 'var(--color-surface-strong)';
            e.currentTarget.style.color = 'var(--color-ink)';
          }
          if (variant === 'danger') {
             e.currentTarget.style.background = '#ffe5eb'; // Light red hint
          }
        }}
        onMouseLeave={(e) => {
          if (disabled) return;
          if (variant === 'primary') e.currentTarget.style.background = isActive ? 'var(--color-primary-active)' : 'var(--color-primary)';
          if (variant === 'secondary') e.currentTarget.style.background = isActive ? 'var(--color-surface-strong)' : 'var(--color-surface-card)';
          if (variant === 'ghost') {
            e.currentTarget.style.background = isActive ? 'var(--color-surface-strong)' : 'transparent';
            e.currentTarget.style.color = isActive ? 'var(--color-ink)' : 'var(--color-muted)';
          }
          if (variant === 'danger') {
            e.currentTarget.style.background = 'var(--color-surface-card)';
          }
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
