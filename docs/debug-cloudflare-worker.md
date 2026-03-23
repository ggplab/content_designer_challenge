# Cloudflare Worker 릴레이 디버깅 기록

> 최초 작성: 2026-03-17
> 업데이트: 2026-03-18

---

## 배경

Discord `/인증` 슬래시 커맨드가 간헐적으로 "애플리케이션이 응답하지 않았어요" 에러 발생.
원인: Supabase Edge Function 콜드 스타트(15~20초 뒤 shutdown)가 Discord 3초 응답 제한을 초과.

Cloudflare Worker를 앞단 릴레이로 배치해 cold start 없이 즉시 응답하는 구조로 전환 시도 중이었다.

---

## 현재 상태

### 최종 결론

- Discord 퍼블릭키 불일치 때문에 Cloudflare Worker 검증이 처음에는 실패했다.
- 퍼블릭키를 최신 값으로 교체한 뒤에는 Worker가 Discord 요청을 정상 검증했다.
- 그러나 모달 제출(`type=5`) 이후 Supabase Edge Function이 `500 WORKER_ERROR`로 실패했다.
- 오늘 기준 서비스는 Cloudflare Worker 경로를 보류하고, 기존 Supabase Interactions Endpoint로 원복했다.
- 현재 Discord `/인증`은 다시 정상 동작한다.

### ✅ 완료된 것

- `cloudflare-worker/worker.js` 작성 (Ed25519 검증 + 모달 빌더 + Supabase 포워딩)
- `cloudflare-worker/wrangler.toml` 작성
- Cloudflare Workers 배포 완료
  - URL: `https://discord-verify-relay.jayjunglim.workers.dev`
- `DISCORD_PUBLIC_KEY` 시크릿 등록 완료
- 진단 결과: `verify=true discordKey=true keylen=64` — Cloudflare Workers에서 Ed25519 완벽 작동 확인
- `wrangler tail`로 Discord 실요청 캡처 성공
- Discord 요청 헤더의 서명 검증 `valid=true` 확인
- Worker가 `type=2` 슬래시 커맨드와 `type=5` 모달 제출 모두 `200`으로 응답하는 것 확인
- Supabase 함수 포워딩 결과가 `500 WORKER_ERROR`로 실패하는 것 확인
- 기존 Supabase Interactions Endpoint로 원복 후 `/인증` 정상 동작 확인

### ❌ Cloudflare 경로에서 막힌 것

Discord Interactions Endpoint URL 등록 시 검증 실패:
```
APPLICATION_INTERACTIONS_ENDPOINT_URL_INVALID:
The specified interactions endpoint url could not be verified.
```

초기에는 Discord가 Worker를 검증하지 못하는 것으로 보였지만,
실제 원인은 Worker에 등록된 `DISCORD_PUBLIC_KEY`가 Discord 앱의 현재 퍼블릭키와 불일치한 것이었다.

퍼블릭키를 아래 값으로 갱신한 뒤 검증은 통과했다.

```text
12cd4f8639df609fb5ba50ee330a801011f0b194f9a81dc027e2f26f341e792b
```

검증 통과 후 남은 실제 문제는 모달 제출 이후 Supabase 함수가 실패하는 점이었다.

### 진단으로 확인된 것

| 항목 | 결과 |
|------|------|
| Worker GET 응답 | ✅ 200 OK |
| Worker POST (시그니처 없음) | ✅ "Missing signature headers" |
| Worker 내 Ed25519 importKey | ✅ 정상 |
| Worker 내 sign→verify 전체 흐름 | ✅ true |
| DISCORD_PUBLIC_KEY 로딩 | ✅ 64자 정상 |
| Discord 실제 POST 요청 도달 | ✅ 확인 |
| Discord 실제 서명 검증 | ✅ `valid=true` |
| Worker `type=2` 응답 | ✅ 200 |
| Worker `type=5` deferred 응답 | ✅ 200 |
| Worker → Supabase 포워딩 | ❌ 500 `WORKER_ERROR` |

### 오늘 시도한 것

1. Worker에 최소 디버그 로그 추가
   - `method`
   - 시그니처 헤더 존재 여부
   - 서명 검증 결과
   - `interaction.type`
   - Supabase 포워딩 응답 코드

2. GET 진단 엔드포인트 제거 후 재배포
   - 검증 경로를 `POST` 중심으로 단순화

3. Cloudflare Worker 시크릿 `DISCORD_PUBLIC_KEY` 재등록
   - 기존 값 대신 Discord Developer Portal의 최신 퍼블릭키 사용

4. `npx wrangler tail discord-verify-relay` 로 실시간 요청 캡처
   - Discord `user-agent: Discord-Interactions/1.0`
   - `type=2`, `type=5` 요청 모두 확인

5. Worker에서 Supabase 포워딩 결과 로그 추가
   - 모달 제출 후 Supabase가 `500`으로 죽는 것 확인

6. Supabase `discord-verify` 함수의 `type=5` 처리 방식 수정 시도
   - `EdgeRuntime.waitUntil(...)` 제거
   - 동기 처리로 전환 후 재배포
   - 결과: 여전히 사용자 체감상 무한 로딩, 운영 경로로 채택하지 않음

7. 기존 Supabase 경로로 원복
   - `supabase/functions/discord-verify/index.ts` 를 기존 동작 상태로 복구
   - Supabase 함수 재배포
   - Discord Interactions Endpoint URL을 다시 Supabase URL로 변경
   - 최종적으로 `/인증` 정상 동작 확인

---

## 파일 위치

```
cloudflare-worker/
├── worker.js       ← Worker 릴레이 코드
└── wrangler.toml   ← 배포 설정
```

---

## 확인된 로그 요약

Cloudflare Worker에서는 아래까지는 정상 확인됐다.

- Discord 요청 도달
- Ed25519 서명 검증 성공
- `type=2` 모달 반환
- `type=5` deferred 응답 반환

모달 제출 이후 Worker 로그:

```text
{"stage":"supabase_forward_complete","status":500,"body":"{\"code\":\"WORKER_ERROR\",\"message\":\"Function exited due to an error (please check logs)\"}"}
```

즉 병목은 Cloudflare Worker가 아니라, Worker가 전달한 요청을 처리하는 Supabase 함수 쪽이었다.

---

## 다음에 다시 시도할 것

1. **Supabase 함수 로그를 직접 확인**
   - `type=5`에서 어떤 예외로 `WORKER_ERROR`가 나는지 원문 로그 확보 필요

2. **Worker 뒤에서 Supabase를 다시 Interactions Endpoint처럼 쓰지 않도록 구조 재검토**
   - 지금 구조는 Worker가 Discord 요청을 검증한 뒤, 같은 Discord payload를 다시 Supabase 함수에 전달하는 형태
   - Supabase 함수가 Discord 원본 엔드포인트 전제를 계속 갖고 있으면 충돌 여지가 있다

3. **Supabase를 Discord 엔드포인트가 아닌 내부 처리 함수로 분리**
   - Worker는 Discord 응답만 담당
   - Supabase는 검증된 payload를 받아 저장/후속 메시지만 처리
   - 이 구조가 장기적으로 더 명확하다

4. **Cloudflare 경로 재시도 전, 기존 운영 경로를 유지**
   - 현재 운영 URL은 다시 Supabase 함수 URL로 복원된 상태
   - Worker는 실험용으로만 유지

---

## 현재 운영 상태

- Edge Function `discord-verify` 정상 배포 중
- Discord Interactions Endpoint는 다시 Supabase URL 사용 중
- Cloudflare Worker 코드는 저장소에 남겨두되, 현재 운영 경로에서는 사용하지 않음
