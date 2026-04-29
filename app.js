/* Structure
 * - Weather
 * - Daily Guide
 * - Schedule
 * - Law Brief
 * - Navigation
 */

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const APP_VERSION = "0.1";
const PRODUCTION_HOSTNAMES = [
  "shjj-brief.pages.dev",
  "shjjbrief.com",
  "www.shjjbrief.com",
  "www.shjj-brief.com",
  "shjj-brief.com",
  "brief.shjj.co.kr",
];
const PREVIEW_HOSTNAMES = [
  "preview.shjj-brief.pages.dev",
];
const APP_NAME = "SHJJ Brief";

const STORAGE_KEYS = {
  schedules: "shjj_brief_schedules_v4",
  companyMembership: "shjj_company_membership_v1",
  companyMembers: "shjj_company_members_v1",
  notificationTime: "shjj_notification_time",
};

const SCHEDULE_STORAGE_VERSION = 1;

// 일정 데이터는 운영 업데이트 후에도 같은 도메인/localStorage key에서 보존되어야 한다.
// 이 key를 바꾸면 기존 일정이 사라진 것처럼 보일 수 있으므로 migration 없이 변경하지 않는다.
// preview와 main은 도메인이 달라 localStorage가 자동 공유되지 않는다.
// 여러 직원 기기 간 실제 일정 공유는 향후 서버/DB 연동이 필요하다.
const DEFAULT_NOTIFICATION_TIME = "09:20";

const DEFAULT_LOCATION = {
  city: "서울",
  latitude: 37.5665,
  longitude: 126.9780,
};

const DEFAULT_COMPANY = {
  id: "shjj-default",
  name: "SHJJ 회사방",
};

const DEFAULT_MEMBER = {
  id: "local-admin",
  name: "관리자",
  role: "admin",
};

const INVITE_CODES = {
  "SHJJ-ADMIN": {
    memberId: "local-admin",
    memberName: "관리자",
    role: "admin",
    schedulePermission: "write",
    status: "active",
  },
  "SHJJ-MEMBER": {
    memberId: "local-member",
    memberName: "구성원",
    role: "member",
    schedulePermission: "read",
    status: "active",
  },
};

const DEFAULT_COMPANY_MEMBERS = [
  {
    memberId: "local-admin",
    memberName: "관리자",
    role: "admin",
    schedulePermission: "write",
    status: "active",
  },
  {
    memberId: "local-member",
    memberName: "구성원",
    role: "member",
    schedulePermission: "read",
    status: "active",
  },
];

const WEATHER_COPY = {
  loading: "날씨 정보를 불러오는 중",
  failed: "날씨 정보를 불러오지 못했습니다.",
  fallbackTitle: "날씨 정보",
  fallbackDesc: "날씨 정보를 확인했습니다.",
};

const LAW_MESSAGES = {
  defaultBasis: "시행일 기준",
  defaultNotice: "시행일 기준으로 오늘 확인할 법령 변경을 정리합니다.",
  loadFailed: "법령 변경 데이터를 불러오지 못했습니다. 네트워크 또는 data/law_updates.json 파일을 확인하세요.",
  loadFailedDetail: "법령 데이터 파일을 불러오지 못했습니다. data/law_updates.json을 확인하세요.",
  emptyToday: "오늘 변경이 없습니다.",
  emptyWeek: "최근 7일 기준 변경이 없습니다.",
  emptyMonth: "최근 30일 기준 변경이 없습니다.",
};

const LAW_TAB_PANELS = {
  today: "lawPanelToday",
  week: "lawPanelWeek",
  month: "lawPanelMonth",
};

const WEATHER_FIELD_PARAMS = {
  current: [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "weather_code",
    "wind_speed_10m",
  ],
  daily: [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
  ],
  hourly: [
    "temperature_2m",
    "precipitation_probability",
    "precipitation",
  ],
};

const LAW_MAJOR_GROUPS = ["건축", "도시주택", "소방안전", "교통기타", "기타"];
const LAW_GROUP_LABELS = {
  건축: "건축",
  도시주택: "도시·주택",
  소방안전: "소방·안전",
  교통기타: "교통·주차",
  기타: "기타",
};
const LAW_API_STATUS_LABELS = {
  success: "정상",
  partial_success: "부분 성공",
  no_data: "0건",
  missing_law_oc: "OC 필요",
  api_error: "오류",
};

const state = {
  city: DEFAULT_LOCATION.city,
  latitude: DEFAULT_LOCATION.latitude,
  longitude: DEFAULT_LOCATION.longitude,
  weather: null,
  schedules: [],
  scheduleCalendarMonth: null,
  company: DEFAULT_COMPANY,
  member: null,
  companyMembership: null,
  companyMembers: [],
  inactiveNoticeShown: false,
  invitePanelOpen: false,
  notificationTime: DEFAULT_NOTIFICATION_TIME,
  weatherMode: "today",
};

const weatherMap = {
  0: ["맑음", "활동하기 좋은 날입니다."],
  1: ["대체로 맑음", "구름은 조금 있지만 무난한 날입니다."],
  2: ["부분적으로 흐림", "햇빛과 구름이 섞여 있습니다."],
  3: ["흐림", "하늘이 흐린 편입니다."],
  45: ["안개", "이동 시 시야를 확인하세요."],
  48: ["안개", "도로와 보행 안전에 유의하세요."],
  51: ["약한 이슬비", "가벼운 우산을 챙기면 좋습니다."],
  53: ["이슬비", "외근 시 우산을 챙기세요."],
  55: ["강한 이슬비", "우산이 필요합니다."],
  61: ["약한 비", "비가 조금 올 수 있습니다."],
  63: ["비", "외근 시 우산을 챙기세요."],
  65: ["강한 비", "이동 계획을 여유 있게 잡으세요."],
  71: ["약한 눈", "눈길에 유의하세요."],
  73: ["눈", "이동 시간을 여유 있게 보세요."],
  75: ["강한 눈", "외근과 운전은 신중히 판단하세요."],
  80: ["소나기", "갑작스러운 비에 대비하세요."],
  81: ["소나기", "우산을 준비하는 편이 좋습니다."],
  82: ["강한 소나기", "실외 이동에 주의하세요."],
  95: ["천둥번개", "실외 활동은 조심하세요."],
  96: ["우박 동반 천둥", "외부 이동을 줄이는 편이 좋습니다."],
  99: ["강한 우박 동반 천둥", "안전을 우선하세요."],
};

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function clearChildren(el) {
  if (el) el.textContent = "";
}

function bindEvent(el, type, handler) {
  if (el) el.addEventListener(type, handler);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function round(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return Math.round(value);
}

function safeText(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function safeHtml(value, fallback = "-") {
  return escapeHtml(safeText(value, fallback));
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadArray(key) {
  const value = loadJson(key, []);
  return Array.isArray(value) ? value : [];
}

function readScheduleStoragePayload() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.schedules);
    if (!raw) return { version: SCHEDULE_STORAGE_VERSION, items: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { version: 0, items: parsed };
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
      return {
        version: Number.isFinite(Number(parsed.version)) ? Number(parsed.version) : 0,
        items: parsed.items,
      };
    }
  } catch (error) {
    console.warn("Failed to read schedule storage. Falling back to empty list.", error);
  }
  return { version: SCHEDULE_STORAGE_VERSION, items: [] };
}

function saveSchedulesSafe(items) {
  const normalized = Array.isArray(items) ? items.map(normalizeScheduleItem) : [];
  saveJson(STORAGE_KEYS.schedules, {
    version: SCHEDULE_STORAGE_VERSION,
    items: normalized,
  });
  return normalized;
}

function migrateSchedulesIfNeeded() {
  const payload = readScheduleStoragePayload();
  const normalized = Array.isArray(payload.items) ? payload.items.map(normalizeScheduleItem) : [];
  const shouldSave = payload.version !== SCHEDULE_STORAGE_VERSION ||
    !Array.isArray(payload.items) ||
    JSON.stringify(payload.items) !== JSON.stringify(normalized);

  if (shouldSave) return saveSchedulesSafe(normalized);
  return normalized;
}

function loadSchedulesSafe() {
  return migrateSchedulesIfNeeded();
}

function exportSchedulesBackup() {
  const items = state.schedules.length ? state.schedules : loadSchedulesSafe();
  return JSON.stringify({
    version: SCHEDULE_STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    items: items.map(normalizeScheduleItem),
  }, null, 2);
}

function importSchedulesBackup(json) {
  const parsed = typeof json === "string" ? JSON.parse(json) : json;
  const items = Array.isArray(parsed) ? parsed : parsed?.items;
  const normalized = saveSchedulesSafe(Array.isArray(items) ? items : []);
  state.schedules = normalized;
  renderSchedules();
  return normalized;
}

