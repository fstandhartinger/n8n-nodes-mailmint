const { chromium } = require('/home/flori/Dev/pdfnode/pdfmint-api/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await c.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  p.on('requestfailed', (r) => console.log('REQFAIL', r.method(), r.url().slice(0, 120), r.failure() && r.failure().errorText));
  p.on('response', async (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(0, 140)); });
  p.on('request', (r) => { if (/\/(rest|webhook|chat)\//.test(r.url()) && /run|chat|push|execut/i.test(r.url())) console.log('REQ', r.method(), r.url().slice(0, 150)); });
  p.on('websocket', (ws) => { console.log('WS', ws.url().slice(0, 120)); ws.on('socketerror', (e) => console.log('WS ERR', e)); ws.on('close', () => console.log('WS CLOSED')); });
  await p.goto('http://localhost:5680', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const body = await p.locator('body').innerText().catch(() => '');
  if (/Sign in/i.test(body)) {
    await p.locator('input[type=email]').first().fill('demo@mailmint.dev');
    await p.locator('input[type=password]').first().fill('MailMintDemo2026');
    await p.click('[data-test-id="form-submit-button"]');
    await p.waitForTimeout(5000);
  }
  await p.goto('http://localhost:5680/workflow/KyxdNItrla1plPBl', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(6000);
  const editHere = p.getByText(/^\s*Edit here\s*$/i).first();
  if (await editHere.count().catch(() => 0)) { console.log('clicking Edit here'); await editHere.click().catch(() => {}); await p.waitForTimeout(3000); }
  const openChat = p.getByRole('button', { name: /Open chat/i });
  const n = await openChat.count();
  console.log('open chat buttons:', n);
  if (n) { await openChat.nth(n - 1).click(); await p.waitForTimeout(3000); }
  let box = p.locator('[data-test-id="chat-input"] textarea, [data-test-id="chat-input"]').first();
  if (!(await box.count())) box = p.getByPlaceholder(/Type message/i).first();
  if (!(await box.count())) box = p.locator('textarea:visible').last();
  await box.click();
  await box.fill('Call the MailMint tool now and tell me the invoice number.');
  await p.keyboard.press('Enter');
  for (let i = 0; i < 30; i++) {
    const t = await p.locator('body').innerText().catch(() => '');
    if (/INV-4417|Failed to receive/i.test(t)) { console.log('RESULT after', i, 'ticks'); break; }
    await p.waitForTimeout(1500);
  }
  await p.screenshot({ path: '/tmp/mmdemo/debug-chat.png' });
  const t = await p.locator('body').innerText();
  console.log('---'); console.log(t.slice(-800));
  await b.close();
})();
