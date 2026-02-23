# 전체 셋업 가이드

## 사전 준비 체크리스트

- [ ] Google 계정 (Sheets + OAuth)
- [ ] Discord 계정 + 서버 관리자 권한
- [ ] n8n 인스턴스 (Cloud 또는 Self-hosted)
- [ ] OpenAI API Key

---

## Step 1. Google Sheets 준비

1. [Google Sheets](https://sheets.google.com) 에서 새 스프레드시트 생성
2. 시트 탭 이름 변경: `Sheet1` → `Challenge_Log`
3. 1행 헤더 입력:
   - A1: `날짜 (Date)`
   - B1: `작성자 (Name)`
   - C1: `플랫폼 (Platform)`
   - D1: `콘텐츠 링크 (URL)`
   - E1: `회차 (Week)`
   - F1: `콘텐츠 요약 (Summary)`
4. URL에서 Sheet ID 복사 → `.env`의 `GOOGLE_SHEET_ID`에 저장

상세 스키마: `docs/google_sheets_schema.md` 참고

---

## Step 2. Discord 봇 설정

1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. **New Application** 클릭 → 이름 입력 (예: `챌린지-매니저`)
3. 좌측 **Bot** 탭 → **Add Bot**
4. **Privileged Gateway Intents** 섹션에서:
   - `MESSAGE CONTENT INTENT` **반드시 활성화** ✅
5. **Reset Token** → 토큰 복사 → `.env`의 `DISCORD_BOT_TOKEN`에 저장
6. **OAuth2 > URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Read Message History`, `View Channels`
7. 생성된 URL로 서버에 봇 초대
8. `#챌린지-인증` 채널 ID 복사 (채널 우클릭 → ID 복사) → `.env`의 `DISCORD_CHANNEL_ID`

---

## Step 3. n8n Credentials 등록

n8n 대시보드 → **Credentials** 메뉴에서 아래 3개 등록:

### 3-1. Discord Bot Token
- Type: `Discord API`
- Bot Token: `.env`의 `DISCORD_BOT_TOKEN` 값

### 3-2. OpenAI API
- Type: `OpenAI API`
- API Key: `.env`의 `OPENAI_API_KEY` 값

### 3-3. Google Sheets OAuth2
- Type: `Google Sheets OAuth2 API`
- OAuth 인증 진행 (Google 계정 로그인)

---

## Step 4. n8n 워크플로우 Import

### 메인 워크플로우 (인증 처리)
1. n8n 대시보드 → **Workflows** → **Import from File**
2. `n8n/workflow_main.json` 업로드
3. 각 노드의 Credential을 등록한 것으로 교체
4. `Discord Trigger` 노드에서 채널 ID 확인
5. `Google Sheets` 노드에서 Sheet ID 확인
6. 워크플로우 **Active** 토글 ON

### 주간 정산 워크플로우
1. `n8n/workflow_weekly.json` 동일하게 Import
2. Schedule: 매주 일요일 23:00 (기본 설정됨)
3. 워크플로우 **Active** 토글 ON

---

## Step 5. 테스트

1. Discord `#챌린지-인증` 채널에 LinkedIn URL 붙여넣기
2. n8n 실행 로그 확인
3. Google Sheets에 데이터 저장 확인
4. Discord 봇 답변 확인 ("✅ 1주차 인증 완료!")

### 예외 케이스 테스트
- URL 없이 텍스트만 전송 → "인증 링크를 포함해 주세요!" 응답 확인
- 다양한 플랫폼 URL 테스트 (Instagram, YouTube 등)

---

## 문제 해결 (Troubleshooting)

| 증상 | 원인 | 해결 |
|------|------|------|
| 봇이 메시지를 못 읽음 | Message Content Intent 미활성화 | Developer Portal에서 활성화 |
| AI 응답이 JSON이 아님 | 프롬프트 누락 | `n8n/prompts.md` 1번 프롬프트 재확인 |
| Sheets 저장 안 됨 | OAuth 만료 또는 Sheet ID 오류 | Credential 재인증, Sheet ID 확인 |
| 주간 정산 미실행 | Schedule Trigger 비활성 | 워크플로우 Active 확인 |
