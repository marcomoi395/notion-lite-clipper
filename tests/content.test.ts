// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OVERLAY_OWNER = 'notion-lite-clipper';

describe('content script', () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.innerHTML = '<body><p>test</p></body>';

    Object.defineProperty(globalThis, 'defineContentScript', {
      configurable: true,
      value: (config: unknown) => config,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render an inline picker after selection changes', async () => {
    const contentScript = (await import('../entrypoints/content')).default as { main: () => void };
    contentScript.main();

    document.dispatchEvent(new Event('selectionchange'));
    document.dispatchEvent(new Event('mouseup'));

    expect(document.querySelector(`[data-owner="${OVERLAY_OWNER}"]`)).toBeNull();
  });
});
