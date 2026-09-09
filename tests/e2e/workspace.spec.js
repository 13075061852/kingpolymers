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
      expect(bytes.readUInt32BE(20)).toBe(424);
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

test('short first elements stay within the displayed inlet and match the report', async ({
  page,
  request,
}) => {
  const data = await (await request.get('/api/bootstrap')).json();
  for (const machine of ['50', '60']) {
    await page.goto('/');
    await page.getByLabel('当前机型').selectOption(machine);
    const item = data.components.find(
      (c) =>
        c.machine === machine && c.type === 'KB' && c.length <= data.machines[machine].entry_offset,
    );
    await page.getByRole('button', { name: '加入 ' + item.name, exact: true }).click();
    await page.getByRole('button', { name: '复制元件 1', exact: true }).click();
    const inlet = page.locator('.drawing [data-entry-connection]');
    await expect(inlet).toHaveAttribute(
      'data-entry-offset',
      String(data.machines[machine].entry_offset),
    );
    const bounds = await page.locator('.drawing').evaluate((svg) => {
      const plate = svg.querySelector('[data-entry-endplate]').getBoundingClientRect();
      const housing = svg.querySelector('[data-entry-connection]').getBoundingClientRect();
      const groups = [...svg.querySelectorAll('[data-element-index]')];
      const symbols = groups.flatMap((group) => [...group.querySelectorAll('[data-model]')]);
      const elements = symbols.map((el) => {
        const b = el.getBoundingClientRect();
        return { right: b.right, top: b.top, bottom: b.bottom, y: el.getAttribute('y') };
      });
      return {
        axis: svg.dataset.axisView,
        right: plate.left,
        top: housing.top,
        bottom: housing.bottom,
        elements,
        symbolCounts: groups.map((group) => group.querySelectorAll('[data-model]').length),
        text: svg.textContent,
      };
    });
    expect(bounds.axis).toBe('single');
    expect(bounds.elements).toHaveLength(2);
    expect(bounds.symbolCounts).toEqual([1, 1]);
    expect(
      bounds.elements.every(
        (b) => b.right <= bounds.right + 0.5 && b.top >= bounds.top && b.bottom <= bounds.bottom,
      ),
    ).toBe(true);
    expect(new Set(bounds.elements.map((element) => element.y)).size).toBe(1);
    expect(bounds.text).not.toContain('B 轴');
    await screenshot(page, 'inlet-short-' + machine);
    await page.getByRole('button', { name: '工程图 / PDF', exact: true }).click();
    await expect(page.locator('#printRoot [data-entry-connection]').first()).toHaveAttribute(
      'data-entry-offset',
      String(data.machines[machine].entry_offset),
    );
    await page.getByRole('button', { name: '返回编辑' }).click();
    await expect(page.locator('.sequence-row')).toHaveCount(2);
  }
});

async function dragPreview(page, source, destination) {
  const a = await source.boundingBox();
  await page.mouse.move(a.x + 60, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 68, a.y + a.height / 2 + 7, { steps: 3 });
  await page.mouse.move(destination.x, destination.y, { steps: 12 });
  await page.mouse.move(destination.x + 1, destination.y);
}

async function dragDiagramPreview(page, source, destination) {
  const a = await source.boundingBox();
  const b = await destination.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 - 8, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + 1, b.y + b.height / 2, { steps: 14 });
}

