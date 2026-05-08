(() => {
  const DEFAULT_LOCAL_MEMBER_PIN = String(0).padStart(4, "0");

  function getPinLabelForText(text) {
    const upper = String(text || "").toUpperCase();
    if (upper.includes("SHJJ-ADMIN")) return "관리자 기존 PIN";
    if (upper.includes("SHJJ-")) return `PIN ${DEFAULT_LOCAL_MEMBER_PIN}`;
    return "";
  }

  function isMemberAdminListReady() {
    return Boolean(document.getElementById("scheduleAdminMemberList"));
  }

  function appendPinBadges() {
    const list = document.getElementById("scheduleAdminMemberList");
    if (!list) return;

    const rows = Array.from(list.children || []);
    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      const label = getPinLabelForText(row.textContent || "");
      if (!label) return;

      const existingBadge = row.querySelector(".schedule-pin-badge");
      if (existingBadge) {
        existingBadge.textContent = label;
        return;
      }

      const pinBadge = document.createElement("span");
      pinBadge.className = "schedule-role-badge schedule-pin-badge";
      pinBadge.textContent = label;
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
