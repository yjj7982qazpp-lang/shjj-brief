(() => {
  const DEFAULT_LOCAL_MEMBER_PIN = "0000";

  function isMemberAdminListReady() {
    return Boolean(document.getElementById("scheduleAdminMemberList"));
  }

  function appendPinBadges() {
    const list = document.getElementById("scheduleAdminMemberList");
    if (!list) return;

    const rows = Array.from(list.children || []);
    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      const text = row.textContent || "";
      if (!text.includes("SHJJ-") || text.includes("PIN")) return;

      const pinBadge = document.createElement("span");
      pinBadge.className = "schedule-role-badge schedule-pin-badge";
      pinBadge.textContent = `PIN ${DEFAULT_LOCAL_MEMBER_PIN}`;
      pinBadge.style.marginLeft = "6px";
      pinBadge.style.whiteSpace = "nowrap";

      const target = row.querySelector("button[aria-label*='복사']") || row.querySelector("button") || row;
      target.insertAdjacentElement("afterend", pinBadge);
    });
  }

  function observeMemberList() {
    if (!isMemberAdminListReady()) return false;
    appendPinBadges();

    const list = document.getElementById("scheduleAdminMemberList");
    const observer = new MutationObserver(() => appendPinBadges());
    observer.observe(list, { childList: true, subtree: true });
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (observeMemberList() || attempts > 30) {
      window.clearInterval(timer);
    }
  }, 500);
})();
