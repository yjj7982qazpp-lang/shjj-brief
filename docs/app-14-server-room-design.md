# APP-14 서버 기반 회사방/초대코드/개인정보 저장 구조 설계

## 0. 목적

SHJJ Brief의 일정 공유 기능을 현재의 기기별 localStorage 데모 구조에서 벗어나, 회사 단위로 실제 사용할 수 있는 서버 기반 구조로 확장한다.

핵심 목표는 다음과 같다.

- 회사방을 서버에 저장한다.
- 직원별 초대코드와 PIN으로 회사방에 참여한다.
- 관리자만 구성원 초대, 권한 변경, 비활성화를 할 수 있다.
- 직원은 권한에 따라 일정 확인 또는 작성이 가능하다.
- 어떤 기기에서 접속해도 같은 회사방과 일정 정보를 불러온다.
- 초기 MVP에서는 이메일/소셜 로그인을 강제하지 않고 개인정보 수집을 최소화한다.
- 현재 웹/PWA 구조를 유지하되, 향후 iOS/Android 앱 확장에 무리가 없도록 설계한다.

---

## 1. 현재 localStorage 기반 구조의 한계

현재 구조는 브라우저 localStorage에 일정, 회사방 참여 상태, 알림 설정, 구성원 상태를 저장하는 방식이다.

### 한계

| 항목 | 문제 |
|---|---|
| 기기 간 동기화 | 아이폰에서 참여한 회사방이 PC나 갤럭시에서 이어지지 않음 |
| 구성원 관리 | 관리자가 퇴사자를 차단해도 다른 기기 localStorage에는 남을 수 있음 |
| 일정 공유 | 같은 회사 구성원이 동일한 일정을 안정적으로 공유하기 어려움 |
| 데이터 복구 | 브라우저 데이터 삭제 시 회사방 참여 상태와 개인 설정이 사라짐 |
| 보안/권한 | 읽기 전용, 쓰기 가능, 관리자 권한을 서버 기준으로 강제하기 어려움 |
| 앱 확장성 | iOS/Android 앱으로 확장할 때 localStorage 의존 구조는 한계가 큼 |

### 결론

localStorage는 화면 상태, 마지막 선택값, 임시 캐시 정도만 맡고, 회사방/구성원/일정/권한의 원본은 서버 DB가 맡아야 한다.

---

## 2. 서버 기반 회사방 구조

서버에는 회사방을 하나의 독립된 공간으로 저장한다.

기본 구조:

```text
Company Room
├─ Company Members
├─ Company Invites
├─ Company Schedules
└─ User Settings
```

### 기본 원칙

- 회사방은 `companies` 테이블에서 관리한다.
- 구성원은 `company_members` 테이블에서 관리한다.
- 초대코드는 `company_invites` 테이블에서 관리한다.
- 일정은 `company_schedules` 테이블에서 관리한다.
- 개인 설정은 `user_settings` 테이블에서 관리한다.
- localStorage에는 서버에서 받은 현재 접속 상태와 캐시만 저장한다.

---

## 3. 회사방 생성 흐름

초기 MVP에서는 사용자가 앱에서 회사방을 직접 생성하거나, 운영자가 미리 생성한 기본 회사방을 사용하는 방식을 선택할 수 있다.

### MVP 추천 흐름

1. 관리자 사용자가 회사방 생성
2. 서버가 회사방 ID 생성
3. 관리자 멤버 자동 생성
4. 관리자용 초대코드 또는 관리자 PIN 발급
5. 관리자가 직원별 초대코드 생성
6. 직원은 초대코드 + PIN으로 회사방 참여

### 회사방 생성 시 저장값

- 회사명
- 회사방 표시명
- 회사방 고유 ID
- 생성자 멤버 ID
- 생성일
- 활성 상태

---

## 4. 직원별 초대코드 구조

단일 공통 회사 PIN만 쓰면 퇴사자 차단이 어렵다. 따라서 직원별 초대코드를 기본 구조로 한다.

### 추천 구조

```text
초대코드: SHJJ-A1B2C3
PIN: 4~6자리 숫자
```

### 직원별 초대코드를 쓰는 이유

| 방식 | 장점 | 단점 | 판단 |
|---|---|---|---|
| 회사 공통 PIN | 간단함 | 퇴사자 한 명만 차단하기 어려움 | 후순위 |
| 직원별 초대코드 | 개별 차단 가능 | 관리 UI 필요 | MVP 기본안 |
| 이메일 로그인 | 안정적 식별 | 가입 장벽 높음 | 초기에는 제외 |
| 소셜 로그인 | 사용자 식별 쉬움 | 구현/정책 부담 | 후순위 |

