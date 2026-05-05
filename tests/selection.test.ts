import { describe, expect, it } from 'vitest';

import { countWords, getNormalizedSelectionText, isSelectionEligible } from '../lib/selection';

describe('countWords', () => {
  it('counts words using whitespace boundaries', () => {
    expect(countWords('one   two\nthree')).toBe(3);
  });
});

describe('getNormalizedSelectionText', () => {
  it('trims surrounding whitespace', () => {
    expect(getNormalizedSelectionText('  short text  ')).toBe('short text');
  });
});

describe('isSelectionEligible', () => {
  it('accepts selections with at most 10 words', () => {
    expect(isSelectionEligible('one two three')).toBe(true);
    expect(isSelectionEligible('1 2 3 4 5 6 7 8 9 10')).toBe(true);
  });

  it('rejects empty selections and selections longer than 10 words', () => {
    expect(isSelectionEligible('')).toBe(false);
    expect(isSelectionEligible('1 2 3 4 5 6 7 8 9 10 11')).toBe(false);
  });
});
