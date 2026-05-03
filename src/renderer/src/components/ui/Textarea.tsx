import React, { forwardRef, useState } from 'react';
import {
  FormControlFont,
  FormControlSize,
  FormControlSurface,
  FormControlTone,
  getFormControlStyle,
} from './form-control';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: FormControlSize;
  font?: FormControlFont;
  tone?: FormControlTone;
  surface?: FormControlSurface;
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className = '',
      size = 'md',
      font = 'sans',
      tone = 'default',
      surface = 'card',
      invalid = false,
      disabled = false,
      style,
      onFocus,
      onBlur,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
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
            multiline: true,
            resize: style?.resize,
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

Textarea.displayName = 'Textarea';
