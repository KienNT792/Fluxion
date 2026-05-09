import React, {
  Children,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import {
  FormControlFont,
  FormControlSize,
  FormControlSurface,
  FormControlTone,
  getFormControlStyle,
} from './form-control';

interface SelectChangeTarget {
  name?: string;
  value: string;
}

export interface SelectChangeEvent {
  currentTarget: SelectChangeTarget;
  target: SelectChangeTarget;
  preventDefault: () => void;
  stopPropagation: () => void;
}

interface ParsedOption {
  disabled: boolean;
  key: React.Key;
  label: React.ReactNode;
  value: string;
}

type NativeOptionElement = React.ReactElement<
  React.OptionHTMLAttributes<HTMLOptionElement>,
  'option'
>;

export interface SelectProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'defaultValue' | 'onChange' | 'size' | 'type' | 'value'
  > {
  children: React.ReactNode;
  defaultValue?: string;
  invalid?: boolean;
  menuClassName?: string;
  name?: string;
  onChange?: (event: SelectChangeEvent) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  size?: FormControlSize;
  font?: FormControlFont;
  tone?: FormControlTone;
  surface?: FormControlSurface;
  value?: string;
  wrapperClassName?: string;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
}

const DEFAULT_MENU_HEIGHT = 240;
const MENU_GAP = 6;
const VIEWPORT_PADDING = 12;

function getOptionValue(option: NativeOptionElement): string {
  if (option.props.value !== undefined && option.props.value !== null) {
    return String(option.props.value);
  }

  if (typeof option.props.children === 'string') {
    return option.props.children;
  }

  return '';
}

function isOptionElement(child: React.ReactNode): child is NativeOptionElement {
  return React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)
    && child.type === 'option';
}

function parseOptions(children: React.ReactNode): ParsedOption[] {
  return Children.toArray(children).flatMap((child, index) => {
    if (!isOptionElement(child)) {
      return [];
    }

    return [
      {
        disabled: Boolean(child.props.disabled),
        key: child.key ?? `${getOptionValue(child)}-${index}`,
        label: child.props.children,
        value: getOptionValue(child),
      },
    ];
  });
}

