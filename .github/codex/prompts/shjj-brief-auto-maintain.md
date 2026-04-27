AGENTS.md 기준으로 shjj-brief 자동 점검 및 개선을 진행해줘.

목표:
이 프로젝트를 자동으로 점검하고, 허용된 범위 안에서 직접 수정 가능한 문제는 수정해줘.

점검 항목:
1. JSON 유효성 확인
- manifest.json
- data/law_updates.json
- .github/scripts/watched_laws.json

2. JavaScript 문법 확인
- node --check app.js

3. 화면 렌더링 기본 확인
- index.html
- styles.css
- app.js
- data/law_updates.json 로딩 여부

4. 보안 점검
- 사용자 입력 또는 외부 데이터가 innerHTML로 직접 렌더링되는지 확인
- API 키, 토큰, 비밀번호가 코드에 직접 들어갔는지 확인
- 외부 서버 전송 코드가 새로 생겼는지 확인

자동 수정 가능 항목:
- 깨진 JSON 복구
- 명백한 JS 문법 오류 수정
- 화면 렌더링을 깨는 HTML/CSS 오류 수정
- XSS 위험을 줄이는 최소 수정
- 문구/가독성의 명백한 오류 수정

제한:
- main 브랜치 직접 수정 금지
- git push 금지
- git push --force 금지
- API 키, 토큰, 비밀번호 추가 금지
- .env 파일 접근 금지
- 프로젝트 밖 파일 수정 금지
- 대규모 리팩토링 금지
- 기능 추가 금지
- 안정화, 보안, 오류수정 중심으로 진행

수정 후 검증:
- python -m json.tool manifest.json
- python -m json.tool data/law_updates.json
- python -m json.tool .github/scripts/watched_laws.json
- node --check app.js

보고 형식:

# shjj-brief 자동 점검 보고서

## 1. 실행 요약
-

## 2. 발견한 문제
-

## 3. 자동 수정 내용
-

## 4. 검증 결과
- manifest.json:
- law_updates.json:
- watched_laws.json:
- app.js 문법:

## 5. 보안 점검 결과
-

## 6. 윤석만님 확인 필요 사항
-

## 7. 다음 자동화 추천
-
