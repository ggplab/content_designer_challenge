# 웹 로그인 · API 키 발급 설계안

이 문서는 대시보드에서 웹 로그인과 사용자별 API 키 발급 기능을 도입하기 위한 구현 계획입니다.

## 목표

- 참가자는 웹에서 로그인할 수 있어야 한다.
- 브라우저 사용은 세션 인증만 사용한다.
- 외부 자동화용 API 키는 사용자별로 발급한다.
- 발급된 키는 본인 참가자 이름으로만 인증 요청을 보낼 수 있어야 한다.
- 공개 HTML이나 클라이언트 JS에는 장기 API 키를 넣지 않는다.

## 설계 원칙

- Discord 중심 운영을 유지한다.
- 계정 식별은 Discord OAuth를 우선 사용한다.
- API 키 원문은 발급 시 1회만 보여주고, DB에는 해시만 저장한다.
- 브라우저 세션과 서버 자동화 키를 분리한다.
- 참가자 이름 검증은 정적 `VALID_NAMES`가 아니라 DB 매핑으로 이동한다.

## 권장 아키텍처

```text
브라우저
  → Supabase Auth (Discord OAuth)
    → session 발급
      → 보호된 웹 UI (/account)
        ├── 내 참가자 정보 조회
        ├── API 키 발급 / 폐기
        └── 세션 기반 웹 인증 제출

자동화 서버 / n8n / 개인 스크립트
  → Bearer <user_api_key>
    → Supabase Edge Function (web-verify)
      ├── API 키 해시 검증
      ├── user_id 식별
      ├── user_id ↔ 참가자 이름 매핑 검증
      ├── rate limit / audit log
      └── Google Sheets + Discord 기록
```

## 인증 전략

### 1. 로그인

- `Supabase Auth`에 Discord OAuth를 연결한다.
- 로그인 성공 시 `auth.users.id`를 기준으로 내부 사용자 식별을 통일한다.
- 첫 로그인 직후에는 아직 참가자 매핑이 없을 수 있으므로, 계정 페이지에서 관리자 승인 전 상태를 보여준다.

### 2. 참가자 매핑

- 각 로그인 계정은 챌린지 참가자 이름 1개에만 연결된다.
- 참가자 이름은 기존 `members.json`과 설문/시트 기준 이름 체계를 따른다.
- 동명이인 가능성이 있으면 Discord user id 또는 관리자 승인 절차로 해결한다.

### 3. 브라우저 인증

- 브라우저는 API 키를 쓰지 않는다.
- 로그인 세션으로 보호된 별도 제출 UI를 만들고, Edge Function은 JWT 또는 세션 기반으로 사용자 식별을 수행한다.
- 세션 사용자와 요청 본문의 참가자 이름이 다르면 403을 반환한다.

### 4. 자동화 인증

- 서버, n8n, 개인 백엔드만 API 키를 사용한다.
- 키는 사용자별로 여러 개 발급 가능하되, 이름과 용도를 붙인다.
- 각 키는 폐기 가능해야 하고 마지막 사용 시각이 남아야 한다.

## 데이터 모델

### `member_profiles`

로그인 사용자와 참가자 이름을 연결하는 테이블.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | `auth.users.id`, unique |
| `display_name` | `text` | 대시보드/설정 페이지 표시용 |
| `challenge_name` | `text` | 실제 참가자 이름 |
| `discord_user_id` | `text` | Discord 사용자 ID |
| `is_active` | `boolean` | 활성 참가자 여부 |
| `role` | `text` | `member` / `admin` |
| `created_at` | `timestamptz` | 생성 시각 |
| `updated_at` | `timestamptz` | 수정 시각 |

제약:
- `user_id` unique
- `challenge_name` unique
- `role`은 체크 제약으로 제한

### `api_keys`

발급된 자동화용 키 메타데이터 저장.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | 키 소유자 |
| `label` | `text` | 예: `n8n`, `home-server` |
| `key_prefix` | `text` | 앞 8~12자리 표시용 |
| `key_hash` | `text` | SHA-256 해시 |
| `scopes` | `jsonb` | 초기엔 `["submit:verify"]` 정도로 단순화 |
| `last_used_at` | `timestamptz` | 마지막 사용 |
| `expires_at` | `timestamptz` | 선택적 만료일 |
| `revoked_at` | `timestamptz` | 폐기 시각 |
| `created_at` | `timestamptz` | 생성 시각 |

