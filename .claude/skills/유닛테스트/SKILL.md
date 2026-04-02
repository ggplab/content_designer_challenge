---
name: 유닛테스트
description: Edge Function의 핵심 로직(주차 계산, 플랫폼 분류, 메달 부여, URL 필터)을 유닛 테스트하고 결과를 리포트한다. 코드 변경 후 배포 전에 검증할 때 사용한다.
---

Edge Function 핵심 로직을 유닛 테스트하고 결과를 리포트해줘.

## 테스트 파일 구조

```
tests/
├── discord-verify.test.ts     — getWeekLabel, detectPlatform, getMedal, URL 필터
└── shared/
    ├── cors.test.ts           — isOriginAllowed, buildCorsHeaders, jsonResponse
    ├── crypto.test.ts         — sha256Hex, createApiKeyPlaintext
    ├── session.test.ts        — getBearerToken
    └── supabase.test.ts       — env getter 함수들 (getSupabaseUrl 등)
```

## 작업 순서

1. 아래 스크립트 실행:
   ```bash
   bash ${CLAUDE_SKILL_DIR}/scripts/run.sh
   ```
2. 결과 리포트 출력
3. 실패한 테스트가 있으면 원인 분석 후 수정 방안 제시
4. 전체 통과 시 "배포할까요?" 확인

## 주의사항

- 실패한 테스트는 원인을 분석하되, Edge Function 코드를 수정하기 전에 사용자 확인 필요
- 테스트 로직이 바뀌면 `scripts/test.ts`를 직접 수정
