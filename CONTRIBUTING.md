# 협업 가이드 — 너만·알맡

이 문서는 새로운 협업자가 프로젝트를 빠르게 이해하고 기여할 수 있도록 작성되었습니다.

---

## 프로젝트 한 줄 요약

Discord `/인증` 슬래시 커맨드로 챌린지 참가자가 콘텐츠 링크를 제출하면, 자동으로 Google Sheets에 기록하고 Discord에 완료 메시지를 보내는 봇 시스템입니다. 공개 대시보드는 GitHub Pages에서 정적으로 배포됩니다.

---

## 시스템 아키텍처

```
사용자: /인증 입력 (Discord)
  └→ Supabase Edge Function (discord-verify)
       │
       ├── [즉시] Ed25519 서명 검증 — Discord 보안 요구사항
       ├── [즉시] 모달 응답 (type=9) — 링크 1~5개 입력 팝업
       │
       └── [모달 제출 후 백그라운드]
             ├── detectPlatform(url) — 도메인 기반 플랫폼 분류
             ├── fetchOGSummary(url) — HTML head 파싱으로 제목 추출
             ├── callGemini(url)     — OG 파싱 실패 시 AI 요약 fallback
             ├── appendToSheets()    — Google Sheets 행 추가
             └── sendFollowup()      — Discord 완료 메시지 전송
```

보안상 공개 웹페이지에서 `web-verify`를 직접 호출하는 방식은 중단했습니다. `web-verify`는 서버 대 서버 자동화 전용으로만 유지합니다.

### 핵심 설계 원칙

- **3초 제한 대응**: Discord는 인터랙션 응답을 3초 안에 받아야 합니다. 모달 제출 시 `{"type":5}`로 즉시 응답하고, 실제 처리는 `EdgeRuntime.waitUntil()`로 백그라운드에서 실행합니다.
- **비공개 인증 지원**: `/인증 blind` 옵션 시 URL 요약을 생략하고 플랫폼명만 기록합니다.
- **주차 자동 계산**: KST 기준 2026-03-02 발행 시작일부터 주차를 계산합니다.

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| Edge Function | Deno (TypeScript), Supabase Functions |
| Dashboard | GitHub Pages, 정적 HTML/JS |
| 서명 검증 | Ed25519 (Web Crypto API) |
| URL 요약 | OG 태그 파싱 → Gemini 2.5 Flash fallback |
| 데이터 저장 | Google Sheets v4 API (Service Account) |
| 봇 인터페이스 | Discord Interactions API v10 |

---

## 플랫폼 분류 규칙

| 도메인 | 분류 |
|--------|------|
| `linkedin.com` | LinkedIn |
| `instagram.com` | Instagram |
| `threads.net`, `threads.com` | Threads |
| `youtube.com`, `youtu.be` | YouTube |
| `tiktok.com` | TikTok |
| `brunch.co.kr` | Brunch |
| 그 외 | Blog |

---

## Google Sheets 컬럼 구조

| A: date | B: user | C: platfrom* | D: link | E: number | F: summary | G: etc |
|---------|---------|-------------|---------|-----------|------------|--------|
| YYYY-MM-DD | 닉네임 | 플랫폼 | URL | 1주차-1회 | 요약 | public/private |

> *`platfrom`은 오타이지만 기존 데이터와의 호환성을 위해 그대로 유지합니다.

---

## 로컬 개발 환경 설정

### 필수 도구

```bash
# Supabase CLI
brew install supabase/tap/supabase

# Deno (타입 체크 용)
brew install deno
```

### 저장소 클론

```bash
git clone https://github.com/ggplab/content_designer_challenge.git
cd content_designer_challenge
```

### Supabase 프로젝트 연결

```bash
supabase link --project-ref tcxtcacibgoancvoiybx
```

> 연결 시 Supabase 계정 접근 권한이 필요합니다. 관리자(@limjung)에게 collaborator 초대를 요청하세요.

### 시크릿 설정

실제 키 값은 별도 채널(Discord)로 전달받습니다. 받은 값으로 아래 명령어를 실행하세요.

```bash
supabase secrets set DISCORD_PUBLIC_KEY=<받은_값>
supabase secrets set DISCORD_APPLICATION_ID=1474072217447829514
supabase secrets set DISCORD_BOT_TOKEN=<받은_값>
supabase secrets set GEMINI_API_KEY=<받은_값>
supabase secrets set GOOGLE_SHEET_ID=1CKyVexXErtbkAVm6I-30fh3tei6J4B9HtCjq0-fmvvU
supabase secrets set GCP_SERVICE_ACCOUNT_JSON=<받은_값>
supabase secrets set WEB_VERIFY_API_KEY=<받은_값>
supabase secrets set WEB_VERIFY_ALLOWED_ORIGINS=https://ggplab.github.io/content_designer_challenge,https://ggplab.github.io,http://localhost:4173
supabase secrets set WEB_VERIFY_RATE_LIMIT_WINDOW_MS=600000
supabase secrets set WEB_VERIFY_RATE_LIMIT_MAX=20
```

