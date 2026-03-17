---
name: 유닛테스트
description: Edge Function의 핵심 로직(주차 계산, 플랫폼 분류, 메달 부여, URL 필터)을 유닛 테스트하고 결과를 리포트한다. 코드 변경 후 배포 전에 검증할 때 사용한다.
---

Edge Function 핵심 로직을 유닛 테스트하고 결과를 리포트해줘.

## 테스트 대상

`supabase/functions/discord-verify/index.ts`와 `supabase/functions/web-verify/index.ts`의 공통 핵심 로직:

1. **getWeekLabel()** — 날짜별 주차 계산
2. **detectPlatform()** — URL → 플랫폼 분류
3. **메달 로직** — weekTotal 1/2/3/4+ 에 따른 이모지
4. **빈 URL 예외** — http로 시작하지 않는 링크 필터

## 작업 순서

1. 아래 스크립트 실행 (테스트 파일 복사 → deno test → 정리 자동 처리):
   ```bash
   bash ${CLAUDE_SKILL_DIR}/scripts/run.sh
   ```
2. 결과 리포트 출력
3. 실패한 테스트가 있으면 원인 분석 후 수정 방안 제시
4. 전체 통과 시 "배포할까요?" 확인

테스트 케이스는 `${CLAUDE_SKILL_DIR}/scripts/test.ts`에 정의되어 있음.

## 주의사항

- 실패한 테스트는 원인을 분석하되, Edge Function 코드를 수정하기 전에 사용자 확인 필요
- 테스트 로직이 바뀌면 `scripts/test.ts`를 직접 수정
