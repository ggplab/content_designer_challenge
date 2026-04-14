# 시스템 아키텍처 — 너만·알맡 챌린지

> 작성일: 2026-03-17

---

## 1. 전체 시스템 흐름도

```mermaid
sequenceDiagram
    actor User as 사용자 (Discord)
    participant DC as Discord
    participant DV as discord-verify<br/>(Supabase Edge Fn)
    participant WV as web-verify<br/>(Supabase Edge Fn)
    participant GS as Google Sheets
    participant GM as Gemini 2.5 Flash
    participant WEB as Web Dashboard<br/>(GitHub Pages)

    %% Discord 인증 플로우
    rect rgb(230, 245, 255)
        Note over User,DC: Discord /인증 플로우
        User->>DC: /인증 슬래시 커맨드
        DC->>DV: POST (type=2)
        DV-->>DC: { type: 9 } 모달 팝업
        User->>DC: 링크 1~5개 입력 후 제출
        DC->>DV: POST (type=5, 모달 데이터)
        DV-->>DC: { type: 5 } 즉시 응답 (3초 제한 대응)

        Note over DV: EdgeRuntime.waitUntil() 백그라운드 처리
        loop 각 URL별
            DV->>DV: detectPlatform(url)
            alt Instagram / Threads
                DV->>DV: summary = "{platform}콘텐츠" (고정)
            else 그 외 플랫폼
                DV->>DV: fetchOGSummary(url) [5초 timeout]
                alt OG 태그 실패
                    DV->>GM: URL + 프롬프트
                    GM-->>DV: 15자 요약
                end
            end
            DV->>GS: appendToSheets(row)
            GS-->>DV: 200 OK
            alt 공개 제출 + 단축 가능 플랫폼
                DV->>DB: insertShortLink(code, url)
                DB-->>DV: ok
            end
        end
        DV->>GS: getWeekCounts() — 이번 주 제출 순위 조회
        GS-->>DV: 시트 데이터
        DV->>DC: PATCH follow-up 메시지<br/>(플랫폼, 요약, 주차, 메달, 단축 URL)
        DC-->>User: 인증 완료 메시지 표시
    end

    %% 주간 정산 플로우
    rect rgb(230, 255, 230)
        Note over DV,GS: 주간 정산 플로우 (매주 일요일 또는 수동)
        Note over DV: weekly-summary Edge Fn
        DV->>GS: 지난주 행 조회 (날짜 필터)
        GS-->>DV: 시트 데이터
        DV->>DC: GET /guilds/{id}/members (닉네임→ID 맵)
        DC-->>DV: 서버 멤버 목록
        DV->>GM: 추천 콘텐츠 선정 프롬프트
        GM-->>DV: 교육적·챌린지·후킹 콘텐츠 인덱스
        DV->>DC: POST /channels/{id}/messages\n(주간 정산 임베드, 멘션 포함)
        DC-->>User: 주간 정산 메시지 표시
    end

    %% 웹 인증 플로우
    rect rgb(255, 245, 230)
        Note over User,WEB: 웹 대시보드 인증 플로우
        User->>WEB: account.html 접속
        WEB->>DC: Discord OAuth 로그인
        DC-->>WEB: Supabase 세션 발급
        WEB->>WV: POST /verify (Bearer token or API key)
        WV->>WV: 서명 검증 + Rate Limit 체크
        loop 각 URL별
            WV->>GM: URL 요약 요청
            GM-->>WV: summary
            WV->>GS: appendToSheets(row)
        end
        WV-->>WEB: { ok: true, results: [...] }
    end
```

---

## 2. 컴포넌트 구조도

