(() => {
  const CONFIG = {
    url: window.SHJJ_SUPABASE_CONFIG?.url || "https://pfpcifidfrnsubhxvgzw.supabase.co",
    publishableKey: window.SHJJ_SUPABASE_CONFIG?.publishableKey || "sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW",
    timeoutMs: 7000,
    companyId: "e978f664-848e-4609-a56a-820d11ef55e6",
  };

  const STORAGE_KEYS = {
    companyMembership: "shjj_company_membership_v1",
    companyMembers: "shjj_company_members_v1",
  };

  const LOCAL_TO_SERVER_MEMBER_ID = {
    "local-admin": "ca482e0e-07b9-4341-8f16-cbf28e445db6",
    "local-member": "84507457-cd81-4904-a707-ca85c20fa22b",
  };

  const ADMIN_MEMBER_ID = LOCAL_TO_SERVER_MEMBER_ID["local-admin"];
  const MEMBER_PIN_LABEL = `PIN ${String(0).padStart(4, "0")}`;
  const ADMIN_PIN_LABEL = `PIN ${String(920).padStart(4, "0")}`;
  const RUN_FLAG = "data-member-helper-applied";

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

  function getCompanyMembers() {
    const members = readJson(STORAGE_KEYS.companyMembers, []);
    return Array.isArray(members) ? members : [];
  }

  function getCurrentMembership() {
    return readJson(STORAGE_KEYS.companyMembership, null);
  }

  function getAdminMemberId() {
    const membership = getCurrentMembership();
    if (membership?.role === "admin") {
      return LOCAL_TO_SERVER_MEMBER_ID[membership.memberId] || membership.memberId || ADMIN_MEMBER_ID;
    }
    return ADMIN_MEMBER_ID;
  }

  function getAuthLabelForText(text) {
    const upper = String(text || "").toUpperCase();
    if (upper.includes("SHJJ-ADMIN")) return ADMIN_PIN_LABEL;
    if (upper.includes("SHJJ-")) return MEMBER_PIN_LABEL;
    return "";
  }

  function toServerSchedulePermission(member) {
    if (member.role === "admin") return "write";
    return member.schedulePermission === "write" ? "write" : "read";
  }

  function buildMemberPayload() {
    return getCompanyMembers().map((member) => ({
      member_id: LOCAL_TO_SERVER_MEMBER_ID[member.memberId] || null,
      client_member_id: member.memberId || "",
      member_name: member.memberName || "구성원",
      role: member.role === "admin" ? "admin" : "member",
      schedule_permission: toServerSchedulePermission(member),
      status: member.status === "inactive" ? "inactive" : "active",
      invite_code: String(member.inviteCode || "").trim().toUpperCase(),
    })).filter((member) => member.invite_code);
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

    let button = document.getElementById("saveScheduleMembersBtn");
    if (!button) {
      button = document.createElement("button");
      button.id = "saveScheduleMembersBtn";
      button.type = "button";
      button.className = "schedule-open-btn";
      button.textContent = "구성원 변경 저장";
      button.style.marginTop = "10px";
      body.appendChild(button);
      button.addEventListener("click", saveMembersToServer);
    }
    ensureStatusElement(body);
    return button;
  }

  function applyAuthBadges() {
    const list = document.getElementById("scheduleAdminMemberList");
    if (!list) return false;

    const rows = Array.from(list.children || []);
    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      const label = getAuthLabelForText(row.textContent || "");
      if (!label) return;

      const existing = row.querySelector(".schedule-pin-badge, .schedule-auth-badge");
      if (existing) {
        existing.textContent = label;
      } else {
        const badge = document.createElement("span");
        badge.className = "schedule-role-badge schedule-auth-badge";
        badge.textContent = label;
        badge.style.marginLeft = "6px";
        badge.style.whiteSpace = "nowrap";
        const target = row.querySelector("button[aria-label*='복사']") || row.querySelector("button") || row;
        target.insertAdjacentElement("afterend", badge);
      }
      row.setAttribute(RUN_FLAG, "true");
    });

    return true;
  }

  function markDirty(message = "변경사항 있음 · 저장 필요") {
    ensureSaveButton();
    applyAuthBadges();
    const status = document.getElementById("memberSaveStatus");
    if (status) status.textContent = message;
  }

  async function saveMembersToServer() {
    const status = document.getElementById("memberSaveStatus");
    const button = document.getElementById("saveScheduleMembersBtn");

    if (!canUseRpc()) {
      if (status) status.textContent = "서버 연결 설정을 찾을 수 없습니다.";
      return;
    }

    const members = buildMemberPayload();
    if (!members.length) {
      if (status) status.textContent = "저장할 구성원이 없습니다.";
      return;
    }

    if (button) button.disabled = true;
    if (status) status.textContent = "구성원 변경사항을 서버에 저장하는 중입니다.";

    try {
      const result = await callRpc("save_company_members_rpc", {
        p_company_id: CONFIG.companyId,
        p_admin_member_id: getAdminMemberId(),
        p_members: members,
      });
      const row = Array.isArray(result) ? result[0] : result;
      if (row && Object.prototype.hasOwnProperty.call(row, "ok") && !row.ok) {
        throw new Error(row.message || "save failed");
      }
      if (status) status.textContent = "구성원 변경 저장 완료";
    } catch (error) {
      console.warn("Save company members failed", error);
      if (status) status.textContent = "구성원 변경 저장 실패: 서버 저장 함수 적용이 필요합니다.";
    } finally {
      if (button) button.disabled = false;
    }
  }

  function refreshSoon() {
    window.setTimeout(() => {
      ensureSaveButton();
      applyAuthBadges();
    }, 100);
    window.setTimeout(() => {
      ensureSaveButton();
      applyAuthBadges();
    }, 700);
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "addScheduleMemberBtn") {
      window.setTimeout(() => markDirty(), 250);
      return;
    }
    if (target.closest("#scheduleAdminPanel")) {
      refreshSoon();
    }
  }, true);

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("#scheduleAdminPanel")) {
      markDirty();
    }
  }, true);

  refreshSoon();
})();
