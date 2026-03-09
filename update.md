# 업데이트 내역

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
