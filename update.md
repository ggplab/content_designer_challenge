# 업데이트 이력

> 날짜별 이력은 `changelog/YYYY-MM-DD.md`에서 관리합니다. 미해결 이슈는 `bugs/open/`을 확인하세요.

| 날짜 | 주요 내용 |
|------|-----------|
| [2026-03-19](changelog/2026-03-19.md) | 주간 정산 Edge Function 추가 — 주차별 인증 집계·추천 콘텐츠·Discord 임베드 전송 |
| [2026-03-18](changelog/2026-03-18.md) | changelog 아카이빙 구조 신설, Discord 메시지 항상 새 메시지로 전송 |
| [2026-03-17](changelog/2026-03-17.md) | Discord OAuth 로그인, 사용자별 API 키, 워밍업 cron |
| [2026-03-16](changelog/2026-03-16.md) | 보안 구조 변경, web-verify 강화 |
| [2026-03-13](changelog/2026-03-13.md) | 안예지 멤버 추가, 유닛테스트 15개 통과 |
| [2026-03-12](changelog/2026-03-12.md) | API 키 인증 보안 강화 |
| [2026-03-11](changelog/2026-03-11.md) | 온보딩 인포그래픽, 제출자 멘션/메달 기능 |
| [2026-03-10](changelog/2026-03-10.md) | 웹 인증 폼, 멤버 자동 sync |
| [2026-03-09](changelog/2026-03-09.md) | 멤버 관리 중앙화, URL 요약 로직 개선 |
| [2026-03-08](changelog/2026-03-08.md) | 웹사이트 최초 기능 목록 |

---

## 2026-03-17

### 신규 기능
- **Discord OAuth 웹 로그인 도입** — `account.html`에서 Discord 계정으로 로그인하고 참가자 이름을 연결할 수 있는 계정 페이지 추가 (`web/account.html`, `web/account.js`)
- **사용자별 API 키 발급 기능 추가** — 발급, 조회, 폐기용 Edge Function 추가 (`create-api-key`, `list-api-keys`, `revoke-api-key`)
- **참가자 이름 셀프 연결 기능 추가** — 로그인한 사용자가 `claim-member-profile`로 본인 참가자 이름을 직접 연결 가능
- **인증/키 관리 DB 스키마 추가** — `challenge_members`, `member_profiles`, `api_keys`, `api_audit_logs` 및 RLS 정책 반영 (`supabase/migrations/20260316143000_web_auth_api_keys.sql`)

### 변경사항
- **`web-verify` 인증 모델 전환** — 공용 API 키 비교에서 세션 또는 사용자별 API 키 기반 식별로 변경, 본인 이름만 제출 가능하도록 검증 강화
- **계정 페이지 UX 개선** — API 키 이름 자동 입력, 만료일 3개월 기본값, 발급 직후 키 표시/복사 버튼 추가
- **대시보드 진입점 확장** — 메인 페이지에서 계정/API 키 관리 페이지로 이동 버튼 추가 (`web/index.html`)
- **배포 및 운영 문서 보강** — 웹 로그인/API 키 설계안, 배포 체크리스트, 함수 일괄 배포 스크립트 추가
- **CI 확장** — 새 Edge Function들(`claim-member-profile`, `create-api-key`, `list-api-keys`, `revoke-api-key`)도 `deno check` 대상에 포함
- **시스템 아키텍처 다이어그램 추가** — `docs/architecture.md`에 시퀀스·컴포넌트·DB 스키마 Mermaid 다이어그램 작성 및 GitHub 렌더링 확인
- **README 아키텍처 섹션 개선** — ASCII 텍스트에서 Mermaid 컴포넌트 다이어그램으로 교체, `docs/architecture.md` 링크 추가

### 인프라
- **Supabase 원격 DB 반영 완료** — 인증/키 관리 마이그레이션을 원격 프로젝트에 적용
- **인증 관련 Edge Function 재배포 완료** — `discord-verify`, `web-verify`, `claim-member-profile`, `create-api-key`, `list-api-keys`, `revoke-api-key`
- **Discord OAuth Provider 설정 완료** — Supabase Auth와 Discord Developer Portal redirect 설정 반영
- **웹 공개 설정 반영** — `web/app-config.js`에 Supabase URL/functions URL 및 publishable key 설정

