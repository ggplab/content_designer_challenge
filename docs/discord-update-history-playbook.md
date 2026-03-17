# Discord 업데이트 이력 전송 플레이북

이 문서는 `update.md` 변경사항을 Discord `#업데이트-이력` 채널로 보내는 절차와, 실패 시 점검할 항목을 정리한 운영 문서입니다.

관련 파일:

- [정리 명령](/Users/limjung/Documents/Projects/content_designer_challenge/.claude/commands/정리.md)
- [업데이트 이력 원본](/Users/limjung/Documents/Projects/content_designer_challenge/update.md)
- [메시지 캐시](/Users/limjung/Documents/Projects/content_designer_challenge/.discord_message_cache.json)

## 목적

- `update.md`의 오늘 날짜 섹션을 단일 소스로 유지한다.
- 같은 날 여러 번 정리하면 Discord 메시지는 새로 올리지 않고 수정한다.
- 웹훅이 막히면 원인을 빠르게 확인하고 다음 세션에 이어서 처리할 수 있게 한다.

## 기본 흐름

1. `update.md`의 오늘 날짜 섹션 정리
2. `git add update.md && git commit && git push`
3. Discord 채널에서 오늘 메시지 조회
4. 있으면 PATCH, 없으면 POST
5. 성공 시 `.discord_message_cache.json` 갱신

## 채널 정보

- 채널 이름: `#업데이트-이력`
- 채널 ID: `1480426873963151501`

## 환경변수

`.env` 또는 안전한 비밀 저장소에 아래 값이 필요합니다.

- `DISCORD_BOT_TOKEN`
- `DISCORD_WEBHOOK_UPDATE`

## 1. 오늘 메시지 조회

```bash
set -a
source .env
curl -sS "https://discord.com/api/v10/channels/1480426873963151501/messages?limit=10" \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN"
```

오늘 날짜가 포함된 메시지 ID만 추출하려면:

```bash
set -a
source .env
curl -sS "https://discord.com/api/v10/channels/1480426873963151501/messages?limit=10" \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN" | python3 -c "
import sys, json
today = 'YYYY-MM-DD'
msgs = json.load(sys.stdin)
print(next((m['id'] for m in msgs if today in m.get('content', '')), 'none'))
"
```

## 2. 메시지 형식

권장 형식:

```text
📦 **웹 업데이트 이력** · YYYY-MM-DD

**🆕 신규 기능**
• 항목

**🐛 버그 수정**
• 항목

**⚙️ 변경사항**
• 항목
```

원칙:

- `update.md`의 오늘 날짜 섹션만 반영
- 같은 항목 반복 금지
- Discord 최대 길이 2000자 초과 시 핵심 항목만 남김
- 기술 세부사항보다 사용자/운영자 관점 우선

## 3. 웹훅으로 신규 전송

```bash
set -a
source .env
curl -sS -X POST "${DISCORD_WEBHOOK_UPDATE}?wait=true" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"<메시지 내용>\"}"
```

성공 기준:

- 응답 JSON에 `id` 존재

## 4. 웹훅으로 기존 메시지 수정

```bash
set -a
source .env
curl -sS -X PATCH "${DISCORD_WEBHOOK_UPDATE}/messages/<message_id>" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"<메시지 내용>\"}"
```

## 5. 캐시 갱신

성공 시 `.discord_message_cache.json`에 날짜와 message ID를 기록합니다.

예시:

```json
{
  "2026-03-17": "1483..."
}
```

## 실패 시 점검 순서

### A. 웹훅 `403 Forbidden`

가능한 원인:

- 웹훅이 삭제됨
- 웹훅 URL이 잘못 복사됨
- 웹훅 토큰이 재생성됨
- 채널이 삭제/이동됨

점검:

1. Discord 채널 설정에서 웹훅이 실제로 존재하는지 확인
2. 새 웹훅을 생성해서 다시 시도
3. `.env`의 `DISCORD_WEBHOOK_UPDATE` 교체

### B. Bot API 조회는 되는데 POST가 `403 Forbidden`

가능한 원인:

- 봇에 `Send Messages` 권한이 없음
- 채널 권한 override로 차단됨
- 대상 채널이 다름

점검:

1. 채널 권한에서 봇의 `View Channel`, `Send Messages`, `Read Message History` 허용
2. 채널 ID가 `1480426873963151501` 맞는지 확인
3. 서버 역할 권한에서 봇 역할이 막혀 있지 않은지 확인

### C. `.env` 로드 후 환경변수가 안 잡힘

`source .env`만으로는 export되지 않을 수 있습니다.

권장:

```bash
set -a
source .env
```

## 2026-03-17 실제 장애 기록

이 날짜에 확인된 사항:

- `update.md` 정리 및 git 반영은 성공
- 기존 `DISCORD_WEBHOOK_UPDATE` URL로 POST 시 `403 Forbidden`
- 사용자가 새 웹훅 URL을 제공했지만 그 URL도 `403 Forbidden`
- Bot API로 채널 조회는 성공했지만 채널 POST는 `403 Forbidden`

따라서 이 시점의 결론:

- 전송 실패 원인은 코드가 아니라 Discord 웹훅 또는 채널 권한 설정
- 다음 세션에서는 새 웹훅 재생성 또는 봇의 채널 `Send Messages` 권한 점검부터 시작하면 된다