제약:
- `key_hash` unique
- 폐기되지 않은 키만 유효

### `api_audit_logs`

키 사용 이력과 실패 기록 저장.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | 식별된 사용자, 실패 시 nullable 가능 |
| `api_key_id` | `uuid` | 사용 키 |
| `request_name` | `text` | 요청 본문의 이름 |
| `ip_address` | `text` | 호출 IP |
| `origin` | `text` | Origin 헤더 |
| `user_agent` | `text` | 클라이언트 식별 |
| `status_code` | `integer` | 결과 코드 |
| `error_code` | `text` | `invalid_key`, `name_mismatch`, `rate_limited` 등 |
| `created_at` | `timestamptz` | 호출 시각 |

## RLS 정책

### `member_profiles`

- 본인은 자신의 행만 조회 가능
- 관리자는 전체 조회/수정 가능
- 일반 사용자는 다른 사람의 `challenge_name`을 수정할 수 없음

### `api_keys`

- 본인은 자신의 키 목록만 조회 가능
- 본인은 자신의 키만 발급/폐기 가능
- 원문 키는 DB에 저장하지 않으므로 조회 API에서도 반환하지 않음

### `api_audit_logs`

- 본인은 자신의 로그만 조회 가능
- 관리자는 전체 조회 가능

## Edge Function 변경 방향

### `web-verify`

현재:
- 공용 `WEB_VERIFY_API_KEY` 1개 비교
- 이름은 정적 `VALID_NAMES`로 검증

변경 후:
- `Authorization: Bearer <user_api_key>` 또는 웹 세션으로 사용자 식별
- 키 해시 또는 세션 `user.id`로 `member_profiles` 조회
- `request.name === member_profiles.challenge_name` 검증
- 통과 시에만 Sheets/Discord 처리
- 성공/실패 모두 `api_audit_logs` 기록

추가 검증:
- Origin 제한
- IP + user_id 이중 rate limit
- 허용 플랫폼 URL allowlist
- 활성 사용자만 제출 가능 (`is_active = true`)

## 웹 UI 구성

### 1. `/account`

로그인 후 진입하는 계정 페이지.

표시 항목:
- 로그인 상태
- 연결된 참가자 이름
- Discord 계정 정보
- API 키 목록
- 최근 사용 로그

### 2. API 키 발급 모달

입력:
- 키 이름(label)
- 선택적 만료일

출력:
- 새 API 키 원문 1회 표시
- 복사 버튼
- 재확인 불가 경고

### 3. 세션 기반 제출 UI

기존 대시보드 상단 CTA를 로그인 상태에 따라 분기한다.

- 비로그인: `Discord에서 인증하기` 또는 `로그인`
- 로그인 + 매핑 완료: `웹에서 인증 제출`
- 로그인 + 매핑 미완료: `관리자 승인 대기`

## API 설계

### `POST /functions/v1/create-api-key`

목적:
- 로그인 사용자에게 새 자동화 키 발급

처리:
- 세션 사용자 확인
- 랜덤 키 생성
- prefix/sha256 저장
- 원문 키는 응답에서 한 번만 반환

### `POST /functions/v1/revoke-api-key`

목적:
- 기존 키 폐기

처리:
- 세션 사용자 확인
- 본인 키만 폐기 가능

### `GET /functions/v1/list-api-keys`

목적:
- 키 메타데이터 목록 조회

반환:
- `id`, `label`, `key_prefix`, `last_used_at`, `expires_at`, `revoked_at`

### `POST /functions/v1/web-verify`

목적:
- 세션 또는 사용자별 API 키로 인증 적재

추가 규칙:
- 세션 경로와 API 키 경로를 둘 다 지원하되, 사용자 식별 결과는 하나로 통일
- 요청 이름은 서버가 검증하고 필요하면 서버 측 이름으로 강제 덮어쓴다