### 개발환경 개선
- **Claude 스킬 modern 포맷 마이그레이션** — `.claude/commands/*.md` 레거시 포맷을 `.claude/skills/*/SKILL.md` 구조로 전환, YAML 프론트매터(name, description) 추가
- **사이드이펙트 스킬 보호** — `정리`·`멤버추가` 스킬에 `disable-model-invocation: true` 추가 (git push·Discord 전송을 Claude가 자동 호출하지 못하도록)
- **결정론적 실행 스크립트 추가** — 각 스킬에 bash 스크립트 분리 (`git-push.sh`, `discord-send.sh`, `run.sh`, `test.ts`) — Claude는 내용 생성만, 기계적 실행은 스크립트로 위임
- **글로벌 CLAUDE.md에 스킬 작성 규칙 추가** — modern 포맷 강제, 사이드이펙트 플래그 기준 명시

### 운영 메모
- **Supabase 시크릿명 조정** — `SUPABASE_SERVICE_ROLE_KEY` 대신 커스텀 시크릿 `SERVICE_ROLE_KEY`를 사용하도록 코드/문서 수정
- **공개 가능한 키와 비공개 키 분리 정리** — `app-config.js`에는 publishable key만 두고, service role key와 사용자 API 키는 Edge Function 시크릿으로만 관리

### 버그 수정
- **Discord `/인증` 모달 간헐적 미표시 수정** — Edge Function 콜드 스타트(Deno 런타임 재부팅)가 Discord 3초 응답 제한을 초과해 모달이 뜨지 않던 문제 해결
  - `discord-verify`에 GET 헬스체크 엔드포인트 추가 (`index.ts`: GET 요청 시 즉시 `200 OK` 반환)
  - pg_net · pg_cron 확장 활성화 후 5분마다 워밍업 cron job 등록 (`warmup-discord-verify`, `*/5 * * * *`)

---

## 2026-03-16

### 보안 구조 변경
- **공개 웹 인증 중단** — 대시보드에서 브라우저가 `web-verify`를 직접 호출하던 기능 제거
- **API 키 노출 제거** — `web/index.html`에서 공개 API 키, 예제 curl, 복사 UI 제거
- **인증 UX 변경** — 상단 버튼을 Discord `/인증` 안내 모달로 전환

### `web-verify` 보안 강화
- **Origin 제한 추가** — `WEB_VERIFY_ALLOWED_ORIGINS` 기반으로 허용 도메인만 CORS 응답
- **요청 빈도 제한 추가** — IP 기준 in-memory rate limit 적용 (`WEB_VERIFY_RATE_LIMIT_WINDOW_MS`, `WEB_VERIFY_RATE_LIMIT_MAX`)
- **URL allowlist 적용** — LinkedIn, Instagram, Threads, YouTube, TikTok, Brunch 및 등록된 블로그 계열만 허용
- **로컬 공개 클라이언트 차단** — 정적 사이트/문서에 `Authorization: Bearer ...` 형태 키를 싣지 않는 구조로 정리

### 문서 정리
- **README 갱신** — Discord 인증 중심 구조, 서버 전용 `web-verify`, 신규 시크릿 설정 반영
- **CONTRIBUTING 갱신** — 협업자용 보안 원칙, `WEB_VERIFY_*` 환경변수, 장애 대응 항목 추가
- **웹 로그인/API 키 설계 문서 추가** — `docs/web-auth-api-key-plan.md`

### 인증 기반 작업 시작
- **계정 페이지 추가** — `web/account.html`, `web/account.js`, `web/app-config.js`
- **API 키 관리 함수 추가** — `create-api-key`, `list-api-keys`, `revoke-api-key`
- **DB 마이그레이션 추가** — `member_profiles`, `api_keys`, `api_audit_logs` 및 RLS 정책
- **`web-verify` 인증 모델 전환 시작** — 세션 또는 사용자별 키 기반 식별, 감사 로그 기록

