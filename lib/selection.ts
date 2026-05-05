import type { SelectionRect } from './types';

const MAX_SELECTION_WORDS = 10;

export function getNormalizedSelectionText(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function countWords(text: string): number {
  const normalized = getNormalizedSelectionText(text);
  if (!normalized) {
    return 0;
  }

  return normalized.split(' ').length;
}

export function isSelectionEligible(text: string): boolean {
  const wordCount = countWords(text);
  return wordCount > 0 && wordCount <= MAX_SELECTION_WORDS;
}

export function toSelectionRect(rect: DOMRect): SelectionRect {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
  };
}

export function getSelectionSnapshot(selection: Selection | null): { text: string; rect: SelectionRect } | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const text = getNormalizedSelectionText(selection.toString());
  if (!isSelectionEligible(text)) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const fallbackRect = range.getClientRects()[0];
  const usableRect = rect.width || rect.height ? rect : fallbackRect;

  if (!usableRect) {
    return null;
  }

  return {
    text,
    rect: toSelectionRect(usableRect),
  };
}
