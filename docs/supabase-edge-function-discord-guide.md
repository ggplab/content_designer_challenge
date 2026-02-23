# Supabase Edge Function으로 Discord 슬래시 커맨드 구현 가이드

작성일: 2026-02-22
작성자: 임정 (GGP)
프로젝트: 너만·알맡 챌린지 Discord 봇 자동화

---

## 1. 무엇을 했는가 (작업 요약)

Discord 슬래시 커맨드 `/인증`을 누르면 모달 팝업이 열리고, 참여자가 최대 5개의 SNS 링크를 입력하면 자동으로 AI가 분석해 Google Sheets에 기록하고 Discord에 완료 메시지를 보내는 시스템을 구축했다.  
추가로 슬래시 옵션 `public`(true/false)로 링크 공개 여부를 선택할 수 있게 확장했다.

핵심은 n8n Webhook 기반이었던 기존 아키텍처를 Supabase Edge Function (Deno 2) 기반으로 전면 교체한 것이다.

**구현된 파일:**
- `ggplab/supabase/functions/discord-verify/index.ts`

**배포 완료 상태:**
- Edge Function URL: `https://tcxtcacibgoancvoiybx.supabase.co/functions/v1/discord-verify`
- Discord Interactions Endpoint 등록 및 PING/PONG 검증 통과
- 슬래시 커맨드 `/인증` 등록 완료

---

## 2. 왜 했는가 (배경 및 의사결정)

### 기존 구조의 한계

기존 시스템은 n8n Webhook → AI Agent → Google Sheets → Discord 메시지 순으로 동작했다. 그런데 Discord 슬래시 커맨드를 사용하려면 Discord Developer Portal에 **Interactions Endpoint URL**을 등록해야 한다.

Discord는 이 Endpoint로 요청을 보낼 때 **Ed25519 서명**을 헤더에 포함시킨다. Endpoint가 이 서명을 직접 검증하고 3초 이내에 올바른 형식으로 응답해야 한다. 검증에 실패하거나 응답이 늦으면 Discord가 해당 Endpoint를 무효로 판단한다.

n8n Webhook 노드는 이 Ed25519 서명 검증 로직을 내장하고 있지 않다. n8n 코드 노드로 구현을 시도했으나 응답 형식 제어가 어려워 Discord 검증 통과가 불가능했다.

### Supabase Edge Function을 선택한 이유

| 조건 | n8n Webhook | Supabase Edge Function |
|------|------------|----------------------|
| Ed25519 서명 검증 | 미지원 | `crypto.subtle` 네이티브 지원 |
| 응답 형식 완전 제어 | 어려움 | `Response` 객체 직접 반환 |
| 3초 응답 보장 | 불확실 | 즉시 응답 후 백그라운드 처리 가능 |
| 기존 인프라 활용 | n8n 인스턴스 필요 | 이미 Supabase 사용 중 |
| 비용 | n8n Cloud 유료 | Supabase Free Tier 충분 |

### 슬래시 커맨드 변경: `/verify` → `/인증`

초기에는 영문 커맨드 `/verify`로 등록했다. 챌린지 참여자 대상 설문 결과 멀티 플랫폼 동시 게시 수요가 확인되었고, 이에 따라 단일 링크 입력에서 모달 팝업(최대 5개 링크)으로 UX를 변경했다. 이 시점에 한국어 참여자 친화적인 `/인증`으로 커맨드명도 교체했다.

---

## 3. 어떻게 했는가 (단계별 과정)

### Step 1. Supabase Edge Function 생성

Claude Code에 다음과 같이 지시했다.

```
supabase/functions/discord-verify/index.ts 파일을 생성해줘.
Discord Interactions Endpoint로 동작해야 하니까:
1. Ed25519 서명 검증 (헤더: x-signature-ed25519, x-signature-timestamp)
2. type=1 PING → {"type":1} PONG 즉시 응답
3. type=2 슬래시 커맨드 → {"type":9} MODAL 응답 (링크 입력창 5개)
4. type=5 모달 제출 → {"type":5} deferred 즉시 응답 후 백그라운드에서 처리
백그라운드 처리: Gemini로 URL 분석 → Google Sheets 저장 → Discord follow-up 메시지
```

### Step 2. Ed25519 서명 검증 구현

