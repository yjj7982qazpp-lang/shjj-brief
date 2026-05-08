(() => {
  const DEFAULT_LOCAL_MEMBER_PIN = String(0).padStart(4, "0");
  const RUN_FLAG = "data-pin-helper-applied";

  function getPinLabelForText(text) {
    const upper = String(text || "").toUpperCase();
    if (upper.includes("SHJJ-ADMIN")) return "관리자 기존 PIN";
    if (upper.includes("SHJJ-")) return `PIN ${DEFAULT_LOCAL_MEMBER_PIN}`;
    return "";
  }

  function appendPinBadgesOnce() {
    const list = document.getElementById("scheduleAdminMemberList");
    if (!list) return false;

    const rows = Array.from(list.children || []);
    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      if (row.getAttribute(RUN_FLAG) === "true") return;

      const label = getPinLabelForText(row.textContent || "");
      if (!label) return;

      const existingBadge = row.querySelector(".schedule-pin-badge");
      if (existingBadge) {
        existingBadge.textContent = label;
      } else {
        const pinBadge = document.createElement("span");
        pinBadge.className = "schedule-role-badge schedule-pin-badge";
        pinBadge.textContent = label;
        pinBadge.style.marginLeft = "6px";
        pinBadge.style.whiteSpace = "nowrap";

        const target = row.querySelector("button[aria-label*='복사']") || row.querySelector("button") || row;
        target.insertAdjacentElement("afterend", pinBadge);
      }

      row.setAttribute(RUN_FLAG, "true");
    });

    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const done = appendPinBadgesOnce();
    if (done || attempts > 20) {
      window.clearInterval(timer);
    }
  }, 300);

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("#scheduleAdminPanel") || target.id === "addScheduleMemberBtn") {
      window.setTimeout(appendPinBadgesOnce, 150);
      window.setTimeout(appendPinBadgesOnce, 600);
    }
  });
})();
