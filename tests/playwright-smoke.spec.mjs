import { test, expect } from '@playwright/test';

const BASE_URL = process.env.SMOKE_BASE_URL || 'https://www.shjjbrief.com';

async function openScheduleAndJoinAsAdmin(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body');

  await page.locator('#toggleScheduleInviteBtn').click();
  await expect(page.locator('#scheduleInvitePanel')).toBeVisible();
  await page.locator('#inviteCodeInput').fill('SHJJ-ADMIN');
  await page.locator('#joinCompanyRoomBtn').click();

  await expect(page.locator('#scheduleRoomContent')).toBeVisible();
  await expect(page.locator('#scheduleRoleBadge')).toContainText('관리자');
  await expect(page.locator('#schedulePermissionBadge')).toContainText('읽기/쓰기');
}

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
});

test('law_updates.json fetch', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/data/law_updates.json`);
  expect(res.ok()).toBeTruthy();

  const data = await res.json();
  expect(data).toBeTruthy();
  expect(Array.isArray(data.watched_laws) || Array.isArray(data.tracked_laws) || Array.isArray(data.items)).toBeTruthy();
});

test('page load + law meta summary', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body');

  await expect(page.locator('#lawMetaSummary')).toBeVisible();
  await expect(page.locator('#lawTodayCount')).toBeVisible();
  await expect(page.locator('#lawWeekCount')).toBeVisible();
  await expect(page.locator('#lawMonthCount')).toBeVisible();
});

test('weather card leaves initial loading state', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#currentTemp')).toBeVisible();
  await expect(page.locator('#weatherDesc')).toBeVisible();
  await expect(page.locator('#highLow')).toBeVisible();

  await expect(page.locator('#weatherDesc')).not.toContainText('불러오는 중', { timeout: 15000 });
  const currentTemp = (await page.locator('#currentTemp').innerText()).trim();
  expect(currentTemp).toMatch(/(-?\d+°|--°)/);
});

test('invite code joins company room as admin', async ({ page }) => {
  await openScheduleAndJoinAsAdmin(page);

  const membership = await page.evaluate(() => localStorage.getItem('shjj_company_membership_v1'));
  expect(membership).toContain('local-admin');
  expect(membership).toContain('active');
});

test('schedule UI add flow persists after reload', async ({ page }) => {
  await openScheduleAndJoinAsAdmin(page);

  await page.locator('#openScheduleSheetBtn').click();
  await expect(page.locator('#scheduleSheet')).toBeVisible();

  const today = new Date().toISOString().slice(0, 10);
  await page.locator('#scheduleDateInput').fill(today);
  await page.locator('#scheduleTimeInput').fill('10:30');
  await page.locator('#scheduleTitleInput').fill('Playwright 테스트 일정');
  await page.locator('#scheduleLocationInput').fill('서울 송파구');
  await page.locator('#scheduleMemoInput').fill('자동 스모크 테스트');
  await page.locator('#confirmScheduleBtn').click();

  await expect(page.locator('#scheduleList')).toContainText('Playwright 테스트 일정');

  await page.reload();
  await expect(page.locator('#scheduleList')).toContainText('Playwright 테스트 일정');

  const value = await page.evaluate(() => localStorage.getItem('shjj_brief_schedules_v4'));
  expect(value).toContain('Playwright 테스트 일정');
});

test('notification time save flow persists after reload', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  await page.locator('#notificationFold > summary').click();
  await page.locator('#notificationTimeInput').fill('08:30');
  await page.locator('#notificationTimeSaveBtn').click();

  await expect(page.locator('#notificationTimePill')).toContainText('08:30');
  await page.reload();
  await expect(page.locator('#notificationTimePill')).toContainText('08:30');

  const value = await page.evaluate(() => localStorage.getItem('shjj_notification_time'));
  expect(value).toBe('08:30');
});

test('read-only member cannot open schedule writer', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  await page.locator('#toggleScheduleInviteBtn').click();
  await page.locator('#inviteCodeInput').fill('SHJJ-MEMBER');
  await page.locator('#joinCompanyRoomBtn').click();

  await expect(page.locator('#scheduleRoomContent')).toBeVisible();
  await expect(page.locator('#schedulePermissionBadge')).toContainText('읽기');
  await expect(page.locator('#openScheduleSheetBtn')).toBeDisabled();
});
