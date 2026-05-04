(() => {
  const MEMBERSHIP_KEY = "shjj_company_membership_v1";
  const MEMBERS_KEY = "shjj_company_members_v1";
  const DEFAULT_COMPANY_ROOM_ID = "shjj-default";
  const ORIGINAL_ADMIN_ID = "ca482e0e-07b9-4341-8f16-cbf28e445db6";
  const CONFIG = {
    url: window.SHJJ_SUPABASE_CONFIG?.url || "https://pfpcifidfrnsubhxvgzw.supabase.co",
    key: window.SHJJ_SUPABASE_CONFIG?.publishableKey || "sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW",
    companyId: "e978f664-848e-4609-a56a-820d11ef55e6",
    timeoutMs: 5000,
  };
  const MEMBER_UUID_MAP = {
    "local-admin": ORIGINAL_ADMIN_ID,
    "local-member": "84507457-cd81-4904-a707-ca85c20fa22b",
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getMembership() {
    const membership = readJson(MEMBERSHIP_KEY, null);
    if (!membership || membership.status !== "active") return null;
    return membership;
  }

  function isReadOnlyMember() {
    const membership = getMembership();
    return membership?.role === "member" && membership?.schedulePermission !== "write";
  }

  function normalizeCurrentMember() {
    const membership = getMembership();
    if (!membership) return;
    const normalized = {
      ...membership,
      companyRoomId: DEFAULT_COMPANY_ROOM_ID,
      role: membership.role === "admin" ? "admin" : "member",
      schedulePermission: membership.role === "admin" || membership.schedulePermission === "write" ? "write" : "read",
    };
    writeJson(MEMBERSHIP_KEY, normalized);

    const members = readJson(MEMBERS_KEY, []);
    const list = Array.isArray(members) ? members : [];
    const current = {
      memberId: normalized.memberId,
      memberName: normalized.memberName || "구성원",
      role: normalized.role,
      schedulePermission: normalized.schedulePermission,
      status: "active",
      inviteCode: normalized.inviteCode || "SERVER-MEMBER",
    };
    const index = list.findIndex((item) => item?.memberId === current.memberId);
    if (index >= 0) list[index] = { ...list[index], ...current };
    else list.push(current);
    writeJson(MEMBERS_KEY, list);
  }

  function hideWriteControlsForReadOnly() {
    if (!isReadOnlyMember()) return;
    const openBtn = document.getElementById("openScheduleSheetBtn");
    if (openBtn) {
      openBtn.hidden = true;
      openBtn.disabled = true;
      openBtn.style.display = "none";
    }
    const sheet = document.getElementById("scheduleSheet");
    if (sheet) sheet.hidden = true;
    const notice = document.getElementById("scheduleReadonlyNotice");
    if (notice) notice.textContent = "읽기 권한입니다. 일정 확인만 가능합니다.";
  }

  function blockReadOnlyScheduleCreate(event) {
    if (!event.target?.closest?.("#openScheduleSheetBtn, #confirmScheduleBtn")) return;
    if (!isReadOnlyMember()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.alert("읽기 권한입니다. 일정 등록은 관리자 또는 쓰기 권한 구성원만 가능합니다.");
    hideWriteControlsForReadOnly();
  }

  function getCurrentMemberId() {
    const raw = String(getMembership()?.memberId || "").trim();
    return MEMBER_UUID_MAP[raw] || raw;
  }

  async function callRpc(functionName, payload) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CONFIG.timeoutMs);
    try {
      const response = await fetch(`${CONFIG.url}/rest/v1/rpc/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: CONFIG.key,
          Authorization: `Bearer ${CONFIG.key}`,
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

  function getMemberIdFromRow(row) {
    return row?.dataset?.memberId || "";
  }

  function patchAdminButtons() {
    document.querySelectorAll("#scheduleAdminMemberList .schedule-admin-member").forEach((row) => {
      const memberId = getMemberIdFromRow(row);
      if (!memberId || memberId === ORIGINAL_ADMIN_ID) return;
      if (!row.querySelector(".member-delete-btn")) {
        const actions = row.querySelector(".schedule-admin-actions-row") || row.querySelector(".schedule-admin-controls") || row;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "schedule-admin-copy-btn member-delete-btn";
        btn.textContent = "삭제";
        btn.addEventListener("click", (event) => deleteMember(event, memberId, row));
        actions.appendChild(btn);
      }
    });
  }

  async function deleteMember(event, memberId, row) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!window.confirm("이 구성원을 삭제할까요? 삭제 후 해당 초대코드로는 접속할 수 없습니다.")) return;
    try {
      const result = await callRpc("delete_company_member_rpc", {
        p_company_id: CONFIG.companyId,
        p_admin_member_id: getCurrentMemberId(),
        p_target_member_id: memberId,
      });
      const data = Array.isArray(result) ? result[0] : result;
      if (!data?.ok) throw new Error(data?.message || "delete failed");
      row.remove();
      window.alert("구성원이 삭제되었습니다.");
    } catch (error) {
      console.warn("Delete member failed", error);
      window.alert("구성원 삭제에 실패했습니다. Supabase 삭제 RPC를 먼저 적용해야 합니다.");
    }
  }

  function forceCalendarRender() {
    const fold = document.querySelector(".schedule-calendar-fold");
    const grid = document.getElementById("scheduleCalendarGrid");
    const prev = document.getElementById("schedulePrevMonthBtn");
    const next = document.getElementById("scheduleNextMonthBtn");
    if (!fold || !grid || !prev || !next || !fold.open) return;
    if (grid.children.length > 0 && grid.textContent.trim()) return;
    next.click();
    window.setTimeout(() => prev.click(), 50);
  }

  function bindCalendarSummary() {
    const fold = document.querySelector(".schedule-calendar-fold");
    if (!fold || fold.dataset.runtimeStabilizer === "1") return;
    fold.dataset.runtimeStabilizer = "1";
    fold.addEventListener("toggle", () => {
      if (!fold.open) return;
      window.setTimeout(forceCalendarRender, 20);
      window.setTimeout(forceCalendarRender, 120);
      window.setTimeout(forceCalendarRender, 350);
    });
  }

  function tick() {
    normalizeCurrentMember();
    hideWriteControlsForReadOnly();
    patchAdminButtons();
    bindCalendarSummary();
    forceCalendarRender();
  }

  document.addEventListener("click", blockReadOnlyScheduleCreate, true);
  const observer = new MutationObserver(tick);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  window.setInterval(tick, 700);
  tick();
})();
