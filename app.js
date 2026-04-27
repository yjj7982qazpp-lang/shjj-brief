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

function makeId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
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

  hourSelect.innerHTML = "";
  minuteSelect.innerHTML = "";
  quickGrid.innerHTML = "";

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

function groupByCategory(items) {
  const groups = {};

  (items || []).forEach((item) => {
    const category = safeText(item.category, "기타");

    if (!groups[category]) {
      groups[category] = [];
    }

    groups[category].push(item);
  });

  return groups;
}

function renderChangedCategoryGroups(changedItems) {
  if (!changedItems.length) return "";

  const groups = groupByCategory(changedItems);

  return Object.entries(groups).map(([category, items]) => {
    const cards = items.map(renderChangedItem).join("");

    return `
      <section class="law-category-group changed-group">
        <div class="law-category-title">
          <strong>${escapeHtml(category)}</strong>
          <span>변경 ${items.length}건</span>
        </div>
        <div class="law-category-body">
          ${cards}
        </div>
      </section>
    `;
  }).join("");
}

function renderNoChangeGroup(unchangedItems) {
  if (!unchangedItems.length) return "";

  const groups = groupByCategory(unchangedItems);

  const categoryBlocks = Object.entries(groups).map(([category, items]) => {
    const names = items.map((item) => {
      return `<li>${safeHtml(item.law_name)}</li>`;
    }).join("");

    return `
      <details class="law-nochange-category">
        <summary>
          <strong>${escapeHtml(category)}</strong>
          <span>${items.length}건</span>
        </summary>
        <ul class="law-nochange-list">
          ${names}
        </ul>
      </details>
    `;
  }).join("");

  return `
    <details class="law-nochange-box">
      <summary>변경 없는 법령 ${unchangedItems.length}건</summary>
      <div class="law-nochange-categories">
        ${categoryBlocks}
      </div>
    </details>
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
        <span>변경 후 요약</span>
        <p>${escapeHtml(getLawChangeSummary(item))}</p>
      </div>

      <div class="law-next-step">
        변경 전후 비교는 API 연결 후 클릭 상세 화면에서 확장 예정입니다.
      </div>
    </article>
  `;
}

