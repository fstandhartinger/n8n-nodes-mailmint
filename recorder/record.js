// MailMint demo recording for n8n's manual:awaiting-video stage.
//
// n8n's own checklist, read off the portal rather than guessed:
//   1. install the node from npm, the same version submitted (0.1.0)
//   2. new workflow, insert the node
//   3. set up a credential AND SHOW THE CREDENTIAL TEST PASSING
//   4. demonstrate the most common actions
//   5. show it used as a tool by an AI agent
// No cuts. Playwright records the context, so the file is continuous by
// construction.
//
// Adapted from the DocMint recorder in ../../n8n-nodes-docmint/recorder.
const { chromium } = require('/home/flori/Dev/pdfnode/pdfmint-api/node_modules/playwright');
const fs = require('fs');

const N8N = process.env.N8N_URL || 'http://localhost:5680';
const EMAIL = 'demo@mailmint.dev';
const PASS = 'MailMintDemo2026';
const KEY = fs.readFileSync('/tmp/mmdemo/key.txt', 'utf8').trim();
const OPENAI = process.env.OPENAI_API_KEY;
const SHOTS = '/tmp/mmdemo/shots';
const VIDEO = '/tmp/mmdemo/raw';
const log = (...a) => console.log('[mm]', ...a);
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(VIDEO, { recursive: true });

const SAMPLE_SUBJECT = 'Invoice INV-4417 from Nordwind Logistics';
const SAMPLE_TEXT = [
  'Hello Lena,',
  '',
  'invoice INV-4417 is below.',
  '',
  'Amount due: 128.40 EUR',
  'Due date: 2026-09-15',
  '',
  'Kind regards,',
  'Nordwind Logistics GmbH',
].join('\n');
const SAMPLE_SCHEMA = JSON.stringify([
  { name: 'invoice_number', type: 'string', description: 'The invoice number' },
  { name: 'amount_due', type: 'number', description: 'Total amount due' },
  { name: 'due_date', type: 'date', description: 'The date payment is due' },
]);

