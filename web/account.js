import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const authStatusEl = document.getElementById("auth-status");
const profileMetaEl = document.getElementById("profile-meta");
const apiKeysEl = document.getElementById("api-keys");
const auditLogsEl = document.getElementById("audit-logs");
const createKeyResultEl = document.getElementById("create-key-result");
const createKeyResultTitleEl = document.getElementById("create-key-result-title");
const createKeyResultMessageEl = document.getElementById("create-key-result-message");
const createKeySecretEl = document.getElementById("create-key-secret");
const copyKeyButton = document.getElementById("copy-key-button");
const claimProfileResultEl = document.getElementById("claim-profile-result");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const refreshButton = document.getElementById("refresh-button");
const createKeyForm = document.getElementById("create-key-form");
const createKeyButton = document.getElementById("create-key-button");
const keyLabelInput = document.getElementById("key-label");
const keyExpiryInput = document.getElementById("key-expiry");
const claimProfileForm = document.getElementById("claim-profile-form");
const claimProfileButton = document.getElementById("claim-profile-button");
const claimChallengeNameSelect = document.getElementById("claim-challenge-name");
const claimDisplayNameInput = document.getElementById("claim-display-name");

const config = window.APP_CONFIG || {};
const supabaseUrl = config.supabaseUrl || "";
const supabasePublishableKey = config.supabasePublishableKey || "";
const functionsBaseUrl = config.functionsBaseUrl || (supabaseUrl ? `${supabaseUrl}/functions/v1` : "");

let supabase = null;
let currentSession = null;
let latestIssuedApiKey = "";

function setStatus(message, type) {
  authStatusEl.textContent = message;
  authStatusEl.className = `status${type ? ` ${type}` : ""}`;
}

function showCreateKeyResult(message, type, secret = "") {
  createKeyResultEl.style.display = "block";
  createKeyResultEl.className = `status${type ? ` ${type}` : ""}`;
  createKeyResultTitleEl.textContent = type === "success" ? "발급 결과" : "오류";
  createKeyResultMessageEl.textContent = message;
  latestIssuedApiKey = secret;
  if (secret) {
    createKeySecretEl.style.display = "block";
    createKeySecretEl.textContent = secret;
    copyKeyButton.style.display = "inline-flex";
  } else {
    createKeySecretEl.style.display = "none";
    createKeySecretEl.textContent = "";
    copyKeyButton.style.display = "none";
  }
}

function resetCreateKeyResult() {
  createKeyResultEl.style.display = "none";
  createKeyResultTitleEl.textContent = "";
  createKeyResultMessageEl.textContent = "";
  createKeySecretEl.textContent = "";
  createKeySecretEl.style.display = "none";
  copyKeyButton.style.display = "none";
  latestIssuedApiKey = "";
}

function showClaimResult(message, type) {
  claimProfileResultEl.style.display = "block";
  claimProfileResultEl.className = `status${type ? ` ${type}` : ""}`;
  claimProfileResultEl.textContent = message;
}

