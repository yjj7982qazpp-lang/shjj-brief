(() => {
  const STORAGE_KEY = "shjj_company_membership_v1";
  const DEFAULT_COMPANY_ROOM_ID = "shjj-default";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function readMembership() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveMembership(membership) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(membership));
  }

  const membership = readMembership();
  if (!membership || typeof membership !== "object") return;

  const currentRoomId = String(membership.companyRoomId || "");
  if (!UUID_RE.test(currentRoomId)) return;

  saveMembership({
    ...membership,
    serverCompanyId: membership.serverCompanyId || currentRoomId,
    companyRoomId: DEFAULT_COMPANY_ROOM_ID,
  });
})();
