# 너만·알맡 챌린지 자동화 시스템

> "너 만들기만하고, 알고리즘에 맡겨" — 12주 콘텐츠 제작 챌린지

[![CI](https://github.com/ggplab/content_designer_challenge/actions/workflows/ci.yml/badge.svg)](https://github.com/ggplab/content_designer_challenge/actions/workflows/ci.yml)

## 현재 아키텍처

```
Discord /인증 (슬래시 커맨드)
  → 모달 팝업 (최대 5개 링크 입력)
    → Supabase Edge Function (discord-verify)
        ├── Ed25519 서명 검증
        ├── Gemini 2.5 Flash — URL 분석 및 요약
        ├── Google Sheets — 인증 기록 저장
        └── Discord — 인증 완료 메시지
```

정적 대시보드(`web/`)는 GitHub Pages로 배포되며, 공개용 `members.json`과 공개 게시된 Google Sheets 데이터를 읽어 렌더링합니다.
웹페이지에서 직접 인증을 제출하는 기능은 보안상 중단했습니다. 참가자는 Discord `#챌린지-인증` 채널에서 `/인증`으로만 제출합니다.
`web-verify` 함수는 남아 있지만 공개 브라우저용이 아니라 서버 대 서버 자동화 전용입니다.

## 챌린지 일정

| 기간 | 내용 |
|------|------|
| 2026-02-23 ~ 03-01 | 준비기간 (목표/KPI/플랫폼 제출) |
| 2026-03-02 ~ 05-23 | 발행기간 (12주) |

## 디렉토리 구조

```
content_designer_challenge/
├── supabase/
│   ├── functions/
│   │   ├── discord-verify/     ← Discord 인터랙션 처리
│   │   ├── web-verify/         ← 서버 전용 자동화 엔드포인트
│   │   ├── claim-member-profile/
│   │   ├── create-api-key/
│   │   ├── list-api-keys/
│   │   └── revoke-api-key/
│   └── migrations/             ← 인증/키 관리 스키마
├── web/
│   ├── index.html              ← 공개 대시보드
│   ├── account.html            ← 로그인 / API 키 관리 페이지
│   ├── account.js
│   ├── app-config.js           ← Supabase 공개 설정
│   ├── dashboard-data.js
│   └── members.json
├── docs/
│   ├── supabase-edge-function-discord-guide.md
│   ├── google_sheets_schema.md
│   ├── discord_announcement.md
│   └── social-posts.md
├── config/
│   └── challenge_config.json
├── secrets/                    ← .gitignore (SA JSON 등)
├── deprecated/
│   └── n8n/                    ← 구버전 n8n 워크플로우
├── CLAUDE.md
└── README.md
```

## 주요 설정

| 항목 | 값 |
|------|-----|
| Supabase Project | tcxtcacibgoancvoiybx |
| Edge Function URL | `https://tcxtcacibgoancvoiybx.supabase.co/functions/v1/discord-verify` |
| Dashboard | `https://content.ggplab.xyz` |
| Account Page | `https://content.ggplab.xyz/account.html` |
| Discord 서버 ID | 1473868607640305889 |
| Discord 채널 | #챌린지-인증 (1473868708261658695) |
| Google Sheet ID | 1CKyVexXErtbkAVm6I-30fh3tei6J4B9HtCjq0-fmvvU |

## 배포

```bash
cd /Users/limjung/Documents/Projects/content_designer_challenge
supabase functions deploy discord-verify --project-ref tcxtcacibgoancvoiybx --no-verify-jwt
supabase functions deploy web-verify --project-ref tcxtcacibgoancvoiybx --no-verify-jwt
```

## 로컬 준비

### 필수 도구

- `git`
- `supabase` CLI
- `deno` (로컬 타입 체크 시)

### 설치 및 실행

```bash
git clone https://github.com/ggplab/content_designer_challenge.git
cd content_designer_challenge
```

로컬 파일로 API 키를 저장하지 말고, Supabase 시크릿에 등록해서 사용하세요.

```bash
supabase secrets set DISCORD_PUBLIC_KEY=...
supabase secrets set DISCORD_APPLICATION_ID=...
supabase secrets set DISCORD_BOT_TOKEN=...
supabase secrets set GEMINI_API_KEY=...
supabase secrets set GOOGLE_SHEET_ID=...
supabase secrets set GCP_SERVICE_ACCOUNT_JSON=...
supabase secrets set WEB_VERIFY_API_KEY=...
supabase secrets set WEB_VERIFY_ALLOWED_ORIGINS=https://content.ggplab.xyz,https://ggplab.github.io,http://localhost:4173
supabase secrets set WEB_VERIFY_RATE_LIMIT_WINDOW_MS=600000
supabase secrets set WEB_VERIFY_RATE_LIMIT_MAX=20
```

`WEB_VERIFY_API_KEY`는 브라우저나 정적 파일에 절대 넣지 않습니다. 외부 자동화가 필요할 때만 서버 환경변수나 비밀 저장소에서 읽어 사용합니다.
`app-config.js`에는 Supabase URL과 publishable key만 넣습니다. publishable key는 공개 가능하지만, service role key나 사용자별 API 키는 넣지 않습니다.

계정 연결 흐름:
- Discord OAuth 로그인
- `account.html`에서 본인 참가자 이름 선택
- `claim-member-profile`로 `member_profiles` 생성
- 이후 API 키 발급 또는 세션 기반 웹 기능 사용

## 인증 방식

- 참가자 제출: Discord `#챌린지-인증` 채널에서 `/인증`
- 공개 대시보드: GitHub Pages 정적 사이트
- 서버 자동화 연동: `web-verify`를 서버 대 서버 방식으로 호출

브라우저, n8n 클라이언트, 공개 문서에 `Authorization: Bearer ...` 형태의 고정 키를 노출하지 마세요.

## 기여 방법

1. 이 저장소를 fork 합니다.
2. 작업 브랜치를 생성합니다. (`git checkout -b feat/my-change`)
3. 변경사항을 커밋합니다. (`git commit -m "feat: ..."` )
4. 원격 브랜치에 푸시 후 Pull Request를 생성합니다.

PR에는 아래 항목을 포함해 주세요.

- 변경 목적
- 영향 범위 (`docs`, `supabase/functions`, `config` 등)
- 검증 방법

## 보안 정책

- API 키, 토큰, 서비스 계정 JSON은 절대 커밋하지 않습니다.
- 민감정보는 `secrets/`, `.env*`, 키 파일 패턴으로 `.gitignore` 처리되어 있습니다.
- 이미 유출된 키는 히스토리 정리 전에 반드시 폐기하고 재발급하세요.
- `web-verify`는 공개 웹 UI에서 직접 호출하지 않습니다.
- 자동화 엔드포인트는 허용 Origin, rate limit, URL allowlist를 함께 운영합니다.

취약점 제보는 공개 이슈 대신 비공개 채널로 전달해 주세요.

## TODO

- [ ] 주차별 제출 횟수 태그 (1주차-1회, 1주차-2회 형식)
- [ ] Discord 응답 메시지 URL 단축
- [ ] 주간 정산 워크플로우 (매주 일요일 자동 집계)
- [ ] URL 없는 모달 제출 예외 처리

## License

MIT License. 자세한 내용은 `LICENSE`를 참고하세요.

## Report

- 기술 작업 리포트 (2026-02-23): `docs/technical_report_2026-02-23.md`
- 웹 로그인/API 키 설계안: `docs/web-auth-api-key-plan.md`
- 웹 로그인/API 키 배포 체크리스트: `docs/auth-deploy-checklist.md`