### 운영 메모
- 기존에 노출됐던 `WEB_VERIFY_API_KEY`는 반드시 폐기 후 재발급 필요
- `web-verify`는 이제 참가자용 공개 UI가 아니라 서버 대 서버 자동화 전용 엔드포인트

---

## 2026-03-13

### 멤버 변경사항
- **안예지 (nunnu) 신규 추가** — 2주1회 (`web/members.json`)
- **이선정 (tidyline) 이미 등록 확인** — 추가 없이 패스
- **nunnu 이름 오기 수정** — GitHub Actions 자동 sync 봇이 `"name": "nunnu"`로 잘못 추가한 것을 `"안예지"`로 수정

### 인프라
- **`discord-verify` Edge Function 재배포** — `export $(cat .env | xargs)` 방식으로 `.env` 토큰 로드 후 배포
- **GitHub Pages 자동 배포 확인** — `push` 후 `Deploy Pages` 워크플로우 자동 실행 및 성공 확인

### 유닛테스트
- **Edge Function 핵심 로직 15개 전체 통과** — `getWeekLabel`(4), `detectPlatform`(6), `getMedal`(4), URL 필터(1)

### 변경사항
- **상위 `CLAUDE.md` 배포 설정 수정** — "Netlify" → "GitHub Pages (gh-pages 브랜치)"로 변경
- **`deno` 경로 확인** — `~/.deno/bin/deno`로 직접 호출 필요 (PATH 미등록 환경)
- **Supabase 배포 시 `.env` 로드 방법 확정** — `export $(cat .env | xargs) &&` 선행 필요

---

## 2026-03-12

### 신규 기능
- **API 인증 연동 엔드포인트 보안 강화** — `web-verify` Edge Function에 API 키 인증 추가 (`Authorization: Bearer` 또는 `x-api-key` 헤더)
- **참가자 검증** — 등록되지 않은 이름으로 API 요청 시 403 반환 (VALID_NAMES 목록 기반)
- **"🔗 API로 인증 연동" 버튼** — 대시보드 웹페이지에 추가, 클릭 시 모달 팝업
- **API 정보 모달** — 엔드포인트 URL / API 키(마스킹+표시 토글) / JSON 예시 / curl 예시를 원클릭 복사 버튼과 함께 제공
- **웹 인증 폼 API 키 연동** — 기존 "콘텐츠 인증하기" 폼도 API 키 헤더 자동 포함

### 변경사항
- **`supabase/functions/web-verify/index.ts`** — `WEB_VERIFY_API_KEY` 시크릿 검증 로직 추가, CORS에 `Authorization`/`x-api-key` 헤더 허용
- **`web/index.html`** — API 연동 버튼 + 모달 HTML/CSS/JS 추가, `submitVerify()`에 Authorization 헤더 추가
- **Supabase 시크릿** — `WEB_VERIFY_API_KEY` 등록 및 `web-verify` 재배포

---

## 2026-03-11

### 신규 파일
- **`docs/onboarding-infographic.html`** — 신규 참가자 온보딩 인포그래픽 HTML 소스 (가로형 4단계 여정 레이아웃)
- **`docs/onboarding-infographic.png`** — Discord 공유용 인포그래픽 이미지 (1920×827px, 2x 레티나)

### 변경사항
- **온보딩 인포그래픽 설계** — 텍스트 위주 공지를 시각적 유저 여정 맵으로 전환
  - 4단계 흐름: 공지 확인 → 자기소개 작성 → 설문조사 제출 → 매주 챌린지 인증
  - Discord 최적 비율(2.3:1) 가로형 레이아웃 — Discord 채팅창 너비에 맞게 크게 표시
  - 미니멀 디자인, 채널 태그 / `/인증` 커맨드 태그 포함
  - Rules 바 (하단 다크 섹션) — 핵심 규칙 4개 한눈에
- **Discord 공지 채널 채널 ID 확인** — `#자기소개-목표-제출`(1474087756144705607), `#챌린지-인증`(1473868708261658695)

