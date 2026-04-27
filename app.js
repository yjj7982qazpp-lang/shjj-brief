/* Structure
 * - Weather
 * - Daily Guide
 * - Schedule
 * - Law Brief
 * - Navigation
 */

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const STORAGE_KEYS = {
  schedules: "shjj_brief_schedules_v4",
};

const DEFAULT_LOCATION = {
  city: "서울",
  latitude: 37.5665,
  longitude: 126.9780,
};

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
    "precipitation_probability",
    "precipitation",
  ],
};

const QUICK_SCHEDULE_TIMES = ["09:00", "10:00", "11:00", "13:30", "14:00", "15:00", "16:00", "17:00"];
const SCHEDULE_MINUTES = ["00", "10", "20", "30", "40", "50"];
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

function getWeatherSnapshot() {
  if (!state.weather) return null;

  const current = state.weather.current;
  const daily = state.weather.daily;

  return {
    current,
    daily,
    temp: round(current.temperature_2m),
    high: round(daily.temperature_2m_max[0]),
    low: round(daily.temperature_2m_min[0]),
    rain: round(daily.precipitation_probability_max[0]),
    wind: round(current.wind_speed_10m),
  };
}

function renderWeather() {
  const snapshot = getWeatherSnapshot();
  if (!snapshot) return;

  const [title, desc] = weatherText(snapshot.current.weather_code);
  setText("locationName", state.city);
  setText("currentTemp", `${snapshot.temp}°`);
  setText("weatherDesc", `${title} · ${desc}`);
  setText("highLow", `${snapshot.high}° / ${snapshot.low}°`);
  setText("rainProb", `${snapshot.rain}%`);
  setText("rainTime", getRainTimeSummary(state.weather));
  setText("humidity", `${round(snapshot.current.relative_humidity_2m)}%`);
  setText("wind", `${snapshot.wind} km/h`);
}

function getGuideCopy(snapshot) {
  const rainGuide = snapshot.rain >= 60
    ? {
      title: "우산 필요 가능성 높음",
      text: `강수확률 ${snapshot.rain}%입니다. 외근이나 이동 시 우산을 챙기세요.`,
    }
    : snapshot.rain >= 30
      ? {
        title: "비 가능성 있음",
        text: `강수확률 ${snapshot.rain}%입니다. 접이식 우산 정도는 고려하세요.`,
      }
      : {
        title: "비 걱정은 낮음",
        text: `강수확률 ${snapshot.rain}%입니다. 우산 필요성은 낮아 보입니다.`,
      };

  const outsideGuide = (snapshot.rain >= 60 || snapshot.wind >= 30)
    ? {
      title: "외근 일정은 여유 있게",
      text: `바람 ${snapshot.wind}km/h, 강수확률 ${snapshot.rain}%입니다. 이동 시간을 넉넉하게 잡으세요.`,
    }
    : {
      title: "외근 진행 무난",
      text: "현장 확인이나 외부 미팅 진행에 큰 부담은 낮아 보입니다.",
    };

  const clothesGuide = snapshot.low <= 5
    ? {
      title: "아침 저녁 보온 필요",
      text: `최저 ${snapshot.low}°입니다. 겉옷을 챙기는 편이 좋습니다.`,
    }
    : snapshot.high >= 28
      ? {
        title: "더위 대비 필요",
        text: `최고 ${snapshot.high}°입니다. 가벼운 옷차림과 수분 섭취를 신경 쓰세요.`,
      }
      : snapshot.high - snapshot.low >= 10
        ? {
          title: "일교차 주의",
          text: `최고 ${snapshot.high}°, 최저 ${snapshot.low}°입니다. 얇은 겉옷을 조절하는 방식이 좋습니다.`,
        }
        : {
          title: "무난한 옷차림",
          text: `현재 ${snapshot.temp}°, 최고 ${snapshot.high}° / 최저 ${snapshot.low}°입니다. 일반적인 외출복으로 무난합니다.`,
        };

  return { rainGuide, outsideGuide, clothesGuide };
}

