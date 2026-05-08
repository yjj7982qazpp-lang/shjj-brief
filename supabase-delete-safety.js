(() => {
  const STORAGE_KEYS = {
    companyMembership: "shjj_company_membership_v1",
    companyMembers: "shjj_company_members_v1",
  };

  const $ = (id) => document.getElementById(id);

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) || fallback;
    } catch {
      return fallback;
    }
  }

  function getMembership() {
    const stored = readJson(STORAGE_KEYS.companyMembership, null);

    try {
      if (typeof state !== "undefined" && state.companyMembership) {
        return withManagedMemberPermission(state.companyMembership);
      }
    } catch {
      // state 접근 불가 시 localStorage 기준으로 판단한다.
    }

    return withManagedMemberPermission(stored);
  }

  function withManagedMemberPermission(membership) {
    if (!membership) return null;
    const members = readJson(STORAGE_KEYS.companyMembers, []);
    const managed = Array.isArray(members)
      ? members.find((member) => member.memberId === membership.memberId)
      : null;

    if (!managed) return membership;

    return {
      ...membership,
      role: managed.role || membership.role,
      schedulePermission: managed.role === "admin" ? "write" : managed.schedulePermission || membership.schedulePermission,
      status: managed.status || membership.status,
    };
  }

  function canWriteSchedule() {
    const membership = getMembership();
    return membership?.status === "active" && (
      membership.role === "admin" || membership.schedulePermission === "write"
    );
  }

  function isDeleteButton(button) {
    if (!button) return false;
    const label = String(button.textContent || "").trim();
    return /삭제|delete/i.test(label) || String(button.className || "").includes("delete");
  }

  function showFeedback(message) {
    const el = $("scheduleFeedback") || $("scheduleInviteFeedback");
    if (el) el.textContent = message;
    if (message) window.alert(message);
  }

  window.addEventListener(
    "click",
    (event) => {
      const button = event.target?.closest?.("button");
      if (!button || !isDeleteButton(button)) return;
      if (!button.closest?.("#scheduleSection")) return;

      if (!canWriteSchedule()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showFeedback("일정 삭제 권한이 없습니다.");
      }
    },
    true
  );
})();
