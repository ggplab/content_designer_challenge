# 001 — Discord 응답 URL 단축

**상태**: 미해결
**등록일**: 2026-03-02
**카테고리**: 개선

## 현상
Discord `/인증` 완료 메시지에 원본 URL이 그대로 노출되어 메시지가 길어짐.

## 목표
긴 URL을 단축 URL로 교체하여 메시지 가독성 향상.

## 관련 파일
- `supabase/functions/discord-verify/index.ts` — follow-up 메시지 생성 부분
- `supabase/functions/web-verify/index.ts`

## 참고
URL 단축 서비스 선택 필요 (외부 API vs 자체 구현).