async function caption(p, text, ms = 2400) {
  await p.evaluate((t) => {
    let el = document.getElementById('__cap');
    if (!el) {
      el = document.createElement('div'); el.id = '__cap';
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;'
        + 'background:rgba(10,12,14,.93);color:#fff;font:600 19px/1.45 Inter,system-ui,sans-serif;'
        + 'padding:15px 26px;text-align:center;letter-spacing:.1px';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text).catch(() => {});
  await p.waitForTimeout(ms);
}
async function clearCaption(p) {
  await p.evaluate(() => { const e = document.getElementById('__cap'); if (e) e.remove(); }).catch(() => {});
}
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png` }).catch(() => {});

async function ensureLoggedIn(p) {
  await p.goto(N8N, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const body = await p.locator('body').innerText().catch(() => '');
  if (/Set up owner account|Get started/i.test(body)) {
    await p.locator('input[type=email], input[name=email]').first().fill(EMAIL);
    const names = p.locator('input[type=text]');
    if (await names.count() >= 2) { await names.nth(0).fill('Mail'); await names.nth(1).fill('Mint'); }
    await p.locator('input[type=password]').first().fill(PASS);
    await p.locator('button[type=submit], [data-test-id="form-submit-button"]').first().click();
    await p.waitForTimeout(6000);
  } else if (/Sign in/i.test(body)) {
    await p.locator('input[type=email], input[name=email]').first().fill(EMAIL);
    await p.locator('input[type=password]').first().fill(PASS);
    await p.click('[data-test-id="form-submit-button"]');
    await p.waitForTimeout(5000);
  }
  for (const sel of ['text=/Skip|Get started|Continue|Later/i']) {
    const b = p.locator(sel).first();
    if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await p.waitForTimeout(1500); }
  }
}
async function openNewWorkflow(p) {
  await p.goto(`${N8N}/workflow/new`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
}
async function closeNdv(p) {
  const back = p.locator('[data-test-id="back-to-canvas"]').first();
  if (await back.count().catch(() => 0)) { await back.click().catch(() => {}); await p.waitForTimeout(1200); return; }
  await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
}
const handleIndexByX = (p) => p.evaluate(() =>
  [...document.querySelectorAll('[data-test-id="canvas-handle-plus"]')]
    .map((e, i) => ({ i, x: e.getBoundingClientRect().x }))
    .sort((a, b) => a.x - b.x).map((o) => o.i));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // Owner account and the OpenAI credential are set up off-camera; the video
  // starts from a logged-in n8n with NO community node installed, which is what
  // the checklist asks for.
  // The owner account and the OpenAI credential are created off-camera by
  // setup.sh before this script runs, so the recording starts from a
  // logged-in n8n with NO community node installed — which is what the
  // checklist asks for. Doing it here through the page's own fetch was
  // fragile: it raced the post-setup navigation, and then 401'd on the
  // browser-id header n8n binds to the session.
  if (!OPENAI) log('WARNING: no OPENAI_API_KEY; the agent stage will fail');

  const c = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: VIDEO, size: { width: 1280, height: 720 } },
  });
  const p = await c.newPage();

  try {
    await ensureLoggedIn(p);
    log('logged in at', p.url());

    // ---- 1. install from npm ----------------------------------------------
    await p.goto(`${N8N}/settings/community-nodes`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3500);
    await caption(p, 'A fresh n8n 2.36.7 with no community nodes installed.', 2800);
    await shot(p, '01-empty');
    await p.locator('button:has-text("Install a community node"), button:has-text("Install")').first().click();
    await p.waitForTimeout(1500);
    await caption(p, 'Installing n8n-nodes-mailmint 0.1.0 from npm — the version submitted.', 3000);
    await p.locator('input[placeholder*="n8n-nodes"], .el-dialog input[type=text]').first().fill('n8n-nodes-mailmint');
    await p.waitForTimeout(900);
    const installBtn = () => p.locator('.el-dialog button, [role=dialog] button')
      .filter({ hasText: /^\s*Install\s*$/ }).last();
    for (const attempt of ['label', 'checkbox', 'coords']) {
      if (!(await installBtn().isDisabled().catch(() => true))) break;
      if (attempt === 'label') await p.getByText(/I understand the risks/i).first().click({ force: true }).catch(() => {});
      if (attempt === 'checkbox') await p.locator('input[type=checkbox]').first().click({ force: true }).catch(() => {});
      if (attempt === 'coords') {
        const box = await p.getByText(/I understand the risks/i).first().boundingBox().catch(() => null);
        if (box) await p.mouse.click(box.x - 14, box.y + 8);
      }
      await p.waitForTimeout(1200);
    }
    if (await installBtn().isDisabled().catch(() => true)) throw new Error('risks checkbox never ticked; Install still disabled');
    await installBtn().click();
    await caption(p, 'Downloading from the public registry.', 2000);
    await p.waitForSelector('text=n8n-nodes-mailmint', { timeout: 240000 });
    await p.waitForTimeout(2500);
    await caption(p, 'Installed — zero runtime dependencies, published with npm provenance.', 3200);
    await shot(p, '02-installed');
    log('installed');

    // ---- 2. workflow + node ------------------------------------------------
    await openNewWorkflow(p);
    await p.waitForSelector('[data-test-id="canvas-plus-button"]', { timeout: 60000 });
    await p.waitForTimeout(1500);
    await caption(p, 'A new workflow.', 1800);
    await p.click('[data-test-id="canvas-plus-button"]');
    await p.waitForSelector('input[placeholder="Search nodes..."]', { timeout: 30000 });
    await p.waitForTimeout(1200);
    await p.getByText('Trigger manually', { exact: true }).first().click();
    await p.waitForSelector('[data-test-id="canvas-handle-plus"]', { timeout: 30000 });
    await p.waitForTimeout(2000);

    await p.click('[data-test-id="canvas-handle-plus"]');
    await p.waitForSelector('input[placeholder="Search nodes..."]', { timeout: 30000 });
    await caption(p, 'Adding the MailMint node.', 2000);
    await p.fill('input[placeholder="Search nodes..."]', 'MailMint');
    await p.waitForTimeout(2200);
    let item = p.locator('[data-test-id="node-creator-item-name"]').filter({ hasText: /^MailMint$/i }).first();
    if (!(await item.count().catch(() => 0))) item = p.getByText(/^MailMint$/i).first();
    await item.click();
    await p.waitForTimeout(2500);
    await caption(p, 'Eleven actions across mailboxes, messages and one-off parsing.', 3200);
    await shot(p, '03-actions');
    await p.getByText(/Parse an email/i).first().click();
    await p.waitForTimeout(2500);
    await p.waitForSelector('[data-test-id="node-parameters"]', { timeout: 30000 });
    await p.waitForTimeout(2000);
    await shot(p, '04-node-added');

    // ---- 3. credential + the test result ON SCREEN -------------------------
    await caption(p, 'Creating the MailMint credential.', 2200);
    await p.getByText(/Connect to MailMint|Set up credential|Create new credential/i).first().click();
    const keyInput = p.locator('input[placeholder*="mm_live"], [data-test-id="parameter-input-apiKey"] input').first();
    await keyInput.waitFor({ state: 'visible', timeout: 45000 });
    await keyInput.fill(KEY);
    await p.waitForTimeout(1200);
    await caption(p, 'Base URL is already the hosted API — nothing to look up.', 3000);
    await p.waitForTimeout(800);
    await caption(p, 'Saving. n8n calls GET /v1/usage to test the key.', 2600);
    await p.locator('[data-test-id="credential-save-button"]').click();
    await p.waitForTimeout(5000);
    await caption(p, 'Reopening the credential to show the connection test.', 2400);
    const pencil = p.locator('[data-test-id="credential-edit-button"], [data-test-id="edit-credential-button"]').first();
    if (await pencil.count()) await pencil.click();
    await p.waitForSelector('text=Connection tested successfully', { timeout: 60000 });
    await caption(p, 'Credential test passed: "Connection tested successfully".', 4500);
    await shot(p, '05-credential-tested');
    log('credential banner shown');
    const close = p.locator('[data-test-id="close-credential-modal"], .el-dialog__headerbtn').first();
    if (await close.count()) await close.click().catch(() => {});
    await p.waitForTimeout(2500);
    fs.writeFileSync('/tmp/mmdemo/.stage', 'credential-ok');
  } catch (e) {
    log('FAILED before stage 4:', e.message.split('\n')[0]);
    await shot(p, 'failure');
    await c.close().catch(() => {});
    await browser.close().catch(() => {});
    process.exit(1);
  }

  await require('/home/flori/Dev/pdfnode/n8n-nodes-mailmint/recorder/part2.js')({
    p, c, browser, caption, clearCaption, shot, closeNdv, openNewWorkflow, handleIndexByX,
    log, fs, SHOTS, SAMPLE_SUBJECT, SAMPLE_TEXT, SAMPLE_SCHEMA,
  });
})();