function renderLawList(containerId, items, emptyMessage) {
  const container = $(containerId);
  if (!container) return;

  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = `<div class="law-empty">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  const changedItems = items.filter((item) => item.status !== "no_change");
  const unchangedItems = items.filter((item) => item.status === "no_change");

  let html = "";

  if (changedItems.length > 0) {
    html += renderChangedCategoryGroups(changedItems);
  } else {
    html += `<div class="law-empty">${escapeHtml(emptyMessage)}</div>`;
  }

  html += renderNoChangeGroup(unchangedItems);

  container.innerHTML = html;
}

async function loadLawUpdates() {
  try {
    const res = await fetch("./data/law_updates.json", { cache: "no-store" });
    if (!res.ok) throw new Error("law_updates.json 로딩 실패");

    const data = await res.json();

    const todayCount = data.summary?.today_changes ?? countChanged(data.today);
    const weekCount = data.summary?.last_7_days_changes ?? countChanged(data.last_7_days);
    const monthCount = data.summary?.last_30_days_changes ?? countChanged(data.last_30_days);

    setText("lawBasisChip", data.basis || "시행일 기준");
    setText("lawNotice", data.scope || data.notice || "시행일 기준 법령 변경을 확인합니다.");
    const syncedAtText = data.synced_at ? ` · 자동갱신: ${data.synced_at}` : "";
    setText("lawCheckedAt", `확인일: ${safeText(data.checked_at)}${syncedAtText}`);

    setText("lawTodayCount", `${todayCount}건`);
    setText("lawWeekCount", `${weekCount}건`);
    setText("lawMonthCount", `${monthCount}건`);

    renderLawList(
      "lawTodayList",
      data.today,
      "오늘부터 새로 시행되는 건축 관련 법령 변경사항이 없습니다."
    );

    renderLawList(
      "lawWeekList",
      data.last_7_days,
      "최근 7일 내 새로 시행된 건축 관련 법령 변경사항이 없습니다."
    );

    renderLawList(
      "lawMonthList",
      data.last_30_days,
      "최근 30일 내 새로 시행된 건축 관련 법령 변경사항이 없습니다."
    );
  } catch (error) {
    setText("lawNotice", "법령 변경 정보를 불러오지 못했습니다.");
    setText("lawCheckedAt", "확인일: -");

    renderLawList("lawTodayList", [], "법령 데이터 파일을 확인해야 합니다.");
    renderLawList("lawWeekList", [], "법령 데이터 파일을 확인해야 합니다.");
    renderLawList("lawMonthList", [], "법령 데이터 파일을 확인해야 합니다.");
  }
}

function setupLawTabs() {
  document.querySelectorAll(".law-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.lawTab;

      document.querySelectorAll(".law-tab-btn").forEach((item) => {
        item.classList.remove("active");
      });

      document.querySelectorAll(".law-panel").forEach((panel) => {
        panel.classList.remove("active");
      });

      btn.classList.add("active");

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
    timezone: "auto",
    forecast_days: "1"
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
  setText("humidity", `${round(current.relative_humidity_2m)}%`);
  setText("wind", `${round(current.wind_speed_10m)} km/h`);
}

function renderSchedules() {
  const list = $("scheduleList");
  list.innerHTML = "";

  if (state.schedules.length === 0) {
    list.innerHTML = `<div class="item"><div class="item-main"><span class="item-title">등록된 일정이 없습니다.</span></div></div>`;
    updateBrief();
    return;
  }

  const sorted = [...state.schedules].sort((a, b) => a.time.localeCompare(b.time));

  sorted.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="item-main">
        <span class="item-time">${escapeHtml(item.time)}</span>
        <span class="item-title">${escapeHtml(item.title)}</span>
      </div>
      <div class="item-actions">
        <button data-id="${escapeHtml(item.id)}" class="delete-schedule">삭제</button>
      </div>
    `;
    list.appendChild(row);
  });

  document.querySelectorAll(".delete-schedule").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.schedules = state.schedules.filter((item) => item.id !== btn.dataset.id);
      saveJson(STORAGE_KEYS.schedules, state.schedules);
      renderSchedules();
      updateBrief();
    });
  });

  updateBrief();
}

function renderTasks() {
  const list = $("taskList");
  list.innerHTML = "";

  if (state.tasks.length === 0) {
    list.innerHTML = `<div class="item"><div class="item-main"><span class="item-title">등록된 할 일이 없습니다.</span></div></div>`;
    updateBrief();
    return;
  }

  state.tasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = `item ${task.done ? "done" : ""}`;
    row.innerHTML = `
      <div class="item-main">
        <span class="item-title">${escapeHtml(task.title)}</span>
      </div>
      <div class="item-actions">
        <button data-id="${escapeHtml(task.id)}" class="toggle-task">${task.done ? "해제" : "완료"}</button>
        <button data-id="${escapeHtml(task.id)}" class="delete-task">삭제</button>
      </div>
    `;
    list.appendChild(row);
  });

  document.querySelectorAll(".toggle-task").forEach((btn) => {
    btn.addEventListener("click", () => {
      const task = state.tasks.find((item) => item.id === btn.dataset.id);
      if (task) task.done = !task.done;
      saveJson(STORAGE_KEYS.tasks, state.tasks);
      renderTasks();
      updateBrief();
    });
  });

  document.querySelectorAll(".delete-task").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tasks = state.tasks.filter((item) => item.id !== btn.dataset.id);
      saveJson(STORAGE_KEYS.tasks, state.tasks);
      renderTasks();
      updateBrief();
    });
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
      await navigator.serviceWorker.register("./sw.js");
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

  state.schedules = loadJson(STORAGE_KEYS.schedules, []);
  state.tasks = loadJson(STORAGE_KEYS.tasks, []);

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
