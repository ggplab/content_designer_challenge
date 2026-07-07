# 002 — 주간 정산 워크플로우

**상태**: 해결 (2026-03-19)
**등록일**: 2026-03-02
**카테고리**: 신규 기능

> 해결 근거: `weekly-summary` Edge Function 추가 + pg_cron 주간 등록으로 구현 완료 — `changelog/2026-03-19.md` 참고.

## 현상
매주 일요일 자동 집계 및 Discord 요약 메시지 발송 기능 없음.

## 목표
- 매주 일요일 자정 KST 자동 실행
- 해당 주차 참가자별 인증 횟수 집계
- Discord에 주간 요약 메시지 전송

## 구현 방향
- pg_cron으로 주간 cron job 등록
- Edge Function 또는 GitHub Actions 활용
- Google Sheets 데이터 집계 후 Discord webhook 전송

## 관련 파일
- `supabase/functions/discord-verify/index.ts`
- `config/challenge_config.json`
