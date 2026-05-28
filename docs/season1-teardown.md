# 1기 종료(teardown) 및 2기 재가동 가이드

콘텐츠 디자이너 챌린지 "너만알맡" 1기 종료(2026-05-28) 시 운영 자동화를 내린 내역과,
2기 재가동에 필요한 복원 절차를 기록한다. 함수/DB/Secret은 삭제하지 않고 보존했다.

## 내린 것 (1기 종료 처리)

| 대상 | 처리 | 비고 |
|------|------|------|
| pg_cron `warmup-discord-verify` | unschedule | 5분마다 discord-verify 워밍업 |
| pg_cron `weekly-summary` | unschedule | 매주 일요일 주간 정산 |
| GitHub Actions `sync-members.yml` | schedule 주석 처리 | 매일 자정(KST) 멤버 sync. `workflow_dispatch`(수동)는 유지 |
| `web/index.html` | 인증 버튼 2개 제거 + 1기 종료 배너 | "Discord에서 인증하기", "내 계정/API키" 제거 |
| Discord `/인증` 슬래시 커맨드 | deregister | 길드 `1473868607640305889` |

## 보존한 것 (삭제하지 않음, 2기 재사용)

- Edge Function 7개: `discord-verify`, `web-verify`, `weekly-summary`, `claim-member-profile`, `create-api-key`, `list-api-keys`, `revoke-api-key` (Supabase에 그대로 배포된 상태)
- Supabase Secrets 전부 (다른 프로젝트와 공유분 포함)
- DB 테이블 4개: `member_profiles`, `challenge_members`, `api_keys`, `api_audit_logs`
- GitHub Pages 갤러리 사이트 (`web/`)
- Google Sheets (인증 기록 시트, 설문 응답 시트)
- 1기 운영 최종 상태 git 태그: `season1-final`

> 주의: 이 Supabase 프로젝트(`tcxtcacibgoancvoiybx`)는 ggplab 홈페이지/예약 시스템/인프런 n8n 챌린지 등과 공유한다. 함수 삭제·Secret 변경 시 챌린지 소관(위 7개 함수, `DISCORD_*`)만 건드릴 것.

## 2기 재가동 절차

### 1. pg_cron 재등록 (Supabase 대시보드 SQL Editor 또는 Management API)

```sql
-- discord-verify 워밍업 (5분마다)
select cron.schedule(
  'warmup-discord-verify',
  '*/5 * * * *',
  $$SELECT net.http_get(url := 'https://tcxtcacibgoancvoiybx.supabase.co/functions/v1/discord-verify') AS request_id;$$
);

-- 주간 정산 (매주 일요일 21:00 UTC = 월요일 06:00 KST)
select cron.schedule(
  'weekly-summary',
  '0 21 * * 0',
  $$select net.http_post(
    url := 'https://tcxtcacibgoancvoiybx.supabase.co/functions/v1/weekly-summary',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);
```

### 2. GitHub Actions 멤버 sync 재개

`.github/workflows/sync-members.yml`에서 `schedule` 블록 주석을 해제한다.

### 3. 갤러리 인증 버튼 복원

`web/index.html`에서 1기 종료 배너(`.season-end-banner`)를 제거하고, 태그 `season1-final`의
인증 버튼(`verify-cta`, `api-cta`)과 `goToAccountPage()` 함수를 복원한다.

```bash
git show season1-final:web/index.html   # 1기 운영 시점 원본 확인
```

### 4. Discord `/인증` 슬래시 커맨드 재등록

```bash
curl -X POST \
  https://discord.com/api/v10/applications/1474072217447829514/guilds/1473868607640305889/commands \
  -H "Authorization: Bot <너만알맡봇_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"인증",
    "description":"콘텐츠 인증 (최대 5개 링크 입력 가능)",
    "options":[
      {
        "type":3,"name":"visibility","description":"blind/public 선택","required":false,
        "choices":[{"name":"public","value":"public"},{"name":"blind","value":"blind"}]
      }
    ]
  }'
```

### 5. Edge Function

이미 배포된 상태이므로 코드 변경이 없으면 재배포 불필요.
코드를 수정했다면: `supabase functions deploy <name> --project-ref tcxtcacibgoancvoiybx --no-verify-jwt`
