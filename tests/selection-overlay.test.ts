// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { SelectionOverlay } from '../lib/selection-overlay';

describe('SelectionOverlay', () => {
  it('shows a trigger button before expanding datasource choices', () => {
    const overlay = new SelectionOverlay({
      onSelect: vi.fn(async () => undefined),
    });

    overlay.show({
      rect: { left: 10, top: 20, width: 40, height: 12, bottom: 32 },
      dataSources: [
        { id: 'db-1', name: 'Inbox' },
        { id: 'db-2', name: 'Quotes' },
        { id: 'db-3', name: 'Ideas' },
      ],
    });

    const root = overlay.getRoot().shadowRoot;
    const trigger = root?.querySelector('button[data-role="trigger"]');
    const dataSourceButtons = root?.querySelectorAll('button[data-role="datasource"]');

    expect(trigger).not.toBeNull();
    expect(dataSourceButtons?.length).toBe(0);
  });

  it('expands to at most two datasource buttons after clicking the trigger', () => {
    const overlay = new SelectionOverlay({
      onSelect: vi.fn(async () => undefined),
    });

    overlay.show({
      rect: { left: 10, top: 20, width: 40, height: 12, bottom: 32 },
      dataSources: [
        { id: 'db-1', name: 'Inbox' },
        { id: 'db-2', name: 'Quotes' },
        { id: 'db-3', name: 'Ideas' },
      ],
    });

    const root = overlay.getRoot().shadowRoot;
    const trigger = root?.querySelector('button[data-role="trigger"]') as HTMLButtonElement | null;
    trigger?.click();

    const buttons = root?.querySelectorAll('button[data-role="datasource"]');
    expect(buttons?.length).toBe(2);
    expect((buttons?.[0] as HTMLButtonElement).textContent).toBe('Inbox');
    expect((buttons?.[1] as HTMLButtonElement).textContent).toBe('Quotes');
  });

  it('saves immediately when there is exactly one datasource', async () => {
    const onSelect = vi.fn(async () => undefined);
    const overlay = new SelectionOverlay({
      onSelect,
    });

    overlay.show({
      rect: { left: 10, top: 20, width: 40, height: 12, bottom: 32 },
      dataSources: [{ id: 'db-1', name: 'Inbox' }],
    });

    const trigger = overlay
      .getRoot()
      .shadowRoot?.querySelector('button[data-role="trigger"]') as HTMLButtonElement | null;

    trigger?.click();
    await Promise.resolve();

    expect(onSelect).toHaveBeenCalledWith('db-1');
  });

  it('shows success feedback before hiding', () => {
    vi.useFakeTimers();

    const overlay = new SelectionOverlay({
      onSelect: vi.fn(async () => undefined),
    });

    overlay.show({
      rect: { left: 10, top: 20, width: 40, height: 12, bottom: 32 },
      dataSources: [{ id: 'db-1', name: 'Inbox' }],
    });

    overlay.showSuccess('Saved');
    expect(overlay.isVisible()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(overlay.isVisible()).toBe(false);

    vi.useRealTimers();
  });
});
