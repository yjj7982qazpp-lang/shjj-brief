(() => {
  const CONFIG = {
    url: window.SHJJ_SUPABASE_CONFIG?.url || "https://pfpcifidfrnsubhxvgzw.supabase.co",
    publishableKey: window.SHJJ_SUPABASE_CONFIG?.publishableKey || "sb_publishable_VtMrmN53iH599XMJQbxVhA_BUN1BFuW",
    companyId: "e978f664-848e-4609-a56a-820d11ef55e6",
    timeoutMs: 5000,
  };

  const STORAGE_KEY = "shjj_company_membership_v1";
  const ORIGINAL_ADMIN_ID = "ca482e0e-07b9-4341-8f16-cbf28e445db6";
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

  function injectStyles() {
    if (document.getElementById("memberAdminFinalStyle")) return;
    const style = document.createElement("style");
    style.id = "memberAdminFinalStyle";
    style.textContent = `
      #scheduleAdminMemberList .schedule-admin-member {
        grid-template-columns: 1fr !important;
        padding: 12px !important;
      }
      #scheduleAdminMemberList .schedule-admin-member-head {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }
      #scheduleAdminMemberList .schedule-admin-badges {
        display: flex !important;
        gap: 6px !important;
        flex-wrap: wrap !important;
      }
      #scheduleAdminMemberList .schedule-admin-invite-row {
        display: grid !important;
        grid-template-columns: minmax(130px, 1fr) auto !important;
        gap: 7px !important;
        align-items: center !important;
        margin-top: 9px !important;
      }
      #scheduleAdminMemberList .schedule-admin-actions-row {
        display: flex !important;
        gap: 6px !important;
        flex-wrap: wrap !important;
        margin-top: 9px !important;
      }
      #scheduleAdminMemberList .schedule-admin-pill {
        justify-content: center;
      }
      #scheduleAdminMemberList .schedule-admin-pill.role-admin {
        background: #ede9fe !important;
        color: #6d28d9 !important;
      }
      #scheduleAdminMemberList .schedule-admin-pill.role-member {
        background: #dcfce7 !important;
        color: #15803d !important;
      }
      #scheduleAdminMemberList .schedule-admin-pill.permission-write {
        background: #dbeafe !important;
        color: #1d4ed8 !important;
      }
      #scheduleAdminMemberList .schedule-admin-pill.permission-read {
        background: #fef3c7 !important;
        color: #92400e !important;
      }
      #scheduleAdminMemberList .schedule-admin-copy-btn {
        white-space: nowrap !important;
      }
      #scheduleAdminMemberList .member-delete-btn {
        color: #9a3412 !important;
        background: #ffedd5 !important;
        border-color: rgba(154, 52, 18, 0.18) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function text(el) {
    return String(el?.textContent || "").trim();
  }

  function pillKind(pill) {
    const value = text(pill);
    if (value === "관리자") return "role-admin";
    if (value === "구성원") return "role-member";
    if (value === "읽기/쓰기") return "permission-write";
    if (value === "읽기") return "permission-read";
    return "";
  }

  function normalizeRow(row) {
    if (!row) return;
    const memberId = row.dataset.memberId || "";
    const list = document.getElementById("scheduleAdminMemberList");
    if (memberId === ORIGINAL_ADMIN_ID && list?.firstElementChild !== row) list.prepend(row);

    row.querySelectorAll(".schedule-admin-pill").forEach((pill) => {
      pill.classList.remove("role-admin", "role-member", "permission-write", "permission-read");
      const kind = pillKind(pill);
      if (kind) pill.classList.add(kind);
    });

    row.querySelectorAll("button").forEach((button) => {
      const label = text(button);
      if (label === "복사") {
        const prev = button.previousElementSibling;
        const prevText = text(prev);
        if (prevText.startsWith("초대코드")) button.textContent = "초대코드복사";
        if (prevText.startsWith("PIN")) button.textContent = "핀번호복사";
      }
      if (label === "이름") button.textContent = "이름변경";
      if (label === "읽기") button.textContent = "읽기로 변경";
      if (label === "읽기/쓰기") button.textContent = "읽기/쓰기로 변경";
      if (label === "관리자화") button.textContent = "관리자로 변경";
      if (label === "구성원화") button.textContent = "구성원으로 변경";
    });

    if (memberId && memberId !== ORIGINAL_ADMIN_ID && !row.querySelector(".member-delete-btn")) {
      const actions = row.querySelector(".schedule-admin-actions-row") || row;
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "schedule-admin-copy-btn member-delete-btn";
      deleteButton.textContent = "삭제";
      deleteButton.addEventListener("click", (event) => deleteMember(event, memberId, row));
      actions.appendChild(deleteButton);
    }
  }

  async function deleteMember(event, memberId, row) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const ok = window.confirm("이 구성원을 삭제할까요? 삭제 후 해당 초대코드로는 접속할 수 없습니다.");
    if (!ok) return;
    try {
      const adminId = getCurrentMemberId();
      const result = await callRpc("delete_company_member_rpc", {
        p_company_id: CONFIG.companyId,
        p_admin_member_id: adminId,
        p_target_member_id: memberId,
      });
      const data = Array.isArray(result) ? result[0] : result;
      if (!data?.ok) throw new Error(data?.message || "delete member failed");
      row.remove();
      window.alert("구성원이 삭제되었습니다.");
    } catch (error) {
      console.warn("Delete member failed", error);
      window.alert("구성원 삭제에 실패했습니다. Supabase 삭제 RPC 적용 여부를 확인해주세요.");
    }
  }

  function normalizeAll() {
    injectStyles();
    document.querySelectorAll("#scheduleAdminMemberList .schedule-admin-member").forEach(normalizeRow);
  }

  const observer = new MutationObserver(normalizeAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(normalizeAll, 1200);
  normalizeAll();
})();