function buildChangeEvent(name: string | undefined, value: string): SelectChangeEvent {
  const target = { name, value };

  return {
    currentTarget: target,
    target,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  };
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      children,
      className = '',
      defaultValue,
      disabled = false,
      font = 'sans',
      invalid = false,
      menuClassName = '',
      name,
      onBlur,
      onChange,
      onFocus,
      onValueChange,
      placeholder = 'Select an option',
      size = 'md',
      style,
      surface = 'card',
      tone = 'default',
      value,
      wrapperClassName = '',
      ...props
    },
    ref
  ) => {
    const listboxId = useId();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const isControlled = value !== undefined;
    const options = useMemo(() => parseOptions(children), [children]);
    const [internalValue, setInternalValue] = useState(defaultValue ?? '');
    const [isFocused, setIsFocused] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

    const currentValue = isControlled ? String(value ?? '') : internalValue;
    const selectedIndex = options.findIndex((option) => option.value === currentValue);
    const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

    const setTriggerRef = useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node;

        if (!ref) {
          return;
        }

        if (typeof ref === 'function') {
          ref(node);
          return;
        }

        ref.current = node;
      },
      [ref]
    );

    const getEnabledIndex = useCallback(
      (startIndex: number, direction: 1 | -1): number => {
        if (options.length === 0) {
          return -1;
        }

        let index = startIndex;

        for (let steps = 0; steps < options.length; steps += 1) {
          index = (index + direction + options.length) % options.length;

          if (!options[index].disabled) {
            return index;
          }
        }

        return -1;
      },
      [options]
    );

    const updateMenuPosition = useCallback(
      (menuHeight = DEFAULT_MENU_HEIGHT): void => {
        if (!triggerRef.current) {
          return;
        }

        const rect = triggerRef.current.getBoundingClientRect();
        const width = rect.width;
        const left = Math.max(
          VIEWPORT_PADDING,
          Math.min(rect.left, window.innerWidth - width - VIEWPORT_PADDING)
        );
        const availableBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
        const availableAbove = rect.top - VIEWPORT_PADDING;
        const shouldOpenAbove =
          availableBelow < menuHeight && availableAbove > availableBelow;

        const top = shouldOpenAbove
          ? Math.max(VIEWPORT_PADDING, rect.top - menuHeight - MENU_GAP)
          : Math.min(
              rect.bottom + MENU_GAP,
              window.innerHeight - menuHeight - VIEWPORT_PADDING
            );

        setMenuPosition({ left, top, width });
      },
      []
    );

    const closeMenu = useCallback(() => {
      setIsOpen(false);
      setMenuPosition(null);
    }, []);

    const emitChange = useCallback(
      (nextValue: string) => {
        onValueChange?.(nextValue);
        onChange?.(buildChangeEvent(name, nextValue));
      },
      [name, onChange, onValueChange]
    );

    const selectValue = useCallback(
      (nextValue: string) => {
        if (!isControlled) {
          setInternalValue(nextValue);
        }

        emitChange(nextValue);
        closeMenu();
        triggerRef.current?.focus();
      },
      [closeMenu, emitChange, isControlled]
    );

    useEffect(() => {
      if (disabled && isOpen) {
        closeMenu();
      }
    }, [closeMenu, disabled, isOpen]);

    useEffect(() => {
      if (isControlled) {
        return;
      }

      if (options.some((option) => option.value === internalValue)) {
        return;
      }

      const fallbackValue =
        (defaultValue && options.find((option) => option.value === defaultValue)?.value) ??
        options.find((option) => !option.disabled)?.value ??
        '';

      setInternalValue(fallbackValue);
    }, [defaultValue, internalValue, isControlled, options]);

    useEffect(() => {
      if (!isOpen) {
        return;
      }

      const startingIndex =
        selectedIndex >= 0 && !options[selectedIndex]?.disabled
          ? selectedIndex
          : options.findIndex((option) => !option.disabled);

      setHighlightedIndex(startingIndex);
    }, [isOpen, options, selectedIndex]);

    useEffect(() => {
      if (!isOpen) {
        return;
      }

      updateMenuPosition(menuRef.current?.offsetHeight ?? DEFAULT_MENU_HEIGHT);

      const handlePointerDown = (event: PointerEvent): void => {
        const target = event.target as Node;

        if (
          wrapperRef.current?.contains(target) ||
          menuRef.current?.contains(target)
        ) {
          return;
        }

        closeMenu();
      };

      const handleViewportChange = (): void => {
        updateMenuPosition(menuRef.current?.offsetHeight ?? DEFAULT_MENU_HEIGHT);
      };

      document.addEventListener('pointerdown', handlePointerDown);
      window.addEventListener('resize', handleViewportChange);
      window.addEventListener('scroll', handleViewportChange, true);

      return () => {
        document.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('resize', handleViewportChange);
        window.removeEventListener('scroll', handleViewportChange, true);
      };
    }, [closeMenu, isOpen, updateMenuPosition]);

    useEffect(() => {
      if (!isOpen || highlightedIndex < 0) {
        return;
      }

      const highlightedOption = menuRef.current?.querySelector<HTMLElement>(
        `[data-select-option-index="${highlightedIndex}"]`
      );

      highlightedOption?.scrollIntoView({ block: 'nearest' });
    }, [highlightedIndex, isOpen]);

    const toggleMenu = (): void => {
      if (disabled || options.length === 0) {
        return;
      }

      setIsOpen((previous) => !previous);
    };

    const handleTriggerKeyDown = (
      event: React.KeyboardEvent<HTMLButtonElement>
    ): void => {
      if (disabled) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();

        if (!isOpen) {
          setIsOpen(true);
          return;
        }

        setHighlightedIndex((previous) => getEnabledIndex(previous, 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();

        if (!isOpen) {
          setIsOpen(true);
          return;
        }

        setHighlightedIndex((previous) => getEnabledIndex(previous, -1));
        return;
      }

      if (event.key === 'Home') {
        if (!isOpen) {
          return;
        }

        event.preventDefault();
        setHighlightedIndex(options.findIndex((option) => !option.disabled));
        return;
      }

      if (event.key === 'End') {
        if (!isOpen) {
          return;
        }

        event.preventDefault();

        for (let index = options.length - 1; index >= 0; index -= 1) {
          if (!options[index].disabled) {
            setHighlightedIndex(index);
            break;
          }
        }

        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();

        if (!isOpen) {
          setIsOpen(true);
          return;
        }

        if (highlightedIndex >= 0 && !options[highlightedIndex]?.disabled) {
          selectValue(options[highlightedIndex].value);
        }

        return;
      }

      if (event.key === 'Escape') {
        if (!isOpen) {
          return;
        }

        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key === 'Tab') {
        closeMenu();
      }
    };

    const menu =
      isOpen && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              id={listboxId}
              aria-activedescendant={
                highlightedIndex >= 0
                  ? `${listboxId}-option-${highlightedIndex}`
                  : undefined
              }
              className={`overflow-y-auto rounded-lg ${menuClassName}`}
              style={{
                position: 'fixed',
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: `${DEFAULT_MENU_HEIGHT}px`,
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-lg)',
                padding: '6px',
                zIndex: 120,
              }}
            >
              {options.map((option, index) => {
                const isActive = option.value === currentValue;
                const isHighlighted = highlightedIndex === index;

                return (
                  <button
                    key={option.key}
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-form-control="true"
                    data-select-option-index={index}
                    disabled={option.disabled}
                    tabIndex={-1}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors"
                    style={{
                      background: isHighlighted
                        ? 'var(--color-canvas-soft)'
                        : isActive
                          ? 'var(--color-canvas)'
                          : 'transparent',
                      color: option.disabled
                        ? 'var(--color-muted-soft)'
                        : isActive
                          ? 'var(--color-primary)'
                          : 'var(--color-ink)',
                      cursor: option.disabled ? 'not-allowed' : 'pointer',
                      fontFamily: font === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
                      fontSize: size === 'sm' ? '13px' : '14px',
                      fontWeight: isActive ? 600 : 400,
                      opacity: option.disabled ? 0.65 : 1,
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onMouseEnter={() => {
                      if (!option.disabled) {
                        setHighlightedIndex(index);
                      }
                    }}
                    onClick={() => {
                      if (!option.disabled) {
                        selectValue(option.value);
                      }
                    }}
                  >
                    <span className="truncate">{option.label}</span>
                    <span
                      className="flex h-4 w-4 items-center justify-center"
                      style={{
                        color: isActive
                          ? 'var(--color-primary)'
                          : 'transparent',
                      }}
                    >
                      <Check size={14} />
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null;

    return (
      <>
        {name ? <input type="hidden" name={name} value={currentValue} /> : null}

        <div
          ref={wrapperRef}
          className={`relative w-full ${wrapperClassName}`}
          data-form-control="true"
        >
          <button
            {...props}
            ref={setTriggerRef}
            type="button"
            disabled={disabled}
            role="combobox"
            aria-controls={isOpen ? listboxId : undefined}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            data-form-control="true"
            className={`flex items-center justify-between gap-3 rounded-md text-left ${className}`}
            style={{
              ...getFormControlStyle({
                size,
                font,
                tone,
                surface,
                invalid,
                disabled,
                isFocused: isFocused || isOpen,
              }),
              cursor: disabled ? 'not-allowed' : 'pointer',
              ...style,
            }}
            onClick={toggleMenu}
            onFocus={(event) => {
              setIsFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setIsFocused(false);
              closeMenu();
              onBlur?.(event);
            }}
            onKeyDown={handleTriggerKeyDown}
          >
            <span
              className="min-w-0 flex-1 truncate"
              style={{
                color: selectedOption
                  ? tone === 'accent'
                    ? 'var(--color-primary)'
                    : 'var(--color-ink)'
                  : 'var(--color-muted)',
                fontWeight:
                  selectedOption && tone === 'accent' ? 600 : undefined,
              }}
            >
              {selectedOption?.label ?? placeholder}
            </span>

            <span
              className="flex shrink-0 items-center"
              style={{
                color: disabled
                  ? 'var(--color-muted-soft)'
                  : tone === 'accent'
                    ? 'var(--color-primary)'
                    : 'var(--color-muted)',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            >
              <ChevronDown size={14} />
            </span>
          </button>
        </div>

        {menu}
      </>
    );
  }
);

Select.displayName = 'Select';
