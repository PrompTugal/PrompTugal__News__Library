// Librarian's tool, run by hand after a build: render _site/preview.svg to src/preview.png (1200x630) for social
// cards, with the browser that is installed locally. CI has no browser, so the PNG is committed and may lag the
// SVG; the SVG itself is rebuilt at every build. Loads only the local file; no network.
const { chromium } = require('playwright');
const { readFileSync, writeFileSync } = require('node:fs');
(async () => {
  const svg = readFileSync('_site/preview.svg', 'utf8');
  if (/<script|foreignObject|\son[a-z]+=/i.test(svg)) { console.error('unsafe svg'); process.exit(1); }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, javaScriptEnabled: false, serviceWorkers: 'block' });
  await p.route('**/*', (r) => (r.request().url().startsWith('data:') || r.request().url() === 'about:blank' ? r.continue() : r.abort()));
  await p.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  writeFileSync('src/preview.png', await p.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }));
  await b.close();
  console.log('wrote src/preview.png');
})();
