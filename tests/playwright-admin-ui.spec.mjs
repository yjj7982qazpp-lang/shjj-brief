import { test, expect } from '@playwright/test';

const BASE_URL = process.env.SMOKE_BASE_URL || 'https://www.shjjbrief.com';
const SUPABASE_URL = 'https://pfpcifidfrnsubhxvgzw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW';
const SUPABASE_COMPANY_ID = 'e978f664-848e-4609-a56a-820d11ef55e6';
const SUPABASE_ADMIN_MEMBER_ID = 'ca482e0e-07b9-4341-8f16-cbf28e445db6';
const MEMBER_TEST_PREFIX = '자동구성원검증-';

async function clearStorageAndOpen(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body');
}

async function expandScheduleCard(page) {
  await page.locator('#scheduleSection details.fold-card').evaluate((details) => {
    details.open = true;
  });
}

async function fillInvitePinIfPresent(page, pin) {
  const pinInput = page.locator('#invitePinInput');
  if (await pinInput.count()) {
    await pinInput.fill(pin);
  }
}

async function openScheduleAndJoinAsAdmin(page) {
  await clearStorageAndOpen(page);
  await expandScheduleCard(page);

  await page.locator('#toggleScheduleInviteBtn').click();
  await page.locator('#inviteCodeInput').fill('SHJJ-ADMIN');
  await fillInvitePinIfPresent(page, '0920');

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.locator('#joinCompanyRoomBtn').click();

  await expect(page.locator('#scheduleRoomContent')).toBeVisible();
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

async function cleanupShjjMemberTestRows(request) {
  const members = await callSupabaseRpc(request, 'list_company_members_rpc', {
    p_company_id: SUPABASE_COMPANY_ID,
    p_request_member_id: SUPABASE_ADMIN_MEMBER_ID,
  });

  for (const member of members.filter((item) => String(item.display_name || '').startsWith(MEMBER_TEST_PREFIX))) {
    await callSupabaseRpc(request, 'set_company_member_status_rpc', {
      p_company_id: SUPABASE_COMPANY_ID,
      p_admin_member_id: SUPABASE_ADMIN_MEMBER_ID,
      p_target_member_id: member.member_id,
      p_status: 'inactive',
    });
  }
}

test('admin member management UI works with server RPC', async ({ page, request }) => {
  await cleanupShjjMemberTestRows(request);
  await openScheduleAndJoinAsAdmin(page);

  await expect(page.locator('#scheduleAdminPanel')).toBeVisible();
  await page.locator('#scheduleAdminPanel').evaluate((details) => {
    details.open = true;
  });

  const name = `${MEMBER_TEST_PREFIX}${Date.now()}`;
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('구성원 이름을 입력하세요');
    await dialog.accept(name);
  });
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('구성원 생성 완료');
    await dialog.accept();
  });
  await page.locator('#addScheduleMemberBtn').click();

  const createdRow = page.locator('#scheduleAdminMemberList .schedule-admin-member').filter({
    hasText: name,
  }).first();
  await expect(createdRow).toBeVisible({ timeout: 15000 });
  await expect(createdRow).toContainText('상태: 활성');
  await expect(createdRow).toContainText('초대코드:');

  await createdRow.getByRole('button', { name: '차단' }).click();
  await expect(createdRow).toContainText('상태: 비활성', { timeout: 15000 });

  await createdRow.getByRole('button', { name: '복구' }).click();
  await expect(createdRow).toContainText('상태: 활성', { timeout: 15000 });

  await cleanupShjjMemberTestRows(request);
});
