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
    postLoginAction: "shjj_post_login_action_v1",
  };

  const LEGACY_COMPANY_ID = "e978f664-848e-4609-a56a-820d11ef55e6";
  const DEFAULT_LOCAL_MEMBER_PIN = String(0).padStart(4, "0");
  const ADMIN_PIN = String(920).padStart(4, "0");
  const GENERIC_INVITE_ERROR = "초대코드 또는 PIN을 확인하세요.";
  const CORE_INVITE_CODES = new Set(["SHJJ-ADMIN", "SHJJ-MEMBER"]);
  const $ = (id) => document.getElementById(id);

  const LOCAL_INVITE_FALLBACKS = {
    "SHJJ-ADMIN": {
      pinCode: ADMIN_PIN,
      roleInfo: {
        companyId: LEGACY_COMPANY_ID,
        companyName: "SHJJ 회사방",
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
        companyId: LEGACY_COMPANY_ID,
        companyName: "SHJJ 회사방",
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

  function isCoreInviteCode(inviteCode) {
    return CORE_INVITE_CODES.has(String(inviteCode || "").trim().toUpperCase());
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

      if (!response.ok) {
        throw new Error(`Supabase invite RPC failed: ${response.status}`);
      }

      const payload = await response.json();
      return Array.isArray(payload) ? payload[0] : payload;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizeRoleInfo(result) {
    return {
      companyId: String(result?.company_id || result?.company_room_id || "").trim(),
      companyName: String(result?.company_name || "SHJJ 회사방").trim() || "SHJJ 회사방",
      memberId: String(result?.member_id || "").trim(),
      memberName: String(result?.member_name || "구성원").trim() || "구성원",
      role: result?.role === "admin" ? "admin" : "member",
      schedulePermission: result?.role === "admin" || result?.schedule_permission === "write" ? "write" : "read",
      status: result?.member_status === "inactive" ? "inactive" : "active",
    };
  }

  function saveMembership(roleInfo) {
    if (roleInfo?.status === "inactive") {
      localStorage.removeItem(STORAGE_KEYS.companyMembership);
      showInviteMessage("구성원 상태를 확인하세요.");
      return false;
    }

    const sessionPayload = {
      company_id: roleInfo.companyId || "",
      company_name: roleInfo.companyName || "SHJJ 회사방",
      member_id: roleInfo.memberId,
      role: roleInfo.role,
      schedule_permission: roleInfo.schedulePermission,
      status: roleInfo.status,
    };

    localStorage.setItem(STORAGE_KEYS.companyMembership, JSON.stringify(sessionPayload));

    const runtimePayload = {
      ...sessionPayload,
      memberName: roleInfo.memberName,
    };

    try {
      if (typeof applyCompanyMembership === "function") {
        applyCompanyMembership(runtimePayload);
      } else if (typeof state !== "undefined") {
        state.companyMembership = runtimePayload;
      }
    } catch {
      // Keep session cache even if app state is not available yet.
    }

    return true;
  }

  function refreshScheduleView() {
    localStorage.setItem(STORAGE_KEYS.postLoginAction, JSON.stringify({
      action: "open-schedule",
      at: Date.now(),
    }));

    if (typeof window.SHJJ_SYNC_SCHEDULES === "function") {
      window.SHJJ_SYNC_SCHEDULES({ openSchedule: true, reload: false }).finally(() => {
        window.location.reload();
      });
      return;
    }

    window.location.reload();
  }

  function joinWithRoleInfo(roleInfo, inviteInput, pinInput) {
    const saved = saveMembership(roleInfo);
    if (!saved) return;

    if (inviteInput) inviteInput.value = "";
    if (pinInput) pinInput.value = "";
    setFeedback("");
    window.alert("로그인되었습니다.");
    refreshScheduleView();
  }

  function getLocalFallbackResult(inviteCode, pinCode) {
    const fallback = LOCAL_INVITE_FALLBACKS[inviteCode];
    if (!fallback) return null;
    if (fallback.pinCode !== pinCode) {
      return { ok: false, message: GENERIC_INVITE_ERROR, focus: "pin" };
    }
    return { ok: true, roleInfo: fallback.roleInfo };
  }

  function showGenericInviteError(inviteCode, inviteInput, pinInput) {
    showInviteMessage(GENERIC_INVITE_ERROR, {
      focusTarget: isCoreInviteCode(inviteCode) ? pinInput : inviteInput,
    });
  }

  async function handleInviteJoin(event) {
    const button = event.target?.closest?.("#joinCompanyRoomBtn");
    if (!button) return;

    const inviteInput = $("inviteCodeInput");
    const pinInput = $("invitePinInput");
    const inviteCode = String(inviteInput?.value || "").trim().toUpperCase();
    const pinCode = String(pinInput?.value || "").trim();

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!inviteCode) {
      showInviteMessage("초대코드를 입력하세요.", { focusTarget: inviteInput });
      return;
    }

    if (!pinCode) {
      showInviteMessage("PIN을 입력하세요.", { focusTarget: pinInput });
      return;
    }

    if (canUseSupabaseInviteAuth()) {
      try {
        const result = await verifyInviteCode(inviteCode, pinCode);
        if (result?.ok) {
          const roleInfo = normalizeRoleInfo(result);
          if (roleInfo.companyId && roleInfo.memberId) {
            joinWithRoleInfo(roleInfo, inviteInput, pinInput);
            return;
          }
        }
      } catch (error) {
        console.warn("Supabase invite verification failed", error);
      }
    }

    const fallback = getLocalFallbackResult(inviteCode, pinCode);
    if (!fallback) {
      showGenericInviteError(inviteCode, inviteInput, pinInput);
      return;
    }

    if (!fallback.ok) {
      showInviteMessage(
        fallback.message,
        { focusTarget: fallback.focus === "pin" ? pinInput : inviteInput }
      );
      return;
    }

    joinWithRoleInfo(fallback.roleInfo, inviteInput, pinInput);
  }

  function init() {
    ensurePinInput();
    document.addEventListener("click", handleInviteJoin, true);
    ["inviteCodeInput", "invitePinInput"].forEach((id) => {
      const input = $(id);
      input?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        $("joinCompanyRoomBtn")?.click();
      });
    });
  }

  init();
})();
