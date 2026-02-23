# SNS 포스트 모음

---

## 2026-02-22

### 주제: n8n에서 Supabase Edge Function으로 Discord 봇 아키텍처 전환

---

### LinkedIn

n8n으로 Discord 봇을 만들다가 벽에 부딪혔다.

Discord 슬래시 커맨드를 쓰려면 Interactions Endpoint를 등록해야 하는데, Discord가 요청마다 Ed25519 서명을 심어서 보낸다. 이 서명을 3초 안에 검증하고 응답하지 못하면 Discord가 Endpoint를 무효 처리한다.

n8n Webhook 노드는 이 검증 로직을 지원하지 않는다. 코드 노드로 우회를 시도했지만 응답 형식을 완전히 제어하기 어려웠다.

결국 Supabase Edge Function (Deno 2)으로 교체했다.

전환 후 달라진 것:
1. Ed25519 검증을 crypto.subtle 네이티브 API로 처리
2. 단일 링크 → 모달 팝업 (최대 5개 링크 동시 제출)
3. deferred 응답으로 3초 제한 우회, 백그라운드에서 AI 분석

비개발자인 내가 코드 한 줄 직접 안 쓰고 Claude Code에 지시해서 구현했다. 서버리스 함수, JWT, Ed25519가 뭔지 개념만 이해하면 충분했다.

도구를 이해하고, 올바른 질문을 만드는 것이 코딩 능력보다 중요한 시대다.

#AI자동화 #노코드 #Supabase #Discord봇 #개인브랜딩

---

### Threads

n8n으로 Discord 봇 만들다가 막혔다.

문제: Discord 슬래시 커맨드는 Ed25519 서명 검증 필수인데 n8n이 이걸 지원 안 함.

해결: Supabase Edge Function으로 통째로 교체.

코드 한 줄 안 쓰고 Claude Code 지시만으로 해결했다. 개념을 이해하면 코딩은 AI가 한다.