function renderDailyGuide() {
  const snapshot = getWeatherSnapshot();
  if (!snapshot) return;

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
  renderWeather();
  renderDailyGuide();
  updateSettingsView();
  updateBrief();
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

function getSelectedScheduleTime() {
  const hour = $("scheduleHourSelect")?.value || "09";
  const minute = $("scheduleMinuteSelect")?.value || "00";
  return `${hour}:${minute}`;
}

function updateSelectedScheduleTime() {
  const time = getSelectedScheduleTime();
  setText("selectedScheduleTime", time);
  $$(".quick-time-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.time === time);
  });
}

function setScheduleTime(time) {
  const [hour, minute] = time.split(":");
  const hourSelect = $("scheduleHourSelect");
  const minuteSelect = $("scheduleMinuteSelect");

  if (hourSelect) hourSelect.value = hour;
  if (minuteSelect) minuteSelect.value = minute;

  updateSelectedScheduleTime();
  $("scheduleTitleInput")?.focus();
}

function buildScheduleTimeOptions(select, values, formatter) {
  clearChildren(select);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = formatter(value);
    select.appendChild(option);
  });
}

function buildQuickTimeButtons(container) {
  clearChildren(container);
  QUICK_SCHEDULE_TIMES.forEach((time) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-time-btn";
    button.dataset.time = time;
    button.textContent = time;
    button.addEventListener("click", () => setScheduleTime(time));
    container.appendChild(button);
  });
}

function setupScheduleTimePicker() {
  const hourSelect = $("scheduleHourSelect");
  const minuteSelect = $("scheduleMinuteSelect");
  const quickGrid = $("quickTimeGrid");

  if (!hourSelect || !minuteSelect || !quickGrid) return;

  buildScheduleTimeOptions(
    hourSelect,
    Array.from({ length: 18 }, (_, index) => pad2(index + 6)),
    (value) => `${value}시`
  );
  buildScheduleTimeOptions(minuteSelect, SCHEDULE_MINUTES, (value) => `${value}분`);
  buildQuickTimeButtons(quickGrid);

  hourSelect.value = "09";
  minuteSelect.value = "00";
  bindEvent(hourSelect, "change", updateSelectedScheduleTime);
  bindEvent(minuteSelect, "change", updateSelectedScheduleTime);
  updateSelectedScheduleTime();
}

function createScheduleRow(item) {
  const row = document.createElement("div");
  row.className = "item";

  const main = document.createElement("div");
  main.className = "item-main";

  const time = document.createElement("span");
  time.className = "item-time";
  time.textContent = safeText(item.time, "--:--");

  const title = document.createElement("span");
  title.className = "item-title";
  title.textContent = safeText(item.title, "제목 없음");

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const deleteButton = createActionButton("삭제", "delete-schedule", item.id, () => {
    removeSchedule(item.id);
  });

  main.append(time, title);
  actions.appendChild(deleteButton);
  row.append(main, actions);
  return row;
}

function sortSchedules(items) {
  return [...items].sort((a, b) => safeText(a.time, "").localeCompare(safeText(b.time, "")));
}

function updateBrief() {
  setText("scheduleCount", `${state.schedules.length}건`);
}

function renderSchedules() {
  const list = $("scheduleList");
  if (!list) return;

  clearChildren(list);

  if (state.schedules.length === 0) {
    list.appendChild(createEmptyListItem("등록된 일정이 없습니다."));
    updateBrief();
    return;
  }

  sortSchedules(state.schedules).forEach((item) => {
    list.appendChild(createScheduleRow(item));
  });
  updateBrief();
}

function removeSchedule(scheduleId) {
  state.schedules = state.schedules.filter((schedule) => schedule.id !== scheduleId);
  saveJson(STORAGE_KEYS.schedules, state.schedules);
  renderSchedules();
}