Deno의 `crypto.subtle` API를 사용해 구현했다. 별도 라이브러리 설치 없이 네이티브로 처리한다.

```typescript
// 검증 핵심 로직
const isValid = await crypto.subtle.verify(
  "Ed25519",
  publicKey,
  signature,
  encoder.encode(timestamp + body)
);
```

검증 실패 시 HTTP 401을 반환한다. Discord는 이 응답을 보고 Endpoint를 무효 처리한다.

### Step 3. MODAL 응답 구성

Discord type=9 응답으로 모달을 띄운다. 링크 입력 필드 5개를 구성했다.

```typescript
// type=2 슬래시 커맨드 수신 시
return new Response(JSON.stringify({
  type: 9, // MODAL
  data: {
    custom_id: "verify_modal",
    title: "콘텐츠 인증",
    components: [
      { type: 1, components: [{ type: 4, custom_id: "link_1", label: "링크 1", style: 1, required: true }] },
      { type: 1, components: [{ type: 4, custom_id: "link_2", label: "링크 2", style: 1, required: false }] },
      // ... link_3, link_4, link_5
    ]
  }
}), { headers: { "Content-Type": "application/json" } });
```

### Step 4. 모달 제출 후 백그라운드 처리

Discord는 모달 제출(type=5)에 대해서도 3초 내 응답을 요구한다. AI 분석 + Sheets 저장 + Discord 메시지를 3초 안에 끝내는 건 불가능하므로 deferred 응답을 먼저 보내고 실제 처리는 백그라운드로 뺐다.

```typescript
// type=5 수신 시 즉시 응답
const deferredResponse = new Response(JSON.stringify({ type: 5 }), {
  headers: { "Content-Type": "application/json" }
});

// 백그라운드에서 실제 처리
EdgeRuntime.waitUntil(processVerification(interactionData));

return deferredResponse;
```

`EdgeRuntime.waitUntil()`은 Deno Edge Runtime에서 제공하는 API로, 응답을 반환한 후에도 비동기 작업이 완료될 때까지 실행 컨텍스트를 유지한다.

### Step 5. Google Service Account 인증 (JWT 직접 생성)

Edge Function 환경에서는 Google SDK를 사용하기 어렵다. Service Account JSON의 private_key로 JWT를 직접 생성해 Google OAuth2 토큰을 발급받는 방식을 사용했다.

```typescript
// RSASSA-PKCS1-v1_5 + SHA-256로 JWT 서명
const key = await crypto.subtle.importKey(
  "pkcs8",
  pemToBuffer(privateKey),
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  false,
  ["sign"]
);
const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
```

### Step 6. 환경 변수 등록 및 배포

```bash
# 시크릿 등록
supabase secrets set DISCORD_PUBLIC_KEY=<값>
supabase secrets set DISCORD_BOT_TOKEN=<값>
supabase secrets set DISCORD_APPLICATION_ID=<값>
supabase secrets set DISCORD_CHANNEL_ID=<값>
supabase secrets set GCP_SERVICE_ACCOUNT_JSON=<값>
supabase secrets set GOOGLE_SHEET_ID=<값>
supabase secrets set GEMINI_API_KEY=<값>

# 배포
supabase functions deploy discord-verify --no-verify-jwt
```

### Step 7. Discord 슬래시 커맨드 등록

Discord REST API로 `/인증` 커맨드를 등록했다.

```bash
curl -X POST \
  https://discord.com/api/v10/applications/<APPLICATION_ID>/guilds/<GUILD_ID>/commands \
  -H "Authorization: Bot <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"인증",
    "description":"콘텐츠 인증 (최대 5개 링크 입력 가능)",
    "options":[
      {
        "type":5,
        "name":"public",
        "description":"인증 완료 메시지에 링크를 공개할지 여부",
        "required":false
      }
    ]
  }'
```

### Step 8. Interactions Endpoint 등록

Discord Developer Portal → General Information → Interactions Endpoint URL에 Edge Function URL을 입력하고 저장했다. Discord가 자동으로 PING 요청을 보내 서명 검증 + PONG 응답을 확인한다.

---

## 4. 사용한 도구와 비용

