---
name: 정리
description: 이번 대화에서 진행한 작업을 update.md에 기록하고, 아키텍처 변경이 있으면 docs/architecture.md도 갱신하고, Discord #업데이트-이력 채널에 알린다. git push와 Discord 메시지 전송 등 비가역적 작업이 포함되므로 사용자가 명시적으로 호출할 때만 실행한다.
disable-model-invocation: true
---

이번 대화에서 진행한 작업 내용을 `update.md`에 업데이트하고, 아키텍처 변경이 있으면 `docs/architecture.md`도 갱신하고, Discord #업데이트 채널에도 알려줘.

참고 문서:
- `docs/discord-update-history-playbook.md`
- `docs/architecture.md`

## 순서

### 0. architecture.md 갱신 (변경이 있을 때만)

이번 대화에서 아래 중 하나라도 해당되면 `docs/architecture.md`를 먼저 업데이트한다:

- Edge Function 추가/삭제/역할 변경
- DB 테이블·컬럼 추가/삭제/변경
- 외부 서비스 연동 추가/삭제 (Gemini, Sheets, Discord 등)
- 인증 흐름 변경
- 주요 데이터 플로우 변경

업데이트 범위:
- **시퀀스 다이어그램** — 플로우가 바뀐 경우
- **컴포넌트 구조도** — 컴포넌트가 추가/삭제된 경우
- **ER 다이어그램** — 테이블/컬럼이 바뀐 경우
- **하단 요약 표** (주차 계산, 메달 부여, URL 요약 우선순위 등) — 로직이 바뀐 경우

아키텍처 변경이 없는 순수 문서·설정 작업이면 이 단계를 건너뛴다.

### 1. update.md 업데이트

- 오늘 날짜(`## YYYY-MM-DD`) 섹션을 확인
  - **섹션이 없으면**: 맨 위에 새로 추가
  - **섹션이 있으면**: 기존 섹션 전체를 읽고, 이번 작업 내용을 **카테고리별로 통합**하여 섹션을 하나로 교체
    - 기존 항목과 새 항목을 같은 카테고리 아래 합쳐서 중복 없이 정리
    - 섹션을 위아래로 늘리거나 `(2차)` 같은 접미사를 붙이지 않음
- 작업 내용을 카테고리별로 정리 (변경사항, 신규 기능, 버그 수정, 멤버 변경 등)
- 기술적인 세부사항도 포함 (어떤 파일이 왜 변경됐는지)
- 작성 완료 후 아래 스크립트로 커밋·푸시:
  ```bash
  bash ${CLAUDE_SKILL_DIR}/scripts/git-push.sh "docs: update YYYY-MM-DD release notes"
  ```

### 2. Discord 채널에서 오늘 메시지 조회

Bot API로 채널 최근 메시지를 가져와 오늘 날짜(`YYYY-MM-DD`)가 포함된 메시지를 찾는다.

```bash
source .env && curl -s "https://discord.com/api/v10/channels/1480426873963151501/messages?limit=10" \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN" | python3 -c "
import sys, json
today = 'YYYY-MM-DD'  # 오늘 날짜로 교체
msgs = json.load(sys.stdin)
for m in msgs:
    if today in m.get('content', ''):
        print(m['id'])
        break
else:
    print('none')
"
```

- **message_id가 반환되면** → 기존 메시지 수정 (PATCH)
- **'none'이면** → 새 메시지 전송 (POST)

### 3. Discord 메시지 내용 작성 후 스크립트로 전송

update.md의 **오늘 날짜 섹션 전체**를 기반으로 메시지를 작성하고 `/tmp/discord_msg.txt`에 저장한다.
(당일 2회 이상 정리 시 누적된 내용 전체가 반영되어야 함)

**메시지 형식**:
```
📦 **웹 업데이트 이력** · YYYY-MM-DD

**🆕 신규 기능**
• 항목

**🐛 버그 수정**
• 항목

**⚙️ 변경사항**
• 항목
```

- 해당 날짜에 작업한 내용만 포함 (카테고리가 없으면 생략)
- 각 항목은 간결하게 1줄로
- 기술 용어보다 사용자 관점으로 작성
- 2000자 초과 시 핵심 항목만 요약

메시지 작성 완료 후 스크립트로 전송 (POST/PATCH·캐시 관리 자동 처리):
```bash
bash ${CLAUDE_SKILL_DIR}/scripts/discord-send.sh < /tmp/discord_msg.txt
```