function resetClaimResult() {
  claimProfileResultEl.style.display = "none";
  claimProfileResultEl.textContent = "";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

function formatDateInputValue(date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function getDefaultKeyLabel(profile) {
  const owner = profile?.challenge_name || "member";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${owner}-${date}`;
}

function getDefaultExpiryValue() {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return formatDateInputValue(date);
}

function applyDefaultApiKeyFormValues(profile) {
  if (!keyLabelInput || !keyExpiryInput) return;
  if (!keyLabelInput.value.trim()) {
    keyLabelInput.value = getDefaultKeyLabel(profile);
  }
  if (!keyExpiryInput.value) {
    keyExpiryInput.value = getDefaultExpiryValue();
  }
}

function renderMeta(profile, session) {
  if (!profile) {
    profileMetaEl.innerHTML = '<div class="empty">참가자 매핑이 아직 없습니다. 운영자에게 계정 연결을 요청하세요.</div>';
    return;
  }

  const items = [
    ["이메일", session?.user?.email || "-"],
    ["표시 이름", profile.display_name || "-"],
    ["참가자 이름", profile.challenge_name || "-"],
    ["Discord User ID", profile.discord_user_id || "-"],
    ["권한", profile.role || "member"],
    ["상태", profile.is_active ? "활성" : "비활성"],
  ];

  profileMetaEl.innerHTML = items.map(([label, value]) => `
    <div class="meta-item">
      <span class="meta-label">${label}</span>
      <div class="meta-value">${value}</div>
    </div>
  `).join("");
}

function renderApiKeys(keys) {
  if (!keys || keys.length === 0) {
    apiKeysEl.innerHTML = '<div class="empty">발급된 API 키가 없습니다.</div>';
    return;
  }

  apiKeysEl.innerHTML = keys.map((key) => {
    const revoked = Boolean(key.revoked_at);
    return `
      <div class="list-item">
        <div class="list-row">
          <div>
            <p class="list-title">${key.label}</p>
            <p class="list-sub">
              Prefix: <code>${key.key_prefix}</code><br>
              생성: ${formatDateTime(key.created_at)}<br>
              마지막 사용: ${formatDateTime(key.last_used_at)}<br>
              만료: ${formatDateTime(key.expires_at)}<br>
              상태: ${revoked ? "폐기됨" : "사용 가능"}
            </p>
          </div>
          <button class="danger revoke-key-button" type="button" data-key-id="${key.id}" ${revoked ? "disabled" : ""}>
            키 폐기
          </button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".revoke-key-button").forEach((button) => {
    button.addEventListener("click", async () => {
      await revokeApiKey(button.dataset.keyId);
    });
  });
}

function renderAuditLogs(logs) {
  if (!logs || logs.length === 0) {
    auditLogsEl.innerHTML = '<div class="empty">최근 사용 로그가 없습니다.</div>';
    return;
  }

  auditLogsEl.innerHTML = logs.map((log) => `
    <div class="list-item">
      <p class="list-title">${formatDateTime(log.created_at)} · ${log.status_code}</p>
      <p class="list-sub">
        이름: ${log.request_name || "-"}<br>
        Origin: ${log.origin || "-"}<br>
        IP: ${log.ip_address || "-"}<br>
        오류 코드: ${log.error_code || "-"}
      </p>
    </div>
  `).join("");
}

function renderClaimOptions(challengeMembers, profile) {
  if (!challengeMembers || challengeMembers.length === 0) {
    claimChallengeNameSelect.innerHTML = '<option value="">연결 가능한 참가자 이름이 없습니다.</option>';
    claimProfileButton.disabled = true;
    return;
  }

  claimChallengeNameSelect.innerHTML = ['<option value="">참가자 이름을 선택하세요</option>']
    .concat(challengeMembers.map((name) => `<option value="${name}">${name}</option>`))
    .join("");
  claimProfileButton.disabled = Boolean(profile);
  claimChallengeNameSelect.disabled = Boolean(profile);
  claimDisplayNameInput.disabled = Boolean(profile);
  if (profile) {
    claimDisplayNameInput.value = profile.display_name || profile.challenge_name || "";
    showClaimResult(`이미 연결된 참가자 이름이 있습니다: ${profile.challenge_name}`, "success");
  } else {
    resetClaimResult();
  }
  applyDefaultApiKeyFormValues(profile);
}

function updateAuthButtons(isLoggedIn, hasProfile = false) {
  loginButton.style.display = isLoggedIn ? "none" : "inline-flex";
  logoutButton.style.display = isLoggedIn ? "inline-flex" : "none";
  refreshButton.style.display = isLoggedIn ? "inline-flex" : "none";
  createKeyButton.disabled = !isLoggedIn || !hasProfile;
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

async function callFunction(path, options = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch(`${functionsBaseUrl}/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "요청을 처리하지 못했습니다.");
  }
  return payload;
}

async function loadAccount() {
  if (!supabase) return;

  const { data } = await supabase.auth.getSession();
  currentSession = data.session;

  if (!currentSession) {
    updateAuthButtons(false, false);
    setStatus("로그인이 필요합니다. Discord 계정으로 로그인하세요.", "");
    renderMeta(null, null);
    renderApiKeys([]);
    renderAuditLogs([]);
    renderClaimOptions([], null);
    return;
  }

  updateAuthButtons(true, false);
  setStatus("로그인됨", "success");

  try {
    const payload = await callFunction("list-api-keys", { method: "GET" });
    renderMeta(payload.profile, currentSession);
    renderApiKeys(payload.apiKeys);
    renderAuditLogs(payload.auditLogs);
    renderClaimOptions(payload.challengeMembers, payload.profile);
    updateAuthButtons(true, Boolean(payload.profile));

    if (!payload.profile) {
      setStatus("로그인됨. 아직 참가자 이름 연결이 없습니다. 아래에서 본인 이름을 선택해 연결하세요.", "error");
    }
  } catch (error) {
    setStatus(error.message, "error");
    renderMeta(null, currentSession);
    renderApiKeys([]);
    renderAuditLogs([]);
    renderClaimOptions([], null);
  }
}

async function loginWithDiscord() {
  resetCreateKeyResult();
  await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: window.location.href,
    },
  });
}

async function logout() {
  await supabase.auth.signOut();
  await loadAccount();
}

async function createApiKey(event) {
  event.preventDefault();
  resetCreateKeyResult();
  createKeyButton.disabled = true;

  try {
    const label = document.getElementById("key-label").value.trim();
    const expiryRaw = document.getElementById("key-expiry").value;
    const expiresAt = expiryRaw ? new Date(expiryRaw).toISOString() : null;
    const payload = await callFunction("create-api-key", {
      method: "POST",
      body: JSON.stringify({ label, expiresAt }),
    });

    showCreateKeyResult(
      "새 API 키가 발급되었습니다. 이 값은 지금 한 번만 표시됩니다. 안전한 비밀 저장소에 보관하세요.",
      "success",
      payload.apiKey
    );
    createKeyForm.reset();
    await loadAccount();
  } catch (error) {
    showCreateKeyResult(error.message, "error");
  } finally {
    createKeyButton.disabled = false;
  }
}

async function copyLatestApiKey() {
  if (!latestIssuedApiKey) return;
  await navigator.clipboard.writeText(latestIssuedApiKey);
  const originalText = copyKeyButton.textContent;
  copyKeyButton.textContent = "복사됨";
  setTimeout(() => {
    copyKeyButton.textContent = originalText;
  }, 1200);
}

async function claimProfile(event) {
  event.preventDefault();
  resetClaimResult();
  claimProfileButton.disabled = true;

  try {
    const payload = await callFunction("claim-member-profile", {
      method: "POST",
      body: JSON.stringify({
        challengeName: claimChallengeNameSelect.value,
        displayName: claimDisplayNameInput.value.trim(),
      }),
    });
    showClaimResult(`참가자 이름이 연결되었습니다: ${payload.profile.challenge_name}`, "success");
    await loadAccount();
  } catch (error) {
    showClaimResult(error.message, "error");
  } finally {
    claimProfileButton.disabled = false;
  }
}

async function revokeApiKey(keyId) {
  if (!keyId) return;
  if (!window.confirm("이 API 키를 폐기할까요? 폐기 후에는 다시 사용할 수 없습니다.")) {
    return;
  }

  try {
    await callFunction("revoke-api-key", {
      method: "POST",
      body: JSON.stringify({ keyId }),
    });
    showCreateKeyResult("API 키를 폐기했습니다.", "success");
    await loadAccount();
  } catch (error) {
    showCreateKeyResult(error.message, "error");
  }
}

function showConfigError() {
  updateAuthButtons(false, false);
  setStatus("`web/app-config.js`에 Supabase URL과 publishable key를 설정해야 합니다.", "error");
  renderMeta(null, null);
  renderApiKeys([]);
  renderAuditLogs([]);
  renderClaimOptions([], null);
}

async function init() {
  if (!supabaseUrl || !supabasePublishableKey) {
    showConfigError();
    return;
  }

  supabase = createClient(supabaseUrl, supabasePublishableKey);

  loginButton.addEventListener("click", loginWithDiscord);
  logoutButton.addEventListener("click", logout);
  refreshButton.addEventListener("click", loadAccount);
  createKeyForm.addEventListener("submit", createApiKey);
  copyKeyButton.addEventListener("click", copyLatestApiKey);
  claimProfileForm.addEventListener("submit", claimProfile);

  supabase.auth.onAuthStateChange(() => {
    loadAccount();
  });

  await loadAccount();
}

init();
