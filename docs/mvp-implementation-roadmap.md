# SHJJ Brief MVP 구현 로드맵

## 0. 목적

APP-14, APP-11, APP-12에서 정리한 내용을 실제 구현 순서로 연결한다.

이 문서는 바로 코드를 수정하기 위한 문서가 아니라, 다음 개발 단계에서 무엇을 먼저 만들고 무엇을 뒤로 미룰지 정하는 실행 기준이다.

---

## 1. 현재 확정된 방향

| 항목 | 결정 |
|---|---|
| 운영본 브랜치 | main |
| 검수본 브랜치 | preview-main |
| 작업 흐름 | feature → preview-main → main |
| 회사방 방식 | 회사방 + 직원별 초대코드 + PIN |
| 신규 직원 기본 권한 | viewer |
| 일정 작성 가능 권한 | admin, editor |
| 퇴사자 처리 | inactive 비활성화 |
| 데이터 원본 | 서버 DB |
| localStorage 역할 | 캐시/화면 상태 |
| 모바일 UX 기준 | 첫 화면 3초 안에 핵심 정보 파악 |

---

## 2. 구현 우선순위

### 1순위: Supabase 데이터 구조 확정

먼저 DB 테이블을 안정적으로 확정한다.

필수 테이블:

- companies
- company_members
- company_invites
- company_schedules
- user_settings

목표:

- 회사방 원본 저장
- 구성원 원본 저장
- 초대코드와 PIN 저장
- 회사 일정 저장
- 개인 설정 저장

---

### 2순위: 권한 검증 RPC/API 구현

프론트에서 버튼을 숨기는 것만으로는 부족하다. 서버에서 권한을 검증해야 한다.

필수 기능:

- 초대코드 생성
- 초대코드 + PIN 검증
- 구성원 목록 조회
- 권한 변경
- 비활성화/복구
- 일정 조회
- 일정 생성
- 일정 수정
- 일정 삭제 또는 소프트 삭제

---

### 3순위: 기존 일정 UI와 서버 데이터 연결

기존 화면 구조는 최대한 유지하고, 데이터 원본만 서버로 옮긴다.

원칙:

- UI 대개편 금지
- 기존 일정 카드 유지
- 회사방 참여 상태는 서버 검증
- 일정 목록은 company_schedules에서 로드
- 권한별 버튼 노출 제어

---

### 4순위: 모바일 UX 보정

APP-11 기준에 따라 실제 화면에서 밀림/잘림/과도한 정보량을 보정한다.

즉시 볼 것:

- 초대코드/PIN 입력창
- 복사 버튼 위치
- 일정 카드 접힘/펼침
- viewer의 일정 등록 버튼 숨김
- 모바일 320px 폭에서 카드 깨짐 여부

---

### 5순위: 알림/개인 설정 서버 저장

APP-10과 연결되는 후속 작업이다.

- 알림 시간 서버 저장
- 날씨 위치 저장
- 관심 법령 카테고리 저장
- UI 접힘/펼침 선호 저장

---

## 3. 실제 개발 단계

### Phase 1: DB/RPC 설계 및 SQL 작성

작업 파일 후보:

- `supabase/schema.sql`
- `supabase/rpc-company-room.sql`
- `supabase/rpc-company-schedule.sql`

검수 기준:

- SQL이 한글 파일을 깨뜨리지 않아야 한다.
- 기존 앱 파일은 아직 수정하지 않는다.
- preview-main 기준으로 문서/SQL만 먼저 검수한다.

---

### Phase 2: 서버 연결 모듈 분리

작업 파일 후보:

- `supabase-company-room.js`
- `supabase-schedule-sync.js`
- `supabase-invite.js`
- `supabase-member-admin.js`

검수 기준:

- 기존 함수와 충돌하지 않는다.
- 서버 실패 시 화면이 무너지지 않는다.
- localStorage는 캐시로만 사용한다.

---

### Phase 3: 권한별 UI 적용

작업 파일 후보:

- `app.js`
- `styles.css`
- `member-admin-polish.css`

검수 기준:

- admin은 구성원 관리 가능
- editor는 일정 작성 가능
- viewer는 일정 확인만 가능
- inactive는 접근 차단
- 모바일 버튼 밀림 없음

---

### Phase 4: 모바일 실기기 검수

검수 기기:

- 아이폰 Safari
- 아이폰 PWA 홈화면 추가 모드
- 갤럭시 Chrome
- 갤럭시 Fold 계열 큰 화면

검수 항목:

- 첫 화면 3초 기준
- 초대코드/PIN 입력
- 일정 등록 버튼 노출
- 일정 카드 접힘/펼침
- 퇴사자 차단

---

## 4. 지금 당장 하지 않을 것

| 항목 | 이유 |
|---|---|
| 이메일 로그인 | 초기 MVP에 무거움 |
| 소셜 로그인 | 정책/구현 부담 큼 |
| 관리자 분석 페이지 | 광고/사용자수 단계 이후 |
| 커뮤니티 기능 | 장기 확장 항목 |
| 디자인 대개편 | 기능 안정화 이후 |
| main 직접 배포 | preview-main 검수 후만 가능 |

---

## 5. 다음 작업 추천

다음 작업은 코드 구현이 아니라 SQL/RPC 설계 문서 또는 SQL 초안 작성이다.

추천 다음 이슈:

```text
Supabase 회사방/구성원/초대코드/일정 테이블 SQL 초안 작성
```

추천 작업 순서:

1. `supabase/schema.sql` 초안 작성
2. `companies`, `company_members`, `company_invites`, `company_schedules`, `user_settings` 생성문 작성
3. role/status 체크 제약 작성
4. 인덱스 작성
5. RLS/RPC 적용 여부 검토
6. preview-main에서 문서/SQL 검수

---

## 6. 최종 판단

현재 SHJJ Brief는 다음 단계로 넘어갈 준비가 됐다.

```text
문서 설계 완료
→ Supabase DB/RPC 초안
→ 서버 연결 모듈
→ 권한별 일정 UI
→ 모바일 실기기 검수
→ preview-main 안정화
→ main 승격
```

이제 가장 중요한 것은 UI를 막 수정하는 것이 아니라, 서버 데이터 구조를 안정적으로 잡는 것이다.
