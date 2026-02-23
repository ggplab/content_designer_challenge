# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

12주 콘텐츠 제작 챌린지 **"너만·알맡"** (너 만들기만하고, 알고리즘에 맡겨)의 Discord 봇 자동화 시스템.

**파이프라인**:
```
Discord /인증 (모달 팝업, 최대 5개 링크)
  → Supabase Edge Function (discord-verify)
      ├── Gemini 1.5 Flash — URL 분석 및 요약
      ├── Google Sheets — 인증 기록 저장 (Service Account)
      └── Discord — 인증 완료 메시지 (follow-up)
```

**챌린지 기간**:
- 준비 기간: 2026-02-23 ~ 2026-03-01
- 발행 기간: 2026-03-02 ~ 2026-05-23 (12주)

**인증 규칙**: 최소 2주에 1회, 플랫폼 제한 없음, 2주 연속 미인증 시 개별 안내

---

## 진행 상황 (2026-02-22 기준)

### 완료

- [x] Supabase Edge Function `discord-verify` 배포
- [x] Ed25519 서명 검증 — Discord Interactions Endpoint 등록 및 PING/PONG 통과
- [x] `/인증` 슬래시 커맨드 등록 (파라미터 없음, 모달로 처리)
- [x] 모달 팝업 — 링크 1~5개 입력 필드
- [x] Gemini 1.5 Flash — URL 분석 후 platform, summary 반환
- [x] Google Sheets 저장 — Service Account 인증, 행 추가 확인
- [x] Discord follow-up 메시지 — 플랫폼별 인증 완료 메시지

### TODO

- [ ] **주차별 제출 횟수 태그** — 같은 주차 중복 제출 시 `1주차-1회`, `1주차-2회` 형식
- [ ] **Discord 응답 URL 단축** — 긴 URL 줄이기
- [ ] **주간 정산 워크플로우** — 매주 일요일 자동 집계 + Discord 요약 메시지
- [ ] **빈 모달 제출 예외 처리** — 유효한 URL 없을 때 안내 메시지

---

## 아키텍처

### 현재 동작 흐름

```
사용자: /인증 입력
  → Edge Function: type=2 수신 → MODAL 응답 (type=9)

사용자: 링크 입력 후 제출
  → Edge Function: type=5 수신
  → {"type":5} 즉시 응답 (Discord 3초 제한 대응)
  → EdgeRuntime.waitUntil() 백그라운드:
      각 URL별:
        ├── detectPlatform(url)       — 코드로 도메인 분류
        ├── callGemini(url)           — 요약 생성
        └── appendToSheets(row)      — Sheets 행 추가
      완료 후:
        └── sendFollowup(token, msg) — Discord PATCH
```

### 플랫폼 분류 규칙 (Edge Function 내 코드)

| 도메인 | 분류 |
|--------|------|
| `linkedin.com` | LinkedIn |
| `instagram.com` | Instagram |
| `threads.net` | Threads |
| `youtube.com`, `youtu.be` | YouTube |
| 그 외 | Blog |

### 주차 계산 공식

```typescript
// 발행 시작일(2026-03-02) 기준, KST
const days = Math.floor((now - new Date("2026-03-02")) / 86400000);
const week = Math.max(1, Math.ceil((days + 1) / 7));
// 발행 시작일 이전이면 "준비기간" 반환
```

---

## 주요 설정

### Supabase

- Project ref: `tcxtcacibgoancvoiybx`
- Edge Function: `discord-verify`
- URL: `https://tcxtcacibgoancvoiybx.supabase.co/functions/v1/discord-verify`
- JWT 검증: **비활성화** (`verify_jwt: false`) — Discord 서명으로 대체

### Supabase Secrets

| 변수명 | 설명 |
|--------|------|
| `DISCORD_PUBLIC_KEY` | Ed25519 서명 검증용 공개키 |
| `DISCORD_APPLICATION_ID` | `1474072217447829514` |
| `GEMINI_API_KEY` | Google AI Studio |
| `GOOGLE_SHEET_ID` | `1CKyVexXErtbkAVm6I-30fh3tei6J4B9HtCjq0-fmvvU` |
| `GCP_SERVICE_ACCOUNT_JSON` | Service Account JSON (minified) |

### Google Sheets

- Sheet ID: `1CKyVexXErtbkAVm6I-30fh3tei6J4B9HtCjq0-fmvvU`
- 시트 탭: `시트1`
- 컬럼: `date` | `user` | `platfrom`(오타 유지) | `link` | `number` | `summary` | `etc`
- 인증: Service Account (`discord-challenge-bot@gen-lang-client-0573007724.iam.gserviceaccount.com`)

### Discord

- 서버: `넌 만들기만하고 알고리즘에 맡겨` (ID: `1473868607640305889`)
- 채널: `#챌린지-인증` (ID: `1473868708261658695`)
- 봇: `너만알맡봇` (Application ID: `1474072217447829514`)
- 슬래시 커맨드: `/인증` — 파라미터 없음, 모달로 링크 수집

---

## 배포

```bash
cd /Users/limjung/Documents/Projects/content_designer_challenge
supabase functions deploy discord-verify --project-ref tcxtcacibgoancvoiybx --no-verify-jwt
```

---

## 자주 발생하는 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| Discord Endpoint 검증 실패 | JWT 인증 활성화 상태 | `verify_jwt: false` 확인 또는 `--no-verify-jwt` 재배포 |
| Google 인증 오류 | SA JSON의 `\n`이 실제 줄바꿈으로 저장됨 | 코드 내 `replace(/\r?\n/g, "\\n")` 전처리 적용됨 |
| Sheets 저장 안 됨 | SA 권한 없음 | Sheets 공유에 `discord-challenge-bot@...` 편집자 권한 확인 |
| 모달이 뜨지 않음 | Interactions Endpoint 미연결 | Discord Dev Portal에서 Endpoint URL 등록 확인 |
| follow-up 메시지 없음 | interaction token 만료(15분) 또는 PATCH 오류 | Supabase 로그 확인 |

---

## 디렉토리 구조

```
content_designer_challenge/
├── supabase/functions/discord-verify/   ← 활성 Edge Function
├── docs/                                ← 문서 (가이드, 공지, SNS 포스트)
├── config/                              ← challenge_config.json
├── secrets/                             ← SA JSON 등 (gitignore)
├── deprecated/n8n/                      ← 구버전 n8n 워크플로우
├── CLAUDE.md
└── README.md
```