### 초대코드 상태

- `active`: 사용 가능
- `used`: 이미 사용됨
- `revoked`: 관리자가 취소
- `expired`: 유효기간 만료

---

## 5. 초대코드 + PIN 방식 유지 여부

초기 MVP에서는 초대코드 + PIN 방식을 유지하는 것이 적합하다.

### 유지 이유

- 이메일/소셜 로그인보다 진입 장벽이 낮다.
- 중소기업 내부 일정 공유에 적합하다.
- 직원별 권한 차단이 가능하다.
- 앱 설치 후 빠르게 회사방에 들어갈 수 있다.

### 보완 필요

- 초대코드는 충분히 랜덤해야 한다.
- PIN은 너무 짧으면 안 된다.
- 관리자 화면에서 초대코드 재발급/비활성화가 가능해야 한다.
- 장기적으로는 기기 토큰 또는 간단한 계정 식별 구조를 붙일 수 있어야 한다.

---

## 6. 관리자 / 읽기 / 쓰기 권한 구조

권한은 3단계로 단순화한다.

| 권한 | 영문값 | 가능 작업 |
|---|---|---|
| 관리자 | `admin` | 회사방 관리, 직원 초대, 권한 변경, 비활성화, 일정 생성/수정/삭제 |
| 쓰기 | `editor` | 일정 확인, 일정 생성/수정 |
| 읽기 | `viewer` | 일정 확인만 가능 |

### 권한 원칙

- 신규 직원은 기본 `viewer`로 시작한다.
- 관리자가 필요 시 `editor`로 승격한다.
- `admin` 권한은 최소 인원에게만 부여한다.
- 권한 검사는 프론트 UI 숨김뿐 아니라 서버 요청 단계에서도 확인해야 한다.

---

## 7. 퇴사자 비활성화 구조

퇴사자는 삭제보다 비활성화를 기본으로 한다.

### 추천 상태값

| 상태 | 의미 |
|---|---|
| `active` | 정상 사용 가능 |
| `inactive` | 접속 차단 |
| `revoked` | 초대/권한 회수 |
| `deleted` | 소프트 삭제 상태 |

### 비활성화 흐름

1. 관리자가 구성원 관리 화면에서 비활성화 클릭
2. 서버에서 해당 멤버의 status를 `inactive`으로 변경
3. 해당 멤버의 초대코드도 `revoked` 처리
4. 사용자가 앱 접속 시 서버 상태 확인
5. `inactive`이면 localStorage 멤버십 제거 후 접근 제한 안내

### 주의

프론트에서 버튼만 숨기는 것은 차단이 아니다. 서버 RPC/API 단계에서 반드시 권한과 상태를 확인해야 한다.

---

## 8. localStorage와 서버 DB 역할 분리

| 구분 | localStorage | 서버 DB |
|---|---|---|
| 회사방 원본 | 저장 금지 | 저장 |
| 구성원 원본 | 저장 금지 | 저장 |
| 일정 원본 | 저장 금지 | 저장 |
| 권한 원본 | 저장 금지 | 저장 |
| 알림 시간 캐시 | 가능 | 저장 |
| 마지막 선택 탭 | 가능 | 선택 |
| 로그인 세션 힌트 | 가능 | 서버 검증 필요 |
| 오프라인 임시 캐시 | 가능 | 원본 아님 |

### 결론

localStorage는 편의용 캐시다. 권한과 데이터의 최종 판단은 서버가 해야 한다.

---

## 9. Supabase 기준 테이블 초안

### 9.1 companies

회사방 정보를 저장한다.

| 컬럼 | 타입 예시 | 설명 |
|---|---|---|
| id | uuid | 회사방 고유 ID |
| name | text | 회사명 |
| display_name | text | 앱 표시명 |
| slug | text | 내부 식별자 |
| status | text | active/inactive |
| created_by_member_id | uuid | 생성자 멤버 ID |
| created_at | timestamptz | 생성일 |
| updated_at | timestamptz | 수정일 |

---

### 9.2 company_members

회사방 구성원을 저장한다.

