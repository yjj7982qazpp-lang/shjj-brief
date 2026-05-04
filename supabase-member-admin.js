(() => {
  const CONFIG = {
    url: window.SHJJ_SUPABASE_CONFIG?.url || "https://pfpcifidfrnsubhxvgzw.supabase.co",
    publishableKey: window.SHJJ_SUPABASE_CONFIG?.publishableKey || "sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW",
    companyId: "e978f664-848e-4609-a56a-820d11ef55e6",
    timeoutMs: 5000,
  };

  const STORAGE_KEYS = {
    companyMembership: "shjj_company_membership_v1",
    companyMembers: "shjj_company_members_v1",
  };

  const MEMBER_UUID_MAP = {
    "local-admin": "ca482e0e-07b9-4341-8f16-cbf28e445db6",
    "local-member": "84507457-cd81-4904-a707-ca85c20fa22b",
  };

  const $ = (id) => document.getElementById(id);
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

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getMembership() {
    const stored = readJson(STORAGE_KEYS.companyMembership, null);
    if (stored) return stored;
    try {
      if (typeof state !== "undefined" && state.companyMembership) return state.companyMembership;
    } catch {
      return null;
    }
    return null;
  }

  function getCurrentMemberId() {
    const membership = getMembership();
    const raw = String(membership?.memberId || "").trim();
    return MEMBER_UUID_MAP[raw] || raw;
  }

  function isAdmin() {
    const membership = getMembership();
    return membership?.status === "active" && membership?.role === "admin";
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

  function normalizeMember(row) {
    return {
      memberId: row.member_id,
      memberName: row.display_name || row.member_name || "구성원",
      role: row.role === "admin" ? "admin" : "member",
      schedulePermission: row.role === "admin" || row.schedule_permission === "write" ? "write" : "read",
      status: row.status === "inactive" ? "inactive" : "active",
      inviteCode: row.invite_code || "",
      pinCode: row.pin_code || "",
    };
  }

  function saveMembers(rows) {
    const members = rows.map(normalizeMember);
    writeJson(STORAGE_KEYS.companyMembers, members);
    try {
      if (typeof state !== "undefined") state.companyMembers = members;
    } catch {
      // localStorage fallback만 유지한다.
    }
    return members;
  }

  function showFeedback(message, alert = false) {
    const el = $("scheduleFeedback") || $("scheduleInviteFeedback");
    if (el) el.textContent = message;
    if (alert && message) window.alert(message);
  }

  async function loadMembersFromServer({ render = true } = {}) {
    if (!isAdmin() || !canUseRpc()) return false;
    const memberId = getCurrentMemberId();
    if (!UUID_RE.test(memberId)) return false;

    try {
      const rows = await callRpc("list_company_members_rpc", {
        p_company_id: CONFIG.companyId,
        p_request_member_id: memberId,
      });
      if (!Array.isArray(rows)) return false;
      const members = saveMembers(rows);
      if (render) renderMemberList(members);
      return true;
    } catch (error) {
      console.warn("Failed to load server members", error);
      return false;
    }
  }

  async function createMember() {
    if (!isAdmin()) return;
    const adminId = getCurrentMemberId();
    const defaultName = `구성원 ${Date.now().toString().slice(-4)}`;
    const inputName = window.prompt("구성원 이름을 입력하세요.", defaultName);
    if (inputName === null) return;
    const displayName = inputName.trim() || defaultName;

    try {
      const result = await callRpc("create_company_member_rpc", {
        p_company_id: CONFIG.companyId,
        p_admin_member_id: adminId,
        p_display_name: displayName,
        p_role: "member",
        p_schedule_permission: "read",
        p_invite_prefix: "SHJJ",
        p_pin_code: null,
      });
      const row = Array.isArray(result) ? result[0] : result;
      if (!row?.ok) throw new Error(row?.message || "member create failed");
      await loadMembersFromServer();
      window.alert(`구성원 생성 완료\n이름: ${displayName}\n초대코드: ${row.invite_code || "-"}\nPIN: ${row.pin_code || "-"}`);
    } catch (error) {
      console.warn("Create server member failed", error);
      showFeedback("서버 구성원 생성 실패: 기존 로컬 방식으로 처리됩니다.", true);
      if (typeof addCompanyMember === "function") addCompanyMember();
    }
  }

  async function setMemberStatus(memberId, status) {
    if (!isAdmin()) return;
    const adminId = getCurrentMemberId();
    try {
      const result = await callRpc("set_company_member_status_rpc", {
        p_company_id: CONFIG.companyId,
        p_admin_member_id: adminId,
        p_target_member_id: memberId,
        p_status: status,
      });
      const row = Array.isArray(result) ? result[0] : result;
      if (!row?.ok) throw new Error(row?.message || "member status failed");
      await loadMembersFromServer();
      showFeedback(status === "inactive" ? "구성원을 차단했습니다." : "구성원을 복구했습니다.");
    } catch (error) {
      console.warn("Update server member status failed", error);
      showFeedback("서버 구성원 상태 변경에 실패했습니다.", true);
    }
  }

  async function updateMemberProfile(member, patch) {
    if (!isAdmin()) return;
    const adminId = getCurrentMemberId();
    try {
      const result = await callRpc("update_company_member_profile_rpc", {
        p_company_id: CONFIG.companyId,
        p_admin_member_id: adminId,
        p_target_member_id: member.memberId,
        p_display_name: patch.memberName ?? member.memberName,
        p_role: patch.role ?? member.role,
        p_schedule_permission: patch.schedulePermission ?? member.schedulePermission,
      });
      const row = Array.isArray(result) ? result[0] : result;
      if (!row?.ok) throw new Error(row?.message || "member profile update failed");
      await loadMembersFromServer();
      showFeedback(row.message || "구성원 정보를 수정했습니다.");
    } catch (error) {
      console.warn("Update server member profile failed", error);
      showFeedback("구성원 정보 수정에 실패했습니다.", true);
    }
  }

  async function renameMember(member) {
    const nextName = window.prompt("변경할 이름을 입력하세요.", member.memberName);
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed) {
      showFeedback("이름을 입력해주세요.", true);
      return;
    }
    await updateMemberProfile(member, { memberName: trimmed });
  }

  async function togglePermission(member) {
    const nextPermission = member.schedulePermission === "write" ? "read" : "write";
    await updateMemberProfile(member, { schedulePermission: nextPermission });
  }

  async function toggleRole(member) {
    const currentMemberId = getCurrentMemberId();
    if (member.memberId === currentMemberId) {
      showFeedback("본인 관리자 계정의 역할은 변경할 수 없습니다.", true);
      return;
    }
    const nextRole = member.role === "admin" ? "member" : "admin";
    const nextPermission = nextRole === "admin" ? "write" : member.schedulePermission;
    const ok = window.confirm(`${member.memberName} 님을 ${nextRole === "admin" ? "관리자" : "구성원"}으로 변경할까요?`);
    if (!ok) return;
    await updateMemberProfile(member, { role: nextRole, schedulePermission: nextPermission });
  }

  async function copyText(text, label) {
    if (!text) {
      showFeedback(`${label} 정보가 없습니다.`, true);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showFeedback(`${label}을 복사했습니다.`);
    } catch {
      window.prompt(`${label} 복사`, text);
    }
  }

  function makeMeta(text) {
    const span = document.createElement("span");
    span.textContent = text;
    return span;
  }

  function makeButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "schedule-admin-copy-btn";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function renderMemberList(members) {
    const list = $("scheduleAdminMemberList");
    const panel = $("scheduleAdminPanel");
    if (!list || !panel || !isAdmin()) return;

    panel.hidden = false;
    list.textContent = "";
    const currentMemberId = getCurrentMemberId();

    members.forEach((member) => {
      const row = document.createElement("div");
      row.className = "schedule-admin-member schedule-admin-row";
      row.dataset.memberId = member.memberId;

      const info = document.createElement("div");
      info.className = "schedule-admin-member-info";

      const name = document.createElement("strong");
      name.textContent = member.memberName;

      const invite = document.createElement("div");
      invite.className = "schedule-admin-code-row";
      invite.textContent = `초대코드: ${member.inviteCode || "-"}`;

      const pin = document.createElement("div");
      pin.className = "schedule-admin-code-row";
      pin.textContent = `PIN: ${member.pinCode || "-"}`;

      const copyRow = document.createElement("div");
      copyRow.className = "schedule-admin-controls";
      copyRow.append(
        makeButton("초대코드 복사", () => copyText(member.inviteCode, "초대코드")),
        makeButton("PIN 복사", () => copyText(member.pinCode, "PIN")),
      );

      info.append(name, invite, pin, copyRow);

      const controls = document.createElement("div");
      controls.className = "schedule-admin-controls";
      controls.append(
        makeMeta(`역할: ${member.role === "admin" ? "관리자" : "구성원"}`),
        makeMeta(`권한: ${member.role === "admin" || member.schedulePermission === "write" ? "읽기/쓰기" : "읽기"}`),
        makeMeta(`상태: ${member.status === "inactive" ? "비활성" : "활성"}`),
        makeButton("이름수정", () => renameMember(member)),
      );

      if (member.role !== "admin") {
        controls.append(makeButton(member.schedulePermission === "write" ? "읽기로 변경" : "읽기/쓰기 변경", () => togglePermission(member)));
      }

      if (member.memberId !== currentMemberId) {
        controls.append(makeButton(member.role === "admin" ? "구성원으로 변경" : "관리자로 변경", () => toggleRole(member)));
        const inactive = member.status === "inactive";
        controls.append(makeButton(inactive ? "복구" : "차단", () => setMemberStatus(member.memberId, inactive ? "active" : "inactive")));
      } else {
        controls.append(makeMeta("본인 관리자 보호"));
      }

      row.append(info, controls);
      list.appendChild(row);
    });
  }

  function interceptAddButton(event) {
    const button = event.target?.closest?.("#addScheduleMemberBtn");
    if (!button || !isAdmin() || !canUseRpc()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    createMember();
  }

  function scheduleReload() {
    window.setTimeout(() => loadMembersFromServer(), 500);
    window.setTimeout(() => loadMembersFromServer(), 1500);
    window.setTimeout(() => loadMembersFromServer(), 3000);
  }

  document.addEventListener("click", interceptAddButton, true);
  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("#toggleScheduleInviteBtn, #joinCompanyRoomBtn, #scheduleAdminPanel")) {
      scheduleReload();
    }
  }, true);

  scheduleReload();
  window.SHJJ_RELOAD_COMPANY_MEMBERS = loadMembersFromServer;
})();