## 구현 순서

### 1단계: Auth 기반 뼈대

- Supabase Auth에 Discord provider 연결
- 로그인/로그아웃 버튼 추가
- `/account` 페이지 또는 보호된 모달 추가
- `member_profiles` 테이블 생성

완료 기준:
- 로그인 성공
- 로그인한 사용자 정보 조회 가능

### 2단계: 참가자 매핑

- 관리자 또는 초기 스크립트로 `member_profiles` 채우기
- 기존 `members.json` 참가자와 Discord 계정 매핑 방식 결정
- 웹 UI에 매핑 상태 표시

완료 기준:
- 로그인 계정이 자신의 참가자 이름과 연결됨

### 3단계: API 키 발급

- `api_keys`, `api_audit_logs` 테이블 생성
- `create-api-key`, `revoke-api-key`, `list-api-keys` 함수 추가
- 계정 페이지에 키 관리 UI 추가

완료 기준:
- 사용자별 키 발급/폐기 가능
- 원문 키는 1회만 표시

### 4단계: `web-verify` 전환

- 공용 `WEB_VERIFY_API_KEY` 비교 제거
- 키 해시 조회 또는 세션 사용자로 검증
- `VALID_NAMES` 제거 또는 보조 검증으로 축소
- audit log 적재

완료 기준:
- 사용자별 키 또는 세션으로만 제출 가능
- 타인 이름 제출 불가

### 5단계: 운영 전환

- 기존 공용 키 폐기
- 문서 업데이트
- 운영자용 매핑 절차 정리
- 장애 대응 및 키 분실 대응 가이드 작성

완료 기준:
- 공개 키 없는 상태로 운영 전환 완료

## 마이그레이션 전략

초기에는 다음 방식이 가장 안전합니다.

1. Discord OAuth 로그인 먼저 도입
2. 관리자 수동 매핑으로 `member_profiles`를 채움
3. 일부 사용자에게만 API 키 발급 기능 오픈
4. `web-verify`를 사용자 키 검증 방식으로 전환
5. 마지막에 기존 공용 키를 폐기

이 순서로 가면 로그인은 먼저 붙여도 제출 기능이 바로 깨지지 않습니다.

## 실제 적용 체크리스트

1. Supabase Dashboard에서 Discord OAuth provider를 활성화한다.
2. Redirect URL에 `https://content.ggplab.xyz/account.html`과 로컬 테스트 URL을 등록한다.
3. SQL Editor 또는 CLI로 `supabase/migrations/20260316143000_web_auth_api_keys.sql`을 적용한다.
4. Edge Function 시크릿에 아래 값을 추가한다.
   - 기본 제공 `SUPABASE_URL`
   - 기본 제공 `SUPABASE_ANON_KEY` 또는 `SUPABASE_PUBLISHABLE_KEY`
   - 커스텀 `SERVICE_ROLE_KEY`
5. `web/app-config.js`에 공개 가능한 `supabaseUrl`, `supabasePublishableKey`, `functionsBaseUrl`를 설정한다.
6. `claim-member-profile`, `create-api-key`, `list-api-keys`, `revoke-api-key`, `web-verify`를 배포한다.
7. 실제 계정으로 `account.html` 로그인 → 참가자 이름 연결 → API 키 발급까지 스모크 테스트한다.

## 오픈 이슈

- 참가자 이름과 Discord 계정 매핑을 누가 승인할지
- 동명이인 처리 기준을 `challenge_name` 외에 무엇으로 보조할지
- n8n 사용자가 브라우저가 아닌 서버 환경에서 비밀을 안전하게 보관할 수 있는지
- 한 사용자에게 여러 자동화 키를 허용할지
- 키 만료를 필수로 할지 선택으로 둘지

## 권장 MVP 범위

첫 배포는 아래만 해도 충분합니다.

- Discord OAuth 로그인
- `member_profiles`
- API 키 1개 발급/폐기
- `web-verify` 사용자 키 검증
- 본인 이름만 제출 가능
- 감사 로그와 기본 rate limit

관리자 UI, 다중 키, 만료 정책, 사용 통계는 2차로 미뤄도 됩니다.