`WEB_VERIFY_API_KEY`는 브라우저 코드, 정적 HTML, 공개 문서, 예제 curl에 넣지 않습니다.
이 키는 서버 환경 변수 또는 비밀 저장소에서만 읽어야 합니다.
`web/app-config.js`에는 Supabase URL과 publishable key만 설정합니다.
로그인 후 `account.html`에서 본인 참가자 이름을 직접 연결할 수 있습니다.
배포 순서는 `docs/auth-deploy-checklist.md`를 기준으로 진행하세요.

---

## 배포

```bash
supabase functions deploy discord-verify \
  --project-ref tcxtcacibgoancvoiybx \
  --no-verify-jwt

supabase functions deploy web-verify \
  --project-ref tcxtcacibgoancvoiybx \
  --no-verify-jwt
```

> `--no-verify-jwt`: Discord 서명 검증은 코드 내부에서 처리하므로 Supabase JWT 검증은 비활성화합니다.

배포 후 Discord Developer Portal에서 Interactions Endpoint URL이 유효한지 확인하세요:
```
https://tcxtcacibgoancvoiybx.supabase.co/functions/v1/discord-verify
```

---

## 개발 워크플로우

```
main ── feat/my-feature ── PR → main
```

1. `main`에서 브랜치 생성: `git checkout -b feat/my-change`
2. 변경 후 커밋: `git commit -m "feat: 설명"`
3. 푸시 후 PR 생성 (CI 자동 실행됨)
4. 머지 전 리뷰 요청

### 커밋 컨벤션

```
feat:   새 기능
fix:    버그 수정
docs:   문서 수정
refactor: 로직 변경 없는 코드 정리
chore:  빌드/설정 변경
```

---

## 자주 발생하는 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| Discord Endpoint 검증 실패 | JWT 인증 활성화됨 | `--no-verify-jwt` 옵션 포함해서 재배포 |
| Google 인증 오류 | SA JSON의 `\n`이 실제 줄바꿈으로 저장됨 | 코드 내 `replace(/\r?\n/g, "\\n")` 처리 확인 |
| Sheets 저장 안 됨 | Service Account 권한 없음 | Sheets 공유에 SA 이메일을 편집자로 추가 |
| follow-up 메시지 없음 | interaction token 만료(15분) | Supabase 로그 확인: `supabase functions logs discord-verify` |
| 모달이 뜨지 않음 | Interactions Endpoint 미연결 | Discord Dev Portal에서 URL 재등록 |
| web-verify 403 | 허용되지 않은 Origin 또는 등록되지 않은 이름 | `WEB_VERIFY_ALLOWED_ORIGINS`, 참가자 목록 확인 |
| web-verify 429 | 요청 과다 | `WEB_VERIFY_RATE_LIMIT_*` 설정 또는 호출 빈도 조정 |
| web-verify 400 | 허용되지 않은 URL 도메인 | LinkedIn, Instagram, Threads, YouTube, TikTok, Brunch, 등록된 블로그 도메인만 사용 |

---

## Supabase 로그 확인

```bash
supabase functions logs discord-verify --project-ref tcxtcacibgoancvoiybx
```

---

## 디렉토리 구조

```
content_designer_challenge/
├── supabase/
│   ├── functions/
│   │   ├── discord-verify/
│   │   │   └── index.ts          ← Discord 인터랙션 처리
│   │   ├── web-verify/
│   │   │   └── index.ts          ← 서버 전용 자동화 엔드포인트
│   │   ├── claim-member-profile/
│   │   ├── create-api-key/
│   │   ├── list-api-keys/
│   │   └── revoke-api-key/
│   ├── migrations/
│   └── config.toml
├── web/
│   ├── account.html              ← 로그인 / API 키 관리 페이지
│   ├── account.js
│   ├── app-config.js             ← Supabase 공개 설정
│   ├── index.html                ← 공개 대시보드
│   ├── dashboard-data.js
│   └── members.json
├── docs/
│   ├── supabase-edge-function-discord-guide.md
│   ├── google_sheets_schema.md
│   └── technical_report_2026-02-23.md
├── config/
│   └── challenge_config.json
├── secrets/                      ← .gitignore 처리 (절대 커밋 금지)
├── deprecated/
│   └── n8n/                      ← 구버전 n8n 워크플로우 (참고용)
├── CLAUDE.md                     ← AI 작업 가이드
├── CONTRIBUTING.md               ← 이 파일
└── README.md
```

---

## 보안 수칙

- `secrets/` 폴더는 `.gitignore` 처리되어 있습니다. 절대 git에 추가하지 마세요.
- API 키, 토큰, SA JSON을 코드에 하드코딩하지 마세요.
- 모든 민감 정보는 `supabase secrets set`으로만 관리합니다.
- 키가 실수로 노출되었다면 즉시 폐기하고 재발급하세요.
- 공개 웹페이지에서 인증 요청을 직접 보내지 마세요. 참가자 인증은 Discord `/인증`만 사용합니다.
- `web-verify`는 서버 대 서버 호출만 허용합니다. Origin 제한, rate limit, URL allowlist를 우회하려고 하지 마세요.

---

## 연락처

- 프로젝트 오너: @limjung (GitHub)
- Discord 서버: 넌 만들기만하고 알고리즘에 맡겨 (ID: 1473868607640305889)
