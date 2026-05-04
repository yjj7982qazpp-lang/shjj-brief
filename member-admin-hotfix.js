(() => {
  const ORIGINAL_ADMIN_ID = "ca482e0e-07b9-4341-8f16-cbf28e445db6";

  function text(el) {
    return String(el?.textContent || "").trim();
  }

  function getPreviousPill(button) {
    let node = button?.previousElementSibling;
    while (node) {
      if (node.classList?.contains("schedule-admin-pill")) return node;
      node = node.previousElementSibling;
    }
    return null;
  }

  async function copyValue(value, label) {
    if (!value) {
      window.alert(`${label} 정보가 없습니다.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      window.alert(`${label}가 복사되었습니다.`);
    } catch {
      window.prompt(`${label} 복사`, value);
    }
  }

  function normalizeLabels() {
    const rows = Array.from(document.querySelectorAll("#scheduleAdminMemberList .schedule-admin-member"));
    const list = document.getElementById("scheduleAdminMemberList");
    if (!list || rows.length === 0) return;

    const originalAdmin = rows.find((row) => row.dataset.memberId === ORIGINAL_ADMIN_ID);
    if (originalAdmin && list.firstElementChild !== originalAdmin) {
      list.prepend(originalAdmin);
    }

    rows.forEach((row) => {
      const buttons = Array.from(row.querySelectorAll("button"));
      buttons.forEach((button) => {
        const label = text(button);
        const previousPill = getPreviousPill(button);
        const pillText = text(previousPill);

        if (label === "복사" && pillText.startsWith("초대코드")) button.textContent = "초대코드복사";
        if (label === "복사" && pillText.startsWith("PIN")) button.textContent = "핀번호복사";
        if (label === "이름") button.textContent = "이름변경";
        if (label === "읽기") button.textContent = "읽기로 변경";
        if (label === "읽기/쓰기") button.textContent = "읽기/쓰기로 변경";
        if (label === "관리자화") button.textContent = "관리자로 변경";
        if (label === "구성원화") button.textContent = "구성원으로 변경";
      });
    });
  }

  function interceptCopy(event) {
    const button = event.target?.closest?.("#scheduleAdminMemberList button");
    if (!button) return;
    const label = text(button);
    if (label !== "초대코드복사" && label !== "핀번호복사") return;

    const pill = getPreviousPill(button);
    const pillText = text(pill);
    const isPin = label === "핀번호복사";
    const value = pillText.replace(isPin ? /^PIN\s*/ : /^초대코드\s*/, "").trim();

    event.preventDefault();
    event.stopImmediatePropagation();
    copyValue(value, isPin ? "핀번호" : "초대코드");
  }

  const observer = new MutationObserver(() => normalizeLabels());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("click", interceptCopy, true);
  window.setInterval(normalizeLabels, 1500);
  normalizeLabels();
})();