| 컬럼 | 타입 예시 | 설명 |
|---|---|---|
| id | uuid | 멤버 고유 ID |
| company_id | uuid | 회사방 ID |
| display_name | text | 표시 이름 |
| role | text | admin/editor/viewer |
| status | text | active/inactive/deleted |
| invite_id | uuid | 사용한 초대 ID |
| device_label | text | 선택값, 기기 식별 힌트 |
| last_seen_at | timestamptz | 마지막 접속 |
| created_at | timestamptz | 생성일 |
| updated_at | timestamptz | 수정일 |

개인정보 최소화를 위해 초기에는 이메일, 전화번호, 주민번호 등은 저장하지 않는다.

---

### 9.3 company_invites

직원별 초대코드와 PIN 정보를 저장한다.

| 컬럼 | 타입 예시 | 설명 |
|---|---|---|
| id | uuid | 초대 고유 ID |
| company_id | uuid | 회사방 ID |
| invite_code | text | 초대코드 |
| pin_hash | text | PIN 해시값 |
| role_to_assign | text | 초대 시 부여할 권한 |
| status | text | active/used/revoked/expired |
| created_by_member_id | uuid | 생성한 관리자 |
| used_by_member_id | uuid | 사용한 멤버 |
| expires_at | timestamptz | 만료일 |
| created_at | timestamptz | 생성일 |
| used_at | timestamptz | 사용일 |

PIN은 평문 저장하지 않고 해시 저장을 원칙으로 한다.

---

### 9.4 company_schedules

회사 공유 일정을 저장한다.

| 컬럼 | 타입 예시 | 설명 |
|---|---|---|
| id | uuid | 일정 ID |
| company_id | uuid | 회사방 ID |
| title | text | 일정 제목 |
| description | text | 설명 |
| start_at | timestamptz | 시작일시 |
| end_at | timestamptz | 종료일시 |
| all_day | boolean | 종일 여부 |
| category | text | 업무/개인/법령/기타 등 |
| created_by_member_id | uuid | 작성자 |
| updated_by_member_id | uuid | 수정자 |
| status | text | active/deleted |
| created_at | timestamptz | 생성일 |
| updated_at | timestamptz | 수정일 |

---

### 9.5 user_settings

사용자별 앱 설정을 저장한다.

| 컬럼 | 타입 예시 | 설명 |
|---|---|---|
| id | uuid | 설정 ID |
| member_id | uuid | 멤버 ID |
| company_id | uuid | 회사방 ID |
| notification_time | text | 예: 09:20 |
| weather_location | text | 날씨 기준 위치 |
| law_categories | jsonb | 관심 법령 분야 |
| ui_preferences | jsonb | 접힘/펼침 등 화면 설정 |
| created_at | timestamptz | 생성일 |
| updated_at | timestamptz | 수정일 |

---

## 10. 서버 API / RPC 초안

초기 Supabase RPC 또는 Edge Function 기준으로 다음 기능이 필요하다.

| 기능 | 설명 |
|---|---|
| create_company_room | 회사방 생성 |
| create_company_invite | 직원 초대코드 생성 |
| accept_company_invite | 초대코드 + PIN으로 회사방 참여 |
| list_company_members | 구성원 목록 조회 |
| update_company_member_role | 권한 변경 |
| set_company_member_status | 비활성화/복구 |
| list_company_schedules | 일정 조회 |
| create_company_schedule | 일정 생성 |
| update_company_schedule | 일정 수정 |
| delete_company_schedule | 일정 소프트 삭제 |
| get_user_settings | 개인 설정 조회 |
| update_user_settings | 개인 설정 저장 |

---

## 11. 개인정보 최소 수집 원칙

초기 MVP에서는 다음 정보를 수집하지 않는 것을 기본으로 한다.

- 이메일
- 전화번호
- 생년월일
- 실명 인증 정보
- 주민등록번호
- 위치 실시간 추적 정보

초기에는 다음 정도만 사용한다.

- 표시 이름
- 회사방 참여 정보
- 권한
- 알림 시간
- 마지막 접속 시간

향후 앱스토어/구글플레이 배포 시 개인정보처리방침과 데이터 삭제 요청 절차를 별도로 마련해야 한다.

---

## 12. 기존 SHJJ Brief 일정 기능과 연결 방식

기존 일정 UI는 최대한 유지하고, 데이터 소스만 localStorage에서 서버로 바꾸는 방식이 안전하다.

### 단계별 연결

