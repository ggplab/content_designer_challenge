# 001 — Discord 응답 URL 단축

**상태**: 해결 (2026-04-14)
**등록일**: 2026-03-02
**카테고리**: 개선

> 해결 근거: Supabase DB 기반 자체 URL 단축(`r` Edge Function + `_shared/short-links.ts`)으로 구현 완료 — `changelog/2026-04-14.md` 참고.

## 현상
Discord `/인증` 완료 메시지에 원본 URL이 그대로 노출되어 메시지가 길어짐.

## 목표
긴 URL을 단축 URL로 교체하여 메시지 가독성 향상.

## 관련 파일
- `supabase/functions/discord-verify/index.ts` — follow-up 메시지 생성 부분
- `supabase/functions/web-verify/index.ts`

## 참고
URL 단축 서비스 선택 필요 (외부 API vs 자체 구현).