function addSchedule() {
  const input = $("scheduleTitleInput");
  const title = input?.value.trim() || "";

  if (!title) {
    alert("일정 내용을 입력하세요.");
    input?.focus();
    return;
  }

  state.schedules.push({
    id: makeId(),
    source: "manual",
    time: getSelectedScheduleTime(),
    title,
  });

  saveJson(STORAGE_KEYS.schedules, state.schedules);
  if (input) {
    input.value = "";
    input.focus();
  }
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
  const statusText = successLike ? "API 성공 0건" : "API 실패 0건";

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

  container.innerHTML = renderChangedCategoryGroups(changedItems);
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
    setText("lawActionTitle", "API 조회 확인");
    setText("lawActionText", `오늘 변경 0건처럼 보여도 실제로는 API 상태가 ${apiStatus}입니다. 최신성부터 다시 확인하세요.${suffix}`);
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
  setText("lawMetaSummary", `마지막 갱신 ${formatLawUpdatedAt(updatedAt)} · 총 저장 ${savedCount}건`);
  setText("trackedLawUpdatedAt", `마지막 갱신 ${formatLawUpdatedAt(updatedAt)}`);
}

function renderLawSections(data, todayItems, weekItems, monthItems) {
  renderLawList("lawTodayList", todayItems, LAW_MESSAGES.emptyToday, { apiStatus: data.apiStatus });
  renderLawList("lawWeekList", weekItems, LAW_MESSAGES.emptyWeek, { apiStatus: data.apiStatus });
  renderLawList("lawMonthList", monthItems, LAW_MESSAGES.emptyMonth, { apiStatus: data.apiStatus });
}

function renderLawLoadFailure() {
  setText("lawNotice", LAW_MESSAGES.loadFailed);
  setText("lawCheckedAt", "확인일: -");
  setText("lawMetaSummary", "마지막 갱신 - · 총 저장 0건");
  setText("trackedLawUpdatedAt", "마지막 갱신 -");
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

function buildNotificationWeatherLine() {
  const snapshot = getWeatherSnapshot();
  if (!snapshot) return "날씨 정보 확인 중";

  const [title] = weatherText(snapshot.current.weather_code);
  return `${state.city} ${snapshot.temp}° · ${title} · 최고 ${snapshot.high}° / 최저 ${snapshot.low}°`;
}

async function showBriefNotification() {
  if (!("Notification" in window)) return;

  if (Notification.permission !== "granted") {
    const ok = await requestNotification();
    if (!ok) return;
  }

  const title = "SHJJ Brief · 오늘 브리핑";
  const body = `${buildNotificationWeatherLine()}\n오늘 일정 ${state.schedules.length}건`;
  const reg = await navigator.serviceWorker.getRegistration();

  if (reg) {
    reg.showNotification(title, {
      body,
      tag: "shjj-brief-test",
      renotify: true,
    });
    return;
  }

  new Notification(title, { body });
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
}

function bindScheduleEvents() {
  bindEvent($("addScheduleBtn"), "click", addSchedule);
  bindEvent($("scheduleTitleInput"), "keydown", (event) => {
    if (event.key === "Enter") addSchedule();
  });
}

function bindNotificationEvents() {
  bindEvent($("notifyBtn"), "click", requestNotification);
  bindEvent($("testNotifyBtn"), "click", showBriefNotification);
}

function bindEvents() {
  bindWeatherEvents();
  bindScheduleEvents();
  bindNotificationEvents();
}

async function init() {
  updateDate();
  setupBottomNav();
  setupScheduleTimePicker();
  setupLawTabs();

  state.schedules = loadArray(STORAGE_KEYS.schedules);
  renderSchedules();
  bindEvents();

  const weatherLoadPromise = loadWeather().catch(handleWeatherLoadError);
  await registerSW();
  await loadLawUpdates();
  await weatherLoadPromise;
}

init();
