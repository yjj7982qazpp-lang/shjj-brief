import { test, expect } from '@playwright/test';

const BASE_URL = process.env.SMOKE_BASE_URL || 'https://www.shjjbrief.com';

test('law_updates.json fetch', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/data/law_updates.json`);
  expect(res.ok()).toBeTruthy();
});

test('page load + law meta summary', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body');

  const el = page.locator('#lawMetaSummary');
  await expect(el).toBeVisible();
});

test('localStorage schedule persistence', async ({ page }) => {
  await page.goto(BASE_URL);

  await page.evaluate(() => {
    localStorage.setItem('shjj_brief_schedules_v4', JSON.stringify({ items: [{ title: 'test' }] }));
  });

  await page.reload();

  const value = await page.evaluate(() => localStorage.getItem('shjj_brief_schedules_v4'));
  expect(value).toContain('test');
});

test('notification time persistence', async ({ page }) => {
  await page.goto(BASE_URL);

  await page.evaluate(() => {
    localStorage.setItem('shjj_notification_time', '08:30');
  });

  await page.reload();

  const value = await page.evaluate(() => localStorage.getItem('shjj_notification_time'));
  expect(value).toBe('08:30');
});
