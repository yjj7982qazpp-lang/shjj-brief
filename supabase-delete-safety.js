(() => {
  const STORAGE_KEYS = {
    companyMembership: "shjj_company_membership_v1",
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
    if (stored) return stored;

    try {
      if (typeof state !== "undefined" && state.companyMembership) return state.companyMembership;
    } catch {
      return null;
    }

    return null;
  }

  function isAdmin() {
    const membership = getMembership();
    return membership?.status === "active" && membership?.role === "admin";
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

      if (!isAdmin()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showFeedback("일정 삭제는 관리자만 가능합니다.");
      }
    },
    true
  );
})();
