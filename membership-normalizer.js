(() => {
  const MEMBERSHIP_KEY = "shjj_company_membership_v1";
  const MEMBERS_KEY = "shjj_company_members_v1";
  const DEFAULT_COMPANY_ROOM_ID = "shjj-default";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeMembership(membership) {
    if (!membership || typeof membership !== "object") return null;
    const roomId = String(membership.companyRoomId || "");
    const normalized = {
      ...membership,
      companyRoomId: DEFAULT_COMPANY_ROOM_ID,
      serverCompanyId: UUID_RE.test(roomId) ? (membership.serverCompanyId || roomId) : (membership.serverCompanyId || ""),
      status: membership.status === "inactive" ? "inactive" : "active",
      role: membership.role === "admin" ? "admin" : "member",
      schedulePermission: membership.role === "admin" || membership.schedulePermission === "write" ? "write" : "read",
    };
    return normalized.memberId ? normalized : null;
  }

  function upsertCurrentMember(membership) {
    if (!membership || membership.status !== "active") return;
    const members = readJson(MEMBERS_KEY, []);
    const list = Array.isArray(members) ? members : [];
    const next = {
      memberId: membership.memberId,
      memberName: membership.memberName || "구성원",
      role: membership.role === "admin" ? "admin" : "member",
      schedulePermission: membership.role === "admin" || membership.schedulePermission === "write" ? "write" : "read",
      status: "active",
      inviteCode: membership.inviteCode || "SERVER-MEMBER",
    };
    const index = list.findIndex((item) => item?.memberId === next.memberId);
    if (index >= 0) list[index] = { ...list[index], ...next };
    else list.push(next);
    writeJson(MEMBERS_KEY, list);
  }

  const membership = normalizeMembership(readJson(MEMBERSHIP_KEY, null));
  if (!membership) return;
  writeJson(MEMBERSHIP_KEY, membership);
  upsertCurrentMember(membership);
})();
