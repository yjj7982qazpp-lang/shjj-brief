(() => {
  const SUPABASE_INVITE_CONFIG = {
    url: "https://pfpcifidfrnsubhxvgzw.supabase.co",
    publishableKey: "__SUPABASE_PUBLISHABLE_KEY__",
  };

  const STORAGE_KEYS = {
    companyMembership: "shjj_company_membership_v1",
  };

  const DEFAULT_COMPANY_ROOM_ID = "shjj-default";
  const $ = (id) => document.getElementById(id);

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
    });

    if (!response.ok) {
      throw new Error(`Supabase invite RPC failed: ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload[0] : payload;
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

  async function handleInviteJoin(event) {
    const button = event.target?.closest?.("#joinCompanyRoomBtn");
    if (!button || !canUseSupabaseInviteAuth()) return;

    const inviteInput = $("inviteCodeInput");
    const pinInput = $("invitePinInput");
    const inviteCode = (inviteInput?.value || "").trim().toUpperCase();
    const pinCode = (pinInput?.value || "").trim();

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!inviteCode) {
      setFeedback("초대코드를 입력해주세요.");
      inviteInput?.focus();
      return;
    }

    if (!pinCode) {
      setFeedback("PIN을 입력해주세요.");
      pinInput?.focus();
      return;
    }

    setFeedback("서버에서 초대코드를 확인하는 중입니다.");

    try {
      const result = await verifyInviteCode(inviteCode, pinCode);
      if (!result?.ok) {
        setFeedback(result?.message || "초대코드 또는 PIN을 확인해주세요.");
        return;
      }

      const roleInfo = normalizeRoleInfo(result);
      if (!roleInfo.memberId) {
        setFeedback("구성원 정보를 확인할 수 없습니다.");
        return;
      }

      saveMembership(roleInfo);
      if (inviteInput) inviteInput.value = "";
      if (pinInput) pinInput.value = "";
      setFeedback("");
      refreshScheduleView();
    } catch (error) {
      console.warn("Supabase invite verification failed", error);
      setFeedback("서버 연결을 확인해주세요.");
    }
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
