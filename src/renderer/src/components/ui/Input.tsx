import React, { forwardRef, useState } from 'react';
import {
  FormControlFont,
  FormControlSize,
  FormControlSurface,
  FormControlTone,
  getFormControlStyle,
} from './form-control';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: FormControlSize;
  font?: FormControlFont;
  tone?: FormControlTone;
  surface?: FormControlSurface;
  invalid?: boolean;
  htmlSize?: number;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      size = 'md',
      font = 'sans',
      tone = 'default',
      surface = 'card',
      invalid = false,
      disabled = false,
      htmlSize,
      style,
      onFocus,
      onBlur,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        size={htmlSize}
        className={`rounded-md ${className}`}
        style={{
          ...getFormControlStyle({
            size,
            font,
            tone,
            surface,
            invalid,
            disabled,
            isFocused,
          }),
          ...style,
        }}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