test('single-axis diagram sorts screw elements directly with animated displacement', async ({
  page,
}) => {
  await page.goto('/');
  const names = ['GFA-2-30-30', 'GFA-2-60-60', 'GFA-2-30-30', 'GFA-2-45-60'];
  for (const name of names)
    await page.getByRole('button', { name: '加入 ' + name, exact: true }).click();
  const drawing = page.locator('.drawing');
  const diagramItems = drawing.locator('[data-element-index]');
  const rows = page.locator('.sequence-row');
  await expect(drawing).toHaveAttribute('data-axis-view', 'single');
  await expect(diagramItems).toHaveCount(names.length);
  expect(
    await diagramItems.evaluateAll((items) =>
      items.every((item) => item.querySelectorAll('[data-model]').length === 1),
    ),
  ).toBe(true);
  const identity = await diagramItems.first().getAttribute('data-sort-id');
  await dragDiagramPreview(
    page,
    diagramItems.first().locator('[data-element-hitbox]'),
    diagramItems.last().locator('[data-element-hitbox]'),
  );
  await expect(drawing).toHaveAttribute('data-diagram-dragging', 'true');
  await expect(diagramItems.first()).toHaveAttribute('data-drag-source', 'true');
  await expect(drawing.locator('[data-diagram-drop-slot]')).toBeVisible();
  await expect
    .poll(async () =>
      diagramItems
        .nth(1)
        .evaluate((element) => Math.abs(new DOMMatrix(getComputedStyle(element).transform).m41)),
    )
    .toBeGreaterThan(2);
  await screenshot(page, 'diagram-sorting-preview');
  await page.mouse.up();
  await expect(rows.locator('.sequence-name strong')).toHaveText([
    names[1],
    names[2],
    names[3],
    names[0],
  ]);
  await expect(diagramItems.last()).toHaveAttribute('data-sort-id', identity);
  await expect(rows.last()).toHaveClass(/selected/);
  await expect(drawing.locator('[data-diagram-drop-slot]')).toHaveCount(0);
  // A new drag can start while the previous 360 ms landing animation is active.
  await dragDiagramPreview(
    page,
    diagramItems.last().locator('[data-element-hitbox]'),
    diagramItems.first().locator('[data-element-hitbox]'),
  );
  await expect(drawing.locator('[data-diagram-drop-slot]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(rows.locator('.sequence-name strong')).toHaveText([
    names[1],
    names[2],
    names[3],
    names[0],
  ]);
  await page.keyboard.press('Control+z');
  await expect(rows.locator('.sequence-name strong')).toHaveText(names);

  await page.getByRole('button', { name: '放大', exact: true }).click();
  await page.locator('.drawing-scroll').evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await dragDiagramPreview(
    page,
    diagramItems.first().locator('[data-element-hitbox]'),
    diagramItems.last().locator('[data-element-hitbox]'),
  );
  await expect(drawing.locator('[data-diagram-drop-slot]')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  await expect(rows.locator('.sequence-name strong')).toHaveText(names);
  await expect(drawing).not.toHaveAttribute('data-diagram-dragging', 'true');
  await expect(drawing.locator('[data-diagram-drop-slot]')).toHaveCount(0);
  await expect
    .poll(async () =>
      diagramItems.evaluateAll((items) =>
        Math.max(
          ...items.map((element) =>
            Math.abs(new DOMMatrix(getComputedStyle(element).transform).m41),
          ),
        ),
      ),
    )
    .toBe(0);
});

test('reference view keeps the first drop slot visible when a short block moves first', async ({
  page,
}) => {
  await page.goto('/');
  const names = ['GFA-2-60-60', 'GFA-2-30-30', 'GFA-2-45-60'];
  for (const name of names)
    await page.getByRole('button', { name: '加入 ' + name, exact: true }).click();
  const drawing = page.locator('.drawing');
  const items = drawing.locator('[data-element-index]');
  await expect(drawing).toContainText('偏置段未展开');
  const source = await items.nth(1).locator('[data-element-hitbox]').boundingBox();
  const endpoint = await drawing.evaluate((svg) => {
    const point = svg.createSVGPoint();
    point.x = 1140;
    point.y = 90;
    const screen = point.matrixTransform(svg.getScreenCTM());
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 8, source.y + source.height / 2, {
    steps: 3,
  });
  await page.mouse.move(endpoint.x - 2, endpoint.y, { steps: 14 });
  const slot = drawing.locator('[data-diagram-drop-slot]');
  await expect(slot).toBeVisible();
  const slotBox = await slot.boundingBox();
  expect(Math.abs(slotBox.x + slotBox.width - endpoint.x)).toBeLessThan(2);
  await page.mouse.up();
  await expect(page.locator('.sequence-name strong')).toHaveText([names[1], names[0], names[2]]);
  await expect(drawing).toContainText('全轴显示');
  await expect(drawing.locator('[data-entry-connection]')).toBeVisible();
});

test('native sorting animates row displacement, preserves duplicates and cancels cleanly', async ({
  page,
}) => {
  await page.goto('/');
  const names = ['GFA-2-60-60', 'GFA-2-30-30', 'GFA-2-60-60', 'GFA-2-45-60'];
  for (const name of names)
    await page.getByRole('button', { name: '加入 ' + name, exact: true }).click();
  const rows = page.locator('.sequence-row');
  const identity = await rows.first().getAttribute('data-sort-id');
  const last = await rows.last().boundingBox();
  await dragPreview(page, rows.first(), { x: last.x + 80, y: last.y + last.height - 4 });
  await expect(page.locator('.sequence-list .sort-placeholder')).toBeVisible();
  expect(await rows.nth(1).evaluate((el) => getComputedStyle(el).transitionProperty)).toContain(
    'transform',
  );
  await expect
    .poll(async () =>
      rows.nth(1).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42),
    )
    .toBeLessThan(-20);
  const previewTop = (await rows.nth(1).boundingBox()).y;
  await page.screenshot({ path: captures + '/sorting-preview.png' });
  await page.mouse.up();
  await expect(rows.locator('.sequence-name strong')).toHaveText([
    names[1],
    names[2],
    names[3],
    names[0],
  ]);
  expect(Math.abs((await rows.first().boundingBox()).y - previewTop)).toBeLessThan(2);
  await expect(rows.last()).toHaveAttribute('data-sort-id', identity);
  await expect(page.locator('.sort-placeholder')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(rows.locator('.sequence-name strong')).toHaveText(names);
  const end = await rows.last().boundingBox();
  await dragPreview(page, rows.first(), { x: end.x + 80, y: end.y + end.height - 4 });
  await expect(page.locator('.sort-placeholder')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(rows.locator('.sequence-name strong')).toHaveText(names);
  await expect(page.locator('.sort-placeholder')).toHaveCount(0);
  await expect
    .poll(async () =>
      rows.nth(1).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42),
    )
    .toBe(0);
  // Native insertion from the library into the middle keeps the rest in order.
  const second = await rows.nth(1).boundingBox();
  const extra = 'GFA-2-45-30';
  await dragPreview(
    page,
    page.getByRole('button', { name: '加入 ' + extra, exact: true }).locator('..'),
    { x: second.x + 80, y: second.y + second.height - 4 },
  );
  await expect(page.locator('.sequence-list .sort-placeholder')).toBeVisible();
  await page.mouse.up();
  await expect(rows.locator('.sequence-name strong')).toHaveText([
    names[0],
    names[1],
    extra,
    names[2],
    names[3],
  ]);
  // Barrel rows use the same animation and keep stable module identities.
  const barrels = page.locator('.barrel-row');
  const barrelId = await barrels.nth(2).getAttribute('data-sort-id');
  const target = await barrels.nth(4).boundingBox();
  await dragPreview(page, barrels.nth(2), { x: target.x + 35, y: target.y + target.height - 3 });
  await expect(page.locator('.barrel-rows .sort-placeholder')).toBeVisible();
  await page.mouse.up();
  await expect(barrels.nth(4)).toHaveAttribute('data-sort-id', barrelId);
});

test('drag edge scrolling and reduced motion preserve a single undo step', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '使用标准模板', exact: true }).click();
  const list = page.locator('.sequence-list');
  const bounds = await list.boundingBox();
  await dragPreview(page, page.locator('.sequence-row').first(), {
    x: bounds.x + 70,
    y: bounds.y + bounds.height - 8,
  });
  await expect.poll(async () => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await list.evaluate((el) => {
    el.scrollTop = 0;
  });
  const third = await page.locator('.sequence-row').nth(2).boundingBox();
  await dragPreview(page, page.locator('.sequence-row').first(), {
    x: third.x + 70,
    y: third.y + third.height - 3,
  });
  await expect(page.locator('.sort-placeholder')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeEnabled();
  expect(
    await page
      .locator('.sequence-row')
      .first()
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
});