| 도구 | 용도 | 비용 |
|------|------|------|
| Supabase Edge Function | Discord Interactions 처리 | Free Tier (충분) |
| Deno 2 Runtime | TypeScript 실행 환경 | Supabase 내 포함 |
| Google Gemini 1.5 Flash | URL 분석 및 콘텐츠 요약 | Free Tier (분당 15회) |
| Google Sheets REST API | 인증 데이터 저장 | 무료 |
| Discord Bot API | 슬래시 커맨드, 모달, 메시지 전송 | 무료 |
| Claude Code | 코드 작성 보조 | 구독 포함 |

---

## 5. 겪은 문제와 해결법

### 문제 1. Supabase JWT 인증 오류 (401)

**증상**: Edge Function 배포 후 Discord에서 Endpoint를 호출할 때마다 401 반환.

**원인**: Supabase는 기본적으로 모든 Edge Function 호출에 Supabase JWT 토큰을 요구한다. Discord는 자체 서명 방식을 사용하므로 Supabase JWT를 헤더에 포함하지 않는다.

**해결**: 배포 시 `--no-verify-jwt` 플래그를 사용해 Supabase JWT 검증을 비활성화했다. 대신 Discord Ed25519 서명 검증으로 요청 출처를 보장한다.

```bash
supabase functions deploy discord-verify --no-verify-jwt
```

### 문제 2. Service Account JSON의 개행문자 처리 오류

**증상**: `JSON.parse` 실행 시 "Unexpected token" 오류 발생.

**원인**: `supabase secrets set`으로 멀티라인 JSON을 저장할 때 `\n` 이스케이프 시퀀스가 실제 줄바꿈 문자로 변환된다. `private_key` 필드 안의 줄바꿈이 JSON 파싱을 깨뜨렸다.

**해결**: `JSON.parse` 전에 실제 줄바꿈을 `\n` 이스케이프 시퀀스로 되돌리는 전처리를 추가했다.

```typescript
const rawJson = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON") ?? "";
const safeJson = rawJson.replace(/\r?\n/g, "\\n");
const serviceAccount = JSON.parse(safeJson);
// private_key만 다시 실제 줄바꿈으로 복원
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
```

### 문제 3. 터미널 명령어 줄바꿈 오류

**증상**: 멀티라인 curl 명령어 실행 시 중간에 끊기거나 예기치 않게 실행됨.

**원인**: 터미널 환경에서 백슬래시 줄바꿈이 의도대로 처리되지 않는 경우가 있었다.

**해결**: 명령어를 쉘 스크립트 파일 (`register_command.sh`)로 작성하고 실행했다. 스크립트 파일에서는 줄바꿈이 안전하게 처리된다.

---

## 6. 결과 및 확인 방법

### 현재 동작 확인된 흐름

```
Discord 사용자 /인증 입력
  → Discord → Edge Function (Ed25519 서명 검증)
    → type=2 감지 → MODAL 응답 (링크 입력창 5개 팝업)
      → 사용자 링크 입력 후 제출
        → type=5 감지 → deferred 즉시 응답
          → 백그라운드: Gemini URL 분석 → Sheets 저장 → Discord follow-up 메시지
```

### 확인 방법

1. Discord 서버에서 `/인증` 입력 → 모달 팝업 확인
2. 링크 입력 후 제출 → "처리 중..." 메시지 확인
3. 수 초 후 Discord에 완료 메시지 + 플랫폼/주차 정보 표시 확인
   - `public:true`면 링크 노출
   - `public:false`(기본값)이면 링크 비노출
4. Google Sheets `시트1`에 행 추가 확인

### 배포 정보

- Supabase Project ref: `tcxtcacibgoancvoiybx`
- Edge Function URL: `https://tcxtcacibgoancvoiybx.supabase.co/functions/v1/discord-verify`
- Discord Application ID: `1474072217447829514`
- Discord Guild ID: `1473868607640305889`

---

## 남은 TODO

- [ ] 주차별 제출 횟수 태그 자동 생성 (예: `1주차-1회`)
- [ ] Discord 응답 메시지 내 URL 단축 처리 (OG Embed 방지 또는 활용)
- [ ] 주간 정산 워크플로우 구현 (Schedule Trigger → 통계 집계 → Discord 요약)
- [ ] URL 없는 모달 제출 예외 처리
