(() => {
  const SUPABASE_INVITE_CONFIG = {
    url: "https://pfpcifidfrnsubhxvgzw.supabase.co",
    publishableKey: "sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW",
    timeoutMs: 2500,
  };

  window.SHJJ_SUPABASE_CONFIG = {
    url: SUPABASE_INVITE_CONFIG.url,
    publishableKey: SUPABASE_INVITE_CONFIG.publishableKey,
  };

  const STORAGE_KEYS = {
    companyMembership: "shjj_company_membership_v1",
  };

  const DEFAULT_COMPANY_ROOM_ID = "shjj-default";
  const $ = (id) => document.getElementById(id);

  const LOCAL_INVITE_FALLBACKS = {
    "SHJJ-ADMIN": {
      pinCode: "0920",
      roleInfo: {
        memberId: "local-admin",
        memberName: "관리자",
        role: "admin",
        schedulePermission: "write",
        status: "active",
      },
    },
    "SHJJ-MEMBER": {
      pinCode: "0000",
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
      memberId: String(result?.member_id || ""),
      memberName: String(result?.member_name || "구성원"),
      role: result?.role === "admin" ? "admin" : "member",
      schedulePermission: result?.role === "admin" || result?.schedule_permission === "write" ? "write" : "read",
      status: result?.member_status === "inactive" ? "inactive" : "active",
    };
  }

  function saveMembership(roleInfo) {
    if (typeof window.saveCompanyMembership === "function") {
      window.saveCompanyMembership(roleInfo);
      return;
    }

    localStorage.setItem(STORAGE_KEYS.companyMembership, JSON.stringify({
      companyRoomId: DEFAULT_COMPANY_ROOM_ID,
      memberId: roleInfo.memberId,
      memberName: roleInfo.memberName,
      role: roleInfo.role,
      schedulePermission: roleInfo.schedulePermission,
      status: roleInfo.status,
    }));
  }

  function refreshScheduleView() {
    if (typeof window.renderSchedules === "function") {
      window.renderSchedules();
      return;
    }
    window.location.reload();
  }

  function syncSchedulesAfterLogin() {
    if (typeof window.SHJJ_SYNC_SCHEDULES !== "function") {
      refreshScheduleView();
      return;
    }

    setFeedback("일정을 동기화하는 중입니다.");
    window.SHJJ_SYNC_SCHEDULES({ reload: true })
      .then((synced) => {
        if (!synced) refreshScheduleView();
      })
      .catch((error) => {
        console.warn("Schedule sync after login failed", error);
        refreshScheduleView();
      });
  }

  function joinWithRoleInfo(roleInfo, inviteInput, pinInput) {
    saveMembership(roleInfo);
    if (inviteInput) inviteInput.value = "";
    if (pinInput) pinInput.value = "";
    setFeedback("");
    window.alert("로그인되었습니다.");
    syncSchedulesAfterLogin();
  }

  function getLocalFallbackResult(inviteCode, pinCode) {
    const fallback = LOCAL_INVITE_FALLBACKS[inviteCode];
    if (!fallback) {
      return {
        ok: false,
        message: "초대코드가 틀렸습니다.",
        focus: "invite",
      };
    }

    if (fallback.pinCode !== pinCode) {
      return {
        ok: false,
        message: "PIN이 틀렸습니다.",
        focus: "pin",
      };
    }

    return {
      ok: true,
      roleInfo: fallback.roleInfo,
    };
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

    const localResult = getLocalFallbackResult(inviteCode, pinCode);
    if (localResult.ok) {
      joinWithRoleInfo(localResult.roleInfo, inviteInput, pinInput);
      return;
    }

    if (LOCAL_INVITE_FALLBACKS[inviteCode]) {
      showInviteMessage(localResult.message, {
        focusTarget: localResult.focus === "pin" ? pinInput : inviteInput,
      });
      return;
    }

    setFeedback("서버에서 초대코드를 확인하는 중입니다.");

    if (canUseSupabaseInviteAuth()) {
      try {
        const result = await verifyInviteCode(inviteCode, pinCode);
        if (!result?.ok) {
          showInviteMessage(result?.message || localResult.message || "초대코드 또는 PIN을 확인해주세요.", {
            focusTarget: inviteInput,
          });
          return;
        }

        const roleInfo = normalizeRoleInfo(result);
        if (!roleInfo.memberId) {
          showInviteMessage("구성원 정보를 확인할 수 없습니다.");
          return;
        }

        joinWithRoleInfo(roleInfo, inviteInput, pinInput);
        return;
      } catch (error) {
        console.warn("Supabase invite verification failed", error);
      }
    }

    showInviteMessage(localResult.message, { focusTarget: inviteInput });
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