```mermaid
graph TD
    subgraph CLIENT["클라이언트"]
        DISCORD["Discord\n(사용자)"]
        BROWSER["웹 브라우저\n(사용자)"]
    end

    subgraph PAGES["GitHub Pages (ggplab.github.io)"]
        INDEX["index.html\n공개 리더보드"]
        ACCOUNT["account.html\n계정 관리"]
        ACCJS["account.js"]
        CFG["app-config.js"]
        MEMBERS["members.json\n참가자 목록"]
    end

    subgraph SUPABASE["Supabase (tcxtcacibgoancvoiybx · Tokyo)"]
        subgraph EDGE["Edge Functions (Deno)"]
            DV["discord-verify\n─────────────\nindex.ts (서명 검증·라우팅)\nverification.ts (오케스트레이터)\nservices/ (summarizer·sheets·discord·modal)"]
            WV["web-verify\n─────────────\nCORS 검증\nRate Limit\n감사 로그"]
            CLAIM["claim-member-profile\n참가자 이름 연결"]
            CKEY["create-api-key\nAPI 키 발급"]
            LKEY["list-api-keys\n키 목록 조회"]
            RKEY["revoke-api-key\n키 폐기"]
            WS["weekly-summary\n─────────────\nindex.ts (라우팅)\nsummary.ts (오케스트레이터)\nservices/ (discord·gemini·sheets·url)"]
            R["r\n─────────────\nURL 단축 리다이렉트"]
            SHARED["_shared/\n─────────────\nauth · cors · crypto · session\nsupabase · google-auth\nweek · platform · sheets · url\nshort-links"]
        end
        subgraph CRON["pg_cron (워밍업)"]
            WARMUP["warmup-discord-verify\n─────────────\n*/5 * * * *\npg_net.http_get()"]
        end
        subgraph DB["PostgreSQL (RLS 적용)"]
            MP["member_profiles\n─────────────\nuser_id\nchallenge_name\ndisplay_name\ndiscord_user_id\nrole"]
            CM["challenge_members\n─────────────\nchallenge_name\nis_active"]
            AK["api_keys\n─────────────\nkey_hash (SHA-256)\nkey_prefix\nscopes\nexpires_at\nrevoked_at"]
            AL["api_audit_logs\n─────────────\nip_address\norigin\nstatus_code\nerror_code"]
            SL["short_links\n─────────────\ncode (PK)\noriginal_url\ncreated_at"]
        end
        AUTH["Supabase Auth\n(Discord OAuth)"]
    end

    subgraph EXTERNAL["외부 서비스"]
        GS["Google Sheets\n시트1\n인증 기록 저장"]
        GM["Gemini 2.5 Flash\nURL 요약 생성"]
        GAUTH["Google OAuth\n(Service Account)"]
    end

    %% Cron → Edge Functions (워밍업)
    WARMUP -->|"GET /discord-verify\n5분마다"| DV

    %% 클라이언트 → Edge Functions
    DISCORD -->|"POST /discord-verify\nEd25519 서명"| DV
    BROWSER --> INDEX
    BROWSER --> ACCOUNT
    ACCOUNT --> ACCJS
    ACCJS -->|"Bearer / API Key"| WV
    ACCJS --> CLAIM
    ACCJS --> CKEY
    ACCJS --> LKEY
    ACCJS --> RKEY

    %% 웹 내부
    INDEX -->|fetch| MEMBERS
    ACCOUNT --> CFG

    %% 클라이언트 → r (리다이렉트)
    BROWSER -->|"GET /r/{code}"| R
    R --> SHARED

    %% Edge → Shared
    DV --> SHARED
    WV --> SHARED
    CLAIM --> SHARED
    CKEY --> SHARED
    LKEY --> SHARED
    RKEY --> SHARED

    %% Edge → DB
    SHARED --> MP
    SHARED --> CM
    SHARED --> AK
    SHARED --> AL
    SHARED --> AUTH
    DV -->|"insertShortLink"| SL
    R -->|"resolveShortLink"| SL

    %% Edge → External
    DV -->|"append row\ngetWeekCounts"| GS
    WV -->|"append row"| GS
    DV -->|"URL 요약"| GM
    WV -->|"URL 요약"| GM
    GS -->|"JWT OAuth"| GAUTH

    %% Weekly summary
    WS -->|"지난주 행 조회"| GS
    WS -->|"GET 길드 멤버 목록"| DISCORD
    WS -->|"추천 콘텐츠 선정"| GM
    WS -->|"POST 주간 정산 임베드 (멘션 포함)"| DISCORD

    %% Discord followup
    DV -->|"PATCH webhook\nfollow-up 메시지"| DISCORD
```

---

## 3. 데이터 모델 (DB Schema)

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        text email
    }

    MEMBER_PROFILES {
        uuid id PK
        uuid user_id FK
        text display_name
        text challenge_name UK
        text discord_user_id UK
        boolean is_active
        text role
        timestamptz created_at
        timestamptz updated_at
    }

    CHALLENGE_MEMBERS {
        uuid id PK
        text challenge_name UK
        boolean is_active
        timestamptz created_at
    }

    API_KEYS {
        uuid id PK
        uuid user_id FK
        text label
        text key_prefix
        text key_hash UK
        jsonb scopes
        timestamptz last_used_at
        timestamptz expires_at
        timestamptz revoked_at
        timestamptz created_at
    }

    API_AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        uuid api_key_id FK
        text request_name
        text ip_address
        text origin
        text user_agent
        int status_code
        text error_code
        timestamptz created_at
    }

    GOOGLE_SHEETS_ROW {
        text date "YYYY-MM-DD (KST)"
        text user "Discord global_name"
        text platfrom "플랫폼 (오타 유지)"
        text link "제출 URL"
        text number "N주차-M회"
        text summary "최대 40자 요약"
        text etc "public / private"
    }

    SHORT_LINKS {
        text code PK "6자리 랜덤 코드"
        text original_url "원본 URL"
        timestamptz created_at
    }

    AUTH_USERS ||--o| MEMBER_PROFILES : "1:1 claim"
    AUTH_USERS ||--o{ API_KEYS : "issues"
    AUTH_USERS ||--o{ API_AUDIT_LOGS : "logged"
    API_KEYS ||--o{ API_AUDIT_LOGS : "used_by"
    CHALLENGE_MEMBERS ||--o| MEMBER_PROFILES : "mapped_to"
```

---

## 4. 주요 처리 로직 요약

### 주차 계산
```
발행 시작일: 2026-03-02 (KST)
준비기간: ~ 2026-03-01
1주차: 03-02 ~ 03-08
2주차: 03-09 ~ 03-15
...
12주차: 05-18 ~ 05-23
```

### 메달 부여
```
해당 주차 내 제출 순서 기준:
1번째 → 🥇  |  2번째 → 🥈  |  3번째 → 🥉
```

### URL 요약 우선순위
```
Instagram / Threads: 고정 문자열 "{platform}콘텐츠" (OG fetch · Gemini 호출 없음)
  → 이유: 클라우드 서버 IP 차단으로 429 반환, URL 자체에 내용 정보 없어 Gemini 할루시네이션 발생

그 외 플랫폼:
  1순위: OG 메타 태그 (og:title, twitter:title, <title>) — 5초 timeout
  2순위: Gemini 2.5 Flash — 15자 이내 한국어 요약
```

### 인증 수단 (web-verify)
```
1. Supabase 세션 Bearer 토큰 (Discord OAuth 로그인)
2. API 키 (ggplab_ 접두사, SHA-256 해시 저장)
```
