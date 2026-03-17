# 웹 로그인 · API 키 배포 체크리스트

이 문서는 Discord OAuth 로그인, 참가자 이름 연결, 사용자별 API 키 발급 기능을 실제 운영 환경에 올릴 때 필요한 순서를 정리한 것입니다.

## 1. Supabase Auth 설정

Supabase Dashboard에서:

1. `Authentication` → `Providers` → `Discord` 활성화
2. Discord OAuth Client ID / Client Secret 입력
3. Redirect URL 등록

권장 Redirect URL:

- `https://ggplab.github.io/content_designer_challenge/account.html`
- `http://localhost:4173/account.html`

## 2. Discord Developer Portal 설정

Discord 애플리케이션에서 OAuth Redirect URL을 Supabase와 동일하게 등록합니다.

- `https://tcxtcacibgoancvoiybx.supabase.co/auth/v1/callback`

Discord Provider를 Supabase Auth에 연결할 때 실제 콜백 URL은 Supabase 쪽이므로, Discord 앱에는 Supabase callback URL이 등록되어 있어야 합니다.

## 3. Supabase DB 반영

저장소를 프로젝트에 링크한 뒤 마이그레이션을 반영합니다.

```bash
supabase link --project-ref tcxtcacibgoancvoiybx
supabase db push
```

반영 후 확인할 테이블:

- `public.challenge_members`
- `public.member_profiles`
- `public.api_keys`
- `public.api_audit_logs`

## 4. Edge Function 시크릿 설정

최소 필요 시크릿:

```bash
supabase secrets set SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>

supabase secrets set DISCORD_PUBLIC_KEY=<DISCORD_PUBLIC_KEY>
supabase secrets set DISCORD_APPLICATION_ID=1474072217447829514
supabase secrets set DISCORD_BOT_TOKEN=<DISCORD_BOT_TOKEN>

supabase secrets set GEMINI_API_KEY=<GEMINI_API_KEY>
supabase secrets set GOOGLE_SHEET_ID=1CKyVexXErtbkAVm6I-30fh3tei6J4B9HtCjq0-fmvvU
supabase secrets set GCP_SERVICE_ACCOUNT_JSON=<MINIFIED_SERVICE_ACCOUNT_JSON>

supabase secrets set WEB_VERIFY_ALLOWED_ORIGINS=https://ggplab.github.io/content_designer_challenge,https://ggplab.github.io,http://localhost:4173
supabase secrets set WEB_VERIFY_RATE_LIMIT_WINDOW_MS=600000
supabase secrets set WEB_VERIFY_RATE_LIMIT_MAX=20
```

주의:

- 기존 공용 `WEB_VERIFY_API_KEY`는 더 이상 기본 인증 모델이 아닙니다.
- 남아 있더라도 새 구조에서는 사용자별 API 키 발급 후 점진적으로 폐기하는 것이 맞습니다.

## 5. Edge Function 배포

```bash
supabase functions deploy discord-verify --project-ref tcxtcacibgoancvoiybx --no-verify-jwt
supabase functions deploy web-verify --project-ref tcxtcacibgoancvoiybx --no-verify-jwt
supabase functions deploy claim-member-profile --project-ref tcxtcacibgoancvoiybx --no-verify-jwt
supabase functions deploy create-api-key --project-ref tcxtcacibgoancvoiybx --no-verify-jwt
supabase functions deploy list-api-keys --project-ref tcxtcacibgoancvoiybx --no-verify-jwt
supabase functions deploy revoke-api-key --project-ref tcxtcacibgoancvoiybx --no-verify-jwt
```

## 6. 웹 공개 설정

`web/app-config.js`를 실제 값으로 채웁니다.

```js
window.APP_CONFIG = {
  supabaseUrl: "https://tcxtcacibgoancvoiybx.supabase.co",
  supabasePublishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  functionsBaseUrl: "https://tcxtcacibgoancvoiybx.supabase.co/functions/v1",
};
```

공개 가능한 값:

- Supabase URL
- Supabase Publishable Key
- Functions Base URL

공개하면 안 되는 값:

- `SERVICE_ROLE_KEY`
- 사용자별 API 키 원문
- Discord Bot Token
- GCP Service Account JSON

## 7. 정적 사이트 배포

`main` 브랜치에 푸시하면 GitHub Pages가 `web/`를 배포합니다.

확인 경로:

- `https://ggplab.github.io/content_designer_challenge`
- `https://ggplab.github.io/content_designer_challenge/account.html`

## 8. 스모크 테스트

### 로그인 테스트

1. `account.html` 접속
2. Discord 로그인
3. 로그인 상태가 표시되는지 확인

### 참가자 연결 테스트

1. 참가자 이름 드롭다운에서 본인 이름 선택
2. 연결 완료 메시지 확인
3. `member_profiles`에 새 행이 생겼는지 확인

### API 키 발급 테스트

1. 키 이름 입력 후 발급
2. 원문 키가 1회만 표시되는지 확인
3. `api_keys`에 prefix/hash만 저장되는지 확인

### API 호출 테스트

발급받은 키로:

```bash
curl -X POST https://tcxtcacibgoancvoiybx.supabase.co/functions/v1/web-verify \
  -H "Authorization: Bearer <USER_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name":"본인이름","links":["https://www.linkedin.com/posts/..."],"isPublic":true}'
```

확인 포인트:

- 본인 이름이면 성공
- 다른 이름이면 403
- 허용되지 않은 도메인이면 400
- 과도 호출이면 429

## 9. 운영 전환 체크

전환 완료 기준:

- `account.html` 로그인 가능
- 참가자 이름 연결 가능
- 사용자별 API 키 발급 가능
- `web-verify`가 사용자별 키 또는 세션만 받음
- 기존 공용 키는 폐기 또는 비상용으로만 남김

## 10. 권장 후속 작업

- `web/app-config.js` 자동 생성 빌드 단계 추가
- 관리자 전용 `member_profiles` 승인/수정 UI 추가
- 세션 기반 웹 제출 UI 추가
- 기존 `.env`/시크릿 정리 및 키 로테이션 완료
