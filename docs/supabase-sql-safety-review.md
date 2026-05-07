# Supabase SQL 안전 검토

## 0. 목적

`supabase/schema.sql`을 실제 Supabase SQL Editor에 실행하기 전에 충돌, 보안, 권한, 데이터 손상 가능성을 점검한다.

이 문서는 실행 지시서가 아니라 실행 전 검토표다. 실제 DB에는 아직 적용하지 않는다.

---

## 1. 현재 SQL 초안 상태

| 항목 | 상태 |
|---|---|
| 파일 | `supabase/schema.sql` |
| 반영 위치 | `preview-main` |
| 실제 Supabase 실행 | 미실행 |
| 앱 파일 수정 | 없음 |
| main 수정 | 없음 |

---

## 2. 실행 전 반드시 확인할 것

### 2.1 기존 테이블 존재 여부

Supabase SQL Editor에서 먼저 확인해야 한다.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

확인할 테이블:

- companies
- company_members
- company_invites
- company_schedules
- user_settings

판정:

| 결과 | 조치 |
|---|---|
| 같은 이름 테이블 없음 | 신규 생성 가능 |
| 같은 이름 테이블 있음 | 컬럼/데이터 확인 후 마이그레이션 필요 |
| 유사한 기존 테이블 있음 | 중복 구조 방지 필요 |

---

## 3. 기존 RPC 존재 여부 확인

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
order by routine_name;
```

확인할 함수:

- is_active_admin
- can_write_schedule
- list_company_members_rpc
- set_company_member_status_rpc
- update_company_member_role_rpc
- list_company_schedules_rpc
- create_company_schedule_rpc

판정:

| 결과 | 조치 |
|---|---|
| 같은 함수 없음 | 신규 생성 가능 |
| 같은 함수 있음 | 현재 앱에서 쓰는지 확인 필요 |
| 기존 함수와 이름 충돌 | 백업 후 교체 여부 결정 |

---

## 4. 백업 원칙

실행 전에 기존 public 스키마 상태를 확인하고, 이미 테이블이 있으면 백업이 먼저다.

### 최소 백업 확인

- 기존 테이블 목록 캡처
- 기존 RPC 목록 캡처
- 기존 RLS 정책 목록 캡처

RLS 정책 확인:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

---

## 5. 가장 중요한 위험요소

| 위험 | 설명 | 대응 |
|---|---|---|
| 기존 테이블 충돌 | 같은 이름 테이블이 이미 있으면 구조 충돌 가능 | 실행 전 목록 확인 |
| FK 순환 | companies.created_by_member_id와 company_members 관계가 순환될 수 있음 | 생성 순서 검토 |
| RLS 잠김 | RLS enable 후 정책이 없으면 직접 접근이 막힘 | RPC 중심 사용 또는 정책 추가 |
| anon RPC 호출 | 공개 클라이언트에서 security definer RPC 호출 시 위험 | 입력 검증/권한 검증 필수 |
| PIN 해시 | PIN 평문 저장 금지 | 서버에서 해시 저장 |
| 권한 우회 | 프론트 버튼 숨김만으로는 부족 | RPC에서 role/status 검증 |

---

## 6. 현재 schema.sql에 대한 검토 의견

### 좋은 점

- 주요 테이블 5개가 분리되어 있다.
- role/status 체크 제약이 들어가 있다.
- 일정은 soft delete 구조다.
- updated_at 트리거가 있다.
- admin/editor/viewer 권한 판단 함수가 있다.
- 실제 실행 전 체크리스트가 포함되어 있다.

### 보완 필요

| 항목 | 이유 |
|---|---|
| 초대코드 생성 RPC | 현재 초안에는 invite 생성 함수가 없음 |
| 초대코드 수락 RPC | accept_company_invite가 실제로 필요 |
| PIN 해시 방식 | bcrypt/crypt 등 Supabase 내 처리 방식 확정 필요 |
| RLS 정책 | 현재는 enable만 있고 구체 정책 부족 |
| 관리자 최초 생성 | 회사방 생성 + admin 생성 RPC 필요 |
| 다중 기기 | 1회용 코드 후 재접속 정책 추가 필요 |

---

## 7. 실행 가능 판정

현재 SQL은 바로 운영 적용보다는 **검수용 초안**으로 적합하다.

### 지금 바로 실행하면 안 되는 이유

```text
1. 기존 Supabase 구조와 충돌 여부를 아직 확인하지 않았다.
2. 초대코드 생성/수락 RPC가 빠져 있다.
3. PIN 해시 방식이 확정되지 않았다.
4. RLS 정책이 운영 수준으로 완성되지 않았다.
5. 관리자 최초 회사방 생성 흐름이 SQL로 완성되지 않았다.
```

---

## 8. 다음 SQL 작업 순서

### 1단계: 기존 Supabase 상태 조사

- 테이블 목록 확인
- RPC 목록 확인
- RLS 정책 확인
- 현재 앱에서 쓰는 Supabase 함수 확인

### 2단계: schema.sql 보강

추가해야 할 RPC:

- create_company_room_rpc
- create_company_invite_rpc
- accept_company_invite_rpc
- get_current_member_status_rpc
- update_user_settings_rpc
- get_user_settings_rpc

### 3단계: 안전한 적용 파일 분리

권장 파일 구조:

```text
supabase/
├─ schema.sql
├─ rpc-company-room.sql
├─ rpc-invites.sql
├─ rpc-schedules.sql
├─ rls-policies.sql
└─ seed-dev-data.sql
```

### 4단계: preview-main 검수

- SQL 문법 검토
- 기존 함수 충돌 검토
- 보안 검토
- 테스트 시나리오 작성

---

## 9. Supabase 적용 전 체크리스트

- [ ] 기존 테이블 목록 확인
- [ ] 기존 RPC 목록 확인
- [ ] 기존 RLS 정책 확인
- [ ] 기존 데이터 백업 여부 확인
- [ ] PIN 해시 방식 확정
- [ ] 초대코드 생성 RPC 작성
- [ ] 초대코드 수락 RPC 작성
- [ ] 회사방 생성 RPC 작성
- [ ] 사용자 설정 RPC 작성
- [ ] admin/editor/viewer 테스트 시나리오 작성
- [ ] inactive 사용자 차단 테스트 시나리오 작성
- [ ] SQL을 한 번에 실행할지, 파일별로 나눠 실행할지 결정

---

## 10. 최종 판단

현재 `supabase/schema.sql`은 방향은 맞지만, 아직 실행용 최종본은 아니다.

최적의 다음 단계는 다음이다.

```text
기존 Supabase 상태 조사
→ RPC 누락분 보강
→ RLS 정책 분리
→ 테스트 시나리오 작성
→ preview-main에서 검수
→ Supabase SQL Editor에 단계별 적용
```

지금은 SQL을 바로 실행하지 않고, 먼저 기존 Supabase 상태를 확인해야 한다.
