import { describe, expect, it } from 'vitest';
import { getNextBinarySwitchValueFromKey } from './BinarySwitch';

describe('getNextBinarySwitchValueFromKey', () => {
  it('toggles with Enter and Space', () => {
    expect(getNextBinarySwitchValueFromKey('Enter', false)).toBe(true);
    expect(getNextBinarySwitchValueFromKey(' ', true)).toBe(false);
  });

  it('selects explicit sides with arrow keys', () => {
    expect(getNextBinarySwitchValueFromKey('ArrowLeft', true)).toBe(false);
    expect(getNextBinarySwitchValueFromKey('ArrowRight', false)).toBe(true);
  });

  it('ignores unrelated keys', () => {
    expect(getNextBinarySwitchValueFromKey('Escape', false)).toBeNull();
  });
});
