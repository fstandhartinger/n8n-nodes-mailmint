const { chromium } = require('/home/flori/Dev/pdfnode/pdfmint-api/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await c.newPage();
  await p.goto('http://localhost:5680', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const body = await p.locator('body').innerText().catch(() => '');
  if (/Sign in/i.test(body)) {
    await p.locator('input[type=email], input[name=email]').first().fill('demo@mailmint.dev');
    await p.locator('input[type=password]').first().fill('MailMintDemo2026');
    await p.click('[data-test-id="form-submit-button"]');
    await p.waitForTimeout(5000);
  }
  await p.goto('http://localhost:5680/workflow/new', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  await p.click('[data-test-id="canvas-plus-button"]');
  await p.waitForSelector('input[placeholder="Search nodes..."]', { timeout: 30000 });
  await p.fill('input[placeholder="Search nodes..."]', 'AI Agent');
  await p.waitForTimeout(2000);
  await p.getByText('AI Agent', { exact: true }).first().click();
  await p.waitForTimeout(3500);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => [...document.querySelectorAll('[data-test-id="canvas-handle-plus"]')].map((e) => {
    const r = e.getBoundingClientRect();
    let n = e, tid = null, hid = null;
    for (let i = 0; i < 8 && n; i++, n = n.parentElement) {
      if (!hid && n.getAttribute && n.getAttribute('data-handleid')) hid = n.getAttribute('data-handleid');
      if (!tid && n.getAttribute && n.getAttribute('data-test-id') && n.getAttribute('data-test-id') !== 'canvas-handle-plus') tid = n.getAttribute('data-test-id');
    }
    return { x: Math.round(r.x), y: Math.round(r.y), hid, tid };
  }));
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
