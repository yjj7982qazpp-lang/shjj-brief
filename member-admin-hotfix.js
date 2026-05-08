(() => {
  const STORAGE_KEY = "shjj_company_membership_v1";
  const MEMBERS_KEY = "shjj_company_members_v1";
  const DEFAULT_ROOM_ID = "shjj-default";
  const ORIGINAL_ADMIN_ID = "ca482e0e-07b9-4341-8f16-cbf28e445db6";
  const CONFIG = {
    url: window.SHJJ_SUPABASE_CONFIG?.url || "https://pfpcifidfrnsubhxvgzw.supabase.co",
    key: window.SHJJ_SUPABASE_CONFIG?.publishableKey || "sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW",
    companyId: "e978f664-848e-4609-a56a-820d11ef55e6",
    timeoutMs: 5000,
  };
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

  function text(el) {
    return String(el?.textContent || "").trim();
  }

  function getMembership() {
    const membership = readJson(STORAGE_KEY, null);
    if (!membership || membership.status !== "active") return null;
    return membership;
  }

  function normalizeMembershipAndReloadIfNeeded() {
    const membership = readJson(STORAGE_KEY, null);
    if (!membership || typeof membership !== "object") return;
    const roomId = String(membership.companyRoomId || "");
    const normalized = {
      ...membership,
      serverCompanyId: UUID_RE.test(roomId) ? (membership.serverCompanyId || roomId) : (membership.serverCompanyId || ""),
      companyRoomId: DEFAULT_ROOM_ID,
      role: membership.role === "admin" ? "admin" : "member",
      schedulePermission: membership.role === "admin" || membership.schedulePermission === "write" ? "write" : "read",
      status: membership.status === "inactive" ? "inactive" : "active",
    };
    if (!normalized.memberId) return;
    writeJson(STORAGE_KEY, normalized);
    upsertCurrentMember(normalized);
  }

  function upsertCurrentMember(membership) {
    if (!membership || membership.status !== "active") return;
    const list = Array.isArray(readJson(MEMBERS_KEY, [])) ? readJson(MEMBERS_KEY, []) : [];
    const current = {
      memberId: membership.memberId,
      memberName: membership.memberName || "구성원",
      role: membership.role === "admin" ? "admin" : "member",
      schedulePermission: membership.role === "admin" || membership.schedulePermission === "write" ? "write" : "read",
      status: "active",
      inviteCode: membership.inviteCode || "SERVER-MEMBER",
    };
    const index = list.findIndex((item) => item?.memberId === current.memberId);
    if (index >= 0) list[index] = { ...list[index], ...current };
    else list.push(current);
    writeJson(MEMBERS_KEY, list);
  }

  function injectStyles() {
    if (document.getElementById("memberAdminHotfixStyle")) return;
    const style = document.createElement("style");
    style.id = "memberAdminHotfixStyle";
    style.textContent = `
      #scheduleAdminMemberList .schedule-admin-member{grid-template-columns:1fr!important;padding:12px!important;}
      #scheduleAdminMemberList .schedule-admin-member-head{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;}
      #scheduleAdminMemberList .schedule-admin-badges{display:flex!important;gap:6px!important;flex-wrap:wrap!important;}
      #scheduleAdminMemberList .schedule-admin-invite-row{display:grid!important;grid-template-columns:minmax(126px,1fr) auto!important;gap:7px!important;align-items:center!important;margin-top:9px!important;}
      #scheduleAdminMemberList .schedule-admin-actions-row{display:flex!important;gap:6px!important;flex-wrap:wrap!important;margin-top:9px!important;}
      #scheduleAdminMemberList .schedule-admin-pill{justify-content:center;}
      #scheduleAdminMemberList .schedule-admin-pill.role-admin{background:#ede9fe!important;color:#6d28d9!important;}
      #scheduleAdminMemberList .schedule-admin-pill.role-member{background:#dcfce7!important;color:#15803d!important;}
      #scheduleAdminMemberList .schedule-admin-pill.permission-write{background:#dbeafe!important;color:#1d4ed8!important;}
      #scheduleAdminMemberList .schedule-admin-pill.permission-read{background:#fef3c7!important;color:#92400e!important;}
      #scheduleAdminMemberList .schedule-admin-copy-btn{white-space:nowrap!important;}
      #scheduleAdminMemberList .member-delete-btn{color:#9a3412!important;background:#ffedd5!important;border-color:rgba(154,52,18,.18)!important;}
    `;
    document.head.appendChild(style);
  }

  function isReadOnlyMember() {
    const membership = getMembership();
    return membership?.role === "member" && membership?.schedulePermission !== "write";
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

  function getPreviousPill(button) {
    let node = button?.previousElementSibling;
    while (node) {
      if (node.classList?.contains("schedule-admin-pill")) return node;
      node = node.previousElementSibling;
    }
    return null;
  }

  function applyPillColor(pill) {
    const value = text(pill);
    pill.classList.remove("role-admin", "role-member", "permission-write", "permission-read");
    if (value === "관리자") pill.classList.add("role-admin");
    if (value === "구성원") pill.classList.add("role-member");
    if (value === "읽기/쓰기") pill.classList.add("permission-write");
    if (value === "읽기") pill.classList.add("permission-read");
  }

  function normalizeLabels() {
    injectStyles();
    const rows = Array.from(document.querySelectorAll("#scheduleAdminMemberList .schedule-admin-member"));
    const list = document.getElementById("scheduleAdminMemberList");
    if (!list || rows.length === 0) return;

    const originalAdmin = rows.find((row) => row.dataset.memberId === ORIGINAL_ADMIN_ID);
    if (originalAdmin && list.firstElementChild !== originalAdmin) list.prepend(originalAdmin);

    rows.forEach((row) => {
      row.querySelectorAll(".schedule-admin-pill").forEach(applyPillColor);
      const buttons = Array.from(row.querySelectorAll("button"));
      buttons.forEach((button) => {
        const label = text(button);
        const previousPill = getPreviousPill(button);
        const pillText = text(previousPill);
        if (label === "복사" && pillText.startsWith("초대코드")) button.textContent = "초대코드복사";
        if (label === "복사" && pillText.startsWith("PIN")) button.textContent = "핀번호복사";
        if (label === "이름") button.textContent = "이름변경";
        if (label === "읽기") button.textContent = "읽기로 변경";
        if (label === "읽기/쓰기") button.textContent = "읽기/쓰기로 변경";
        if (label === "관리자화") button.textContent = "관리자로 변경";
        if (label === "구성원화") button.textContent = "구성원으로 변경";
      });
      ensureDeleteButton(row);
    });
  }

  async function copyValue(value, label) {
    if (!value) {
      window.alert(`${label} 정보가 없습니다.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      window.alert(`${label}가 복사되었습니다.`);
    } catch {
      window.prompt(`${label} 복사`, value);
    }
  }

  function interceptCopy(event) {
    const button = event.target?.closest?.("#scheduleAdminMemberList button");
    if (!button) return;
    const label = text(button);
    if (label !== "초대코드복사" && label !== "핀번호복사") return;

    const pill = getPreviousPill(button);
    const pillText = text(pill);
    const isPin = label === "핀번호복사";
    const value = pillText.replace(isPin ? /^PIN\s*/ : /^초대코드\s*/, "").trim();

    event.preventDefault();
    event.stopImmediatePropagation();
    copyValue(value, isPin ? "핀번호" : "초대코드");
  }

  function getCurrentMemberId() {
    const membership = readJson(STORAGE_KEY, null);
    const raw = String(membership?.memberId || "").trim();
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
      const body = await response.text();
      if (!response.ok) throw new Error(`${functionName} failed: ${response.status} ${body}`);
      return body ? JSON.parse(body) : null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function ensureDeleteButton(row) {
    const memberId = row.dataset.memberId || "";
    if (!memberId || memberId === ORIGINAL_ADMIN_ID || row.querySelector(".member-delete-btn")) return;
    const actions = row.querySelector(".schedule-admin-actions-row") || row;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "schedule-admin-copy-btn member-delete-btn";
    button.textContent = "삭제";
    button.addEventListener("click", (event) => deleteMember(event, memberId, row));
    actions.appendChild(button);
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
      window.alert("구성원 삭제에 실패했습니다. Supabase 삭제 RPC 적용 여부를 확인해주세요.");
    }
  }

  function forceCalendarRender() {
    const fold = document.querySelector(".schedule-calendar-fold");
    const grid = document.getElementById("scheduleCalendarGrid");
    const prev = document.getElementById("schedulePrevMonthBtn");
    const next = document.getElementById("scheduleNextMonthBtn");
    if (!fold || !grid || !prev || !next) return;
    if (!fold.open) return;
    if (grid.children.length > 0 && text(grid)) return;
    next.click();
    window.setTimeout(() => prev.click(), 40);
  }

  function bindCalendarFix() {
    const fold = document.querySelector(".schedule-calendar-fold");
    if (!fold || fold.dataset.hotfixBound === "1") return;
    fold.dataset.hotfixBound = "1";
    fold.addEventListener("toggle", () => {
      if (!fold.open) return;
      window.setTimeout(forceCalendarRender, 30);
      window.setTimeout(forceCalendarRender, 180);
      window.setTimeout(forceCalendarRender, 400);
    });
  }

  function stabilize() {
    normalizeMembershipAndReloadIfNeeded();
    hideWriteControlsForReadOnly();
    normalizeLabels();
    bindCalendarFix();
    forceCalendarRender();
  }

  stabilize();
  const observer = new MutationObserver(stabilize);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  document.addEventListener("click", interceptCopy, true);
  document.addEventListener("click", blockReadOnlyScheduleCreate, true);
  window.setInterval(stabilize, 700);
})();
