# Deprecated: n8n 기반 워크플로우

이 폴더의 파일들은 2026-02-22 기준으로 **더 이상 사용하지 않습니다.**

## 교체 이유

n8n Webhook은 Discord Interactions Endpoint 등록에 필수인 **Ed25519 서명 검증**을 지원하지 않아
Discord 슬래시 커맨드 자동화가 불가능했습니다.

→ **Supabase Edge Function** (`supabase/functions/discord-verify/`) 으로 전면 교체

## 파일 목록

| 파일 | 설명 |
|------|------|
| `workflow_main.json` | 메인 인증 처리 워크플로우 |
| `workflow_slash_command.json` | 슬래시 커맨드 처리 워크플로우 (미완성) |
| `workflow_test.json` | Manual Trigger 테스트용 워크플로우 |
| `workflow_weekly.json` | 주간 정산 워크플로우 (미구현, 구조 참고용) |
| `prompts.md` | n8n AI Agent 시스템 프롬프트 |
| `setup_guide.md` | n8n 기반 셋업 가이드 |

## 참고

`workflow_weekly.json`은 미구현 상태였으나 주간 정산 기능을 향후 구현할 때 로직 참고용으로 보존합니다.
