(() => {
  const SUPABASE_INVITE_CONFIG = {
    url: "https://pfpcifidfrnsubhxvgzw.supabase.co",
    publishableKey: "sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW",
    timeoutMs: 3500,
  };

  window.SHJJ_SUPABASE_CONFIG = {
    url: SUPABASE_INVITE_CONFIG.url,
    publishableKey: SUPABASE_INVITE_CONFIG.publishableKey,
  };

  const STORAGE_KEYS = {
    companyMembership: "shjj_company_membership_v1",
    companyMembers: "shjj_company_members_v1",
    postLoginAction: "shjj_post_login_action_v1",
  };

  const DEFAULT_COMPANY_ROOM_ID = "shjj-default";
  const DEFAULT_LOCAL_MEMBER_PIN = String(0).padStart(4, "0");
  const ADMIN_PIN = String(920).padStart(4, "0");
  const $ = (id) => document.getElementById(id);

  const LOCAL_INVITE_FALLBACKS = {
    "SHJJ-ADMIN": {
      pinCode: ADMIN_PIN,
      roleInfo: {
        memberId: "local-admin",
        memberName: "관리자",
        role: "admin",
        schedulePermission: "write",
        status: "active",
      },
    },
    "SHJJ-MEMBER": {
      pinCode: DEFAULT_LOCAL_MEMBER_PIN,
      roleInfo: {
        memberId: "local-member",
        memberName: "구성원",
        role: "member",
        schedulePermission: "read",
        status: "active",
      },
    },
  };

  function showInviteMessage(message, { focusTarget } = {}) {
    const el = $("scheduleInviteFeedback");
    if (el) el.textContent = message;
    if (message) window.alert(message);
    focusTarget?.focus?.();
  }

  function setFeedback(message) {
    const el = $("scheduleInviteFeedback");
    if (el) el.textContent = message;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) || fallback;
    } catch {
      return fallback;
    }
  }

  function ensurePinInput() {
    if ($("invitePinInput")) return;
    const inviteInput = $("inviteCodeInput");
    if (!inviteInput) return;

    const pinInput = document.createElement("input");
    pinInput.id = "invitePinInput";
    pinInput.type = "password";
    pinInput.inputMode = "numeric";
    pinInput.autocomplete = "off";
    pinInput.placeholder = "PIN 입력";

    inviteInput.insertAdjacentElement("afterend", pinInput);
  }

  function canUseSupabaseInviteAuth() {
    return Boolean(
      SUPABASE_INVITE_CONFIG.url &&
      SUPABASE_INVITE_CONFIG.publishableKey &&
      SUPABASE_INVITE_CONFIG.publishableKey !== "__SUPABASE_PUBLISHABLE_KEY__"
    );
  }

  async function verifyInviteCode(inviteCode, pinCode) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), SUPABASE_INVITE_CONFIG.timeoutMs);

    try {
      const response = await fetch(`${SUPABASE_INVITE_CONFIG.url}/rest/v1/rpc/verify_invite_code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_INVITE_CONFIG.publishableKey,
          Authorization: `Bearer ${SUPABASE_INVITE_CONFIG.publishableKey}`,
        },
        body: JSON.stringify({
          p_invite_code: inviteCode,
          p_pin_code: pinCode,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Supabase invite RPC failed: ${response.status}`);
      const payload = await response.json();
      return Array.isArray(payload) ? payload[0] : payload;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizeRoleInfo(result) {
    return {
      companyRoomId: DEFAULT_COMPANY_ROOM_ID,
      serverCompanyId: String(result?.company_id || result?.company_room_id || ""),
      memberId: String(result?.member_id || ""),
      memberName: String(result?.member_name || "구성원"),
      role: result?.role === "admin" ? "admin" : "member",
      schedulePermission: result?.role === "admin" || result?.schedule_permission === "write" ? "write" : "read",
      status: result?.member_status === "inactive" ? "inactive" : "active",
    };
  }

  function saveMembership(roleInfo) {
    if (roleInfo?.status === "inactive") {
      localStorage.removeItem(STORAGE_KEYS.companyMembership);
      showInviteMessage("접근이 제한됩니다. 관리자에게 문의하세요.");
      return false;
    }

    const payload = {
      companyRoomId: DEFAULT_COMPANY_ROOM_ID,
      serverCompanyId: roleInfo.serverCompanyId || "",
      memberId: roleInfo.memberId,
      memberName: roleInfo.memberName,
      role: roleInfo.role,
      schedulePermission: roleInfo.schedulePermission,
      status: roleInfo.status,
    };

    localStorage.setItem(STORAGE_KEYS.companyMembership, JSON.stringify(payload));
    try {
      if (typeof state !== "undefined") state.companyMembership = payload;
    } catch {
      // state 접근 불가 시 localStorage 저장만 유지한다.
    }
    return true;
  }

  function openScheduleAfterReload() {
    localStorage.setItem(STORAGE_KEYS.postLoginAction, JSON.stringify({
      action: "open-schedule",
      at: Date.now(),
    }));
  }

  function refreshScheduleView() {
    openScheduleAfterReload();
    const url = new URL(window.location.href);
    url.searchParams.set("v", `login-${Date.now()}`);
    window.location.replace(url.toString());
  }

  function syncSchedulesAfterLogin() {
    setFeedback("일정을 동기화하는 중입니다.");
    if (typeof window.SHJJ_SYNC_SCHEDULES === "function") {
      window.SHJJ_SYNC_SCHEDULES({ reload: false }).finally(() => refreshScheduleView());
      return;
    }
    refreshScheduleView();
  }

  function joinWithRoleInfo(roleInfo, inviteInput, pinInput) {
    const saved = saveMembership(roleInfo);
    if (!saved) return;
    if (inviteInput) inviteInput.value = "";
    if (pinInput) pinInput.value = "";
    setFeedback("");
    window.alert("로그인되었습니다.");
    syncSchedulesAfterLogin();
  }

  function getManagedLocalInvite(inviteCode) {
    const members = readJson(STORAGE_KEYS.companyMembers, []);
    if (!Array.isArray(members)) return null;
    return members.find((member) => String(member?.inviteCode || "").trim().toUpperCase() === inviteCode) || null;
  }

  function getLocalFallbackResult(inviteCode, pinCode) {
    const fallback = LOCAL_INVITE_FALLBACKS[inviteCode];
    if (fallback) {
      if (fallback.pinCode !== pinCode) return { ok: false, message: "PIN이 틀렸습니다.", focus: "pin" };
      return {
        ok: true,
        roleInfo: {
          ...fallback.roleInfo,
          companyRoomId: DEFAULT_COMPANY_ROOM_ID,
          serverCompanyId: "",
        },
      };
    }

    const managedMember = getManagedLocalInvite(inviteCode);
    if (!managedMember) return { ok: false, message: "초대코드가 틀렸습니다.", focus: "invite" };
    if (pinCode !== DEFAULT_LOCAL_MEMBER_PIN) return { ok: false, message: "PIN이 틀렸습니다. 신규 구성원 기본 PIN은 0000입니다.", focus: "pin" };

    return {
      ok: true,
      roleInfo: {
        companyRoomId: DEFAULT_COMPANY_ROOM_ID,
        serverCompanyId: "",
        memberId: managedMember.memberId,
        memberName: managedMember.memberName || "구성원",
        role: managedMember.role === "admin" ? "admin" : "member",
        schedulePermission: managedMember.role === "admin" || managedMember.schedulePermission === "write" ? "write" : "read",
        status: managedMember.status === "inactive" ? "inactive" : "active",
      },
    };
  }

  async function tryServerJoin(inviteCode, pinCode, inviteInput, pinInput) {
    if (!canUseSupabaseInviteAuth()) return false;
    try {
      const result = await verifyInviteCode(inviteCode, pinCode);
      if (!result?.ok) return false;
      const roleInfo = normalizeRoleInfo(result);
      if (!roleInfo.memberId || !roleInfo.serverCompanyId) return false;
      joinWithRoleInfo(roleInfo, inviteInput, pinInput);
      return true;
    } catch (error) {
      console.warn("Supabase invite verification failed", error);
      return false;
    }
  }

  async function handleInviteJoin(event) {
    const button = event.target?.closest?.("#joinCompanyRoomBtn");
    if (!button) return;

    const inviteInput = $("inviteCodeInput");
    const pinInput = $("invitePinInput");
    const inviteCode = (inviteInput?.value || "").trim().toUpperCase();
    const pinCode = (pinInput?.value || "").trim();

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!inviteCode) {
      showInviteMessage("초대코드를 입력해주세요.", { focusTarget: inviteInput });
      return;
    }
    if (!pinCode) {
      showInviteMessage("PIN을 입력해주세요.", { focusTarget: pinInput });
      return;
    }

    const isFixedLocalCode = Boolean(LOCAL_INVITE_FALLBACKS[inviteCode]);

    if (!isFixedLocalCode) {
      setFeedback("서버에서 초대코드를 확인하는 중입니다.");
      const joinedFromServer = await tryServerJoin(inviteCode, pinCode, inviteInput, pinInput);
      if (joinedFromServer) return;
    }

    const localResult = getLocalFallbackResult(inviteCode, pinCode);
    if (localResult.ok) {
      joinWithRoleInfo(localResult.roleInfo, inviteInput, pinInput);
      return;
    }

    if (isFixedLocalCode || getManagedLocalInvite(inviteCode)) {
      showInviteMessage(localResult.message, {
        focusTarget: localResult.focus === "pin" ? pinInput : inviteInput,
      });
      return;
    }

    showInviteMessage("초대코드 또는 PIN을 확인해주세요.", { focusTarget: inviteInput });
  }

  function handleInviteKeydown(event) {
    if (event.key !== "Enter") return;
    if (!["inviteCodeInput", "invitePinInput"].includes(event.target?.id)) return;
    const button = $("joinCompanyRoomBtn");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.click();
  }

  ensurePinInput();
  document.addEventListener("click", handleInviteJoin, true);
  document.addEventListener("keydown", handleInviteKeydown, true);
})();