1. 앱 시작 시 localStorage에서 기존 멤버십 힌트 확인
2. 서버에 현재 멤버 상태 검증 요청
3. active 멤버이면 회사방 일정 로드
4. inactive/revoked이면 localStorage 멤버십 제거
5. 일정 등록 버튼은 role이 admin/editor일 때만 표시
6. viewer는 일정 확인만 가능

### 기존 localStorage 처리

- 기존 사용자 데이터는 즉시 삭제하지 않는다.
- 서버 전환 후에는 localStorage 데이터를 캐시 또는 마이그레이션 후보로만 사용한다.
- 서버 데이터와 충돌하면 서버 데이터를 우선한다.

---

## 13. 모바일 앱 iOS/Android 확장 가능 구조

향후 앱 확장을 고려하면 다음 원칙을 지켜야 한다.

| 항목 | 설계 방향 |
|---|---|
| 데이터 원본 | Supabase DB 또는 서버 API |
| 인증/접속 | 초대코드 기반에서 계정 기반으로 확장 가능하게 설계 |
| 알림 | 웹 Push → iOS/Android Push로 확장 가능하게 설정 분리 |
| UI | 웹/PWA 컴포넌트와 앱 화면 데이터 구조 분리 |
| 권한 | 프론트 숨김이 아니라 서버 권한 검증 중심 |
| 캐시 | 오프라인 캐시는 가능하되 원본은 서버 |

---

## 14. MVP 구현 순서

### 1단계: 서버 회사방/구성원 기반 안정화

- companies 생성
- company_members 생성
- company_invites 생성
- 초대코드 + PIN 참여
- 관리자/쓰기/읽기 권한 구분
- 비활성화 차단

### 2단계: 서버 일정 공유

- company_schedules 생성
- 회사방 일정 조회
- 권한별 일정 등록/수정 제한
- 기존 localStorage 일정과 마이그레이션 여부 검토

### 3단계: 개인 설정/알림 확장

- user_settings 생성
- 알림 시간 서버 저장
- 날씨 위치/관심 법령 설정 저장
- 모바일 앱 Push 확장 고려

---

## 15. 위험요소와 방지책

| 위험요소 | 방지책 |
|---|---|
| main 직접 수정 | feature → preview-main → main 흐름 강제 |
| 권한 우회 | 서버 RPC/API에서 role/status 확인 |
| 퇴사자 접속 | member status와 invite status 동시 차단 |
| 한글 깨짐 | UTF-8 고정, PowerShell 단순 치환 지양 |
| localStorage 충돌 | 서버 데이터 우선 원칙 |
| 데이터 과수집 | 초기 MVP에서 이메일/전화번호 미수집 |
| 앱 확장 어려움 | DB/API/UI 상태 구조 분리 |
| 비용 증가 | 필요한 데이터만 읽고, 불필요한 전체 재분석 금지 |

---

## 16. preview-main 검수 체크리스트

preview-main에 반영하기 전 다음을 확인한다.

### 문서 검수

- [ ] APP-14 범위와 맞는가
- [ ] 초대코드 + PIN 유지 방침이 맞는가
- [ ] admin/editor/viewer 권한 구조가 적절한가
- [ ] 퇴사자 비활성화 구조가 현실적인가
- [ ] Supabase 테이블 초안이 MVP에 충분한가
- [ ] 개인정보 최소 수집 원칙이 반영됐는가
- [ ] iOS/Android 앱 확장 가능성을 해치지 않는가

### 작업 안전 검수

- [ ] main 브랜치를 직접 수정하지 않았는가
- [ ] feature/schedule-mvp 브랜치를 건드리지 않았는가
- [ ] 기존 앱 동작 파일을 불필요하게 수정하지 않았는가
- [ ] 한글 깨짐 문자가 없는가
- [ ] PR 대상이 main이 아니라 preview-main인가

---

## 최종 판단

APP-14의 핵심은 기능 구현보다 데이터 원본 구조를 서버로 옮기는 것이다.

최적 방향은 다음과 같다.

```text
직원별 초대코드 + PIN
→ 서버 회사방 참여
→ 관리자/쓰기/읽기 권한 구분
→ 퇴사자 비활성화
→ 서버 일정 공유
→ 개인 설정/알림 서버 저장
```

초기에는 이메일/소셜 로그인을 넣지 않고, 회사방 + 직원별 초대코드 + PIN 방식으로 가는 것이 가장 가볍고 현실적인 MVP다.