### 기타
- Discord 이미지 표시 스펙 조사 — 커뮤니티 표준 16:9(1920×1080) 확인, 높이 제한으로 가로형이 최적임을 검증
- 온보딩 공지 아래 붙일 복사용 텍스트 블록 작성 (채널 멘션 + 설문/시트/대시보드 링크)

### 신규 기능 (2차)
- **인증 시 제출자 멘션** — Discord 인증 완료 메시지에서 `<@userId>` 태그로 멘션 (`discord-verify/index.ts`, `web-verify/index.ts`)
- **주차별 순위 메달** — 해당 주차 서버 전체 기준 1/2/3번째 제출자에게 🥇🥈🥉 표기 (두 함수 모두 적용)
- **웹 인증 → Discord 채널 전송** — 웹사이트 인증 시 `#챌린지-인증`에 메시지 자동 전송 (`web-verify/index.ts`, `DISCORD_BOT_TOKEN` 시크릿 추가)
- **설문 미작성 멤버 자동 프로필 카드** — 인증 기록만 있어도 대시보드에 프로필 카드 자동 생성 (`web/index.html`)
- **`/유닛테스트` 스킬** — Edge Function 핵심 로직 15개 자동 테스트 (주차 계산, 플랫폼 감지, 메달, URL 필터)
- **`/정리` 스킬 개선** — Discord 채널에서 오늘 메시지를 직접 조회해 중복 전송 대신 기존 메시지 수정 (PATCH)

### 버그 수정 (2차)
- **web-verify 401 오류** — `--no-verify-jwt` 누락으로 웹 인증 요청이 차단되던 문제 수정

### 멤버 변경사항
- **서영학님 LinkedIn 링크 등록** — `web/members.json`에 `https://www.linkedin.com/in/inspire12/` 추가

---

## 2026-03-10

### 신규 기능
- **웹 인증 폼** — 상단 "콘텐츠 인증하기" 버튼 클릭 시 모달 팝업으로 링크 제출 가능 (Discord `/인증`과 동일한 처리)
- **멤버 자동 sync** — 매일 자정 KST GitHub Actions가 Google Sheets의 새 닉네임을 감지해 `members.json`에 자동 추가
- **`/멤버추가` 슬래시 커맨드** — Claude Code에서 신규 참가자를 빠르게 추가하는 커맨드
- **Discord 업데이트 이력 알림** — `/정리` 실행 시 Discord `#업데이트-이력` 채널에 자동 전송

### 버그 수정
- **플랫폼-링크 매핑 오류** — `threads.com` URL이 Blog로 잘못 분류되던 문제 수정 (임정, 서영학, 이선정 영향)
- **설문 링크 컬럼 범위 오류** — 브런치 컬럼(col16) 누락으로 링크 유실되던 문제 수정
- **설문 링크 컬럼 순서 의존 제거** — 고정 컬럼 인덱스 대신 URL 자체로 플랫폼 감지하도록 변경 (시트 구조 변경에도 안전)
- **추가 링크 유실** — `extraTagHtml`이 `memberLinks`만 보던 것을 `mergedLinks` 기준으로 수정
- **CI 타입체크 에러** — Deno v2 `Uint8Array<ArrayBuffer>` 타입 호환성 및 `EdgeRuntime` 미정의 오류 수정 (`discord-verify/index.ts`, `.github/workflows/ci.yml`)

### 변경사항
- **비공개 인증 요약 생략** — 비공개(blind) 제출 시 OG 파싱/Gemini 요약을 스킵하고, Discord·웹 메시지에서 요약 텍스트 미표시 (`discord-verify/index.ts`, `web-verify/index.ts`, `web/index.html`)
- **최근 인증 타임라인 비공개 요약 숨김** — 비공개 인증 건은 타임라인에서 요약 텍스트 빈 칸 처리 (`web/index.html`)
- **인증 폼 입력 필드** — Discord 닉네임 → 실명(이름) 입력으로 변경 (로그인 기능 연동 대비)
- **선언 플랫폼 흑백 아이콘 복원** — 링크 없는 선언 플랫폼은 grayscale로 표시
- **Netlify 설정 파일 제거** — `web/.netlify/`, `web/netlify.toml` 삭제 (GitHub Pages로 이전 완료)

