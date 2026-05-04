import { test, expect } from '@playwright/test';

const BASE_URL = process.env.SMOKE_BASE_URL || 'https://www.shjjbrief.com';
const SUPABASE_URL = 'https://pfpcifidfrnsubhxvgzw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW';
const SUPABASE_COMPANY_ID = 'e978f664-848e-4609-a56a-820d11ef55e6';
const SUPABASE_ADMIN_MEMBER_ID = 'ca482e0e-07b9-4341-8f16-cbf28e445db6';
const SYNC_TEST_PREFIX = '자동동기화검증-';

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

async function fillInvitePinIfPresent(page, pin) {
  const pinInput = page.locator('#invitePinInput');
  if (await pinInput.count()) {
    await pinInput.fill(pin);
  }
}

async function openScheduleAndJoin(page, code, pin) {
  await clearStorageAndOpen(page);
  await expandScheduleCard(page);

  await page.locator('#toggleScheduleInviteBtn').click();
  await page.locator('#inviteCodeInput').fill(code);
  await fillInvitePinIfPresent(page, pin);

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.locator('#joinCompanyRoomBtn').click();

  await expect(page.locator('#scheduleRoomContent')).toBeVisible();
}

async function openScheduleAndJoinAsAdmin(page) {
  await openScheduleAndJoin(page, 'SHJJ-ADMIN', '0920');
}

async function callSupabaseRpc(request, functionName, payload) {
  const response = await request.post(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function cleanupSyncTestSchedules(request) {
  const rows = await callSupabaseRpc(request, 'list_company_schedules', {
    p_company_id: SUPABASE_COMPANY_ID,
    p_member_id: SUPABASE_ADMIN_MEMBER_ID,
    p_date_from: null,
    p_date_to: null,
  });

  for (const row of rows.filter((item) => String(item.title || '').startsWith(SYNC_TEST_PREFIX))) {
    await callSupabaseRpc(request, 'delete_company_schedule', {
      p_company_id: SUPABASE_COMPANY_ID,
      p_member_id: SUPABASE_ADMIN_MEMBER_ID,
      p_schedule_id: row.id,
    });
  }
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

test('server schedule sync works across member sessions', async ({ page, request }) => {
  await cleanupSyncTestSchedules(request);

  const title = `${SYNC_TEST_PREFIX}${Date.now()}`;
  await openScheduleAndJoinAsAdmin(page);
  await page.locator('#openScheduleSheetBtn').click();
  await page.locator('#scheduleTitleInput').fill(title);

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('서버 일정 저장 완료');
    await dialog.accept();
  });
  await page.locator('#confirmScheduleBtn').click();

  const rows = await expect.poll(async () => {
    const payload = await callSupabaseRpc(request, 'list_company_schedules', {
      p_company_id: SUPABASE_COMPANY_ID,
      p_member_id: SUPABASE_ADMIN_MEMBER_ID,
      p_date_from: null,
      p_date_to: null,
    });
    return payload.filter((item) => item.title === title);
  }, { timeout: 15000 }).toHaveLength(1);

  await openScheduleAndJoin(page, 'SHJJ-MEMBER', '0000');
  await expect(page.locator('#schedulePermissionBadge')).toContainText('읽기');
  await expect(page.locator('#scheduleList')).toContainText(title, { timeout: 15000 });
  await expect(page.locator('#openScheduleSheetBtn')).toBeHidden();

  const saved = await callSupabaseRpc(request, 'list_company_schedules', {
    p_company_id: SUPABASE_COMPANY_ID,
    p_member_id: SUPABASE_ADMIN_MEMBER_ID,
    p_date_from: null,
    p_date_to: null,
  });
  const created = saved.find((item) => item.title === title);
  if (created?.id) {
    await callSupabaseRpc(request, 'delete_company_schedule', {
      p_company_id: SUPABASE_COMPANY_ID,
      p_member_id: SUPABASE_ADMIN_MEMBER_ID,
      p_schedule_id: created.id,
    });
  }
});

test('notification save persists', async ({ page }) => {
  await clearStorageAndOpen(page);

  const notificationFold = page.locator('#notificationFold');
  await notificationFold.locator('summary').click();
  await notificationFold.locator('input#notificationTimeInput').fill('08:30');
  await notificationFold.locator('button#notificationTimeSaveBtn').click();

  await expect(page.locator('#notificationTimePill')).toContainText('08:30');
});

test('member is read-only', async ({ page }) => {
  await openScheduleAndJoin(page, 'SHJJ-MEMBER', '0000');

  await expect(page.locator('#schedulePermissionBadge')).toContainText('읽기');
  await expect(page.locator('#openScheduleSheetBtn')).toBeHidden();
});
