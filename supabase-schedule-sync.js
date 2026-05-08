(() => {
  const CONFIG = {
    url: window.SHJJ_SUPABASE_CONFIG?.url || "https://pfpcifidfrnsubhxvgzw.supabase.co",
    publishableKey: window.SHJJ_SUPABASE_CONFIG?.publishableKey || "sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW",
    timeoutMs: 5000,
    companyId: "e978f664-848e-4609-a56a-820d11ef55e6",
  };

  const STORAGE_KEYS = {
    schedules: "shjj_brief_schedules_v4",
    companyMembership: "shjj_company_membership_v1",
    companyMembers: "shjj_company_members_v1",
    postLoginAction: "shjj_post_login_action_v1",
  };

  const MEMBER_UUID_MAP = {
    "local-admin": "ca482e0e-07b9-4341-8f16-cbf28e445db6",
    "local-member": "84507457-cd81-4904-a707-ca85c20fa22b",
  };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const $ = (id) => document.getElementById(id);

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) || fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getStoredScheduleItems() {
    const payload = readJson(STORAGE_KEYS.schedules, { version: 1, items: [] });
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    return [];
  }

  function writeScheduleItems(items) {
    writeJson(STORAGE_KEYS.schedules, {
      version: 1,
      items: Array.isArray(items) ? items : [],
    });
  }

  function withManagedMemberPermission(membership) {
    if (!membership) return null;
    const members = readJson(STORAGE_KEYS.companyMembers, []);
    const managed = Array.isArray(members)
      ? members.find((member) => member.memberId === membership.memberId)
      : null;

    if (!managed) return membership;

    return {
      ...membership,
      role: managed.role || membership.role,
      schedulePermission: managed.role === "admin" ? "write" : managed.schedulePermission || membership.schedulePermission,
      status: managed.status || membership.status,
    };
  }

  function getMembership() {
    const stored = readJson(STORAGE_KEYS.companyMembership, null);

    try {
      if (typeof state !== "undefined" && state.companyMembership) {
        return withManagedMemberPermission(state.companyMembership);
      }
    } catch {
      // state 접근 불가 시 localStorage 기준으로 판단한다.
    }

    return withManagedMemberPermission(stored);
  }

  function getRpcIds() {
    const membership = getMembership();
    if (!membership || membership.status !== "active") return null;

    const rawCompanyId = String(membership.companyRoomId || "").trim();
    const rawMemberId = String(membership.memberId || "").trim();
    const companyId = UUID_RE.test(rawCompanyId) ? rawCompanyId : CONFIG.companyId;
    const memberId = MEMBER_UUID_MAP[rawMemberId] || rawMemberId;

    if (!UUID_RE.test(companyId) || !UUID_RE.test(memberId)) return null;
    return { companyId, memberId, membership };
  }

  function canUseRpc() {
    return Boolean(CONFIG.url && CONFIG.publishableKey && CONFIG.publishableKey.startsWith("sb_publishable_"));
  }

  async function callRpc(functionName, payload) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CONFIG.timeoutMs);
    try {
      const response = await fetch(`${CONFIG.url}/rest/v1/rpc/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: CONFIG.publishableKey,
          Authorization: `Bearer ${CONFIG.publishableKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await response.text();
      if (!response.ok) throw new Error(`${functionName} failed: ${response.status} ${text}`);
      return text ? JSON.parse(text) : null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizeFromServer(row, ids) {
    return {
      id: row.id,
      companyId: ids.companyId,
      calendarScope: "company",
      date: row.schedule_date,
      time: row.schedule_time || "09:00",
      title: row.title || "",
      location: row.location || "",
      detailMemo: row.memo || "",
      memo: "",
      createdBy: row.created_by_member_id || ids.memberId,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
      source: "supabase",
    };
  }

  function showFeedback(message, { alert = false } = {}) {
    const el = $("scheduleFeedback") || $("scheduleInviteFeedback");
    if (el) el.textContent = message;
    if (alert && message) window.alert(message);
  }

  function applyScheduleItems(items) {
    const normalized = Array.isArray(items) ? items : [];
    writeScheduleItems(normalized);

    try {
      if (typeof state !== "undefined") state.schedules = normalized;
      if (typeof renderSchedules === "function") renderSchedules();
    } catch {
      // 앱 본문 state 접근이 막히면 localStorage 저장만 유지한다.
    }
  }

  function openScheduleUi() {
    const scheduleDetails = document.querySelector("#scheduleSection details.fold-card");
    if (scheduleDetails) scheduleDetails.open = true;
    const roomContent = $("scheduleRoomContent");
    if (roomContent) roomContent.hidden = false;
    const invitePanel = $("scheduleJoinSection");
    if (invitePanel) invitePanel.hidden = true;
    const scheduleSection = $("scheduleSection");
    scheduleSection?.scrollIntoView?.({ block: "start" });
  }

  function consumePostLoginAction() {
    const action = readJson(STORAGE_KEYS.postLoginAction, null);
    if (!action || action.action !== "open-schedule") return;
    localStorage.removeItem(STORAGE_KEYS.postLoginAction);
    window.setTimeout(openScheduleUi, 200);
    window.setTimeout(openScheduleUi, 900);
    window.setTimeout(openScheduleUi, 1800);
  }

  async function syncSchedulesFromServer(options = {}) {
    const ids = getRpcIds();
    if (!canUseRpc() || !ids) return false;

    try {
      const rows = await callRpc("list_company_schedules", {
        p_company_id: ids.companyId,
        p_member_id: ids.memberId,
        p_date_from: null,
        p_date_to: null,
      });
      const items = (Array.isArray(rows) ? rows : []).map((row) => normalizeFromServer(row, ids));
      applyScheduleItems(items);
      if (options.openSchedule) openScheduleUi();
      return true;
    } catch (error) {
      console.warn("Schedule server sync failed", error);
      if (options.openSchedule) openScheduleUi();
      return false;
    }
  }

  function canWriteSchedule() {
    const membership = getMembership();
    return membership?.status === "active" && (
      membership.role === "admin" || membership.schedulePermission === "write"
    );
  }

  function buildDraftSchedule(ids) {
    const title = String($("scheduleTitleInput")?.value || "").trim();
    const date = String($("scheduleDateInput")?.value || "").trim();
    const time = String($("scheduleTimeInput")?.value || "09:00").trim() || "09:00";
    const location = String($("scheduleLocationInput")?.value || "").trim();
    const memo = String($("scheduleMemoInput")?.value || "").trim();

    if (!title) return { error: "일정명을 입력해주세요.", focus: $("scheduleTitleInput") };
    if (!date) return { error: "날짜를 선택해주세요.", focus: $("scheduleDateInput") };

    return {
      item: {
        id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        companyId: ids.companyId,
        calendarScope: "company",
        date,
        time,
        title,
        location,
        detailMemo: memo,
        memo: "",
        createdBy: ids.memberId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: "local-fallback",
      },
    };
  }

  async function handleCreateSchedule(event) {
    const button = event.target?.closest?.("#confirmScheduleBtn");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!canWriteSchedule()) {
      showFeedback("일정 작성 권한이 없습니다.", { alert: true });
      return;
    }

    if (!canUseRpc()) {
      showFeedback("서버 일정 연동 설정을 찾을 수 없습니다.", { alert: true });
      return;
    }

    const ids = getRpcIds();
    if (!ids) {
      showFeedback("서버 일정 연동 계정 정보를 찾을 수 없습니다. 로그아웃 후 다시 로그인해주세요.", { alert: true });
      return;
    }

    const draft = buildDraftSchedule(ids);
    if (draft.error) {
      showFeedback(draft.error, { alert: true });
      draft.focus?.focus?.();
      return;
    }

    showFeedback("서버에 일정을 저장하는 중입니다.");

    try {
      const result = await callRpc("create_company_schedule", {
        p_company_id: ids.companyId,
        p_member_id: ids.memberId,
        p_schedule_date: draft.item.date,
        p_schedule_time: draft.item.time || null,
        p_title: draft.item.title,
        p_location: draft.item.location || null,
        p_memo: draft.item.detailMemo || null,
      });
      const row = Array.isArray(result) ? result[0] : result;
      if (!row?.ok) throw new Error(row?.message || "create schedule failed");

      await syncSchedulesFromServer();
      showFeedback("서버 일정 저장 완료", { alert: true });

      try {
        if (typeof resetScheduleForm === "function") resetScheduleForm();
        if (typeof setScheduleSheetOpen === "function") setScheduleSheetOpen(false);
      } catch {
        // 기존 앱 함수 접근이 실패하면 화면 갱신만 유지한다.
      }
    } catch (error) {
      console.warn("Create schedule RPC failed. Falling back to local storage.", error);
      const items = getStoredScheduleItems();
      items.push(draft.item);
      applyScheduleItems(items);
      showFeedback("서버 저장 실패: 기기 저장소에만 저장했습니다.", { alert: true });
    }
  }

  function getScheduleIdFromDeleteButton(button) {
    if (!button) return "";
    return button.dataset.id || button.dataset.scheduleId || button.closest?.("[data-id]")?.dataset?.id || "";
  }

  async function handleDeleteSchedule(event) {
    const button = event.target?.closest?.("button");
    if (!button) return;
    const label = String(button.textContent || "").trim();
    if (!/삭제|delete/i.test(label) && !button.className.includes("delete")) return;

    const scheduleId = getScheduleIdFromDeleteButton(button);
    const ids = getRpcIds();
    if (!scheduleId || !canUseRpc() || !ids) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!canWriteSchedule()) {
      showFeedback("일정 삭제 권한이 없습니다.", { alert: true });
      return;
    }

    try {
      await callRpc("delete_company_schedule", {
        p_company_id: ids.companyId,
        p_member_id: ids.memberId,
        p_schedule_id: scheduleId,
      });
      await syncSchedulesFromServer();
      showFeedback("일정 삭제가 완료되었습니다.", { alert: true });
    } catch (error) {
      console.warn("Delete schedule RPC failed. Falling back to local storage.", error);
      applyScheduleItems(getStoredScheduleItems().filter((item) => item.id !== scheduleId));
      showFeedback("서버 삭제 실패: 기기 저장소에서만 삭제했습니다.", { alert: true });
    }
  }

  function scheduleInitialSync() {
    consumePostLoginAction();
    window.setTimeout(() => syncSchedulesFromServer(), 900);
  }

  document.addEventListener("click", handleCreateSchedule, true);
  document.addEventListener("click", handleDeleteSchedule, true);
  scheduleInitialSync();
  window.SHJJ_SYNC_SCHEDULES = syncSchedulesFromServer;
  window.SHJJ_OPEN_SCHEDULE_UI = openScheduleUi;
})();