function normalizeNotificationTime(value) {
  const text = safeText(value, DEFAULT_NOTIFICATION_TIME);
  return /^\d{2}:\d{2}$/.test(text) ? text : DEFAULT_NOTIFICATION_TIME;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createActionButton(label, className, id, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.id = id;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createEmptyListItem(message) {
  const row = document.createElement("div");
  row.className = "item";

  const main = document.createElement("div");
  main.className = "item-main";

  const title = document.createElement("span");
  title.className = "item-title";
  title.textContent = message;

  main.appendChild(title);
  row.appendChild(main);
  return row;
}

function activateButtonGroup(buttons, activeButton) {
  buttons.forEach((button) => {
    const isActive = button === activeButton;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function weatherText(code) {
  return weatherMap[code] || [WEATHER_COPY.fallbackTitle, WEATHER_COPY.fallbackDesc];
}

function normalizeHostname(hostname) {
  return String(hostname || "").trim().toLowerCase();
}

function isLocalHostname(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function isProductionHostname(hostname) {
  return PRODUCTION_HOSTNAMES.includes(hostname);
}

function isPreviewHostname(hostname) {
  if (PREVIEW_HOSTNAMES.includes(hostname)) return true;

  return (
    hostname.endsWith(".pages.dev") &&
    (
      hostname.startsWith("preview-") ||
      hostname.startsWith("preview.") ||
      hostname.includes("preview-ui-") ||
      hostname.includes("ui-cleanup")
    )
  );
}

function getAppEnv() {
  const hostname = normalizeHostname(window.location.hostname);

  if (isProductionHostname(hostname)) {
    return "production";
  }

  if (isLocalHostname(hostname)) {
    return "preview";
  }

  if (isPreviewHostname(hostname)) {
    return "preview";
  }

  return "production";
}

const APP_ENV = getAppEnv();
const IS_PREVIEW = APP_ENV === "preview";
const APP_TITLE = IS_PREVIEW ? `${APP_NAME} Pre v${APP_VERSION}` : APP_NAME;

function applyAppTitle() {
  document.title = APP_TITLE;

  const titleTargets = document.querySelectorAll("[data-app-title]");
  titleTargets.forEach((target) => {
    target.textContent = APP_NAME;
  });

  const previewBadges = document.querySelectorAll("[data-preview-badge]");
  previewBadges.forEach((badge) => {
    badge.hidden = !IS_PREVIEW;
    badge.style.display = IS_PREVIEW ? "" : "none";
    badge.textContent = IS_PREVIEW ? `Pre v${APP_VERSION}` : "";
  });
}

function formatRainTime(date) {
  const label = date.toLocaleDateString("ko-KR", { day: "numeric" }) ===
    new Date().toLocaleDateString("ko-KR", { day: "numeric" })
    ? "오늘"
    : "내일";
  const hour = date.getHours();
  const dayPart = hour >= 18 ? " 밤" : "";
  return `${label}${dayPart} ${hour}시`;
}

function formatRainRange(start, end) {
  const sameDate = start.toDateString() === end.toDateString();
  return sameDate
    ? `${formatRainTime(start)}~${end.getHours()}시`
    : `${formatRainTime(start)}~${formatRainTime(end)}`;
}

function getRainTimeSummary(weather) {
  const hourly = weather?.hourly;
  if (!hourly?.time?.length) return "시간대별 강수 정보 확인 중";

  const now = new Date();
  const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const slots = hourly.time
    .map((time, index) => {
      const date = new Date(time);
      const probability = Number(hourly.precipitation_probability?.[index] ?? 0);
      const precipitation = Number(hourly.precipitation?.[index] ?? 0);
      return { date, probability, precipitation };
    })
    .filter((slot) =>
      slot.date >= now &&
      slot.date <= limit &&
      (slot.probability >= 40 || slot.precipitation > 0)
    );

  if (slots.length === 0) return "향후 24시간 내 뚜렷한 강수 신호 없음";

  const groups = slots.reduce((acc, slot) => {
    const lastGroup = acc[acc.length - 1];
    const previous = lastGroup?.[lastGroup.length - 1];
    const isNear = previous && slot.date - previous.date <= 90 * 60 * 1000;

    if (isNear) {
      lastGroup.push(slot);
    } else {
      acc.push([slot]);
    }

    return acc;
  }, []);

  const scoreGroup = (group) =>
    Math.max(...group.map((slot) => slot.probability)) * 10 +
    Math.max(...group.map((slot) => slot.precipitation));
  const bestGroup = groups.sort((a, b) => scoreGroup(b) - scoreGroup(a))[0];
  const start = bestGroup[0].date;
  const end = bestGroup[bestGroup.length - 1].date;
  const maxProbability = Math.max(...bestGroup.map((slot) => slot.probability));
  const maxPrecipitation = Math.max(...bestGroup.map((slot) => slot.precipitation));

  if (bestGroup.length === 1) {
    return `${formatRainTime(start)} 전후 ${maxProbability >= 40 ? "비 가능성 높음" : "약한 비 가능성"}`;
  }

  const intensity = maxProbability >= 40 || maxPrecipitation >= 1 ? "비 가능성 높음" : "약한 비 가능성";
  return `${formatRainRange(start, end)} ${intensity}`;
}

function buildWeatherParams() {
  return new URLSearchParams({
    latitude: state.latitude,
    longitude: state.longitude,
    current: WEATHER_FIELD_PARAMS.current.join(","),
    daily: WEATHER_FIELD_PARAMS.daily.join(","),
    hourly: WEATHER_FIELD_PARAMS.hourly.join(","),
    timezone: "auto",
    forecast_days: "2",
  });
}

function getWeatherSnapshot(dayIndex = 0) {
  if (!state.weather) return null;

  const current = dayIndex === 0 ? state.weather.current : null;
  const daily = state.weather.daily;

  if (dayIndex >= daily.temperature_2m_max.length) return null;

  const isTomorrow = dayIndex === 1;
  
  return {
    current: isTomorrow ? null : current,
    daily,
    dayIndex,
    isTomorrow,
    temp: isTomorrow ? round(daily.temperature_2m_max[1]) : round(current?.temperature_2m),
    high: round(daily.temperature_2m_max[dayIndex]),
    low: round(daily.temperature_2m_min[dayIndex]),
    rain: round(daily.precipitation_probability_max[dayIndex]),
    wind: isTomorrow ? "--" : round(current?.wind_speed_10m),
    humidity: isTomorrow ? "--" : round(current?.relative_humidity_2m),
    weatherCode: daily.weather_code[dayIndex],
  };
}

function buildRainSignalSummary(weather) {
  const hourly = weather?.hourly;
  if (!hourly?.time?.length) {
    return {
      hasSignal: false,
      maxProbability: 0,
      maxPrecipitation: 0,
      startLabel: "",
      endLabel: "",
      text: "시간대별 강수 정보 확인 중",
    };
  }

  const now = new Date();
  const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const slots = hourly.time
    .map((time, index) => {
      const date = new Date(time);
      const probability = Number(hourly.precipitation_probability?.[index] ?? 0);
      const precipitation = Number(hourly.precipitation?.[index] ?? 0);
      return { date, probability, precipitation };
    })
    .filter((slot) =>
      slot.date >= now &&
      slot.date <= limit &&
      (slot.probability >= 25 || slot.precipitation > 0)
    );

  if (!slots.length) {
    return {
      hasSignal: false,
      maxProbability: 0,
      maxPrecipitation: 0,
      startLabel: "",
      endLabel: "",
      text: "향후 24시간 내 뚜렷한 강수 신호 없음",
    };
  }

  const groups = slots.reduce((acc, slot) => {
    const lastGroup = acc[acc.length - 1];
    const previous = lastGroup?.[lastGroup.length - 1];
    const isNear = previous && slot.date - previous.date <= 90 * 60 * 1000;
    if (isNear) {
      lastGroup.push(slot);
    } else {
      acc.push([slot]);
    }
    return acc;
  }, []);

  const scoreGroup = (group) =>
    Math.max(...group.map((slot) => slot.probability)) * 10 +
    Math.max(...group.map((slot) => slot.precipitation));
  const bestGroup = groups.sort((a, b) => scoreGroup(b) - scoreGroup(a))[0];
  const start = bestGroup[0].date;
  const end = bestGroup[bestGroup.length - 1].date;
  const maxProbability = Math.max(...bestGroup.map((slot) => slot.probability));
  const maxPrecipitation = Math.max(...bestGroup.map((slot) => slot.precipitation));
  const startLabel = formatRainTime(start);
  const endLabel = formatRainTime(end);
  const hasLightRain = maxProbability >= 60 && maxPrecipitation < 1;
  const hasSignal = maxProbability >= 40 || maxPrecipitation > 0;

  let text = "";
  if (hasLightRain) {
    text = `${startLabel} 전후 비 가능성은 있으나 강수는 약하거나 짧을 수 있음`;
  } else if (bestGroup.length === 1) {
    text = `${startLabel} 전후 강수 가능성 있음`;
  } else {
    text = `${formatRainRange(start, end)} 강수 가능성 있음`;
  }

  return {
    hasSignal,
    maxProbability,
    maxPrecipitation,
    startLabel,
    endLabel,
    text,
  };
}

function renderDailyGuide(dayIndex = 0) {
  const snapshot = getWeatherSnapshot(dayIndex);
  if (!snapshot) return;

  const section = $("guideSection");
  const label = dayIndex === 0 ? "오늘 행동 가이드" : "내일 행동 가이드";
  const guideSummary = section?.querySelector(".fold-summary");
  
  if (guideSummary) {
    const heading = guideSummary.querySelector("h3");
    if (heading) heading.textContent = label;
  }

  const { rainGuide, outsideGuide, clothesGuide } = getGuideCopy(snapshot);
  setText("rainGuideTitle", rainGuide.title);
  setText("rainGuideText", rainGuide.text);
  setText("outsideGuideTitle", outsideGuide.title);
  setText("outsideGuideText", outsideGuide.text);
  setText("clothesGuideTitle", clothesGuide.title);
  setText("clothesGuideText", clothesGuide.text);
}

async function loadWeather() {
  setText("weatherDesc", WEATHER_COPY.loading);
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${buildWeatherParams().toString()}`);
  if (!res.ok) throw new Error("날씨 로딩 실패");

  state.weather = await res.json();
  const dayIndex = state.weatherMode === "today" ? 0 : 1;
  renderWeather(dayIndex);
  renderDailyGuide(dayIndex);
  updateSettingsView();
  updateBrief();
  renderSchedules();
}

function handleWeatherLoadError() {
  state.weather = null;
  setText("weatherDesc", WEATHER_COPY.failed);
  updateSettingsView();
  updateBrief();
}

function updateDate() {
  const now = new Date();
  setText("todayDate", now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }));
}

function updateSettingsView() {
  setText("settingCityName", DEFAULT_LOCATION.city);
}

function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function getWeekRange(dateString = getTodayDateString()) {
  const base = new Date(`${dateString}T00:00:00`);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    end: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
  };
}

function hasCompanyMembership() {
  return state.companyMembership?.status === "active" && state.companyMembership?.companyRoomId === DEFAULT_COMPANY.id;
}

function isCompanyMembershipInactive() {
  return state.companyMembership?.status === "inactive" && state.companyMembership?.companyRoomId === DEFAULT_COMPANY.id;
}

function canWriteSchedule(member = state.member) {
  return hasCompanyMembership() && (
    member?.role === "admin" ||
    (member?.role === "member" && member?.schedulePermission === "write")
  );
}

function canManageCompany(member = state.member) {
  return hasCompanyMembership() && member?.role === "admin";
}

function getMemberRoleLabel(member = state.member) {
  if (member?.role === "admin") return "관리자";
  if (member?.role === "member") return "구성원";
  return "미참여";
}

function getSchedulePermissionLabel(member = state.member) {
  if (!member || member.status === "inactive") return "접속 차단";
  if (member.role === "admin" || member.schedulePermission === "write") return "읽기/쓰기";
  return "읽기 전용";
}

function normalizeCompanyMember(value) {
  const role = value?.role === "admin" ? "admin" : "member";
  const fallback = role === "admin" ? DEFAULT_COMPANY_MEMBERS[0] : DEFAULT_COMPANY_MEMBERS[1];
  const status = value?.status === "inactive" ? "inactive" : "active";
  const schedulePermission = role === "admin"
    ? "write"
    : value?.schedulePermission === "write" ? "write" : "read";

  return {
    memberId: safeText(value?.memberId, fallback.memberId),
    memberName: safeText(value?.memberName, fallback.memberName),
    role,
    schedulePermission,
    status,
  };
}

function getCompanyMemberById(memberId) {
  return state.companyMembers.find((member) => member.memberId === memberId);
}

function loadCompanyMembers() {
  const stored = loadArray(STORAGE_KEYS.companyMembers);
  const byId = new Map(DEFAULT_COMPANY_MEMBERS.map((member) => [member.memberId, normalizeCompanyMember(member)]));
  stored.forEach((member) => {
    const normalized = normalizeCompanyMember(member);
    byId.set(normalized.memberId, normalized);
  });
  state.companyMembers = Array.from(byId.values());
  saveJson(STORAGE_KEYS.companyMembers, state.companyMembers);
}

function normalizeCompanyMembership(value) {
  if (!value || typeof value !== "object") return null;
  if (value.companyRoomId !== DEFAULT_COMPANY.id) return null;
  const role = value.role === "admin" ? "admin" : value.role === "member" ? "member" : "";
  if (!role) return null;
  const memberId = safeText(value.memberId, role === "admin" ? "local-admin" : "local-member");
  const managedMember = getCompanyMemberById(memberId);
  const status = managedMember?.status || (value.status === "inactive" ? "inactive" : "active");
  const schedulePermission = role === "admin"
    ? "write"
    : managedMember?.schedulePermission || (value.schedulePermission === "write" ? "write" : "read");

  return {
    companyRoomId: DEFAULT_COMPANY.id,
    companyRoomName: DEFAULT_COMPANY.name,
    memberId,
    memberName: managedMember?.memberName || safeText(value.memberName, role === "admin" ? "관리자" : "구성원"),
    role,
    schedulePermission,
    status,
    joinedAt: safeText(value.joinedAt, new Date().toISOString()),
  };
}

function applyCompanyMembership(membership) {
  state.companyMembership = normalizeCompanyMembership(membership);
  state.company = DEFAULT_COMPANY;
  state.member = state.companyMembership
    ? {
      id: state.companyMembership.memberId,
      name: state.companyMembership.memberName,
      role: state.companyMembership.role,
      schedulePermission: state.companyMembership.schedulePermission,
      status: state.companyMembership.status,
    }
    : null;
}

function loadCompanyMembership() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.companyMembership);
    applyCompanyMembership(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.warn("Failed to load company membership", error);
    applyCompanyMembership(null);
  }
}

function saveCompanyMembership(roleInfo) {
  const membership = {
    companyRoomId: DEFAULT_COMPANY.id,
    companyRoomName: DEFAULT_COMPANY.name,
    memberId: roleInfo.memberId,
    memberName: roleInfo.memberName,
    role: roleInfo.role,
    schedulePermission: roleInfo.schedulePermission,
    status: roleInfo.status,
    joinedAt: new Date().toISOString(),
  };

  saveJson(STORAGE_KEYS.companyMembership, membership);
  applyCompanyMembership(membership);
}

function joinCompanyRoom() {
  const input = $("inviteCodeInput");
  const code = (input?.value || "").trim().toUpperCase();
  const roleInfo = INVITE_CODES[code];

  if (!roleInfo) {
    setText("scheduleInviteFeedback", "초대코드가 올바르지 않습니다.");
    input?.focus();
    return;
  }

  saveCompanyMembership(roleInfo);
  if (input) input.value = "";
  state.inactiveNoticeShown = false;
  state.invitePanelOpen = false;
  renderSchedules();
  if (isCompanyMembershipInactive()) {
    showNotificationToast("접속 권한이 없습니다. 관리자에게 SHJJ 회사방 권한을 확인해 주세요.");
    state.inactiveNoticeShown = true;
    return;
  }
  showNotificationToast("SHJJ 회사방에 참여했습니다.");
}

function updateCompanyMemberAccess(memberId, accessValue) {
  if (!canManageCompany()) return;
  state.companyMembers = state.companyMembers.map((member) => {
    if (member.memberId !== memberId || member.role === "admin") return member;
    if (accessValue === "inactive") {
      return { ...member, status: "inactive", schedulePermission: "read" };
    }
    return {
      ...member,
      status: "active",
      schedulePermission: accessValue === "write" ? "write" : "read",
    };
  });
  saveJson(STORAGE_KEYS.companyMembers, state.companyMembers);
  loadCompanyMembership();
  renderSchedules();
}

function renderScheduleAdminPanel() {
  const list = $("scheduleAdminMemberList");
  if (!list) return;
  clearChildren(list);

  if (!canManageCompany()) return;

  state.companyMembers.forEach((member) => {
    const row = document.createElement("div");
    row.className = "schedule-admin-member";

    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = member.memberName;
    const meta = document.createElement("span");
    meta.textContent = member.role === "admin" ? "관리자" : "구성원";
    info.append(name, meta);

    const select = document.createElement("select");
    select.disabled = member.role === "admin";
    [
      ["write", "읽기/쓰기"],
      ["read", "읽기 전용"],
      ["inactive", "비활성화"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = member.status === "inactive" ? "inactive" : member.schedulePermission;
    select.addEventListener("change", () => updateCompanyMemberAccess(member.memberId, select.value));

    row.append(info, select);
    list.appendChild(row);
  });
}

function normalizeScheduleItem(item) {
  const now = new Date().toISOString();
  const id = safeText(item?.id, makeId());
  const date = safeText(item?.date, getTodayDateString());
  const time = safeText(item?.time, "09:00");
  const rawEstimatedTravelMinutes = item?.estimatedTravelMinutes;
  const estimatedTravelMinutes = rawEstimatedTravelMinutes === null || rawEstimatedTravelMinutes === undefined || rawEstimatedTravelMinutes === ""
    ? NaN
    : Number(rawEstimatedTravelMinutes);
  const bufferMinutes = Number(item?.bufferMinutes);

  return {
    id,
    companyId: safeText(item?.companyId, DEFAULT_COMPANY.id),
    calendarScope: safeText(item?.calendarScope, "company"),
    date,
    time,
    title: safeText(item?.title, "제목 없음"),
    memo: safeText(item?.memo, ""),
    location: safeText(item?.location, ""),
    estimatedTravelMinutes: Number.isFinite(estimatedTravelMinutes) ? estimatedTravelMinutes : null,
    bufferMinutes: Number.isFinite(bufferMinutes) ? bufferMinutes : 15,
    detailMemo: safeText(item?.detailMemo, ""),
    createdBy: safeText(item?.createdBy, DEFAULT_MEMBER.id),
    createdAt: safeText(item?.createdAt, now),
    updatedAt: safeText(item?.updatedAt, now),
    source: safeText(item?.source, "manual"),
  };
}

function loadSchedules() {
  return loadSchedulesSafe();
}

function getSelectedScheduleTime() {
  return $("scheduleTimeInput")?.value || "09:00";
}

function getSelectedScheduleDate() {
  return $("scheduleDateInput")?.value || getTodayDateString();
}

function toScheduleMinutes(value) {
  if (value === null || value === undefined || value === "") return null;
  const minutes = Number(value);
  return Number.isFinite(minutes) ? minutes : null;
}

function formatScheduleMinutes(value, emptyText = "이동시간 미입력") {
  const minutes = toScheduleMinutes(value);
  if (minutes === null) return emptyText;
  return `${minutes}분`;
}

function getRecommendedDepartureTime(item) {
  const travelMinutes = toScheduleMinutes(item.estimatedTravelMinutes);
  const bufferMinutes = toScheduleMinutes(item.bufferMinutes) ?? 15;
  if (travelMinutes === null) return "-";

  const scheduleTime = new Date(`${item.date}T${safeText(item.time, "09:00")}`);
  if (Number.isNaN(scheduleTime.getTime())) return "-";

  const totalBuffer = travelMinutes + bufferMinutes;
  scheduleTime.setMinutes(scheduleTime.getMinutes() - totalBuffer);
  return `${pad2(scheduleTime.getHours())}:${pad2(scheduleTime.getMinutes())}`;
}

function createScheduleDetailView(item) {
  const detail = document.createElement("details");
  detail.className = "schedule-detail-fold";

  const summary = document.createElement("summary");
  summary.textContent = "상세 보기";

  const body = document.createElement("div");
  body.className = "schedule-detail-body";

  const rows = [
    ["도착지", safeText(item.location, "도착지 없음")],
    ["예상 이동시간", formatScheduleMinutes(item.estimatedTravelMinutes)],
    ["여유시간", formatScheduleMinutes(item.bufferMinutes, "15분")],
    ["권장 출발시간", toScheduleMinutes(item.estimatedTravelMinutes) !== null ? getRecommendedDepartureTime(item) : "-"],
    ["메모", safeText(item.detailMemo, "메모 없음")],
  ];

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "schedule-detail-row";

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    const valueEl = document.createElement("strong");
    valueEl.textContent = value;

    row.append(labelEl, valueEl);
    body.appendChild(row);
  });

  detail.append(summary, body);
  return detail;
}

function setupScheduleTimePicker() {
  const dateInput = $("scheduleDateInput");
  const timeInput = $("scheduleTimeInput");
  const today = getTodayDateString();

  if (dateInput && !dateInput.value) dateInput.value = today;
  if (timeInput && !timeInput.value) timeInput.value = "09:00";
  state.scheduleCalendarMonth = `${today.slice(0, 7)}-01`;
}

function resetScheduleForm() {
  const dateInput = $("scheduleDateInput");
  const timeInput = $("scheduleTimeInput");
  const titleInput = $("scheduleTitleInput");
  const locationInput = $("scheduleLocationInput");
  const memoInput = $("scheduleMemoInput");

  if (dateInput) dateInput.value = getTodayDateString();
  if (timeInput) timeInput.value = "09:00";
  if (titleInput) titleInput.value = "";
  if (locationInput) locationInput.value = "";
  if (memoInput) memoInput.value = "";
}

function setScheduleSheetOpen(open) {
  const sheet = $("scheduleSheet");
  if (!sheet) return;
  sheet.hidden = !open;
  if (open) {
    setupScheduleTimePicker();
    $("scheduleTitleInput")?.focus();
  }
}

function showScheduleFeedback(message) {
  setText("scheduleFeedback", message);
  clearTimeout(showScheduleFeedback.timerId);
  if (message) {
    showScheduleFeedback.timerId = setTimeout(() => {
      setText("scheduleFeedback", "");
    }, 2200);
  }
}

function renderScheduleInviteToggle() {
  const button = $("toggleScheduleInviteBtn");
  if (!button) return;
  const inactive = isCompanyMembershipInactive();
  button.hidden = inactive;
  button.textContent = state.invitePanelOpen ? "닫기" : "초대";
  button.setAttribute("aria-expanded", String(state.invitePanelOpen));
}

function toggleScheduleInvitePanel() {
  state.invitePanelOpen = !state.invitePanelOpen;
  renderScheduleAccess();
  if (state.invitePanelOpen) $("inviteCodeInput")?.focus();
}

function createScheduleRow(item) {
  const row = document.createElement("div");
  row.className = "item";

  const main = document.createElement("div");
  main.className = "item-main";

  const datetime = document.createElement("span");
  datetime.className = "item-time";
  datetime.textContent = `${safeText(item.date, getTodayDateString())} ${safeText(item.time, "--:--")}`;

  const title = document.createElement("span");
  title.className = "item-title";
  title.textContent = safeText(item.title, "제목 없음");

  const meta = document.createElement("span");
  meta.className = "item-meta";
  meta.textContent = item.calendarScope === "company"
    ? `${state.company.name} · ${safeText(item.createdBy, "local")}`
    : safeText(item.createdBy, "local");

  const weather = document.createElement("span");
  weather.className = "item-weather";
  weather.textContent = getScheduleWeatherText(item);

  const actions = document.createElement("div");
  actions.className = "item-actions";

  if (canWriteSchedule()) {
    const deleteButton = createActionButton("삭제", "delete-schedule", item.id, () => {
      removeSchedule(item.id);
    });
    actions.appendChild(deleteButton);
  }

  main.append(datetime, title, meta, weather, createScheduleDetailView(item));
  row.append(main, actions);
  return row;
}

function sortSchedules(items) {
  return [...items].sort((a, b) => {
    const aKey = `${safeText(a.date, "")} ${safeText(a.time, "")}`;
    const bKey = `${safeText(b.date, "")} ${safeText(b.time, "")}`;
    return aKey.localeCompare(bKey);
  });
}

function getVisibleSchedules() {
  const today = getTodayDateString();
  return state.schedules.filter((item) => item.date === today);
}

function updateBrief() {
  if (!hasCompanyMembership()) {
    setText("scheduleCount", "0건");
    return;
  }
  const visibleCount = getVisibleSchedules().length;
  const totalCount = state.schedules.length;
  setText("scheduleCount", `${visibleCount}/${totalCount}건`);
}

function getScheduleWeatherText(item) {
  if (item.date !== getTodayDateString()) return "";
  if (!state.weather?.hourly?.time?.length) return "예상 날씨 확인 중";

  const hourly = state.weather.hourly;
  const targetTime = new Date(`${item.date}T${safeText(item.time, "09:00")}`);
  if (Number.isNaN(targetTime.getTime())) return "예보 없음";

  const slots = hourly.time
    .map((time, index) => ({
      time: new Date(time),
      temp: Number(hourly.temperature_2m?.[index]),
      rain: Number(hourly.precipitation_probability?.[index] ?? 0),
    }))
    .filter((slot) => !Number.isNaN(slot.time.getTime()));

  const nearby = slots.filter((slot) => Math.abs(slot.time.getTime() - targetTime.getTime()) <= 60 * 60 * 1000);
  const closest = slots
    .map((slot) => ({ ...slot, distance: Math.abs(slot.time.getTime() - targetTime.getTime()) }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (!closest || !Number.isFinite(closest.temp)) return "예보 없음";

  const maxRain = nearby.length
    ? Math.max(...nearby.map((slot) => Number.isFinite(slot.rain) ? slot.rain : 0))
    : closest.rain;
  const currentTemp = Number(state.weather.current?.temperature_2m);

  return `예상 ${round(closest.temp)}° · 강수 ${round(maxRain)}% · 현재 ${Number.isFinite(currentTemp) ? `${round(currentTemp)}°` : "-"}`;
}

function getScheduleCountByDate() {
  return state.schedules.reduce((counts, item) => {
    const date = safeText(item.date, "");
    if (date) counts.set(date, (counts.get(date) || 0) + 1);
    return counts;
  }, new Map());
}

function moveScheduleCalendarMonth(offset) {
  const current = new Date(`${state.scheduleCalendarMonth || `${getTodayDateString().slice(0, 7)}-01`}T00:00:00`);
  current.setMonth(current.getMonth() + offset);
  state.scheduleCalendarMonth = `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-01`;
  renderScheduleCalendar();
}

function selectScheduleDate(dateString) {
  const input = $("scheduleDateInput");
  if (input) input.value = dateString;
  state.scheduleCalendarMonth = `${dateString.slice(0, 7)}-01`;
  renderScheduleCalendar();
}

function renderScheduleSelectedDateList() {
  const container = $("scheduleSelectedDayList");
  if (!container) return;

  clearChildren(container);
  const selectedDate = getSelectedScheduleDate();
  const items = sortSchedules(state.schedules.filter((item) => item.date === selectedDate));
  const selected = new Date(`${selectedDate}T00:00:00`);
  const title = document.createElement("strong");
  title.textContent = Number.isNaN(selected.getTime())
    ? `${selectedDate} 일정`
    : `${selected.getMonth() + 1}월 ${selected.getDate()}일 일정`;
  container.appendChild(title);

  if (items.length === 0) {
    const empty = document.createElement("span");
    empty.textContent = "등록된 일정이 없습니다.";
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("span");
    row.textContent = safeText(item.title, "일정");
    container.appendChild(row);
  });
}

function renderScheduleCalendar() {
  const container = $("scheduleCalendarGrid");
  const title = $("scheduleCalendarTitle");
  if (!container || !title) return;

  clearChildren(container);
  const monthKey = state.scheduleCalendarMonth || `${getTodayDateString().slice(0, 7)}-01`;
  const monthDate = new Date(`${monthKey}T00:00:00`);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const selectedDate = getSelectedScheduleDate();
  const counts = getScheduleCountByDate();

  title.textContent = `${year}년 ${month + 1}월`;
  ["일", "월", "화", "수", "목", "금", "토"].forEach((day) => {
    const cell = document.createElement("span");
    cell.className = "schedule-calendar-weekday";
    cell.textContent = day;
    container.appendChild(cell);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  for (let index = 0; index < firstDay; index += 1) {
    const blank = document.createElement("span");
    blank.className = "schedule-calendar-empty";
    container.appendChild(blank);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const dateString = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "schedule-calendar-day";
    button.classList.toggle("has-schedule", counts.has(dateString));
    button.classList.toggle("selected", selectedDate === dateString);
    button.textContent = String(day);
    button.addEventListener("click", () => selectScheduleDate(dateString));

    const count = counts.get(dateString) || 0;
    if (count > 0) {
      const marker = document.createElement("span");
      marker.className = "schedule-calendar-marker";
      marker.textContent = count > 1 ? String(count) : "";
      button.appendChild(marker);
    }

    container.appendChild(button);
  }

  renderScheduleSelectedDateList();
}

function renderScheduleAccess() {
  const joined = hasCompanyMembership();
  const inactive = isCompanyMembershipInactive();
  const writable = canWriteSchedule();
  const invitePanel = $("scheduleInvitePanel");
  const roomContent = $("scheduleRoomContent");
  const adminPanel = $("scheduleAdminPanel");

  renderScheduleInviteToggle();
  if (invitePanel) invitePanel.hidden = !state.invitePanelOpen || inactive;
  if (roomContent) roomContent.hidden = !joined;
  if (adminPanel) adminPanel.hidden = !canManageCompany();

  if (inactive && !state.inactiveNoticeShown) {
    showNotificationToast("접속 권한이 없습니다. 관리자에게 SHJJ 회사방 권한을 확인해 주세요.");
    state.inactiveNoticeShown = true;
  }

  if (!joined) {
    setText("scheduleCount", "0건");
    setText("scheduleInviteFeedback", "");
    setScheduleSheetOpen(false);
    return;
  }

  setText("scheduleCompanyBadge", state.company.name);
  setText("scheduleRoleBadge", getMemberRoleLabel());
  setText("schedulePermissionBadge", getSchedulePermissionLabel());
  setText("scheduleReadonlyNotice", writable ? "" : "구성원은 읽기 전용입니다.");

  const input = $("scheduleTitleInput");
  const openButton = $("openScheduleSheetBtn");
  const confirmButton = $("confirmScheduleBtn");
  const locationInput = $("scheduleLocationInput");
  const memoInput = $("scheduleMemoInput");
  if (input) input.disabled = !writable;
  if (openButton) {
    openButton.disabled = !writable;
    openButton.hidden = !writable;
  }
  if (confirmButton) confirmButton.disabled = !writable;
  if (locationInput) locationInput.disabled = !writable;
  if (memoInput) memoInput.disabled = !writable;
  if (!writable) setScheduleSheetOpen(false);
  renderScheduleAdminPanel();
}

function renderSchedules() {
  const list = $("scheduleList");
  renderScheduleAccess();
  if (!hasCompanyMembership()) {
    updateBrief();
    return;
  }
  if (!list) return;

  clearChildren(list);
  renderScheduleCalendar();

  const visibleSchedules = getVisibleSchedules();

  if (visibleSchedules.length === 0) {
    list.appendChild(createEmptyListItem("오늘 등록된 일정이 없습니다."));
    updateBrief();
    return;
  }

  sortSchedules(visibleSchedules).forEach((item) => {
    list.appendChild(createScheduleRow(item));
  });
  updateBrief();
}

function removeSchedule(scheduleId) {
  if (!canWriteSchedule()) return;
  state.schedules = state.schedules.filter((schedule) => schedule.id !== scheduleId);
  state.schedules = saveSchedulesSafe(state.schedules);
  renderSchedules();
}

function addSchedule() {
  if (!canWriteSchedule()) return;

  const input = $("scheduleTitleInput");
  const locationInput = $("scheduleLocationInput");
  const memoInput = $("scheduleMemoInput");
  const title = input?.value.trim() || "";

  if (!title) {
    alert("일정 내용을 입력하세요.");
    input?.focus();
    return;
  }

  state.schedules.push(normalizeScheduleItem({
    id: makeId(),
    companyId: state.company.id,
    calendarScope: "company",
    date: getSelectedScheduleDate(),
    source: "manual",
    time: getSelectedScheduleTime(),
    title,
    memo: "",
    location: locationInput?.value.trim() || "",
    estimatedTravelMinutes: null,
    bufferMinutes: 15,
    detailMemo: memoInput?.value.trim() || "",
    createdBy: state.member.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  state.schedules = saveSchedulesSafe(state.schedules);
  resetScheduleForm();
  setScheduleSheetOpen(false);
  showScheduleFeedback("일정이 등록되었습니다.");
  renderSchedules();
}

function lawStatusClass(item) {
  return item.status === "no_change" ? "" : "changed";
}

function getLawChangeSummary(item) {
  return safeText(
    item.change_summary || item.after_summary || item.summary,
    "변경 후 주요 내용을 확인해야 합니다."
  );
}

function getLawMajorGroup(item) {
  const text = [
    safeText(item.category, ""),
    safeText(item.law_name, ""),
    safeText(item.law_type, ""),
  ].join(" ");

  if (/건축|녹색건축|피난|방화|에너지절약|범죄예방|건축물관리|면적|높이/.test(text)) return "건축";
  if (/주택|국토|도시|공동주택|계획|이용|하수도/.test(text)) return "도시주택";
  if (/소방|안전|시설물|편의증진|장애인|노인|임산부|층간|바닥충격음/.test(text)) return "소방안전";
  if (/교통|주차장|자전거|도로|차량|자동차/.test(text)) return "교통기타";
  return "기타";
}

function groupLawItemsByMajorGroup(items, includeEmpty = false) {
  const grouped = new Map(LAW_MAJOR_GROUPS.map((name) => [name, []]));
  (items || []).forEach((item) => {
    grouped.get(getLawMajorGroup(item)).push(item);
  });

  return LAW_MAJOR_GROUPS
    .map((name) => ({
      key: name,
      label: LAW_GROUP_LABELS[name] || name,
      items: grouped.get(name) || [],
    }))
    .filter((group) => includeEmpty || group.items.length > 0);
}

function renderLawAccordionGroup(title, items, renderItem, options = {}) {
  const countLabel = options.countLabel || "건";
  const noteText = options.noteText || "";
  const openAttr = options.open ? " open" : "";
  const inner = items.map(renderItem).join("");
  const extra = noteText ? ` <span>${escapeHtml(noteText)}</span>` : "";

  return `
    <details class="law-category-group"${openAttr}>
      <summary class="law-category-title">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(`${items.length}${countLabel}`)}${extra}</span>
      </summary>
      <div class="law-category-body">
        ${inner}
      </div>
    </details>
  `;
}

function renderLawEmptyState(apiStatus, message) {
  const successLike = apiStatus === "success" || apiStatus === "no_data" || apiStatus === "partial_success";
  const statusText = successLike ? "확인 완료 0건" : "확인 필요 0건";

  return `
    <div class="law-empty law-empty-status ${successLike ? "success" : "error"}">
      ${escapeHtml(`${statusText} · ${message}`)}
    </div>
  `;
}

function renderChangedItem(item) {
  return `
    <article class="law-item law-item-changed">
      <div class="law-item-head">
        <div>
          <span class="law-name">${safeHtml(item.law_name)}</span>
          <span class="law-category">${safeHtml(item.category, "분류 없음")}</span>
        </div>
        <span class="law-status ${lawStatusClass(item)}">${safeHtml(item.status_label, "변경 있음")}</span>
      </div>

      <div class="law-meta">
        <div>
          <span>시행일</span>
          <strong>${safeHtml(item.effective_date)}</strong>
        </div>
        <div>
          <span>공포일</span>
          <strong>${safeHtml(item.promulgation_date)}</strong>
        </div>
        <div>
          <span>개정유형</span>
          <strong>${safeHtml(item.amendment_type)}</strong>
        </div>
        <div>
          <span>영향도</span>
          <strong>${safeHtml(item.impact, "확인 필요")}</strong>
        </div>
      </div>

      <div class="law-change-summary-box">
        <span>변경 요약</span>
        <p>${escapeHtml(getLawChangeSummary(item))}</p>
      </div>

      <div class="law-next-step">
        오늘 확인: 시행일, 개정유형, 영향도를 먼저 보고 업무 메모를 남기세요.
      </div>
    </article>
  `;
}

function renderChangedCategoryGroups(changedItems) {
  if (!changedItems.length) return "";

  return groupLawItemsByMajorGroup(changedItems)
    .map(({ label, items }) => renderLawAccordionGroup(label, items, renderChangedItem, { countLabel: "건" }))
    .join("");
}

function getLawSourceBasisLabel(item) {
  const sourceType = safeText(item.source_type, "").toLowerCase();
  const sourceNote = safeText(item.source_note, "");
  const summary = safeText(item.summary, "");
  const combined = `${sourceType} ${sourceNote} ${summary}`;

  if (/effective|시행/.test(combined)) return "시행일 기준";
  if (/promulg|revis|공포|개정/.test(combined)) return "공포·개정 기준";
  return "알 수 없음";
}

function getLawDateEntries(item) {
  const entries = [
    ["시행일", item.effective_date],
    ["공포일", item.promulgation_date],
    ["개정일", item.revision_date],
    ["기준일", item.source_date],
  ].filter(([, value]) => safeText(value, ""));

  const seen = new Set();
  return entries.filter(([label, value]) => {
    const key = `${label}:${safeText(value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getLawRelevanceMemo(item) {
  const text = [
    safeText(item.law_name, ""),
    safeText(item.category, ""),
    safeText(item.summary, ""),
    safeText(item.change_summary, ""),
  ].join(" ");

  const rules = [
    [/녹색건축|에너지절약/, "녹색건축 관련 검토가 필요해 보입니다."],
    [/건축|인허가|국토계획|주택/, "건축 또는 인허가 검토와 관련될 수 있습니다."],
    [/소방|피난|방화/, "소방 또는 피난 기준 검토와 관련될 수 있습니다."],
    [/하수도|수도/, "기반시설 또는 설비 검토와 관련될 수 있습니다."],
    [/안전|범죄예방|편의증진|장애인|노인|임산부/, "안전 또는 이용자 편의 검토와 관련될 수 있습니다."],
    [/주차장|자전거|교통/, "교통 또는 주차 계획 검토와 관련될 수 있습니다."],
  ];

  const match = rules.find(([pattern]) => pattern.test(text));
  return match ? match[1] : "실무 연관성은 법령명과 변경일 중심으로 한 번 더 확인해 보세요.";
}

function getLawCheckStatusLabel(item) {
  return getLawSourceBasisLabel(item) === "공포·개정 기준" ? "참고" : "확인 필요";
}

function getLawDetailUrl(item) {
  return safeText(item.detail_url || item.source_url, "");
}

function renderLawDateBadges(item) {
  const entries = getLawDateEntries(item);
  if (!entries.length) {
    return `
      <div class="law-date-row">
        <span class="law-date-chip law-date-chip-empty">정보 없음</span>
      </div>
    `;
  }

  return `
    <div class="law-date-row">
      ${entries.map(([label, value]) => `
        <span class="law-date-chip">${escapeHtml(label)} ${escapeHtml(safeText(value))}</span>
      `).join("")}
    </div>
  `;
}

function renderLawMetaGrid(item) {
  return `
    <div class="law-meta law-detail-meta">
      <div>
        <span>변경 기준</span>
        <strong>${escapeHtml(getLawSourceBasisLabel(item))}</strong>
      </div>
      <div>
        <span>확인 상태</span>
        <strong>${escapeHtml(getLawCheckStatusLabel(item))}</strong>
      </div>
    </div>
  `;
}

function renderLawRelevanceNote(item) {
  return `
    <div class="law-relevance-note">
      <span>관련성 메모</span>
      <p>${escapeHtml(getLawRelevanceMemo(item))}</p>
    </div>
  `;
}

function renderLawCardActions(item) {
  const url = getLawDetailUrl(item);
  if (!url) return "";

  return `
    <div class="law-card-actions">
      <a class="law-link-btn" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">원문 보기</a>
    </div>
  `;
}

function renderLawDetailCard(item) {
  return `
    <article class="law-item law-item-changed law-detail-card">
      <div class="law-item-head">
        <div>
          <span class="law-name">${safeHtml(item.law_name, "정보 없음")}</span>
          <span class="law-category">${safeHtml(item.category, "분류 없음")}</span>
        </div>
        <span class="law-status ${lawStatusClass(item)}">${escapeHtml(getLawCheckStatusLabel(item))}</span>
      </div>
      ${renderLawDateBadges(item)}
      ${renderLawMetaGrid(item)}
      ${renderLawRelevanceNote(item)}
      ${renderLawCardActions(item)}
    </article>
  `;
}

function getLawDateEntries(item) {
  return [
    ["시행일", item.effective_date],
    ["공포일", item.promulgation_date],
  ].filter(([, value]) => safeText(value, ""));
}

function getLawPreviewDateEntries(item) {
  return getLawDateEntries(item).slice(0, 2);
}

function getLawPrimaryContent(item) {
  const candidates = [
    item.amendment_text,
    item["변경 내용"],
    item["개정 조문"],
    item.article,
    item["개정 이유"],
    item.reason,
    item.change_summary,
    item.summary,
  ];

  const content = candidates.find((value) => safeText(value, ""));
  return safeText(content, "상세 변경 내용은 원문에서 확인");
}

function getLawSummarySourceText(item) {
  const source = getLawSummaryPayload(item);
  if (!source) return "";

  if (Array.isArray(source.value)) {
    return source.value.map((entry) => safeText(entry, "")).filter(Boolean).join("\n");
  }

  if (source.value && typeof source.value === "object") {
    const values = [
      source.value.headline,
      source.value.summary,
      source.value.text,
      source.value.content,
      Array.isArray(source.value.bullets) ? source.value.bullets.join("\n") : "",
      Array.isArray(source.value.items) ? source.value.items.join("\n") : "",
    ].filter(Boolean);
    return values.map((entry) => safeText(entry, "")).filter(Boolean).join("\n");
  }

  return safeText(source.value, "");
}

function getLawSummaryPayload(item) {
  const candidates = [
    { value: item?.ai_summary, source: "openai" },
    { value: item?.practical_summary, source: "cache" },
    { value: item?.aiSummary, source: "openai" },
    { value: item?.practicalSummary, source: "cache" },
  ];

  return candidates.find((candidate) => safeText(candidate.value, ""));
}

function normalizeLawSummaryBullet(entry, index = 0) {
  if (entry == null) return null;

  if (typeof entry === "object" && !Array.isArray(entry)) {
    const label = safeText(entry.label || entry.title || entry.headline || entry.key || "", "");
    const text = safeText(entry.text || entry.summary || entry.content || entry.value || "", "");
    if (label || text) {
      return {
        label: label || ["📝 핵심 변경", "🔁 변경 전후", "🏛️ 관련 조문", "✅ 실무 체크", "⚠️ 주의사항"][index] || "📝 핵심 변경",
        text: text || label,
      };
    }
  }

  const normalized = shortenLawSummaryText(safeText(entry, ""), 120);
  if (!normalized) return null;

  const colonMatch = normalized.match(/^(.{1,20}?)[：:]\s*(.+)$/);
  if (colonMatch) {
    return {
      label: colonMatch[1].trim(),
      text: colonMatch[2].trim(),
    };
  }

  return {
    label: ["📝 핵심 변경", "🔁 변경 전후", "🏛️ 관련 조문", "✅ 실무 체크", "⚠️ 주의사항"][index] || "📝 핵심 변경",
    text: normalized,
  };
}

function normalizeLawSummaryBullets(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => normalizeLawSummaryBullet(entry, index))
    .filter(Boolean)
    .slice(0, 4);
}

function buildLawFallbackSummaryItems(item) {
  const rawText = [
    safeText(item?.change_reason, ""),
    safeText(item?.amendment_text, ""),
    safeText(item?.change_summary, ""),
    safeText(item?.summary, ""),
    safeText(item?.article, ""),
  ].join(" ");

  const items = [];
  const nameChange = extractLawNameChange(rawText);
  if (nameChange) {
    items.push({ label: "🔁 변경 전후", text: nameChange });
  }

  const relatedText = shortenLawSummaryText(
    safeText(item?.related_articles, "") ||
      safeText(item?.article_references, "") ||
      safeText(item?.change_reason, "") ||
      safeText(item?.amendment_text, "") ||
      safeText(item?.change_summary, "") ||
      safeText(item?.summary, ""),
    96
  );
  if (relatedText) {
    items.push({ label: "🏛️ 관련 조문", text: relatedText });
  }

  const impactText = shortenLawSummaryText(
    safeText(item?.impact, "") ||
      safeText(item?.ministry, "") ||
      safeText(item?.category, ""),
    72
  );
  if (impactText) {
    items.push({ label: "✅ 실무 체크", text: impactText });
  }

  const cautionText = shortenLawSummaryText(
    safeText(item?.source_note, "") ||
      safeText(item?.source_type, "") ||
      safeText(item?.status_label, ""),
    72
  );
  if (cautionText) {
    items.push({ label: "⚠️ 주의사항", text: cautionText });
  }

  if (!items.length) {
    items.push({ label: "📝 핵심 변경", text: "요약 준비 중" });
  }

  return items.slice(0, 4);
}

function getLawSummaryDisplay(item) {
  const payload = getLawSummaryPayload(item);
  const fallbackItems = buildLawFallbackSummaryItems(item);

  if (!payload) {
    return {
      headline: "요약 준비 중",
      bullets: fallbackItems,
      confidence: "low",
      source: "fallback",
    };
  }

  const value = payload.value;
  let headline = "";
  let bullets = [];
  let confidence = "medium";
  let source = payload.source;

  if (value && typeof value === "object" && !Array.isArray(value)) {
    headline = shortenLawSummaryText(
      safeText(value.headline || value.title || value.summary || value.text || value.content || "", ""),
      84
    );
    bullets = normalizeLawSummaryBullets(
      Array.isArray(value.bullets)
        ? value.bullets
        : Array.isArray(value.items)
          ? value.items
          : []
    );
    confidence = safeText(value.confidence || "", "").toLowerCase() || (source === "openai" ? "high" : "medium");
    source = safeText(value.source || "", "") || source;
  } else if (Array.isArray(value)) {
    bullets = normalizeLawSummaryBullets(value);
  } else {
    const lines = splitLawSummaryText(safeText(value, ""));
    headline = shortenLawSummaryText(lines.shift() || "", 84);
    bullets = normalizeLawSummaryBullets(lines);
  }

  if (!headline) {
    headline = shortenLawSummaryText(bullets[0]?.text || "", 84) || "핵심 변경 확인";
  }

  if (bullets.length < 2) {
    const extraItems = fallbackItems.filter((itemEntry) => !bullets.some((entry) => entry.label === itemEntry.label));
    bullets = bullets.concat(extraItems);
  }

  if (!bullets.length) {
    bullets = fallbackItems;
  }

  return {
    headline,
    bullets: bullets.slice(0, 4),
    confidence,
    source,
  };
}

function splitLawSummaryText(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n");
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*•·▪]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) return lines.slice(0, 5);

  return normalized
    .split(/(?<=[.!?。])\s+|[;；]\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function shortenLawSummaryText(text, limit = 80) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s*([.;!?。])\s*/g, "$1 ")
    .trim();

  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

function extractLawNameChange(text) {
  const value = String(text || "");
  const patterns = [
    /["“‘]([^"“”'‘’]{3,}?)["”’]\s*(?:를|을)?\s*각각\s*["“‘]([^"“”'‘’]{3,}?)["”’]\s*로\s*한다/,
    /["“‘]([^"“”'‘’]{3,}?)["”’]\s*중\s*["“‘]([^"“”'‘’]{3,}?)["”’]\s*(?:를|을)?\s*["“‘]([^"“”'‘’]{3,}?)["”’]\s*로\s*한다/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;

    const from = match[1]?.trim();
    const to = match[2]?.trim() || match[3]?.trim();
    if (from && to && from !== to) return `${from} → ${to}`;
  }

  const quotes = Array.from(value.matchAll(/["“‘]([^"“”'‘’]{4,}?)["”’]/g))
    .map((match) => match[1].trim())
    .filter((segment) => segment && !/^(일부개정|개정이유 및 주요내용|본문 생략|생략)$/.test(segment));

  if (quotes.length < 2) return "";

  return `${quotes[0]} → ${quotes.find((segment) => segment !== quotes[0]) || quotes[1]}`;
}

function renderLawAiSummaryBlock(item) {
  const summary = getLawSummaryDisplay(item);

  return `
    <section class="law-ai-summary-box law-summary-panel-inner">
      <span class="law-ai-summary-label">📝 핵심 변경</span>
      <p class="law-ai-summary-headline">${escapeHtml(summary.headline)}</p>
      <div class="law-ai-summary-stack">
        ${summary.bullets.map((entry) => `
          <div class="law-ai-summary-item">
            <div class="law-ai-summary-item-label">${escapeHtml(entry.label)}</div>
            <p class="law-ai-summary-item-text">${escapeHtml(entry.text)}</p>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLawOriginalPanel(item, index) {
  const originalText = safeText(
    item?.amendment_text ||
      item?.["변경 내용"] ||
      item?.["개정 조문"] ||
      item?.article ||
      item?.change_summary ||
      item?.summary ||
      "",
    ""
  );

  if (!originalText) return "";

  return `
    <section class="law-change-summary-box law-original-panel-inner">
      <span class="law-change-summary-title">원문</span>
      <p class="law-original-text">${escapeHtml(originalText)}</p>
    </section>
  `;
}

function getLawDetailUrl(item) {
  return safeText(item.article_url || item.detail_url || item.source_url, "");
}

function renderLawPreviewDates(item) {
  const entries = getLawPreviewDateEntries(item);
  if (!entries.length) return `<span class="law-date-chip law-date-chip-empty">날짜 정보 없음</span>`;

  return entries.map(([label, value]) => `
    <span class="law-date-chip">${escapeHtml(label)} ${escapeHtml(safeText(value))}</span>
  `).join("");
}

function renderLawExpandedDates(item) {
  const entries = getLawDateEntries(item);
  if (!entries.length) return "";

  return `
    <div class="law-date-row law-date-row-detail">
      ${entries.map(([label, value]) => `
        <span class="law-date-chip">${escapeHtml(label)} ${escapeHtml(safeText(value))}</span>
      `).join("")}
    </div>
  `;
}

function renderLawCardActions(item) {
  const url = getLawDetailUrl(item);
  if (!url) return "";

  return `
    <div class="law-card-actions">
      <a class="law-link-btn" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">원문 보기</a>
    </div>
  `;
}

function renderLawDetailCard(item, index = 0) {
  const contentId = `law-detail-content-${index}`;
  const category = safeText(item.category, "");

  return `
    <details class="law-item law-item-changed law-detail-card">
      <summary class="law-detail-summary" aria-controls="${escapeHtml(contentId)}">
        <div class="law-detail-summary-main">
          <span class="law-name">${safeHtml(item.law_name, "정보 없음")}</span>
          ${category ? `<span class="law-category">${escapeHtml(category)}</span>` : ""}
          ${renderLawAiSummaryBlock(item)}
        </div>
        <span class="law-toggle-indicator" aria-hidden="true">열기</span>
      </summary>
      <div id="${escapeHtml(contentId)}" class="law-detail-body">
        ${renderLawPrimaryContent(item, index)}
        ${renderLawExpandedDates(item)}
        ${renderLawCardActions(item)}
      </div>
    </details>
  `;
}

function getLawDateEntries(item) {
  return [
    ["시행일", item.effective_date],
    ["공포일", item.promulgation_date],
  ].filter(([, value]) => safeText(value, ""));
}

function getLawPreviewDateEntries(item) {
  return getLawDateEntries(item).slice(0, 2);
}

function formatLawDateCompact(value) {
  const raw = safeText(value, "");
  const matched = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return raw;
  return `${matched[1].slice(2)}.${matched[2]}.${matched[3]}`;
}

function getLawDateLabelShort(label) {
  if (label === "시행일") return "시행";
  if (label === "공포일") return "공포";
  return label;
}

function getLawDateToneClass(item, label) {
  const effectiveDate = safeText(item.effective_date, "");
  const promulgationDate = safeText(item.promulgation_date, "");

  if (effectiveDate && promulgationDate && effectiveDate === promulgationDate) return "law-date-chip-shared";
  if (label === "시행일") return "law-date-chip-effective";
  if (label === "공포일") return "law-date-chip-promulgation";
  return "";
}

function getLawPrimaryContent(item) {
  const candidates = [
    item.change_summary,
    item.summary,
    item.amendment_text,
    item.amendment,
    item.reason,
    item.change_reason,
    item.article,
    item.article_text,
    item.content,
    item.law_content,
    item.detail,
    item.description,
  ];

  const content = candidates.find((value) => safeText(value, ""));
  return safeText(content, "수집 데이터에 구체 변경 내용이 없습니다. 원문에서 세부 조항을 확인하세요.");
}

function getLawDetailUrl(item) {
  return safeText(item.article_url || item.detail_url || item.source_url, "");
}

function renderLawPreviewDates(item) {
  const entries = getLawPreviewDateEntries(item);
  if (!entries.length) {
    return `<span class="law-date-chip law-date-chip-empty">날짜 정보 없음</span>`;
  }

  const chips = entries.map(([label, value]) => `
    <span class="law-date-chip ${getLawDateToneClass(item, label)}">${escapeHtml(getLawDateLabelShort(label))} ${escapeHtml(formatLawDateCompact(value))}</span>
  `);

  return chips.join("");
}

function shouldShowLawContentMore(text) {
  return safeText(text, "").length > 140;
}

function renderLawCardActions(item, index) {
  return `
    <div class="law-card-actions law-card-toggle-actions">
      <button type="button" class="law-section-btn" data-law-panel-target="${escapeHtml(`law-summary-panel-${index}`)}" aria-expanded="false">핵심변경</button>
      <button type="button" class="law-section-btn" data-law-panel-target="${escapeHtml(`law-original-panel-${index}`)}" aria-expanded="false">원문 보기</button>
    </div>
  `;
}

function getLawKeywordText(item) {
  return safeText(item.category || item.law_type || item.ministry || "", "");
}

function renderLawSummaryPanel(item, index) {
  return `
    <section id="${escapeHtml(`law-summary-panel-${index}`)}" class="law-card-panel law-summary-panel" hidden>
      ${renderLawAiSummaryBlock(item)}
    </section>
  `;
}

function renderLawOriginalSection(item, index) {
  const originalText = safeText(
    item?.amendment_text ||
      item?.["변경 내용"] ||
      item?.["개정 조문"] ||
      item?.article ||
      item?.change_summary ||
      item?.summary ||
      "",
    ""
  );

  if (!originalText) return "";

  return `
    <section id="${escapeHtml(`law-original-panel-${index}`)}" class="law-card-panel law-original-panel" hidden>
      <div class="law-change-summary-box law-original-panel-inner">
        <span class="law-change-summary-title">원문</span>
        <p class="law-original-text">${escapeHtml(originalText)}</p>
      </div>
    </section>
  `;
}

function renderLawDetailCard(item, index = 0) {
  const keyword = getLawKeywordText(item);

  return `
    <details class="law-item law-item-changed law-detail-card">
      <summary class="law-detail-summary" aria-controls="${escapeHtml(`law-card-body-${index}`)}">
        <div class="law-detail-summary-main">
          <span class="law-name">${safeHtml(item.law_name, "정보 없음")}</span>
          ${keyword ? `<span class="law-keyword-chip">키워드 ${escapeHtml(keyword)}</span>` : ""}
          <div class="law-date-row law-date-row-preview">
            ${renderLawPreviewDates(item)}
          </div>
        </div>
        <span class="law-toggle-indicator" aria-hidden="true">열기</span>
      </summary>
      <div id="${escapeHtml(`law-card-body-${index}`)}" class="law-detail-body">
        ${renderLawCardActions(item, index)}
        ${renderLawSummaryPanel(item, index)}
        ${renderLawOriginalSection(item, index)}
      </div>
    </details>
  `;
}

const LAW_CHANGE_FALLBACK_TEXT = "수집 데이터에 구체 변경 내용이 없습니다. 원문에서 세부 조항을 확인하세요.";

function getLawChangedArticles(item) {
  return Array.isArray(item?.changed_articles)
    ? item.changed_articles.filter((article) =>
        article && typeof article === "object" && (
          safeText(article.article_number, "") ||
          safeText(article.article_title, "") ||
          safeText(article.article_content, "")
        )
      )
    : [];
}

function getLawPrimaryContent(item) {
  const changedArticles = getLawChangedArticles(item);
  if (changedArticles.length) {
    return {
      type: "articles",
      label: "변경 조문",
      articles: changedArticles,
    };
  }

  const sources = [
    ["개정문", item.amendment_text],
    ["제개정 이유", item.change_reason],
    ["조문 내용", item.article_text],
    ["변경 내용", item.change_summary],
    ["요약", item.summary],
  ];

  const found = sources.find(([, value]) => safeText(value, ""));
  if (!found) {
    return {
      type: "text",
      label: "변경 내용",
      text: LAW_CHANGE_FALLBACK_TEXT,
      isFallback: true,
    };
  }

  return {
    type: "text",
    label: found[0],
    text: safeText(found[1], LAW_CHANGE_FALLBACK_TEXT),
    isFallback: false,
  };
}

function shouldShowLawContentMore(text) {
  return safeText(text, "").length > 160;
}

function formatLawArticleHeading(article) {
  const articleNumber = safeText(article.article_number, "");
  const articleTitle = safeText(article.article_title, "");
  return [articleNumber, articleTitle].filter(Boolean).join(" ");
}

function renderLawArticleMeta(article) {
  const rows = [
    ["변경유형", safeText(article.article_revision_type, "")],
    ["조문시행일", safeText(article.article_effective_date, "")],
  ].filter(([, value]) => value);

  if (!rows.length) return "";

  return `
    <div class="law-article-meta">
      ${rows.map(([label, value]) => `
        <span class="law-article-meta-chip">${escapeHtml(label)}: ${escapeHtml(value)}</span>
      `).join("")}
    </div>
  `;
}

function renderLawExpandableTextBlock(label, text, targetId, options = {}) {
  const contentText = safeText(text, LAW_CHANGE_FALLBACK_TEXT);
  const showMore = shouldShowLawContentMore(contentText);
  const contentClass = showMore ? "law-change-summary-text is-collapsed" : "law-change-summary-text";
  const moreButton = showMore
    ? `<button type="button" class="law-more-btn" data-target="${escapeHtml(targetId)}" aria-expanded="false">더보기</button>`
    : "";
  const boxClass = options.boxClass ? `law-change-summary-box ${options.boxClass}` : "law-change-summary-box";
  const extraClass = options.extraClass ? ` ${options.extraClass}` : "";

  return `
    <div class="${boxClass}${extraClass}">
      <span>${escapeHtml(label)}</span>
      <p class="${contentClass}">${escapeHtml(contentText)}</p>
      ${moreButton}
    </div>
  `;
}

function renderLawChangedArticle(article, cardIndex, articleIndex) {
  const heading = formatLawArticleHeading(article) || `변경 조문 ${articleIndex + 1}`;
  const content = safeText(article.article_content, LAW_CHANGE_FALLBACK_TEXT);

  return `
    <article class="law-article-item">
      <strong class="law-article-title">${escapeHtml(heading)}</strong>
      ${renderLawArticleMeta(article)}
      ${renderLawExpandableTextBlock("조문내용", content, `law-article-content-${cardIndex}-${articleIndex}`, {
        boxClass: "law-article-content-box",
      })}
    </article>
  `;
}

function renderLawPrimaryContent(item, index) {
  const primaryContent = getLawPrimaryContent(item);
  if (primaryContent.type === "articles") {
    return `
      <div id="${escapeHtml(`law-detail-content-${index}`)}" class="law-detail-content-wrap">
        <div class="law-change-summary-box law-change-summary-box-articles">
          <span>${escapeHtml(primaryContent.label)}</span>
          <div class="law-article-list">
            ${primaryContent.articles.map((article, articleIndex) => renderLawChangedArticle(article, index, articleIndex)).join("")}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div id="${escapeHtml(`law-detail-content-${index}`)}" class="law-detail-content-wrap">
      ${renderLawExpandableTextBlock(
        primaryContent.label,
        primaryContent.text,
        `law-detail-content-${index}`,
        {
          extraClass: primaryContent.isFallback ? "law-change-summary-box-fallback" : "",
        }
      )}
    </div>
  `;
}

function renderLawDetailCard(item, index = 0) {
  const category = safeText(item.category, "");

  return `
    <details class="law-item law-item-changed law-detail-card" open>
      <summary class="law-detail-summary" aria-controls="${escapeHtml(`law-detail-body-${index}`)}">
        <div class="law-detail-summary-main">
          <span class="law-name">${safeHtml(item.law_name, "정보 없음")}</span>
          ${category ? `<span class="law-category">${escapeHtml(category)}</span>` : ""}
          <div class="law-date-row law-date-row-preview">
            ${renderLawPreviewDates(item)}
          </div>
        </div>
        <span class="law-toggle-indicator" aria-hidden="true">열기</span>
      </summary>
      <div id="${escapeHtml(`law-detail-body-${index}`)}" class="law-detail-body">
        ${renderLawAiSummaryBlock(item)}
        ${renderLawOriginalFold(item, index)}
        ${renderLawCardActions(item)}
      </div>
    </details>
  `;
}

function renderLawDetailCard(item, index = 0) {
  const keyword = getLawKeywordText(item);

  return `
    <details class="law-item law-item-changed law-detail-card">
      <summary class="law-detail-summary" aria-controls="${escapeHtml(`law-card-body-${index}`)}">
        <div class="law-detail-summary-main">
          <span class="law-name">${safeHtml(item.law_name, "정보 없음")}</span>
          ${keyword ? `<span class="law-keyword-chip">키워드 ${escapeHtml(keyword)}</span>` : ""}
          <div class="law-date-row law-date-row-preview">
            ${renderLawPreviewDates(item)}
          </div>
        </div>
        <span class="law-toggle-indicator" aria-hidden="true">열기</span>
      </summary>
      <div id="${escapeHtml(`law-card-body-${index}`)}" class="law-detail-body">
        ${renderLawCardActions(item, index)}
        ${renderLawSummaryPanel(item, index)}
        ${renderLawOriginalSection(item, index)}
      </div>
    </details>
  `;
}

function renderLawList(containerId, items, emptyMessage, options = {}) {
  const container = $(containerId);
  if (!container) return;

  const apiStatus = options.apiStatus || "";
  const changedItems = Array.isArray(items)
    ? items.filter((item) => item.status !== "no_change")
    : [];

  if (!changedItems.length) {
    container.innerHTML = renderLawEmptyState(apiStatus, emptyMessage);
    return;
  }

  container.innerHTML = changedItems.map((item, index) => renderLawDetailCard(item, index)).join("");
}

function parseLawDateValue(value) {
  const text = safeText(value, "");
  if (!text) return null;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function filterItemsByDateRange(items, start, end) {
  return (items || []).filter((item) => {
    const source = item?.source_date || item?.effective_date || item?.promulgation_date || "";
    const date = parseLawDateValue(source);
    return date && date >= start && date <= end;
  });
}

function formatLawUpdatedAt(value) {
  const date = parseLawDateValue(value);
  if (!date) return safeText(value);

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeLawUpdatesData(rawData) {
  if (Array.isArray(rawData)) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 6);

    return {
      metadata: {},
      watchedItems: [],
      todayItemsRaw: filterItemsByDateRange(rawData, today, endOfToday),
      weekItemsRaw: filterItemsByDateRange(rawData, startOfWeek, endOfToday),
      monthItemsRaw: rawData,
      apiStatus: "",
      basis: LAW_MESSAGES.defaultBasis,
      notice: "",
      error: "",
      totalCheckedLaws: 0,
      failedLaws: 0,
      partialFailedLaws: 0,
      checkedAt: "",
      updatedAt: "",
    };
  }

  const data = rawData && typeof rawData === "object" ? rawData : {};
  const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
  const watchedItems = Array.isArray(data.tracked_laws) ? data.tracked_laws : [];
  const allItems = Array.isArray(data.items) ? data.items : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - 6);

  return {
    metadata,
    watchedItems,
    todayItemsRaw: data.today_items ?? data.today ?? filterItemsByDateRange(allItems, today, endOfToday),
    weekItemsRaw: data.last_7_days_items ?? data.last_7_days ?? filterItemsByDateRange(allItems, startOfWeek, endOfToday),
    monthItemsRaw: data.last_30_days_items ?? data.last_30_days ?? allItems,
    apiStatus: data.api_status || "",
    basis: data.basis || LAW_MESSAGES.defaultBasis,
    notice: data.notice || data.scope || LAW_MESSAGES.defaultNotice,
    error: data.error || "",
    totalCheckedLaws: Number(data.total_checked_laws) || Number(metadata.watchedLawCount) || watchedItems.length,
    failedLaws: Array.isArray(data.failed_laws) ? data.failed_laws.length : 0,
    partialFailedLaws: Array.isArray(data.partial_failed_laws) ? data.partial_failed_laws.length : 0,
    checkedAt: data.checked_at || "",
    updatedAt: data.updated_at || data.synced_at || metadata.lastUpdated || "",
  };
}

function normalizeLawName(value) {
  return safeText(value, "")
    .replace(/\s+/g, "")
    .replace(/[()·ㆍ,]/g, "")
    .trim();
}

function buildWatchedNameSet(items) {
  return new Set(
    (items || [])
      .map((item) => normalizeLawName(item?.law_name || item?.name))
      .filter(Boolean)
  );
}

function filterWatchedItems(items, watchedSet) {
  if (!Array.isArray(items) || watchedSet.size === 0) return [];
  return items.filter((item) => watchedSet.has(normalizeLawName(item?.law_name)));
}

function renderTrackedLaws(items) {
  const totalCount = Array.isArray(items) ? items.length : 0;
  setText("trackedLawCount", `전체 ${totalCount}건`);
}

function updateLawAction(todayCount, weekCount, monthCount, apiStatus, apiError) {
  if (todayCount > 0) {
    setText("lawActionTitle", "오늘 즉시 확인");
    setText("lawActionText", `오늘 시행 변경 ${todayCount}건이 있습니다. 법령명, 시행일, 변경 후 요약을 먼저 확인하세요.`);
    return;
  }

  if (weekCount > 0) {
    setText("lawActionTitle", "최근 변경 재확인");
    setText("lawActionText", `오늘 신규 변경은 없지만 최근 7일 내 변경 ${weekCount}건이 있습니다. 진행 중인 인허가와 관련 여부를 확인하세요.`);
    return;
  }

  if (apiStatus && apiStatus !== "success") {
    const suffix = apiError ? ` (${apiError})` : "";
    setText("lawActionTitle", "조회 상태 확인");
    setText("lawActionText", `오늘 변경 0건처럼 보여도 일부 확인 상태가 ${apiStatus}입니다. 최신성부터 다시 확인하세요.${suffix}`);
    return;
  }

  setText("lawActionTitle", "정기 확인 완료");
  setText("lawActionText", `오늘 신규 변경이 없습니다. 감시 법령 ${monthCount > 0 ? "최근 30일 변경 이력" : "목록"}을 훑고 필요한 메모만 남기세요.`);
}

function getFilteredLawLists(data) {
  const watchedSet = buildWatchedNameSet(data.watchedItems);
  const filterByWatched = (items) => (watchedSet.size ? filterWatchedItems(items, watchedSet) : items);

  return {
    todayItems: filterByWatched(data.todayItemsRaw),
    weekItems: filterByWatched(data.weekItemsRaw),
    monthItems: filterByWatched(data.monthItemsRaw),
  };
}

function updateLawSummaryCounts(todayCount, weekCount, monthCount) {
  setText("lawTodayCount", `${todayCount}건`);
  setText("lawWeekCount", `${weekCount}건`);
  setText("lawMonthCount", `${monthCount}건`);
}

function renderLawHeader(data, monthCount) {
  const apiStatusLabel = LAW_API_STATUS_LABELS[data.apiStatus] || "";
  const basisText = data.apiStatus && data.apiStatus !== "success"
    ? `${data.basis} · ${apiStatusLabel || data.apiStatus}`
    : data.basis;

  const errorSuffix = data.error ? ` (${data.error})` : "";
  const diagnosticText = `관심 법령 ${data.totalCheckedLaws}건 확인 · 부분 실패 ${data.partialFailedLaws}건 · 실패 ${data.failedLaws}건`;
  const updatedAt = data.metadata.lastUpdated || data.updatedAt || "";
  const savedCount = Number(data.metadata.totalSavedCount) || monthCount;

  setText("lawBasisChip", basisText);
  setText("lawNotice", `${data.notice}${data.apiStatus && data.apiStatus !== "success" ? errorSuffix : ""} · ${diagnosticText}`);
  setText("lawCheckedAt", `확인일: ${safeText(data.checkedAt)}${data.updatedAt ? ` · 갱신: ${safeText(data.updatedAt)}` : ""}`);
  setText("lawMetaSummary", `법령 데이터 마지막 갱신 ${formatLawUpdatedAt(updatedAt)} · 총 저장 ${savedCount}건`);
  setText("trackedLawUpdatedAt", `법령 데이터 마지막 갱신 ${formatLawUpdatedAt(updatedAt)}`);
}

function renderLawSections(data, todayItems, weekItems, monthItems) {
  renderLawList("lawTodayList", todayItems, LAW_MESSAGES.emptyToday, { apiStatus: data.apiStatus });
  renderLawList("lawWeekList", weekItems, LAW_MESSAGES.emptyWeek, { apiStatus: data.apiStatus });
  renderLawList("lawMonthList", monthItems, LAW_MESSAGES.emptyMonth, { apiStatus: data.apiStatus });
}

function renderLawLoadFailure() {
  setText("lawNotice", LAW_MESSAGES.loadFailed);
  setText("lawCheckedAt", "확인일: -");
  setText("lawMetaSummary", "법령 데이터 마지막 갱신 - · 총 저장 0건");
  setText("trackedLawUpdatedAt", "법령 데이터 마지막 갱신 -");
  setText("lawActionTitle", "확인 필요");
  setText("lawActionText", "자동 브리프를 표시하지 못했습니다. 오늘 업무 전 수동으로 주요 법령 변경 여부를 확인하세요.");

  renderLawList("lawTodayList", [], LAW_MESSAGES.loadFailedDetail, { apiStatus: "api_error" });
  renderLawList("lawWeekList", [], LAW_MESSAGES.loadFailedDetail, { apiStatus: "api_error" });
  renderLawList("lawMonthList", [], LAW_MESSAGES.loadFailedDetail, { apiStatus: "api_error" });
  renderTrackedLaws([]);
}

async function loadLawUpdates() {
  try {
    const res = await fetch("./data/law_updates.json", { cache: "no-store" });
    if (!res.ok) throw new Error("law_updates.json 로딩 실패");

    const data = normalizeLawUpdatesData(await res.json());
    const { todayItems, weekItems, monthItems } = getFilteredLawLists(data);
    const todayCount = todayItems.length;
    const weekCount = weekItems.length;
    const monthCount = monthItems.length;

    renderLawHeader(data, monthCount);
    updateLawSummaryCounts(todayCount, weekCount, monthCount);
    updateLawAction(todayCount, weekCount, monthCount, data.apiStatus, data.error || "");
    renderTrackedLaws(data.watchedItems);
    renderLawSections(data, todayItems, weekItems, monthItems);
  } catch {
    renderLawLoadFailure();
  }
}

function getLawSummaryStatus(todayCount, weekCount, monthCount) {
  if (todayCount > 0) return `오늘 신규 변경 ${todayCount}건`;
  if (weekCount > 0 || monthCount > 0) return "오늘 신규 변경 없음";
  return "최근 변경 없음";
}

function renderLawSummaryCard(data, todayCount, weekCount, monthCount) {
  const updatedAt = data.metadata.lastUpdated || data.updatedAt || "";
  const apiStatusLabel = LAW_API_STATUS_LABELS[data.apiStatus] || data.apiStatus || "";
  const extra = data.apiStatus && data.apiStatus !== "success" ? ` · ${apiStatusLabel}` : "";

  setText("lawBasisChip", todayCount > 0 ? "변경 있음" : "법령 브리프");
  setText("lawMetaSummary", updatedAt ? `법령 데이터 마지막 갱신 ${formatLawUpdatedAt(updatedAt)}` : "법령 데이터 마지막 갱신 -");
  setText("lawNotice", `${getLawSummaryStatus(todayCount, weekCount, monthCount)}${extra}`);
  setText("lawCheckedAt", "");
  updateLawSummaryCounts(todayCount, weekCount, monthCount);
}

function renderLawLoadFailure() {
  setText("lawBasisChip", "법령 브리프");
  setText("lawMetaSummary", "법령 데이터 마지막 갱신 -");
  setText("lawNotice", LAW_MESSAGES.loadFailed);
  setText("lawCheckedAt", "");
  updateLawSummaryCounts(0, 0, 0);
  renderLawList("lawTodayList", [], LAW_MESSAGES.loadFailedDetail, { apiStatus: "api_error" });
  renderLawList("lawWeekList", [], LAW_MESSAGES.loadFailedDetail, { apiStatus: "api_error" });
  renderLawList("lawMonthList", [], LAW_MESSAGES.loadFailedDetail, { apiStatus: "api_error" });
}

async function loadLawUpdates() {
  try {
    const res = await fetch("./data/law_updates.json", { cache: "no-store" });
    if (!res.ok) throw new Error("law_updates.json 로딩 실패");

    const data = normalizeLawUpdatesData(await res.json());
    const { todayItems, weekItems, monthItems } = getFilteredLawLists(data);
    const todayCount = todayItems.length;
    const weekCount = weekItems.length;
    const monthCount = monthItems.length;

    renderLawSummaryCard(data, todayCount, weekCount, monthCount);
    renderLawSections(data, todayItems, weekItems, monthItems);
  } catch {
    renderLawLoadFailure();
  }
}

function activateLawTab(tab) {
  const buttons = $$(".law-tab-btn");
  const activeButton = buttons.find((button) => button.dataset.lawTab === tab);
  if (!activeButton) return;

  activateButtonGroup(buttons, activeButton);
  $$(".law-panel").forEach((panel) => panel.classList.remove("active"));
  $(LAW_TAB_PANELS[tab])?.classList.add("active");
}

function setupLawTabs() {
  const buttons = $$(".law-tab-btn");
  buttons.forEach((button) => {
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(button.classList.contains("active")));
    bindEvent(button, "click", () => activateLawTab(button.dataset.lawTab));
  });
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    if (registration.update) {
      await registration.update();
    }
  } catch (error) {
    console.log("Service worker skipped", error);
  }
}

async function requestNotification() {
  if (!("Notification" in window)) {
    alert("이 브라우저는 알림을 지원하지 않습니다.");
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    alert("알림 권한이 허용되었습니다.");
    return true;
  }

  alert("알림 권한이 허용되지 않았습니다.");
  return false;
}

function showNotificationToast(message) {
  const toast = $("notificationToast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showNotificationToast.timerId);
  showNotificationToast.timerId = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function triggerNotificationHaptic() {
  try {
    if (navigator.vibrate) navigator.vibrate(40);
  } catch {}
}

function toggleLawContentExpansion(targetId, button) {
  const container = document.getElementById(targetId);
  if (!container || !button) return;

  const text = container.querySelector(".law-change-summary-text");
  if (text) {
    const collapsed = text.classList.toggle("is-collapsed");
    button.setAttribute("aria-expanded", String(!collapsed));
    button.textContent = collapsed
      ? button.dataset.collapsedLabel || "더보기"
      : button.dataset.expandedLabel || "접기";
    return;
  }

  const willOpen = container.hasAttribute("hidden");
  container.hidden = !willOpen ? true : false;
  if (willOpen) {
    container.removeAttribute("hidden");
  } else {
    container.setAttribute("hidden", "");
  }
  button.setAttribute("aria-expanded", String(willOpen));
  button.classList.toggle("is-active", willOpen);
}

function setupBottomNav() {
  const buttons = $$(".bottom-nav-btn");
  buttons.forEach((button) => {
    bindEvent(button, "click", () => {
      const target = document.getElementById(button.dataset.target);
      if (!target) return;

      buttons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindWeatherEvents() {
  bindEvent($("refreshWeatherBtn"), "click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    loadWeather().catch(handleWeatherLoadError);
  });

  bindEvent($("weatherToggleBtn"), "click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    state.weatherMode = state.weatherMode === "today" ? "tomorrow" : "today";
    const dayIndex = state.weatherMode === "today" ? 0 : 1;
    
    const btn = $("weatherToggleBtn");
    if (btn) {
      btn.textContent = state.weatherMode === "today" ? "내일날씨" : "오늘날씨";
      btn.setAttribute("data-active", String(state.weatherMode === "tomorrow"));
    }
    
    renderWeather(dayIndex);
    renderDailyGuide(dayIndex);
  });
}

function bindScheduleEvents() {
  bindEvent($("toggleScheduleInviteBtn"), "click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleScheduleInvitePanel();
  });
  bindEvent($("joinCompanyRoomBtn"), "click", joinCompanyRoom);
  bindEvent($("inviteCodeInput"), "keydown", (event) => {
    if (event.key === "Enter") joinCompanyRoom();
  });
  bindEvent($("openScheduleSheetBtn"), "click", () => {
    showScheduleFeedback("");
    setScheduleSheetOpen(true);
  });
  bindEvent($("closeScheduleSheetBtn"), "click", () => {
    resetScheduleForm();
    setScheduleSheetOpen(false);
  });
  bindEvent($("cancelScheduleBtn"), "click", () => {
    resetScheduleForm();
    setScheduleSheetOpen(false);
  });
  bindEvent($("confirmScheduleBtn"), "click", addSchedule);
  bindEvent($("scheduleTitleInput"), "keydown", (event) => {
    if (event.key === "Enter") addSchedule();
  });
  bindEvent($("scheduleSheet"), "click", (event) => {
    if (event.target === $("scheduleSheet")) {
      resetScheduleForm();
      setScheduleSheetOpen(false);
    }
  });
  bindEvent(document, "keydown", (event) => {
    if (event.key === "Escape" && !$("scheduleSheet")?.hidden) {
      resetScheduleForm();
      setScheduleSheetOpen(false);
    }
  });
  bindEvent($("scheduleDateInput"), "change", () => {
    const selected = getSelectedScheduleDate();
    state.scheduleCalendarMonth = `${selected.slice(0, 7)}-01`;
    renderSchedules();
  });
  bindEvent($("schedulePrevMonthBtn"), "click", () => moveScheduleCalendarMonth(-1));
  bindEvent($("scheduleNextMonthBtn"), "click", () => moveScheduleCalendarMonth(1));
}

function bindNotificationEvents() {
  bindEvent($("notifyBtn"), "click", requestNotification);
  bindEvent($("notificationTimeSaveBtn"), "click", () => {
    saveNotificationTime($("notificationTimeInput")?.value || DEFAULT_NOTIFICATION_TIME);
  });
  bindEvent(document, "click", (event) => {
    const button = event.target.closest(".law-more-btn, .law-section-btn");
    if (!button) return;
    toggleLawContentExpansion(button.dataset.lawPanelTarget || button.dataset.target, button);
  });
  document.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("law-detail-card")) return;

    details.classList.toggle("card-expanded", details.open);

    const indicator = details.querySelector(".law-toggle-indicator");
    if (indicator) {
      indicator.textContent = details.open ? "닫기" : "열기";
    }

    if (details.open) return;

    details.querySelectorAll(".law-card-panel").forEach((panel) => {
      panel.hidden = true;
    });

    details.querySelectorAll(".law-section-btn").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
      button.classList.remove("is-active");
    });
  }, true);
}

function bindEvents() {
  bindWeatherEvents();
  bindScheduleEvents();
  bindNotificationEvents();
  bindAdminStatusReveal();
}

function bindAdminStatusReveal() {
  const triggerTargets = [
    document.querySelector(".eyebrow"),
    document.querySelector("[data-app-title]"),
  ].filter(Boolean);
  const button = $("adminStatusBtn");
  if (!triggerTargets.length || !button) return;

  let tapCount = 0;
  let firstTapAt = 0;

  const handleTap = () => {
    const now = Date.now();
    if (!firstTapAt || now - firstTapAt > 2500) {
      firstTapAt = now;
      tapCount = 0;
    }

    tapCount += 1;
    if (tapCount >= 7) {
      button.hidden = false;
      tapCount = 0;
      firstTapAt = 0;
    }
  };

  triggerTargets.forEach((target) => bindEvent(target, "click", handleTap));
  bindEvent(button, "click", () => {
    window.location.href = "./admin-status.html";
  });
}

function renderNotificationTime() {
  const time = normalizeNotificationTime(state.notificationTime);
  const input = $("notificationTimeInput");

  if (input) input.value = time;
  setText("notificationTimeSummary", `매일 ${time} 알림 예정`);
  setText("notificationTimePill", time);
  setText("notificationTimeCurrent", `현재 저장된 알림 예정 시간: 매일 ${time}`);
}

function saveNotificationTime(value) {
  const normalized = normalizeNotificationTime(value);
  state.notificationTime = normalized;
  localStorage.setItem(STORAGE_KEYS.notificationTime, normalized);
  renderNotificationTime();
  triggerNotificationHaptic();
  showNotificationToast("알림 시간이 저장되었습니다");
}

function loadNotificationSettings() {
  const saved = localStorage.getItem(STORAGE_KEYS.notificationTime);
  state.notificationTime = normalizeNotificationTime(saved);
  renderNotificationTime();
}

function formatTemperature(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${numeric}℃`;
}

function renderWeather(dayIndex = 0) {
  const snapshot = getWeatherSnapshot(dayIndex);
  if (!snapshot) {
    if (dayIndex === 1) {
      setText("weatherDesc", "내일 날씨 정보를 아직 불러오지 못했습니다.");
    }
    return;
  }

  const section = $("weatherSection");
  const label = dayIndex === 0 ? "오늘날씨" : "내일날씨";
  const weatherSummary = section?.querySelector(".weather-summary");

  if (weatherSummary) {
    const heading = weatherSummary.querySelector("h3");
    if (heading) heading.textContent = label;
  }

  const [title, desc] = weatherText(snapshot.weatherCode);
  const rainSignal = dayIndex === 0 ? buildRainSignalSummary(state.weather) : null;

  setText("locationName", state.city);
  setText("currentTemp", formatTemperature(snapshot.temp));
  setText("weatherDesc", `${title} · ${desc}`);
  setText("highLow", `${formatTemperature(snapshot.high)} / ${formatTemperature(snapshot.low)}`);
  setText("rainProb", `${dayIndex === 0 && rainSignal ? rainSignal.maxProbability : snapshot.rain}%`);

  if (dayIndex === 0) {
    setText("rainTime", rainSignal ? rainSignal.text : "시간대별 강수 정보 확인 중");
    setText("humidity", `${snapshot.humidity}%`);
    setText("wind", `${snapshot.wind} km/h`);
  } else {
    setText("rainTime", "내일 시간대 정보 미제공");
    setText("humidity", "--");
    setText("wind", "--");
  }
}

function getGuideCopy(snapshot) {
  const rainSignal = buildRainSignalSummary(state.weather);
  const rainProbability = snapshot.dayIndex === 0 ? rainSignal.maxProbability : snapshot.rain;
  const wind = typeof snapshot.wind === "string" ? 0 : snapshot.wind;
  const rainText = rainSignal.text;

  const rainGuide = rainSignal.hasSignal && rainSignal.maxPrecipitation < 1 && rainSignal.maxProbability >= 60
    ? {
      title: "비 가능성은 있으나 약할 수 있음",
      text: `강수확률 ${rainProbability}%입니다. ${rainText}.`,
    }
    : rainProbability >= 60
      ? {
        title: "우산 필요 가능성 높음",
        text: `강수확률 ${rainProbability}%입니다. ${rainText}.`,
      }
      : rainProbability >= 30
        ? {
          title: "접이식 우산 고려",
          text: `강수확률 ${rainProbability}%입니다. ${rainText}.`,
        }
        : {
          title: "비 가능성 낮음",
          text: `강수확률 ${rainProbability}%입니다. ${rainText}.`,
        };

  const outsideGuide = (rainProbability >= 60 || wind >= 30)
    ? {
      title: "외근 일정은 여유 있게",
      text: `바람 ${wind === 0 ? "정보 미제공" : `${wind}km/h`}, ${rainText}. 이동 시간을 넉넉하게 잡으세요.`,
    }
    : {
      title: "외근 진행 무난",
      text: `바람과 강수 신호가 모두 크지 않아 보입니다. ${rainText}.`,
    };

  const clothesGuide = snapshot.low <= 5
    ? {
      title: "아침 저녁 보온 필요",
      text: `최저 ${formatTemperature(snapshot.low)}입니다. 겹쳐 입기와 보온이 좋습니다.`,
    }
    : snapshot.high >= 28
      ? {
        title: "여름 대비 필요",
        text: `최고 ${formatTemperature(snapshot.high)}입니다. 가벼운 옷차림과 수분 보충을 권합니다.`,
      }
      : snapshot.high - snapshot.low >= 10
        ? {
          title: "일교차 주의",
          text: `최고 ${formatTemperature(snapshot.high)}, 최저 ${formatTemperature(snapshot.low)}입니다. 얇게 겹쳐 입는 방식이 좋습니다.`,
        }
        : {
          title: "무난한 옷차림",
          text: `현재 ${formatTemperature(snapshot.temp)}, 최고 ${formatTemperature(snapshot.high)} / 최저 ${formatTemperature(snapshot.low)}입니다. 일반적인 외출복으로 충분합니다.`,
        };

  return { rainGuide, outsideGuide, clothesGuide };
}

async function init() {
  applyAppTitle();
  updateDate();
  setupBottomNav();
  setupScheduleTimePicker();
  setupLawTabs();

  loadCompanyMembers();
  loadCompanyMembership();
  state.schedules = loadSchedules();
  loadNotificationSettings();
  renderSchedules();
  bindEvents();

  const weatherLoadPromise = loadWeather().catch(handleWeatherLoadError);
  await registerSW();
  await loadLawUpdates();
  await weatherLoadPromise;
}

init();