### 멤버 변경사항
- 이선정 (tidyline) 신규 추가 — 2주1회
- 박수빈 인증 빈도 변경 — 2주1회 → 주1회 (`config/challenge_config.json`, `web/members.json`)

### 협업 환경
- **`CONTRIBUTING.md` 신규 추가** — 협업자 온보딩 문서 작성 (아키텍처, 로컬 셋업, 배포, 트러블슈팅, 보안 수칙 포함)
- **`secrets/collaborator-onboarding.md` 생성** — 협업자에게 디스코드로 전달할 시크릿 키·접근 정보 패키지 (gitignore 보호, 레포 미포함)

### 인프라
- `supabase/functions/web-verify` 신규 Edge Function 배포 — 웹 인증 폼 처리
- `supabase/functions/discord-verify` 재배포 — 비공개 요약 생략 반영
- `supabase/functions/web-verify` 재배포 — 비공개 요약 생략 반영
- `.github/workflows/ci.yml` — web-verify 타입체크 추가
- `.github/workflows/sync-members.yml` — 멤버 자동 sync 워크플로우 추가
- `scripts/sync-members.js` — Sheets에서 새 닉네임 감지 스크립트

---

## 2026-03-09

### 멤버 관리 중앙화
- `web/members.json` 신규 생성 — 참가자 목록, 닉네임맵, 링크를 단일 파일로 관리
- `web/index.html` 하드코딩 제거 → `members.json` 동적 fetch로 교체
  - `ALL_PARTICIPANTS`, `BIWEEKLY_MEMBERS`, `NICKNAME_MAP` 모두 config 기반으로 전환
  - 격주 멤버는 `freq: "2주1회"` 로 자동 분류
- `config/challenge_config.json` participants 배열 추가 (백엔드 참고용)

### 멤버 변경사항
- 이인영 (팝콘) 신규 추가 — 주1회, LinkedIn: https://www.linkedin.com/in/2innnnn0/
- 강예정 인증 빈도 변경 — 주1회 → 2주1회
- 신지혜 브런치 링크 추가 — https://brunch.co.kr/@smol
- 박수빈 블로그 링크 추가 — https://soobing.github.io/posts/

### URL 요약 로직 개선 (Edge Function)
- 기존: Gemini `google_search` 도구 사용 → JSON 파싱 불안정, 소셜 플랫폼 접근 불가
- 변경: OG 태그 파싱 1순위 (Discord 미리보기와 동일 방식)
  - Discordbot User-Agent로 fetch → `og:title` / `twitter:title` / `<title>` 순으로 파싱
  - 5초 타임아웃, head 섹션(50KB)만 읽어 성능 최적화
- 실패 시 Gemini fallback — `google_search` 제거, `responseMimeType: "application/json"` 구조화 출력

### 브런치 아이콘 교체
- 기존: 블로그와 동일한 SVG
- 변경: 실제 브런치 로고 (검정 사각형 + 흰색 b 마크)

### 프로필 카드 개선
- `members.json`에 링크가 있으면 설문 플랫폼 목록에 없어도 아이콘 자동 표시
- 설문 미작성 멤버도 `members.json` 링크가 있으면 카드 표시

---

## 2026-03-08

### 웹사이트 최초 기능 목록
- 챌린지 통계 대시보드 (참가자 수, 총 인증 수, 현재 주차, 인기 플랫폼)
- 리더보드 — 참가자별 주차 그리드, 격주 스킵/미제출/미래 주차 구분 표시
- 참가자 프로필 카드 — 주제, 발행 주기, KPI, 플랫폼 링크
- 최근 인증 타임라인 — 비공개 인증 링크 비노출 처리
- Google Sheets gviz 실시간 연동
- 라이트/다크 모드 (localStorage 유지)
- 반응형 UI
