import type { DataSourceConfig, SelectionRect } from './types';

const HIDE_DELAY_MS = 900;
const MAX_VISIBLE_DATA_SOURCES = 2;
const OVERLAY_Z_INDEX = '2147483647';

interface OverlayShowOptions {
  rect: SelectionRect;
  dataSources: DataSourceConfig[];
}

interface SelectionOverlayOptions {
  onSelect: (dataSourceId: string) => void | Promise<void>;
}

export class SelectionOverlay {
  private readonly host: HTMLDivElement;
  private readonly shadowRoot: ShadowRoot;
  private readonly panel: HTMLDivElement;
  private readonly actions: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly options: SelectionOverlayOptions;
  private hideTimer: number | null = null;
  private visible = false;
  private activeDataSourceId = '';
  private dataSources: DataSourceConfig[] = [];
  private expanded = false;

  constructor(options: SelectionOverlayOptions) {
    this.options = options;
    this.host = document.createElement('div');
    this.host.dataset.owner = 'notion-lite-clipper';
    this.host.style.position = 'fixed';
    this.host.style.zIndex = OVERLAY_Z_INDEX;
    this.host.style.pointerEvents = 'auto';
    this.shadowRoot = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .panel {
        width: fit-content;
        max-width: min(360px, calc(100vw - 24px));
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px;
        border-radius: 18px;
        background: rgba(245, 245, 247, 0.86);
        color: #1d1d1f;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.16);
        border: 1px solid rgba(0, 0, 0, 0.08);
        backdrop-filter: blur(20px) saturate(180%);
        transform: translateY(4px);
        opacity: 0;
        transition: opacity 120ms ease, transform 120ms ease;
      }
      .panel.is-visible {
        transform: translateY(0);
        opacity: 1;
      }
      .panel.is-expanded {
        border-radius: 18px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        min-height: 36px;
        padding: 8px 14px;
        font-size: 12px;
        line-height: 1.2;
        color: #ffffff;
        background: #0066cc;
        cursor: pointer;
        transition: transform 120ms ease, opacity 120ms ease, background-color 120ms ease;
      }
      button:hover { background: #0071e3; }
      button:active { transform: scale(0.98); }
      button:disabled { opacity: 0.55; cursor: wait; transform: none; }
      button[data-state='success'] {
        background: #1d9a6c;
      }
      button[data-state='saving'] {
        background: #0071e3;
      }
      .trigger {
        min-width: 36px;
        padding: 8px;
        font-size: 13px;
        font-weight: 600;
      }
      .status {
        min-height: 16px;
        padding: 0 4px;
        font-size: 12px;
        color: #6e6e73;
      }
      .status:empty {
        display: none;
      }
      .status[data-state='error'] {
        color: #d70015;
      }
      .status[data-state='success'] {
        color: #1d9a6c;
      }
      .status[data-state='info'] {
        color: #6e6e73;
      }
    `;

    this.panel = document.createElement('div');
    this.panel.className = 'panel';

    this.actions = document.createElement('div');
    this.actions.className = 'actions';

    this.status = document.createElement('div');
    this.status.className = 'status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');

    this.panel.append(this.actions, this.status);
    this.shadowRoot.append(style, this.panel);

    this.host.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }

  getRoot(): HTMLDivElement {
    return this.host;
  }

  contains(node: Node | null): boolean {
    return Boolean(node && this.host.contains(node));
  }

  isVisible(): boolean {
    return this.visible;
  }

  show({ rect, dataSources }: OverlayShowOptions): void {
    if (dataSources.length === 0) {
      this.hide();
      return;
    }

    if (!this.host.isConnected) {
      document.documentElement.append(this.host);
    }

    this.clearHideTimer();
    this.visible = true;
    this.activeDataSourceId = '';
    this.dataSources = dataSources;
    this.expanded = false;
    this.renderActions();
    this.setStatus('', 'info');
    this.position(rect);

    requestAnimationFrame(() => {
      this.panel.classList.add('is-visible');
    });
  }

  hide(): void {
    this.clearHideTimer();
    this.visible = false;
    this.activeDataSourceId = '';
    this.expanded = false;
    this.panel.classList.remove('is-visible', 'is-expanded');
    this.host.remove();
  }

  setSaving(dataSourceId: string): void {
    this.activeDataSourceId = dataSourceId;
    this.setStatus('Saving…', 'info');
    for (const button of this.actions.querySelectorAll<HTMLButtonElement>('button')) {
      const isTarget = button.dataset.id === dataSourceId;
      button.disabled = true;
      button.dataset.state = isTarget ? 'saving' : '';
    }
  }

  showError(message: string): void {
    this.activeDataSourceId = '';
    this.setStatus(message, 'error');
    for (const button of this.actions.querySelectorAll<HTMLButtonElement>('button')) {
      button.disabled = false;
      button.dataset.state = '';
    }
  }

  showSuccess(message: string): void {
    this.setStatus(message, 'success');
    for (const button of this.actions.querySelectorAll<HTMLButtonElement>('button')) {
      const isTarget = button.dataset.id === this.activeDataSourceId;
      button.disabled = true;
      button.dataset.state = isTarget ? 'success' : '';
    }

    this.hideTimer = window.setTimeout(() => {
      this.hide();
    }, HIDE_DELAY_MS);
  }

  private renderActions(): void {
    this.actions.replaceChildren();
    this.panel.classList.toggle('is-expanded', this.expanded);

    if (!this.expanded) {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'trigger';
      trigger.dataset.role = 'trigger';
      trigger.dataset.id = this.dataSources.length === 1 ? this.dataSources[0].id : '';
      trigger.setAttribute('aria-label', 'Save selection to Notion');
      trigger.textContent = 'N';
      trigger.addEventListener('click', () => {
        if (this.dataSources.length === 1) {
          void this.options.onSelect(this.dataSources[0].id);
          return;
        }

        this.expanded = true;
        this.renderActions();
      });
      this.actions.append(trigger);
      return;
    }

    for (const dataSource of this.dataSources.slice(0, MAX_VISIBLE_DATA_SOURCES)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = dataSource.name;
      button.dataset.id = dataSource.id;
      button.dataset.role = 'datasource';
      button.addEventListener('click', () => this.options.onSelect(dataSource.id));
      this.actions.append(button);
    }
  }

  private setStatus(message: string, state: 'error' | 'success' | 'info'): void {
    this.status.textContent = message;
    this.status.dataset.state = state;
  }

  private position(rect: SelectionRect): void {
    const panelWidth = this.expanded ? 240 : 54;
    const topPadding = 12;
    const belowTop = rect.bottom + 10;
    const aboveTop = rect.top - 56;
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - panelWidth / 2),
      window.innerWidth - panelWidth - 12,
    );
    const top = aboveTop > topPadding ? aboveTop : belowTop;

    this.host.style.left = `${left}px`;
    this.host.style.top = `${Math.max(topPadding, top)}px`;
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
