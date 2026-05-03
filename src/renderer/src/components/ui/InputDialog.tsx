import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PencilLine } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';

interface InputDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  value: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onValueChange: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const InputDialog: React.FC<InputDialogProps> = ({
  isOpen,
  title,
  description,
  value,
  placeholder,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmDisabled = false,
  onValueChange,
  onConfirm,
  onCancel,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }

      if (event.key === 'Enter' && !confirmDisabled) {
        event.preventDefault();
        void onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDisabled, isOpen, onCancel, onConfirm]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
      style={{ background: 'rgba(38, 37, 30, 0.4)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md overflow-hidden rounded-lg"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-start gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-hairline)' }}
        >
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            style={{
              background: 'var(--color-canvas-soft)',
              border: '1px solid var(--color-hairline)',
              color: 'var(--color-primary)',
            }}
          >
            <PencilLine size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-4">
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            surface="canvas"
          />
        </div>

        <div
          className="flex items-center justify-between gap-2 px-5 py-4"
          style={{ borderTop: '1px solid var(--color-hairline)' }}
        >
          <p className="text-[11px] font-mono" style={{ color: 'var(--color-muted-soft)' }}>
            Press Enter to confirm
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={confirmDisabled}>
              {cancelLabel}
            </Button>
            <Button variant="primary" size="sm" onClick={onConfirm} disabled={confirmDisabled}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
