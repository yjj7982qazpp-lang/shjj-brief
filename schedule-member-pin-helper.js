(() => {
  const CONFIG = {
    url: window.SHJJ_SUPABASE_CONFIG?.url || "https://pfpcifidfrnsubhxvgzw.supabase.co",
    publishableKey: window.SHJJ_SUPABASE_CONFIG?.publishableKey || "sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW",
    timeoutMs: 7000,
    fallbackCompanyId: "e978f664-848e-4609-a56a-820d11ef55e6",
  };

  const STORAGE_KEYS = {
    companyMembership: "shjj_company_membership_v1",
  };

  const LEGACY_MEMBER_UUID_MAP = {
    "local-admin": "ca482e0e-07b9-4341-8f16-cbf28e445db6",
    "local-member": "84507457-cd81-4904-a707-ca85c20fa22b",
  };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) || fallback;
    } catch {
      return fallback;
    }
  }

  function canUseRpc() {
    return Boolean(CONFIG.url && CONFIG.publishableKey && CONFIG.publishableKey.startsWith("sb_publishable_"));
  }

  function getCurrentMembership() {
    if (typeof state !== "undefined" && state.companyMembership) {
      return state.companyMembership;
    }
    return readJson(STORAGE_KEYS.companyMembership, null);
  }

  function getRpcIds() {
    const membership = getCurrentMembership();
    if (!membership || membership.status !== "active") return null;

    const rawCompanyId = String(
      membership.companyId ||
      membership.company_id ||
      membership.serverCompanyId ||
      membership.companyRoomId ||
      ""
    ).trim();
    const rawMemberId = String(membership.memberId || membership.member_id || "").trim();
    const companyId = UUID_RE.test(rawCompanyId) ? rawCompanyId : CONFIG.fallbackCompanyId;
    const memberId = LEGACY_MEMBER_UUID_MAP[rawMemberId] || rawMemberId;

    if (!UUID_RE.test(companyId) || !UUID_RE.test(memberId)) return null;
    return { companyId, memberId, membership };
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
      if (!response.ok) throw new Error(`${response.status} ${text}`);
      return text ? JSON.parse(text) : null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function ensureStatusElement(container) {
    let status = document.getElementById("memberSaveStatus");
    if (!status) {
      status = document.createElement("p");
      status.id = "memberSaveStatus";
      status.className = "schedule-feedback";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      container.appendChild(status);
    }
    return status;
  }

  function ensureSaveButton() {
    const body = document.querySelector("#scheduleAdminPanel .schedule-admin-body");
    if (!body) return null;

    const button = document.getElementById("saveScheduleMembersBtn");
    if (button) button.remove();

    ensureStatusElement(body);
    return null;
  }

  function setStatus(message) {
    const body = document.querySelector("#scheduleAdminPanel .schedule-admin-body");
    if (!body) return;
    const status = ensureStatusElement(body);
    status.textContent = message || "";
  }

  function isAdminMembership() {
    const membership = getCurrentMembership();
    return membership?.status === "active" && membership?.role === "admin";
  }

  function compareMembers(a, b) {
    const rank = (member) => {
      if (member?.role === "admin") return 0;
      if (member?.status === "active") return 1;
      return 2;
    };

    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;

    return String(a?.memberName || "").localeCompare(String(b?.memberName || ""), "ko");
  }

  function normalizeServerMember(row) {
    const role = row?.role === "admin" ? "admin" : "member";
    const schedulePermission = role === "admin"
      ? "write"
      : row?.schedule_permission === "write" ? "write" : "read";
    const status = role === "admin"
      ? "active"
      : row?.status === "inactive" ? "inactive" : "active";
    const inviteStatus = role === "admin"
      ? "active"
      : row?.invite_status === "inactive" ? "inactive" : "active";

    return {
      memberId: String(row?.member_id || row?.id || "").trim(),
      memberName: String(row?.member_name || row?.display_name || "직원").trim() || "직원",
      role,
      schedulePermission,
      status,
      inviteCode: String(row?.invite_code || "").trim().toUpperCase(),
      pinCode: String(row?.pin_code || "").trim(),
      inviteStatus,
    };
  }

  function syncCurrentMembership(members) {
    const membership = getCurrentMembership();
    if (!membership || typeof applyCompanyMembership !== "function") return;

    const currentMemberId = String(membership.memberId || membership.member_id || "").trim();
    const current = (members || []).find((member) => member.memberId === currentMemberId);
    if (!current) return;

    applyCompanyMembership({
      ...membership,
      memberName: current.memberName,
      role: current.role,
      schedulePermission: current.schedulePermission,
      schedule_permission: current.schedulePermission,
      status: current.status,
    });
  }

  function applyCompanyMembers(members) {
    const normalized = (Array.isArray(members) ? members : [])
      .filter((member) => member.memberId && member.inviteCode)
      .sort(compareMembers);

    if (typeof state !== "undefined") {
      state.companyMembers = normalized;
      if (!state.companyMembersDirty) {
        if (typeof cloneCompanyMembers === "function") {
          state.companyMembersDraft = cloneCompanyMembers(normalized);
        } else {
          state.companyMembersDraft = normalized.map((member) => ({ ...member }));
        }
      }
    }
    syncCurrentMembership(normalized);
    if (typeof renderSchedules === "function") {
      renderSchedules();
    }
  }

  async function loadMembersFromServer() {
    const ids = getRpcIds();
    if (!canUseRpc() || !ids || !isAdminMembership()) return false;

    ensureSaveButton();
    setStatus("구성원 목록을 서버에서 불러오는 중입니다.");

    try {
      const result = await callRpc("list_company_members_with_invites_rpc", {
        p_requester_member_id: ids.memberId,
        p_company_id: ids.companyId,
      });

      const members = (Array.isArray(result) ? result : []).map(normalizeServerMember);
      applyCompanyMembers(members);
      setStatus("");
      return true;
    } catch (error) {
      console.warn("Load company members failed", error);
      setStatus("구성원 목록 RPC가 필요합니다. Supabase SQL 패치를 적용하세요.");
      return false;
    }
  }

  function buildMemberPayload() {
    const members = Array.isArray(state?.companyMembers) ? state.companyMembers : [];
    return members.map((member) => {
      const normalizedId = String(member?.memberId || "").trim();
      const role = member?.role === "admin" ? "admin" : "member";
      return {
        member_id: UUID_RE.test(normalizedId) ? normalizedId : null,
        client_member_id: normalizedId,
        member_name: member?.memberName || "직원",
        role,
        schedule_permission: role === "admin" || member?.schedulePermission === "write" ? "write" : "read",
        status: role === "admin" ? "active" : member?.status === "inactive" ? "inactive" : "active",
        invite_code: String(member?.inviteCode || "").trim().toUpperCase(),
        pin_code: String(member?.pinCode || "").trim(),
        invite_status: role === "admin" ? "active" : member?.inviteStatus === "inactive" ? "inactive" : "active",
      };
    }).filter((member) => member.invite_code);
  }

  async function saveMembersToServer() {
    const ids = getRpcIds();
    const button = ensureSaveButton();

    if (!canUseRpc() || !ids) {
      setStatus("서버 연결 정보를 찾을 수 없습니다.");
      return;
    }

    const members = buildMemberPayload();
    if (!members.length) {
      setStatus("저장할 구성원이 없습니다.");
      return;
    }

    if (button) button.disabled = true;
    setStatus("구성원 변경사항을 서버에 저장하는 중입니다.");

    try {
      const result = await callRpc("save_company_members_rpc", {
        p_company_id: ids.companyId,
        p_admin_member_id: ids.memberId,
        p_members: members,
      });
      const row = Array.isArray(result) ? result[0] : result;
      if (row && Object.prototype.hasOwnProperty.call(row, "ok") && !row.ok) {
        throw new Error(row.message || "save failed");
      }

      await loadMembersFromServer();
      setStatus("구성원 변경 저장 완료");
      window.alert("구성원 변경 저장 완료");
    } catch (error) {
      console.warn("Save company members failed", error);
      setStatus(`구성원 변경 저장 실패: ${error?.message || "unknown error"}`);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function markDirty(message = "구성원 변경사항이 있습니다. 저장하세요.") {
    if (!isAdminMembership()) return;
    ensureSaveButton();
    setStatus(message);
  }

  function handlePanelClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (!target.closest("#scheduleAdminPanel")) return;

    ensureSaveButton();
    if (target.id === "addScheduleMemberBtn" || target.closest("#addScheduleMemberBtn")) {
      markDirty();
    }
  }

  function handlePanelChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest("#scheduleAdminPanel")) return;
    markDirty();
  }

  function handlePanelToggle(event) {
    const panel = event.target;
    if (!(panel instanceof HTMLElement) || panel.id !== "scheduleAdminPanel") return;
    if (!panel.open) return;
    ensureSaveButton();
    loadMembersFromServer();
  }

  function init() {
    document.addEventListener("click", handlePanelClick);
    document.addEventListener("change", handlePanelChange);
    document.addEventListener("toggle", handlePanelToggle, true);

    if (isAdminMembership()) {
      ensureSaveButton();
      loadMembersFromServer();
    }
  }

  init();
})();
