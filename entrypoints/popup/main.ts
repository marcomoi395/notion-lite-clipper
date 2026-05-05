import './style.css';

import type { PublicConfig } from '../../lib/types';

async function getPublicConfig(): Promise<PublicConfig> {
  return browser.runtime.sendMessage({ type: 'get-public-config' }) as Promise<PublicConfig>;
}

function render(app: HTMLDivElement, config: PublicConfig): void {
  const isReady = config.hasToken && config.dataSources.length > 0;

  app.innerHTML = `
    <main class="popup-shell">
      <section class="card">
        <p class="eyebrow">Notion Lite Clipper</p>
        <h1>Right-click capture is ${isReady ? 'ready' : 'not ready'}</h1>
        <p class="description">
          Select up to 10 words on any page, then right-click and choose a Notion datasource from the extension submenu.
        </p>
        <dl class="status-list">
          <div>
            <dt>Token</dt>
            <dd>${config.hasToken ? 'Configured' : 'Missing'}</dd>
          </div>
          <div>
            <dt>Databases</dt>
            <dd>${config.dataSources.length}</dd>
          </div>
        </dl>
        <button id="open-options" type="button">Open settings</button>
      </section>
    </main>
  `;

  app.querySelector<HTMLButtonElement>('#open-options')?.addEventListener('click', async () => {
    await browser.runtime.openOptionsPage();
    window.close();
  });
}

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  void getPublicConfig()
    .then((config) => render(app, config))
    .catch(() => {
      app.innerHTML = `
        <main class="popup-shell">
          <section class="card">
            <p class="eyebrow">Notion Lite Clipper</p>
            <h1>Settings unavailable</h1>
            <p class="description">Open extension settings and try again.</p>
          </section>
        </main>
      `;
    });
}
