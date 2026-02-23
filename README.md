# 너만·알맡 챌린지 자동화 시스템

> "너 만들기만하고, 알고리즘에 맡겨" — 12주 콘텐츠 제작 챌린지

## 현재 아키텍처

```
Discord /인증 (슬래시 커맨드)
  → 모달 팝업 (최대 5개 링크 입력)
    → Supabase Edge Function (discord-verify)
        ├── Ed25519 서명 검증
        ├── Gemini 1.5 Flash — URL 분석 및 요약
        ├── Google Sheets — 인증 기록 저장
        └── Discord — 인증 완료 메시지
```

## 챌린지 일정

| 기간 | 내용 |
|------|------|
| 2026-02-23 ~ 03-01 | 준비기간 (목표/KPI/플랫폼 제출) |
| 2026-03-02 ~ 05-23 | 발행기간 (12주) |

## 디렉토리 구조

```
content_designer_challenge/
├── supabase/
│   └── functions/
│       └── discord-verify/     ← 현재 활성 Edge Function
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
| Discord 서버 ID | 1473868607640305889 |
| Discord 채널 | #챌린지-인증 (1473868708261658695) |
| Google Sheet ID | 1CKyVexXErtbkAVm6I-30fh3tei6J4B9HtCjq0-fmvvU |

## 배포

```bash
cd /Users/limjung/Documents/Projects/content_designer_challenge
supabase functions deploy discord-verify --project-ref tcxtcacibgoancvoiybx --no-verify-jwt
```

## TODO

- [ ] 주차별 제출 횟수 태그 (1주차-1회, 1주차-2회 형식)
- [ ] Discord 응답 메시지 URL 단축
- [ ] 주간 정산 워크플로우 (매주 일요일 자동 집계)
- [ ] URL 없는 모달 제출 예외 처리
