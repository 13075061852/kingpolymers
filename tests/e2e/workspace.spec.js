import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const captures = 'runtime/ui-checks';
const nav = (page, name) =>
  page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true });
async function screenshot(page, name) {
  await mkdir(captures, { recursive: true });
  await page.screenshot({
    path: captures + '/' + name + '.png',
    fullPage: true,
    animations: 'disabled',
  });
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});
test('desktop design, empty state, 3D catalog, inventory and settings', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '使用标准模板' })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: '使用标准模板' }).click();
  await expect(page.locator('.sequence-row')).not.toHaveCount(0);
  await screenshot(page, '02-designer');
  await nav(page, '项目方案').click();
  await expect(page.getByText('暂无方案')).toBeVisible();
  await screenshot(page, '03-projects-empty');
  await nav(page, '元件库').click();
  await expect(page.getByRole('button', { name: '向左旋转' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '向左旋转' }).click();
  await page.getByRole('button', { name: '重置视角' }).click();
  await screenshot(page, '04-components');
  await nav(page, '库存').click();
  await noOverflow(page);
  await page.getByRole('button', { name: '调整库存' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await screenshot(page, '05-inventory');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await nav(page, '设置').click();
  await expect(page.getByText('本地模式 · 无需登录')).toBeVisible();
  await page.getByRole('button', { name: '立即备份', exact: true }).click();
  await expect(page.getByText('本次备份已完成')).toBeVisible();
  await screenshot(page, '06-settings');
});
test('create, save, undo identity, export/import and lifecycle', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '使用标准模板' }).click();
  await page.getByRole('button', { name: '图纸资料', exact: true }).click();
  await page.getByLabel('图纸名称', { exact: true }).fill('端到端验收方案');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.keyboard.press('Control+s');
  if (await page.getByRole('heading', { name: '方案需要工程复核' }).isVisible()) {
    await page.getByLabel('复核原因').fill('自动化验收');
    await page.getByLabel('负责人确认码', { exact: true }).fill('sandbox-only');
    await page.getByRole('button', { name: '确认并保存' }).click();
  }
  await expect(page.getByText('方案已保存', { exact: true })).toBeVisible();
  const before = await (await request.get('/api/bootstrap')).json();
  const saved = before.projects.find((p) => p.name === '端到端验收方案');
  expect(saved).toBeTruthy();
  await page.getByRole('button', { name: '图纸资料', exact: true }).click();
  await page.getByLabel('图纸名称', { exact: true }).fill('暂时改名');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('heading', { name: /端到端验收方案/ })).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(page.getByText('方案已保存', { exact: true })).toBeVisible();
  const after = await (await request.get('/api/bootstrap')).json();
  expect(after.projects.filter((p) => p.name === '端到端验收方案')).toHaveLength(1);
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('button', { name: /三页工程图/ }).click();
  await expect(page.locator('#printRoot .print-page')).toHaveCount(3);
  await screenshot(page, '07-report');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-thumbnails')).toBeHidden();
  await expect(page.locator('#printRoot')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: '返回编辑' }).click();
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /JSON 工程文件/ }).click();
  const download = await downloadPromise;
  const file = await download.path();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({
    name: 'roundtrip.json',
    mimeType: 'application/json',
    buffer: await (await import('node:fs/promises')).readFile(file),
  });
  await expect(page.getByRole('heading', { name: /端到端验收方案/ })).toBeVisible();
  await nav(page, '项目方案').click();
  await screenshot(page, '03-projects');
  const row = page.getByRole('row').filter({ hasText: '端到端验收方案' });
  await row.getByRole('button', { name: '发布', exact: true }).click();
  if (await page.getByRole('heading', { name: '确认操作' }).isVisible())
    await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByLabel('负责人确认码（存在异常时必填）').fill('sandbox-only');
  await page.getByRole('button', { name: '确认操作', exact: true }).click();
  await expect(row.getByText('已发布', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: '作废退库' }).click();
  await page.getByRole('button', { name: '确认操作', exact: true }).click();
  await expect(row.getByText('已作废', { exact: true })).toBeVisible();
});
test('component editor and inventory adjustment retain fields on errors', async ({ page }) => {
  await page.goto('/');
  await nav(page, '元件库').click();
  await page.getByRole('button', { name: '添加元件', exact: true }).click();
  await page.getByLabel('完整型号', { exact: true }).fill('UI-CUSTOM-50');
  await page.getByLabel('长度 / mm', { exact: true }).fill('50');
  await page.getByRole('button', { name: '保存元件', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: '搜索型号、类型或参数' }).fill('UI-CUSTOM-50');
  await expect(page.getByRole('button', { name: 'UI-CUSTOM-50', exact: true })).toBeVisible();
  await nav(page, '库存').click();
  await page.getByRole('textbox', { name: '搜索元件型号' }).fill('UI-CUSTOM-50');
  await page.getByRole('button', { name: '调整库存' }).click();
  await page.getByLabel('盘点数量 / 件').fill('48');
  await page.getByRole('button', { name: '保存调整' }).click();
  await expect(page.locator('.stock-count')).toHaveText('48');
  await page.getByRole('button', { name: '调整库存' }).click();
  await page.getByLabel('调整方式').selectOption('add');
  await page.getByLabel('变动数量 / 件').fill('-4');
  await expect(page.locator('.stock-result strong')).toHaveText('44 件');
  await page.getByRole('button', { name: '保存调整' }).click();
  await expect(page.locator('.stock-count')).toHaveText('44');
  await page.getByRole('button', { name: '出入库记录' }).click();
  await expect(page.getByRole('dialog').getByText('UI-CUSTOM-50').first()).toBeVisible();
});
test('responsive mobile and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const name of ['组合设计', '项目方案', '元件库', '库存', '设置']) {
    await nav(page, name).click();
    await noOverflow(page);
    await expect(nav(page, name)).toBeVisible();
  }
  await screenshot(page, '08-mobile');
  expect(
    await page.locator('.page-transition').evaluate((el) => getComputedStyle(el).animationDuration),
  ).toBe('1e-06s');
});
test('cloud login, 3D hero, failed credentials and password change', async ({ page }) => {
  await page.goto('http://127.0.0.1:8741');
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.getByRole('button', { name: '暂停旋转' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '暂停旋转' }).click();
  await screenshot(page, '01-login');
  await page.getByLabel('用户名', { exact: true }).fill('ui-engineer');
  await page.getByLabel('密码', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: '登录工作台', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('用户名或密码不正确');
  await page.getByLabel('密码', { exact: true }).fill('ui-test-password');
  await page.getByRole('button', { name: '登录工作台', exact: true }).click();
  await expect(nav(page, '设置')).toBeVisible();
  await nav(page, '设置').click();
  await screenshot(page, '06-settings-cloud');
  await page.getByLabel('当前密码', { exact: true }).fill('ui-test-password');
  await page.getByLabel('新密码', { exact: true }).fill('ui-new-password');
  await page.getByLabel('确认新密码', { exact: true }).fill('ui-new-password');
  await page.getByRole('button', { name: '修改密码', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await page.getByLabel('用户名', { exact: true }).fill('ui-engineer');
  await page.getByLabel('密码', { exact: true }).fill('ui-new-password');
  await page.getByRole('button', { name: '登录工作台', exact: true }).click();
  await expect(nav(page, '组合设计')).toBeVisible();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
});

test('real drag, keyboard undo, PNG and Excel downloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '加入 GFA-2-60-60', exact: true }).click();
  await page.getByRole('button', { name: '加入 GFA-2-30-30', exact: true }).click();
  await expect(page.locator('.sequence-row')).toHaveCount(2);
  await page.getByRole('button', { name: '上移元件 2' }).click();
  await expect(page.locator('.sequence-row').first()).toContainText('GFA-2-30-30');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.sequence-row').first()).toContainText('GFA-2-60-60');
  await page
    .getByRole('button', { name: '加入 GFA-2-45-30', exact: true })
    .locator('..')
    .dragTo(page.locator('.drop-zone'));
  await expect(page.locator('.sequence-row')).toHaveCount(3);
  for (const [name, extension] of [
    ['PNG 图形', 'png'],
    ['Excel 工作簿', 'xlsx'],
  ]) {
    await page.getByRole('button', { name: '导出', exact: true }).click();
    const wait = page.waitForEvent('download');
    await page.getByRole('button', { name: new RegExp(name) }).click();
    const file = await wait;
    expect(file.suggestedFilename()).toContain('.' + extension);
    const bytes = await (await import('node:fs/promises')).readFile(await file.path());
    expect(bytes.length).toBeGreaterThan(1000);
    if (extension === 'png') {
      expect(bytes.readUInt32BE(16)).toBe(2400);
      expect(bytes.readUInt32BE(20)).toBe(480);
    } else expect(bytes.subarray(0, 2).toString()).toBe('PK');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
test('3D frame pacing, pause, context fallback and lazy loading', async ({ page }, testInfo) => {
  await page.goto('/');
  expect(
    await page.evaluate(
      () =>
        performance.getEntriesByType('resource').filter((r) => r.name.includes('scene3d')).length,
    ),
  ).toBe(0);
  await nav(page, '元件库').click();
  await expect(page.getByRole('button', { name: '自动旋转' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '自动旋转' }).click();
  const timing = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const intervals = [];
        let last = 0;
        const start = performance.now();
        const frame = (t) => {
          if (last) intervals.push(t - last);
          last = t;
          if (t - start < 1600) requestAnimationFrame(frame);
          else {
            intervals.sort((a, b) => a - b);
            resolve({
              frames: intervals.length,
              p95: intervals[Math.floor(intervals.length * 0.95)],
              max: Math.max(...intervals),
            });
          }
        };
        requestAnimationFrame(frame);
      }),
  );
  await testInfo.attach('frame-pacing', {
    body: JSON.stringify(timing),
    contentType: 'application/json',
  });
  expect(timing.p95).toBeLessThan(50);
  await page.getByRole('button', { name: '暂停旋转' }).click();
  await page.getByRole('button', { name: '重置视角' }).click();
  await page
    .locator('.scene-host canvas')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    );
  await expect(page.locator('.screw-preview')).toHaveAttribute('data-state', 'fallback');
  await expect(page.locator('.scene-fallback .detail-symbol svg')).toBeVisible();
  await nav(page, '库存').click();
  await noOverflow(page);
});
test('network failure preserves editor and retry succeeds', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '加入 GFA-2-60-60', exact: true }).click();
  await page.route('**/api/projects', (route) => route.abort('failed'));
  await page.getByRole('button', { name: '保存方案', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('连接中断');
  await expect(page.locator('.sequence-row')).toHaveCount(1);
  await page.unroute('**/api/projects');
  await page.getByRole('button', { name: '保存方案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '方案需要工程复核' })).toBeVisible();
  await expect(page.getByLabel('复核原因')).toBeEditable();
});

test('duplicate component error stays above the dialog and keeps user input', async ({ page }) => {
  await page.goto('/');
  await nav(page, '元件库').click();
  const existing = await page.locator('.model-select').first().innerText();
  await page.getByRole('button', { name: '添加元件', exact: true }).click();
  await page.getByLabel('完整型号', { exact: true }).fill(existing);
  await page.getByLabel('长度 / mm', { exact: true }).fill('999');
  await page.getByRole('button', { name: '保存元件', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('已存在同名型号');
  await expect(page.getByLabel('完整型号', { exact: true })).toHaveValue(existing);
  await expect(page.getByLabel('长度 / mm', { exact: true })).toHaveValue('999');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('compact desktop stays in one viewport with independent panes and a working splitter', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '使用标准模板' }).click();
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const panes = await page.locator('.editor-grid > .panel').evaluateAll((elements) =>
      elements.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, bottom: r.bottom, width: r.width };
      }),
    );
    expect(panes).toHaveLength(3);
    expect(Math.max(...panes.map((p) => p.y)) - Math.min(...panes.map((p) => p.y))).toBeLessThan(2);
    expect(panes.every((p) => p.bottom <= viewport.height + 1 && p.width >= 230)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
      true,
    );
    expect(
      await page.locator('.workspace-content').evaluate((el) => el.scrollHeight <= el.clientHeight),
    ).toBe(true);
    await expect(page.getByRole('button', { name: '保存方案', exact: true })).toBeInViewport();
    await expect(page.locator('.sequence-row').nth(7)).toBeInViewport();
    await screenshot(page, 'compact-designer-' + viewport.width);
    const before = await page.locator('.diagram-panel').boundingBox();
    const splitter = page.getByRole('separator', { name: '调整画布高度' });
    await splitter.focus();
    await page.keyboard.press('ArrowUp');
    expect((await page.locator('.diagram-panel').boundingBox()).height).toBeLessThan(
      before.height - 10,
    );
    const handle = await splitter.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, handle.y - 45, { steps: 5 });
    await page.mouse.up();
    expect((await page.locator('.diagram-panel').boundingBox()).height).toBeLessThan(
      before.height - 40,
    );
    await splitter.dblclick();
    const original = await page.locator('.barrel-rows').evaluate((el) => el.scrollTop);
    await page.locator('.sequence-list').evaluate((el) => {
      el.scrollTop = 250;
    });
    expect(await page.locator('.sequence-list').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await page.locator('.barrel-rows').evaluate((el) => el.scrollTop)).toBe(original);
    await page.locator('.sequence-list').evaluate((el) => {
      el.scrollTop = 0;
    });
    await nav(page, '元件库').click();
    const toolbar = await page.getByRole('toolbar', { name: '元件库工具栏' }).boundingBox();
    expect(toolbar.height).toBeLessThan(45);
    await expect(page.getByRole('button', { name: '添加元件', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: '编辑元件', exact: true })).toBeInViewport();
    expect(
      await page.locator('.workspace-content').evaluate((el) => el.scrollHeight <= el.clientHeight),
    ).toBe(true);
    await screenshot(page, 'compact-components-' + viewport.width);
    for (const name of ['库存', '项目方案', '设置']) {
      await nav(page, name).click();
      expect(
        await page
          .locator('.workspace-content')
          .evaluate((el) => el.scrollHeight <= el.clientHeight),
      ).toBe(true);
    }
    await nav(page, '组合设计').click();
  }
});
