import { test, expect } from '@playwright/test';

const BASE_URL = process.env.SMOKE_BASE_URL || 'https://www.shjjbrief.com';

async function clearStorageAndOpen(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body');
}

async function expandScheduleCard(page) {
  await page.locator('#scheduleSection details.fold-card').evaluate((d) => d.open = true);
}

async function expandWeatherCard(page) {
  await page.locator('#weatherSection details.weather-fold').evaluate((d) => d.open = true);
}

async function openScheduleAndJoinAsAdmin(page) {
  await clearStorageAndOpen(page);
  await expandScheduleCard(page);

  await page.locator('#toggleScheduleInviteBtn').click();
  await page.locator('#inviteCodeInput').fill('SHJJ-ADMIN');
  await page.locator('#joinCompanyRoomBtn').click();

  await expect(page.locator('#scheduleRoomContent')).toBeVisible();
}

test('law_updates.json fetch', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/data/law_updates.json`);
  expect(res.ok()).toBeTruthy();
});

test('weather loads (no stuck loading)', async ({ page }) => {
  await clearStorageAndOpen(page);
  await expandWeatherCard(page);

  await expect(page.locator('#weatherDesc')).not.toContainText('불러오는 중', { timeout: 20000 });
});

test('admin join works', async ({ page }) => {
  await openScheduleAndJoinAsAdmin(page);
});

test('schedule add persists', async ({ page }) => {
  await openScheduleAndJoinAsAdmin(page);

  await page.locator('#openScheduleSheetBtn').click();
  await page.locator('#scheduleTitleInput').fill('테스트 일정');
  await page.locator('#confirmScheduleBtn').click();

  await expect(page.locator('#scheduleList')).toContainText('테스트 일정');
});

test('notification save persists', async ({ page }) => {
  await clearStorageAndOpen(page);

  await page.locator('#notificationFold summary').click();
  await page.locator('#notificationTimeInput').fill('08:30');
  await page.locator('#notificationTimeSaveBtn').click();

  await expect(page.locator('#notificationTimePill')).toContainText('08:30');
});

test('member is read-only', async ({ page }) => {
  await clearStorageAndOpen(page);
  await expandScheduleCard(page);

  await page.locator('#toggleScheduleInviteBtn').click();
  await page.locator('#inviteCodeInput').fill('SHJJ-MEMBER');
  await page.locator('#joinCompanyRoomBtn').click();

  await expect(page.locator('#schedulePermissionBadge')).toContainText('읽기');
});
