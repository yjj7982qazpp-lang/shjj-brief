# SHJJ Brief 진행 기록

## 현재 운영 구조

- 운영본: main
- 후보 작업본: feature 브랜치
- 현재 최신 후보: feature/v3-law-detail-cards
- 배포: Cloudflare Pages
- 법령 자동 업데이트: Auto Law Brief Update 유지
- AI 자동 유지보수: shjj-brief AI Auto Maintain 일시정지

## 완료된 작업

### v1
- 법령 자동 수집 기본 구조 구축
- 관심 법령 기준 수집 구조 적용
- GitHub Actions로 PC 꺼져 있어도 자동 업데이트 가능

### v2
- data/law_updates.json에 metadata/items 구조 추가
- 마지막 갱신 시간 표시
- 전체 저장 건수 표시
- UI 정리
- 코드 클린업
- main 반영 완료

### v3
- 법령 상세 카드 추가
- 최근 30일 탭 법령 카드 접기/펼치기
- 시행일/공포일/유예기간 표시
- 알림 시간 설정 UI 추가
- 브라우저 제목 구분
- Promote Preview to Main 워크플로 추가
- preview 제목이 main에 들어갈 때 SHJJ Brief - MAIN으로 자동 변환되도록 개선

## 운영 규칙

- main은 실제 운영본
- feature 브랜치는 후보 작업본
- 후보 작업 후 preview 확인
- 괜찮으면 GitHub Actions의 Promote Preview to Main 실행
- main 반영 후 Cloudflare Production 자동 배포

## 다음 과제

### v4 후보
- 법령 목록 API 수준을 넘어서 상세 본문/개정문/제개정이유/조문변경여부 수집
- “제 몇 조가 어떻게 바뀌었는지” 카드에 표시
- 조항별 링크 또는 신구조문대비표 연동 검토

### v5 후보
- 실제 휴대폰 푸시 알림 연동
- 사용자가 설정한 알림 시간에 맞춰 알림 발송

### v6 후보
- 관심 법령 관리 UI
- watched_laws.json을 직접 수정하지 않고 화면에서 추가/삭제