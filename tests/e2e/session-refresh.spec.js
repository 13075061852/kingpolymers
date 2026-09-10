import { test, expect } from '@playwright/test';
test('authenticated refresh never mounts login while session is pending', async ({ page }) => {
  await page.goto('http://127.0.0.1:8741/login');
  await page.getByLabel('用户名', { exact: true }).fill('ui-engineer');
  await page.getByLabel('密码', { exact: true }).fill('ui-test-password');
  await page.getByRole('button', { name: '登录工作台', exact: true }).click();
  await expect(page.locator('.designer')).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:8741/');
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route('**/api/auth/session', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('http://127.0.0.1:8741/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('正在恢复工作台…')).toBeVisible();
  await expect(page.locator('.login-tech')).toHaveCount(0);
  release();
  await expect(page.locator('.designer')).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:8741/');
  await page.reload();
  await expect(page.locator('.designer')).toBeVisible();
  await expect(page.locator('.login-tech')).toHaveCount(0);
});
