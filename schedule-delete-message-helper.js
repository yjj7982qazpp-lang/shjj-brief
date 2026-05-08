(() => {
  const CLEAN_DELETE_FAILURE = "일정 삭제 실패: 서버 삭제 권한 설정이 아직 적용되지 않았습니다.";

  const originalAlert = window.alert;
  window.alert = function patchedAlert(message) {
    if (typeof message === "string" && message.startsWith("일정 삭제 실패:")) {
      return originalAlert.call(window, CLEAN_DELETE_FAILURE);
    }
    return originalAlert.apply(window, arguments);
  };

  function cleanScheduleFeedback() {
    const el = document.getElementById("scheduleFeedback");
    if (!el) return;
    const text = String(el.textContent || "");
    if (text.startsWith("일정 삭제 실패:")) {
      el.textContent = CLEAN_DELETE_FAILURE;
    }
  }

  const timer = window.setInterval(cleanScheduleFeedback, 500);
  window.setTimeout(() => window.clearInterval(timer), 30000);
})();
