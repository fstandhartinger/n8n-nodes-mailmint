// Stages 4 and 5 of the MailMint demo: the common action, then the AI-agent tool.
module.exports = async function part2(ctx) {
  const {
    p, c, browser, caption, clearCaption, shot, closeNdv, openNewWorkflow, handleIndexByX,
    log, fs, SHOTS, SAMPLE_SUBJECT, SAMPLE_TEXT, SAMPLE_SCHEMA,
  } = ctx;

  // Element Plus selects: open the control, then click the option by its exact
  // label inside the dropdown that just opened. Matching on page text alone
  // picks up the label of the field itself, which is why the first take typed
  // into a Subject field that was not on screen.
  const selectOption = async (testId, label) => {
    const ctl = p.locator(`[data-test-id="parameter-input-${testId}"]`).first();
    await ctl.waitFor({ state: 'visible', timeout: 25000 });
    await ctl.click();
    await p.waitForTimeout(1400);
    // Each option renders its name AND a description line, so an exact-text
    // match on the whole item never fires, and a loose one picks the first
    // option whose *description* happens to contain the word. Match the first
    // line only, and click the real coordinates.
    const at = await p.evaluate((wanted) => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item, [role="option"]')]
        .filter((e) => e.offsetParent !== null);
      const hit = items.find((e) => (e.innerText || '').split('\n')[0].trim().toLowerCase() === wanted.toLowerCase());
      if (!hit) return null;
      const r = hit.getBoundingClientRect();
      return { x: r.x + Math.min(60, r.width / 2), y: r.y + 12 };
    }, label);
    if (!at) throw new Error(`option "${label}" not in the ${testId} dropdown`);
    await p.mouse.click(at.x, at.y);
    await p.waitForTimeout(1600);
  };

  // The agent's sub-node handles carry a data-handleid on their wrapper:
  // inputs/ai_languageModel/0, inputs/ai_memory/0, inputs/ai_tool/0. Picking
  // them by x position instead put the chat model on the wrong parent, which is
  // why take 5 ended in "Chat Model*" and "Failed to receive response".
  const clickHandle = async (handleId) => {
    const at = await p.evaluate((want) => {
      const hit = [...document.querySelectorAll('[data-handleid]')]
        .find((e) => e.getAttribute('data-handleid') === want
          && e.querySelector('[data-test-id="canvas-handle-plus"]'));
      if (!hit) return null;
      const plus = hit.querySelector('[data-test-id="canvas-handle-plus"]');
      const r = plus.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, handleId);
    if (!at) throw new Error(`no "+" handle for ${handleId}`);
    await p.mouse.click(at.x, at.y);
    await p.waitForTimeout(3000);
  };

  const typeInto = async (testId, text) => {
    const box = p.locator(`[data-test-id="parameter-input-${testId}"] .cm-content, `
      + `[data-test-id="parameter-input-${testId}"] textarea, `
      + `[data-test-id="parameter-input-${testId}"] input`).first();
    await box.waitFor({ state: 'visible', timeout: 25000 });
    await box.click();
    await p.keyboard.press('Control+a');
    await p.keyboard.press('Backspace');
    await p.waitForTimeout(300);
    await p.keyboard.type(text, { delay: 4 });
    await p.waitForTimeout(600);
    await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(400);
  };

  try {
    // ---- 4. the common action: an email in, the fields you asked for out ----
    await caption(p, 'Parse takes a message you already have — no address needed.', 3200);
    await selectOption('inputSource', 'Fields');
    await typeInto('subject', SAMPLE_SUBJECT);
    await p.waitForTimeout(600);
    await typeInto('text', SAMPLE_TEXT);
    await p.waitForTimeout(800);
    await shot(p, '06-message');

    await caption(p, 'The fields are defined here, on the canvas — not in another web app.', 4000);
    // The schema is a JSON parameter; switch the source to JSON, then type it.
    await selectOption('schemaSource', 'JSON');
    await typeInto('schemaJson', SAMPLE_SCHEMA);
    await p.waitForTimeout(800);
    await shot(p, '07-schema');

    await caption(p, 'Executing the node.', 2000);
    await p.locator('button:has-text("Execute step")').first().click();
    await p.waitForTimeout(1500);
    await p.waitForSelector('text=/invoice_number/i', { timeout: 120000 });
    await p.waitForTimeout(2500);
    await shot(p, '08-executed');
    const out = await p.locator('body').innerText();
    fs.writeFileSync(`${SHOTS}/parse-output.txt`, out);
    const gotAll = /INV-4417/.test(out) && /128\.4/.test(out) && /2026-09-15/.test(out);
    log('parse output has all three fields:', gotAll);
    await caption(p, gotAll
      ? 'INV-4417, 128.40 and 2026-09-15 — read out of the message, with confidence on each field.'
      : 'The parsed fields come back as plain JSON.', 5000);
    await p.waitForTimeout(1500);

    // A second action, so "most common actions" is more than one call.
    await caption(p, 'The same node also lists the mailboxes on the account.', 3000);
    await closeNdv(p);
    await p.waitForTimeout(1500);
    const plus = await handleIndexByX(p);
    await p.locator('[data-test-id="canvas-handle-plus"]').nth(plus[plus.length - 1]).click({ force: true });
    await p.waitForSelector('input[placeholder="Search nodes..."]', { timeout: 30000 });
    await p.fill('input[placeholder="Search nodes..."]', 'MailMint');
    await p.waitForTimeout(2000);
    let item2 = p.locator('[data-test-id="node-creator-item-name"]').filter({ hasText: /^MailMint$/i }).first();
    if (!(await item2.count().catch(() => 0))) item2 = p.getByText(/^MailMint$/i).first();
    await item2.click();
    await p.waitForTimeout(2200);
    const many = p.getByText(/Get Many Mailboxes|Get many mailboxes/i).first();
    if (await many.count().catch(() => 0)) {
      await many.click();
      await p.waitForTimeout(2500);
      await p.locator('button:has-text("Execute step")').first().click();
      await p.waitForTimeout(9000);
      await shot(p, '09-mailboxes');
      const mb = await p.locator('body').innerText();
      log('mailbox listing shows an address:', /smooth-operator\.online/.test(mb));
      await caption(p, 'A real mailbox on the account, with its inbound address.', 3800);
      await p.waitForTimeout(1200);
    } else {
      log('mailbox action not found; skipping the second action');
    }
    await closeNdv(p);
    await p.waitForTimeout(1500);

    // ---- 5. used as a tool by an AI agent ---------------------------------
    await openNewWorkflow(p);
    await p.waitForSelector('[data-test-id="canvas-plus-button"]', { timeout: 60000 });
    await p.waitForTimeout(1500);
    await caption(p, 'The same node also works as an AI agent tool.', 2600);
    await p.click('[data-test-id="canvas-plus-button"]');
    await p.waitForSelector('input[placeholder="Search nodes..."]', { timeout: 30000 });
    await p.fill('input[placeholder="Search nodes..."]', 'AI Agent');
    await p.waitForTimeout(2000);
    await p.getByText('AI Agent', { exact: true }).first().click();
    await p.waitForTimeout(3500);
    await closeNdv(p);
    await p.waitForTimeout(2000);

    await caption(p, 'Attaching a chat model.', 2000);
    await clickHandle('inputs/ai_languageModel/0');
    const sb0 = p.locator('input[placeholder*="Search"]').first();
    await sb0.waitFor({ state: 'visible', timeout: 30000 });
    await sb0.fill('OpenAI Chat Model');
    await p.waitForTimeout(2200);
    await p.getByText('OpenAI Chat Model', { exact: false }).first().click();
    await p.waitForTimeout(3500);
    await closeNdv(p);
    await p.waitForTimeout(2500);
    const modelOnCanvas = await p.getByText(/OpenAI Chat Model/i).count();
    log('chat model on canvas:', modelOnCanvas);
    if (!modelOnCanvas) throw new Error('chat model did not attach; the agent would error');

    await caption(p, 'Attaching MailMint as the agent’s tool.', 2400);
    await clickHandle('inputs/ai_tool/0');
    const searchBox = p.locator('input[placeholder*="Search"]').first();
    await searchBox.waitFor({ state: 'visible', timeout: 30000 });
    await searchBox.fill('MailMint');
    await p.waitForTimeout(2400);
    // In the Tools panel the entry is called "MailMint Tool", not "MailMint",
    // so an anchored match on the bare name finds nothing.
    await p.getByText(/^MailMint Tool$/i).first().click();
    await p.waitForTimeout(2500);
    // Picking "MailMint Tool" can land straight in the node's parameters — the
    // tool panel does not always show an action list first. Only click an action
    // if one is actually offered; clicking the NDV heading times out.
    const params = p.locator('[data-test-id="node-parameters"]');
    if (!(await params.isVisible().catch(() => false))) {
      await caption(p, 'Choosing the Parse action for the tool.', 2400);
      await p.getByText(/Parse an email/i).first().click();
      await p.waitForTimeout(3500);
    } else {
      await caption(p, 'The tool opens on Parse — the action the agent will call.', 2600);
    }
    await params.waitFor({ state: 'visible', timeout: 30000 });

    // The tool needs a message to parse. Pin it, and let the agent decide when
    // to call the tool — which is exactly what the checklist asks to be shown.
    await caption(p, 'Pinning the message and the fields the tool will extract.', 3000);
    await selectOption('inputSource', 'Fields');
    await typeInto('subject', SAMPLE_SUBJECT);
    await p.waitForTimeout(500);
    await typeInto('text', SAMPLE_TEXT);
    await p.waitForTimeout(500);
    await selectOption('schemaSource', 'JSON');
    await typeInto('schemaJson', SAMPLE_SCHEMA);
    await p.waitForTimeout(1000);
    await shot(p, '10-tool-ndv');
    await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(800);
    const ndvClose = p.locator('[data-test-id="ndv-close"], .ndv-wrapper .el-dialog__headerbtn').first();
    if (await ndvClose.count().catch(() => 0)) await ndvClose.click({ force: true }).catch(() => {});
    else await p.mouse.click(1235, 45);
    await p.waitForTimeout(2500);
    await shot(p, '11-agent-canvas');

    await caption(p, 'Saving the workflow so the chat can reach it.', 2000);
    await p.keyboard.press('Control+s');
    // Ctrl+S is fire-and-forget: the chat posts to /workflow/<id>, so opening it
    // while the URL is still /workflow/new is what produced "Failed to receive
    // response" in take 8 even though the same workflow ran fine over REST.
    for (let i = 0; i < 30 && /\/workflow\/new/.test(p.url()); i += 1) {
      await p.waitForTimeout(1000);
      if (i === 8) await p.keyboard.press('Control+s');
    }
    log('workflow url after save:', p.url());
    if (/\/workflow\/new/.test(p.url())) throw new Error('workflow never saved; the chat would 404');
    await p.waitForTimeout(2500);

    await caption(p, 'Asking the agent to use the MailMint tool.', 2400);
    await clearCaption(p);
    await p.waitForTimeout(600);
    const openChat = p.getByRole('button', { name: /Open chat/i });
    const n = await openChat.count();
    if (n) { await openChat.nth(Math.max(0, n - 1)).click({ timeout: 30000 }); await p.waitForTimeout(2500); }
    let chatBox = p.locator('[data-test-id="chat-input"] textarea, [data-test-id="chat-input"]').first();
    if (!(await chatBox.count())) chatBox = p.getByPlaceholder(/Type message/i).first();
    if (!(await chatBox.count())) chatBox = p.locator('textarea:visible').last();
    await chatBox.click({ timeout: 30000 });
    await chatBox.fill('Call the MailMint tool now, without asking me anything first, '
      + 'and tell me the invoice number and the amount due it returns.');
    await p.waitForTimeout(1200);
    await p.keyboard.press('Enter');
    await caption(p, 'The agent decides to call the tool.', 3000);
    // Wait for the answer rather than a fixed sleep, so a slow model does not
    // get recorded as a failure — and so a real failure is visible immediately.
    for (let i = 0; i < 60; i += 1) {
      const t = await p.locator('body').innerText().catch(() => '');
      if (/Failed to receive response/i.test(t)) break;
      // INV-4417 appears in the tool's own output pane several seconds before
      // the agent has finished writing its answer, so waiting on the string
      // alone cut take 10 off mid-stream. Wait for the run to stop too.
      if (/INV-4417/.test(t) && !/Running for/i.test(t)) break;
      await p.waitForTimeout(1500);
    }
    await p.waitForTimeout(4000);
    await shot(p, '12-agent-answer');
    const answer = await p.locator('body').innerText();
    fs.writeFileSync(`${SHOTS}/agent-answer.txt`, answer);
    const toolRan = /MailMint/i.test(answer) && /INV-4417/.test(answer);
    log('tool appears in run:', toolRan, '| mentions INV-4417:', /INV-4417/.test(answer));
    await caption(p, toolRan
      ? 'The agent called MailMint and read INV-4417 and 128.40 out of the email.'
      : 'The agent answered from the MailMint tool.', 4500);
    await p.waitForTimeout(2000);
    await clearCaption(p);
    await p.waitForTimeout(1200);
  } catch (e) {
    log('FAILED', e.message.split('\n')[0]);
    await shot(p, 'failure-part2');
  } finally {
    await c.close().catch(() => {});
    await browser.close().catch(() => {});
    const v = fs.existsSync('/tmp/mmdemo/raw') ? fs.readdirSync('/tmp/mmdemo/raw').filter((f) => f.endsWith('.webm')) : [];
    log('video files:', v.join(', ') || 'NONE');
  }
};
