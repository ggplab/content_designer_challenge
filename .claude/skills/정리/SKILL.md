---
name: 정리
description: 이번 대화에서 진행한 작업을 update.md에 기록하고, 아키텍처 변경이 있으면 docs/architecture.md도 갱신하고, Discord #업데이트-이력 채널에 알린다. git push와 Discord 메시지 전송 등 비가역적 작업이 포함되므로 사용자가 명시적으로 호출할 때만 실행한다.
disable-model-invocation: true
---

이번 대화에서 진행한 작업 내용을 `changelog/YYYY-MM-DD.md`에 기록하고 `update.md` 목록에 링크를 추가하고, 아키텍처 변경이 있으면 `docs/architecture.md`도 갱신하고, Discord #업데이트 채널에도 알려줘.

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

### 1. changelog 업데이트

- `changelog/YYYY-MM-DD.md` 파일을 확인
  - **파일이 없으면**: 신규 생성. 상단에 `# YYYY-MM-DD` 헤딩 추가
  - **파일이 있으면**: 기존 내용을 읽고 이번 작업 내용을 **카테고리별로 통합** (중복 없이, `(2차)` 접미사 없이)
- 작업 내용을 카테고리별로 정리 (변경사항, 신규 기능, 버그 수정, 멤버 변경 등)
- 기술적인 세부사항 포함 (어떤 파일이 왜 변경됐는지)
- `update.md` 목록에 오늘 날짜 행이 없으면 추가 (있으면 주요 내용만 업데이트)
- 해결된 버그가 있으면 `bugs/open/` → `bugs/closed/`로 이동
- 작성 완료 후 아래 스크립트로 커밋·푸시:
  ```bash
  bash ${CLAUDE_SKILL_DIR}/scripts/git-push.sh "docs: update YYYY-MM-DD release notes"
  ```

### 2. Discord 메시지 내용 작성 후 스크립트로 전송

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
