import { test, expect } from '@playwright/test';

const BASE_URL = process.env.SMOKE_BASE_URL || 'https://www.shjjbrief.com';
const SUPABASE_URL = 'https://pfpcifidfrnsubhxvgzw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW';
const SUPABASE_COMPANY_ID = 'e978f664-848e-4609-a56a-820d11ef55e6';
const SUPABASE_ADMIN_MEMBER_ID = 'ca482e0e-07b9-4341-8f16-cbf28e445db6';
const SYNC_TEST_PREFIX = '자동동기화검증-';
const MEMBER_TEST_PREFIX = '자동구성원검증-';
const COMPANY_TEST_PREFIX = '자동회사방검증-';

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

async function cleanupTestCompanyRooms(request) {
  const result = await callSupabaseRpc(request, 'cleanup_test_company_room_rpc', {
    p_admin_member_id: SUPABASE_ADMIN_MEMBER_ID,
    p_company_name_prefix: COMPANY_TEST_PREFIX,
  });
  const row = Array.isArray(result) ? result[0] : result;
  expect(row.ok).toBeTruthy();
  return row;
}

async function createScheduleViaRpc(request, companyId, memberId, title) {
  const rows = await callSupabaseRpc(request, 'create_company_schedule', {
    p_company_id: companyId,
    p_member_id: memberId,
    p_schedule_date: new Date().toISOString().slice(0, 10),
    p_schedule_time: '10:10',
    p_title: title,
    p_location: '자동검증',
    p_memo: '자동 테스트 일정',
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  expect(row.ok).toBeTruthy();
  return row;
}

async function listSchedulesViaRpc(request, companyId, memberId) {
  return callSupabaseRpc(request, 'list_company_schedules', {
    p_company_id: companyId,
    p_member_id: memberId,
    p_date_from: null,
    p_date_to: null,
  });
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

  await expect.poll(async () => {
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

test('server member lifecycle works and keeps schedules shared', async ({ request }) => {
  await cleanupShjjMemberTestRows(request);

  const displayName = `${MEMBER_TEST_PREFIX}${Date.now()}`;
  const created = await callSupabaseRpc(request, 'create_company_member_rpc', {
    p_company_id: SUPABASE_COMPANY_ID,
    p_admin_member_id: SUPABASE_ADMIN_MEMBER_ID,
    p_display_name: displayName,
    p_role: 'member',
    p_schedule_permission: 'read',
    p_invite_prefix: 'SHJJT',
    p_pin_code: '1357',
  });
  const createdMember = Array.isArray(created) ? created[0] : created;
  expect(createdMember.ok).toBeTruthy();
  expect(createdMember.invite_code).toBeTruthy();

  const membersAfterCreate = await callSupabaseRpc(request, 'list_company_members_rpc', {
    p_company_id: SUPABASE_COMPANY_ID,
    p_request_member_id: SUPABASE_ADMIN_MEMBER_ID,
  });
  expect(membersAfterCreate.some((member) => member.member_id === createdMember.member_id && member.status === 'active')).toBeTruthy();

  const title = `${SYNC_TEST_PREFIX}구성원유지-${Date.now()}`;
  const schedule = await createScheduleViaRpc(request, SUPABASE_COMPANY_ID, SUPABASE_ADMIN_MEMBER_ID, title);

  const schedulesForNewMember = await listSchedulesViaRpc(request, SUPABASE_COMPANY_ID, createdMember.member_id);
  expect(schedulesForNewMember.some((item) => item.title === title)).toBeTruthy();

  const inactive = await callSupabaseRpc(request, 'set_company_member_status_rpc', {
    p_company_id: SUPABASE_COMPANY_ID,
    p_admin_member_id: SUPABASE_ADMIN_MEMBER_ID,
    p_target_member_id: createdMember.member_id,
    p_status: 'inactive',
  });
  expect((Array.isArray(inactive) ? inactive[0] : inactive).ok).toBeTruthy();

  const schedulesWhileInactive = await listSchedulesViaRpc(request, SUPABASE_COMPANY_ID, createdMember.member_id);
  expect(schedulesWhileInactive).toHaveLength(0);

  const reactivated = await callSupabaseRpc(request, 'set_company_member_status_rpc', {
    p_company_id: SUPABASE_COMPANY_ID,
    p_admin_member_id: SUPABASE_ADMIN_MEMBER_ID,
    p_target_member_id: createdMember.member_id,
    p_status: 'active',
  });
  expect((Array.isArray(reactivated) ? reactivated[0] : reactivated).ok).toBeTruthy();

  const schedulesAfterReactivate = await listSchedulesViaRpc(request, SUPABASE_COMPANY_ID, createdMember.member_id);
  expect(schedulesAfterReactivate.some((item) => item.title === title)).toBeTruthy();

  await callSupabaseRpc(request, 'delete_company_schedule', {
    p_company_id: SUPABASE_COMPANY_ID,
    p_member_id: SUPABASE_ADMIN_MEMBER_ID,
    p_schedule_id: schedule.id,
  });

  await callSupabaseRpc(request, 'set_company_member_status_rpc', {
    p_company_id: SUPABASE_COMPANY_ID,
    p_admin_member_id: SUPABASE_ADMIN_MEMBER_ID,
    p_target_member_id: createdMember.member_id,
    p_status: 'inactive',
  });
});

test('separate company room keeps schedules isolated', async ({ request }) => {
  await cleanupTestCompanyRooms(request);

  const companyName = `${COMPANY_TEST_PREFIX}${Date.now()}`;
  const room = await callSupabaseRpc(request, 'create_company_room', {
    p_company_name: companyName,
    p_admin_name: '자동검증관리자',
    p_invite_prefix: 'AUTO',
    p_admin_pin_code: '2468',
  });
  const createdRoom = Array.isArray(room) ? room[0] : room;
  expect(createdRoom.ok).toBeTruthy();
  expect(createdRoom.company_id).toBeTruthy();
  expect(createdRoom.admin_member_id).toBeTruthy();
  expect(createdRoom.admin_invite_code).toBeTruthy();

  const shjjTitle = `${SYNC_TEST_PREFIX}SHJJ분리-${Date.now()}`;
  const otherTitle = `${SYNC_TEST_PREFIX}타회사분리-${Date.now()}`;
  const shjjSchedule = await createScheduleViaRpc(request, SUPABASE_COMPANY_ID, SUPABASE_ADMIN_MEMBER_ID, shjjTitle);
  await createScheduleViaRpc(request, createdRoom.company_id, createdRoom.admin_member_id, otherTitle);

  const shjjRows = await listSchedulesViaRpc(request, SUPABASE_COMPANY_ID, SUPABASE_ADMIN_MEMBER_ID);
  const otherRows = await listSchedulesViaRpc(request, createdRoom.company_id, createdRoom.admin_member_id);

  expect(shjjRows.some((item) => item.title === shjjTitle)).toBeTruthy();
  expect(shjjRows.some((item) => item.title === otherTitle)).toBeFalsy();
  expect(otherRows.some((item) => item.title === otherTitle)).toBeTruthy();
  expect(otherRows.some((item) => item.title === shjjTitle)).toBeFalsy();

  await callSupabaseRpc(request, 'delete_company_schedule', {
    p_company_id: SUPABASE_COMPANY_ID,
    p_member_id: SUPABASE_ADMIN_MEMBER_ID,
    p_schedule_id: shjjSchedule.id,
  });

  const cleanup = await cleanupTestCompanyRooms(request);
  expect(Number(cleanup.deleted_companies || 0)).toBeGreaterThanOrEqual(1);
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
