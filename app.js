const $ = (id) => document.getElementById(id);

const STORAGE_KEYS = {
  schedules: "shjj_brief_schedules_v4",
  tasks: "shjj_brief_tasks_v4",
  workMemo: "shjj_brief_work_memo_v4",
  lawMemo: "shjj_brief_law_memo_v4",
  city: "shjj_brief_city_v4",
  lat: "shjj_brief_lat_v4",
  lon: "shjj_brief_lon_v4",
};

const state = {
  city: localStorage.getItem(STORAGE_KEYS.city) || "서울",
  latitude: Number(localStorage.getItem(STORAGE_KEYS.lat)) || 37.5665,
  longitude: Number(localStorage.getItem(STORAGE_KEYS.lon)) || 126.9780,
  weather: null,
  schedules: [],
  tasks: [],
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

function weatherText(code) {
  return weatherMap[code] || ["날씨 정보", "날씨 정보를 확인했습니다."];
}

function round(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return Math.round(value);
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

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
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

function clearChildren(el) {
  el.textContent = "";
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

function createActionButton(label, className, id, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.id = id;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return String(Date.now()) + "_" + Math.random().toString(16).slice(2);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function updateDate() {
  const now = new Date();
  const text = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  setText("todayDate", text);
}

function getSelectedScheduleTime() {
  const hour = $("scheduleHourSelect").value || "09";
  const minute = $("scheduleMinuteSelect").value || "00";
  return `${hour}:${minute}`;
}

function updateSelectedScheduleTime() {
  const time = getSelectedScheduleTime();
  setText("selectedScheduleTime", time);

  document.querySelectorAll(".quick-time-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.time === time);
  });
}

function setScheduleTime(time) {
  const [hour, minute] = time.split(":");
  $("scheduleHourSelect").value = hour;
  $("scheduleMinuteSelect").value = minute;
  updateSelectedScheduleTime();
  $("scheduleTitleInput").focus();
}

function setupScheduleTimePicker() {
  const hourSelect = $("scheduleHourSelect");
  const minuteSelect = $("scheduleMinuteSelect");
  const quickGrid = $("quickTimeGrid");

  clearChildren(hourSelect);
  clearChildren(minuteSelect);
  clearChildren(quickGrid);

  for (let h = 6; h <= 23; h++) {
    const option = document.createElement("option");
    option.value = pad2(h);
    option.textContent = `${pad2(h)}시`;
    hourSelect.appendChild(option);
  }

  ["00", "10", "20", "30", "40", "50"].forEach((m) => {
    const option = document.createElement("option");
    option.value = m;
    option.textContent = `${m}분`;
    minuteSelect.appendChild(option);
  });

  hourSelect.value = "09";
  minuteSelect.value = "00";

  ["09:00", "10:00", "11:00", "13:30", "14:00", "15:00", "16:00", "17:00"].forEach((time) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quick-time-btn";
    btn.dataset.time = time;
    btn.textContent = time;
    btn.addEventListener("click", () => setScheduleTime(time));
    quickGrid.appendChild(btn);
  });

  hourSelect.addEventListener("change", updateSelectedScheduleTime);
  minuteSelect.addEventListener("change", updateSelectedScheduleTime);

  updateSelectedScheduleTime();
}

function updateBrief() {
  const scheduleCount = state.schedules.length;
  const undoneTasks = state.tasks.filter((task) => !task.done).length;

  setText("scheduleCount", `${scheduleCount}건`);
  setText("taskCount", `${undoneTasks}건`);

  let tempText = "--°";
  let weatherSummary = "날씨 정보를 불러오는 중입니다.";

  if (state.weather) {
    const current = state.weather.current;
    const daily = state.weather.daily;
    const [title, desc] = weatherText(current.weather_code);
    const temp = round(current.temperature_2m);
    const high = round(daily.temperature_2m_max[0]);
    const low = round(daily.temperature_2m_min[0]);
    const rain = round(daily.precipitation_probability_max[0]);

    tempText = `${temp}°`;
    weatherSummary = `${state.city} ${temp}°, ${title}. 최고 ${high}° / 최저 ${low}°, 강수확률 ${rain}%. ${desc}`;
  }

  setText("weatherMini", tempText);

  const title =
    scheduleCount === 0 && undoneTasks === 0
      ? "오늘은 정리 중심으로 가면 좋습니다."
      : `오늘 일정 ${scheduleCount}건, 할 일 ${undoneTasks}건이 있습니다.`;

  setText("briefTitle", title);
  setText("briefText", `${weatherSummary} 중요한 일정부터 처리하세요.`);
}

function renderDailyGuide() {
  if (!state.weather) return;

  const current = state.weather.current;
  const daily = state.weather.daily;

  const temp = round(current.temperature_2m);
  const high = round(daily.temperature_2m_max[0]);
  const low = round(daily.temperature_2m_min[0]);
  const rain = round(daily.precipitation_probability_max[0]);
  const wind = round(current.wind_speed_10m);

  if (rain >= 60) {
    setText("rainGuideTitle", "우산 필요 가능성 높음");
    setText("rainGuideText", `강수확률 ${rain}%입니다. 외근이나 이동 시 우산을 챙기세요.`);
  } else if (rain >= 30) {
    setText("rainGuideTitle", "비 가능성 있음");
    setText("rainGuideText", `강수확률 ${rain}%입니다. 접이식 우산 정도는 고려하세요.`);
  } else {
    setText("rainGuideTitle", "비 걱정은 낮음");
    setText("rainGuideText", `강수확률 ${rain}%입니다. 우산 필요성은 낮아 보입니다.`);
  }

  if (rain >= 60 || wind >= 30) {
    setText("outsideGuideTitle", "외근 일정은 여유 있게");
    setText("outsideGuideText", `바람 ${wind}km/h, 강수확률 ${rain}%입니다. 이동 시간을 넉넉하게 잡으세요.`);
  } else {
    setText("outsideGuideTitle", "외근 진행 무난");
    setText("outsideGuideText", "현장 확인이나 외부 미팅 진행에 큰 부담은 낮아 보입니다.");
  }

  if (low <= 5) {
    setText("clothesGuideTitle", "아침 저녁 보온 필요");
    setText("clothesGuideText", `최저 ${low}°입니다. 겉옷을 챙기는 편이 좋습니다.`);
  } else if (high >= 28) {
    setText("clothesGuideTitle", "더위 대비 필요");
    setText("clothesGuideText", `최고 ${high}°입니다. 가벼운 옷차림과 수분 섭취를 신경 쓰세요.`);
  } else if (high - low >= 10) {
    setText("clothesGuideTitle", "일교차 주의");
    setText("clothesGuideText", `최고 ${high}°, 최저 ${low}°입니다. 얇은 겉옷을 조절하는 방식이 좋습니다.`);
  } else {
    setText("clothesGuideTitle", "무난한 옷차림");
    setText("clothesGuideText", `현재 ${temp}°, 최고 ${high}° / 최저 ${low}°입니다. 일반적인 외출복으로 무난합니다.`);
  }
}

function updateSettingsView() {
  setText("settingCityName", state.city);
}


function countChanged(items) {
  if (!Array.isArray(items)) return 0;
  return items.filter((item) => item.status !== "no_change").length;
}

function lawStatusClass(item) {
  return item.status === "no_change" ? "" : "changed";
}

function safeText(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function safeHtml(value, fallback = "-") {
  return escapeHtml(safeText(value, fallback));
}

function getLawChangeSummary(item) {
  return safeText(
    item.change_summary || item.after_summary || item.summary,
    "변경 후 주요 내용을 확인해야 합니다."
  );
}

const LAW_MAJOR_GROUPS = ["건축", "도시주택", "소방안전", "교통기타", "기타"];

function getLawMajorGroup(item) {
  const text = [
    safeText(item.category, ""),
    safeText(item.law_name, ""),
    safeText(item.law_type, ""),
  ].join(" ");

  if (/건축|녹색건축|피난|방화|에너지절약|범죄예방|건축물관리|면적|높이/.test(text)) {
    return "건축";
  }

  if (/주택|국토|도시|공동주택|계획|이용|하수도/.test(text)) {
    return "도시주택";
  }

  if (/소방|안전|시설물|편의증진|장애인|노인|임산부|층간|바닥충격음/.test(text)) {
    return "소방안전";
  }

  if (/교통|주차장|자전거|도로|차량|자동차/.test(text)) {
    return "교통기타";
  }

  return "기타";
}

function groupLawItemsByMajorGroup(items) {
  const grouped = new Map(LAW_MAJOR_GROUPS.map((name) => [name, []]));

  (items || []).forEach((item) => {
    const groupName = getLawMajorGroup(item);
    grouped.get(groupName).push(item);
  });

  return LAW_MAJOR_GROUPS
    .map((name) => ({ name, items: grouped.get(name) || [] }))
    .filter((group) => group.items.length > 0);
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

function renderChangedCategoryGroups(changedItems) {
  if (!changedItems.length) return "";

  const groups = groupLawItemsByMajorGroup(changedItems);

  return groups.map(({ name, items }) => renderLawAccordionGroup(
    name,
    items,
    renderChangedItem,
    { countLabel: "건" }
  )).join("");
}

function renderChangedItem(item) {
  return `
    <article class="law-item law-item-changed">
      <div class="law-item-head">
        <div>
          <span class="law-name">${safeHtml(item.law_name)}</span>
          <span class="law-category">${safeHtml(item.category, "분류 없음")}</span>
        </div>
        <span class="law-status changed">${safeHtml(item.status_label, "변경 있음")}</span>
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

function formatLawDate(value) {
  const text = safeText(value, "");
  if (!text) return "";
  return text.replace(/-/g, ".");
}

function normalizeLawName(value) {
  return safeText(value, "")
    .replace(/s+/g, "")
    .replace(/[()·ㆍ,]/g, "")
    .trim();
}

function buildLawUpdateLookup(todayItems, weekItems, monthItems) {
  const lookup = new Map();
  const periods = [
    { key: "today", rank: 0, label: "오늘 변경 1건", items: todayItems },
    { key: "week", rank: 1, label: "최근 7일 변경 1건", items: weekItems },
    { key: "month", rank: 2, label: "최근 30일 변경 1건", items: monthItems },
  ];

  periods.forEach(({ key, rank, label, items }) => {
    (items || []).forEach((item) => {
      const name = normalizeLawName(item.law_name);
      if (!name) return;

      const sourceDate = item.source_date || item.effective_date || item.promulgation_date || "";
      const previous = lookup.get(name);
      const previousDate = previous ? (previous.sourceDate || "") : "";
      if (!previous || rank < previous.rank || (rank === previous.rank && sourceDate > previousDate)) {
        lookup.set(name, { key, rank, label, sourceDate, item });
      }
    });
  });

  return lookup;
}

function getTrackedLawStatus(item, lookup, apiStatus) {
  const name = normalizeLawName(item?.law_name);
  const hasReadableData = !!name && !!safeText(item?.law_name, "");
  const unavailable = apiStatus && apiStatus !== "success" && apiStatus !== "partial_success" && apiStatus !== "no_data";

  if (!hasReadableData) {
    return { label: "데이터 확인 필요", rank: 4, period: "error" };
  }

  if (unavailable) {
    return { label: "데이터 확인 필요", rank: 4, period: "error" };
  }

  const matched = lookup.get(name);
  if (matched) {
    return matched;
  }

  return { label: "최근 업데이트 없음", rank: 3, period: "none" };
}

function renderTrackedLaws(items, checkedAt, updateState = {}) {
  const container = $("trackedLawList");
  if (!container) return;

  if (!Array.isArray(items) || items.length === 0) {
    setText("trackedLawCount", "0개 추적 중");
    container.innerHTML = `<div class="law-empty">관심 법령 추적 데이터가 없습니다.</div>`;
    return;
  }

  const apiStatus = updateState.apiStatus || "";
  const lookup = buildLawUpdateLookup(updateState.todayItems, updateState.weekItems, updateState.monthItems);
  setText("trackedLawCount", `${items.length}개 추적 중`);

  const groups = groupLawItemsByMajorGroup(items);

  container.innerHTML = groups.map(({ name, items: groupItems }) => {
    const decorated = groupItems.map((item) => {
      const status = getTrackedLawStatus(item, lookup, apiStatus);
      return { item, status };
    }).sort((a, b) => {
      if (a.status.rank !== b.status.rank) return a.status.rank - b.status.rank;
      const priorityDiff = (Number(a.item.priority) || 3) - (Number(b.item.priority) || 3);
      if (priorityDiff !== 0) return priorityDiff;
      return safeText(a.item.law_name, "").localeCompare(safeText(b.item.law_name, ""), "ko");
    });

    const recent30Count = decorated.filter(({ status }) => status.rank <= 2).length;
    const rows = decorated.map(({ item, status }) => {
      const className = status.rank <= 2 ? "today-updated" : status.rank === 3 ? "no-update" : "needs-review";
      return `
        <article class="tracked-law-item ${className}">
          <div>
            <strong>${safeHtml(item.law_name)}</strong>
            <span>${safeHtml(item.category, "기타")}</span>
          </div>
          <em>${escapeHtml(status.label)}</em>
        </article>
      `;
    }).join("");

    return `
      <details class="tracked-law-group">
        <summary class="tracked-law-title">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(`${recent30Count}건${recent30Count > 0 ? " · 최근 변경 있음" : ""}`)}</span>
        </summary>
        <div class="tracked-law-list">
          ${rows}
        </div>
      </details>
    `;
  }).join("");
}

async function loadLawUpdates() {
  try {
    const res = await fetch("./data/law_updates.json", { cache: "no-store" });
    if (!res.ok) throw new Error("law_updates.json 로딩 실패");

    const data = await res.json();

    const todayItems = data.today_items ?? data.today ?? [];
    const weekItems = data.last_7_days_items ?? data.last_7_days ?? [];
    const monthItems = data.last_30_days_items ?? data.last_30_days ?? [];
    const todayCount = Number(data.today_count ?? data.summary?.today_changes ?? todayItems.length) || 0;
    const weekCount = Number(data.last_7_days_count ?? data.summary?.last_7_days_changes ?? weekItems.length) || 0;
    const monthCount = Number(data.last_30_days_count ?? data.summary?.last_30_days_changes ?? monthItems.length) || 0;
    const apiStatus = data.api_status || "";
    const apiStatusLabel = {
      success: "정상",
      partial_success: "부분 성공",
      no_data: "0건",
      missing_law_oc: "OC 필요",
      api_error: "오류",
    }[apiStatus] || "";

    setText("lawBasisChip", data.basis || "시행일 기준");
    if (apiStatus && apiStatus !== "success") {
      setText("lawBasisChip", `${data.basis || "시행일 기준"} · ${apiStatusLabel || apiStatus}`);
    }

    const noticeText = data.notice || data.scope || "시행일 기준으로 오늘 확인할 법령 변경을 정리합니다.";
    const errorSuffix = data.error ? ` (${data.error})` : "";
    setText("lawNotice", `${noticeText}${apiStatus && apiStatus !== "success" ? errorSuffix : ""}`);

    const updatedAtText = data.updated_at ? ` · 갱신: ${data.updated_at}` : data.synced_at ? ` · 갱신: ${data.synced_at}` : "";
    setText("lawCheckedAt", `확인일: ${safeText(data.checked_at)}${updatedAtText}`);

    setText("lawTodayCount", `${todayCount}건`);
    setText("lawWeekCount", `${weekCount}건`);
    setText("lawMonthCount", `${monthCount}건`);
    updateLawAction(todayCount, weekCount, monthCount, apiStatus, data.error || "");
    renderTrackedLaws(data.tracked_laws, data.checked_at, {
      apiStatus,
      todayItems,
      weekItems,
      monthItems,
    });

    renderLawList(
      "lawTodayList",
      todayItems,
      "오늘 변경이 없습니다.",
      { apiStatus, error: data.error || "" }
    );

    renderLawList(
      "lawWeekList",
      weekItems,
      "최근 7일 기준 변경이 없습니다.",
      { apiStatus, error: data.error || "" }
    );

    renderLawList(
      "lawMonthList",
      monthItems,
      "최근 30일 기준 변경이 없습니다.",
      { apiStatus, error: data.error || "" }
    );
  } catch (error) {
    setText("lawNotice", "법령 변경 데이터를 불러오지 못했습니다. 네트워크 또는 data/law_updates.json 파일을 확인하세요.");
    setText("lawCheckedAt", "확인일: -");
    setText("lawActionTitle", "확인 필요");
    setText("lawActionText", "자동 브리프를 표시하지 못했습니다. 오늘 업무 전 수동으로 주요 법령 변경 여부를 확인하세요.");

    renderLawList("lawTodayList", [], "법령 데이터 파일을 불러오지 못했습니다. data/law_updates.json을 확인하세요.", { apiStatus: "api_error" });
    renderLawList("lawWeekList", [], "법령 데이터 파일을 불러오지 못했습니다. data/law_updates.json을 확인하세요.", { apiStatus: "api_error" });
    renderLawList("lawMonthList", [], "법령 데이터 파일을 불러오지 못했습니다. data/law_updates.json을 확인하세요.", { apiStatus: "api_error" });
    renderTrackedLaws([], "", { apiStatus: "api_error", todayItems: [], weekItems: [], monthItems: [] });
  }
}
function setupLawTabs() {
  document.querySelectorAll(".law-tab-btn").forEach((btn) => {
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(btn.classList.contains("active")));

    btn.addEventListener("click", () => {
      const tab = btn.dataset.lawTab;

      document.querySelectorAll(".law-tab-btn").forEach((item) => {
        const selected = item === btn;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", String(selected));
      });

      document.querySelectorAll(".law-panel").forEach((panel) => {
        panel.classList.remove("active");
      });

      if (tab === "today") $("lawPanelToday").classList.add("active");
      if (tab === "week") $("lawPanelWeek").classList.add("active");
      if (tab === "month") $("lawPanelMonth").classList.add("active");
    });
  });
}

async function searchCity(name) {
  const query = encodeURIComponent(name.trim());
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=ko&format=json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("도시 검색 실패");

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("검색 결과 없음");
  }

  const city = data.results[0];

  state.city = city.admin1 ? `${city.name}, ${city.admin1}` : city.name;
  state.latitude = city.latitude;
  state.longitude = city.longitude;

  localStorage.setItem(STORAGE_KEYS.city, state.city);
  localStorage.setItem(STORAGE_KEYS.lat, String(state.latitude));
  localStorage.setItem(STORAGE_KEYS.lon, String(state.longitude));

  await loadWeather();
}

async function loadWeather() {
  setText("weatherDesc", "날씨 정보를 불러오는 중");

  const params = new URLSearchParams({
    latitude: state.latitude,
    longitude: state.longitude,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "weather_code",
      "wind_speed_10m"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max"
    ].join(","),
    hourly: [
      "precipitation_probability",
      "precipitation"
    ].join(","),
    timezone: "auto",
    forecast_days: "2"
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error("날씨 로딩 실패");

  const data = await res.json();
  state.weather = data;

  renderWeather();
  renderDailyGuide();
  updateSettingsView();
  updateBrief();
}

function renderWeather() {
  if (!state.weather) return;

  const current = state.weather.current;
  const daily = state.weather.daily;
  const [title, desc] = weatherText(current.weather_code);

  setText("locationName", state.city);
  setText("currentTemp", `${round(current.temperature_2m)}°`);
  setText("weatherDesc", `${title} · ${desc}`);
  setText("highLow", `${round(daily.temperature_2m_max[0])}° / ${round(daily.temperature_2m_min[0])}°`);
  setText("rainProb", `${round(daily.precipitation_probability_max[0])}%`);
  setText("rainTime", getRainTimeSummary(state.weather));
  setText("humidity", `${round(current.relative_humidity_2m)}%`);
  setText("wind", `${round(current.wind_speed_10m)} km/h`);
}

function renderSchedules() {
  const list = $("scheduleList");
  clearChildren(list);

  if (state.schedules.length === 0) {
    list.appendChild(createEmptyListItem("등록된 일정이 없습니다."));
    updateBrief();
    return;
  }

  const sorted = [...state.schedules].sort((a, b) =>
    safeText(a.time, "").localeCompare(safeText(b.time, ""))
  );

  sorted.forEach((item) => {
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
      state.schedules = state.schedules.filter((schedule) => schedule.id !== item.id);
      saveJson(STORAGE_KEYS.schedules, state.schedules);
      renderSchedules();
      updateBrief();
    });

    main.append(time, title);
    actions.appendChild(deleteButton);
    row.append(main, actions);
    list.appendChild(row);
  });

  updateBrief();
}

function renderTasks() {
  const list = $("taskList");
  clearChildren(list);

  if (state.tasks.length === 0) {
    list.appendChild(createEmptyListItem("등록된 할 일이 없습니다."));
    updateBrief();
    return;
  }

  state.tasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = `item ${task.done ? "done" : ""}`;

    const main = document.createElement("div");
    main.className = "item-main";

    const title = document.createElement("span");
    title.className = "item-title";
    title.textContent = safeText(task.title, "제목 없음");

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const toggleButton = createActionButton(task.done ? "해제" : "완료", "toggle-task", task.id, () => {
      task.done = !task.done;
      saveJson(STORAGE_KEYS.tasks, state.tasks);
      renderTasks();
      updateBrief();
    });

    const deleteButton = createActionButton("삭제", "delete-task", task.id, () => {
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      saveJson(STORAGE_KEYS.tasks, state.tasks);
      renderTasks();
      updateBrief();
    });

    main.appendChild(title);
    actions.append(toggleButton, deleteButton);
    row.append(main, actions);
    list.appendChild(row);
  });

  updateBrief();
}

function addSchedule() {
  const title = $("scheduleTitleInput").value.trim();

  if (!title) {
    alert("일정 내용을 입력하세요.");
    $("scheduleTitleInput").focus();
    return;
  }

  state.schedules.push({
    id: makeId(),
    source: "manual",
    time: getSelectedScheduleTime(),
    title,
  });

  saveJson(STORAGE_KEYS.schedules, state.schedules);
  $("scheduleTitleInput").value = "";
  $("scheduleTitleInput").focus();
  renderSchedules();
}

function addTask() {
  const title = $("taskInput").value.trim();

  if (!title) {
    alert("할 일을 입력하세요.");
    $("taskInput").focus();
    return;
  }

  state.tasks.push({
    id: makeId(),
    source: "manual",
    title,
    done: false,
  });

  saveJson(STORAGE_KEYS.tasks, state.tasks);
  $("taskInput").value = "";
  $("taskInput").focus();
  renderTasks();
}

async function registerSW() {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      if (registration.update) {
        await registration.update();
      }
    } catch (error) {
      console.log("Service worker skipped", error);
    }
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

async function showBriefNotification() {
  if (!("Notification" in window)) return;

  if (Notification.permission !== "granted") {
    const ok = await requestNotification();
    if (!ok) return;
  }

  let weatherLine = "날씨 정보 확인 중";
  if (state.weather) {
    const current = state.weather.current;
    const daily = state.weather.daily;
    const [title] = weatherText(current.weather_code);
    weatherLine = `${state.city} ${round(current.temperature_2m)}° · ${title} · 최고 ${round(daily.temperature_2m_max[0])}° / 최저 ${round(daily.temperature_2m_min[0])}°`;
  }

  const scheduleCount = state.schedules.length;
  const taskCount = state.tasks.filter((task) => !task.done).length;

  const title = "SHJJ Brief · 오늘 브리핑";
  const body = `${weatherLine}\n오늘 일정 ${scheduleCount}건 · 남은 할 일 ${taskCount}건`;

  const reg = await navigator.serviceWorker.getRegistration();

  if (reg) {
    reg.showNotification(title, {
      body,
      tag: "shjj-brief-test",
      renotify: true,
    });
  } else {
    new Notification(title, { body });
  }
}

function setupBottomNav() {
  document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;

      document.querySelectorAll(".bottom-nav-btn").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindEvents() {
  $("searchCityBtn").addEventListener("click", async () => {
    const city = $("cityInput").value.trim();
    if (!city) return;

    try {
      await searchCity(city);
      $("cityInput").value = "";
    } catch {
      alert("도시를 찾지 못했습니다. 예: 서울, 수원, 부산");
    }
  });

  $("cityInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") $("searchCityBtn").click();
  });

  $("refreshWeatherBtn").addEventListener("click", loadWeather);
  $("addScheduleBtn").addEventListener("click", addSchedule);
  $("addTaskBtn").addEventListener("click", addTask);
  $("notifyBtn").addEventListener("click", requestNotification);
  $("testNotifyBtn").addEventListener("click", showBriefNotification);

  $("scheduleTitleInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") addSchedule();
  });

  $("taskInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") addTask();
  });

  $("workMemo").addEventListener("input", () => {
    localStorage.setItem(STORAGE_KEYS.workMemo, $("workMemo").value);
  });

  $("lawMemo").addEventListener("input", () => {
    localStorage.setItem(STORAGE_KEYS.lawMemo, $("lawMemo").value);
  });
}

async function init() {
  updateDate();
  setupBottomNav();
  setupScheduleTimePicker();
  setupLawTabs();

  state.schedules = loadArray(STORAGE_KEYS.schedules);
  state.tasks = loadArray(STORAGE_KEYS.tasks);

  $("workMemo").value = localStorage.getItem(STORAGE_KEYS.workMemo) || "";
  $("lawMemo").value = localStorage.getItem(STORAGE_KEYS.lawMemo) || "";

  renderSchedules();
  renderTasks();
  bindEvents();
  await registerSW();
  await loadLawUpdates();

  try {
    await loadWeather();
  } catch {
    setText("weatherDesc", "날씨 정보를 불러오지 못했습니다.");
    updateSettingsView();
    updateBrief();
  }
}

init();
