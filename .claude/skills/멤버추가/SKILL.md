---
name: 멤버추가
description: 새 챌린지 참가자를 web/members.json에 추가하고 git commit·push까지 완료한다. members.json 파일 수정과 git push가 포함되므로 사용자가 명시적으로 호출할 때만 실행한다.
argument-hint: "[이름] [Discord닉네임] [freq] [플랫폼:URL ...]"
disable-model-invocation: true
---

새 챌린지 참가자를 `web/members.json`에 추가하고 git commit까지 완료해줘.

## 입력 형식

사용자가 다음 형식으로 전달:
```
/멤버추가 [이름] [Discord닉네임] [freq] [플랫폼:URL ...]
```

예시:
- `/멤버추가 이선정 tidyline 2주1회`
- `/멤버추가 홍길동 gildong 주1회 Blog:https://blog.example.com`
- `/멤버추가 김철수 chulsoo 2주1회 LinkedIn:https://linkedin.com/in/chulsoo Instagram:https://instagram.com/chulsoo`

## 파라미터

- `이름`: 실명 (한글)
- `Discord닉네임`: nickname_map 키로 사용
- `freq`: `주1회` 또는 `2주1회` (기본값: `2주1회`)
- `플랫폼:URL`: 선택사항, 여러 개 가능. 플랫폼명은 `Brunch`, `Blog`, `LinkedIn`, `Instagram`, `Threads`, `YouTube` 중 하나

## 작업 순서

1. `web/members.json` 읽기
2. `participants` 배열 맨 끝에 새 멤버 추가:
   - links가 있으면 `{ "name": "...", "freq": "...", "links": { "플랫폼": "URL", ... } }`
   - links가 없으면 `{ "name": "...", "freq": "..." }`
3. `nickname_map`에 `"Discord닉네임": "이름"` 추가
4. 파일 저장
5. 결과 요약 출력 (추가된 내용 확인)
6. 아래 스크립트로 커밋·푸시:
   ```bash
   bash ${CLAUDE_SKILL_DIR}/scripts/git-push.sh "[이름]" "[Discord닉네임]"
   ```

## 주의사항

- 이름이 이미 participants에 있으면 추가하지 말고 "이미 등록된 멤버입니다" 안내
- Discord닉네임이 이미 nickname_map에 있으면 덮어쓰기 전에 확인 요청
- 파라미터가 부족하면 빠진 정보 물어보기 (이름, Discord닉네임은 필수)
