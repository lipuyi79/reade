// firebase.js - Firebase REST 封装（Auth + Firestore），用于 options 页
// 不依赖 firebase SDK，纯 fetch，兼容 MV3 的 CSP

const FB = (() => {
  const STORAGE_KEY = 'fbConfig';
  const SESSION_KEY = 'fbSession';

  // ---------- 配置 ----------
  async function getConfig() {
    const r = await chrome.storage.local.get([STORAGE_KEY]);
    return r[STORAGE_KEY] || null;
  }

  async function setConfig(config) {
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
  }

  async function clearConfig() {
    await chrome.storage.local.remove([STORAGE_KEY]);
  }

  // ---------- 会话 ----------
  async function getSession() {
    const r = await chrome.storage.local.get([SESSION_KEY]);
    return r[SESSION_KEY] || null;
  }

  async function setSession(session) {
    await chrome.storage.local.set({ [SESSION_KEY]: session });
  }

  async function clearSession() {
    await chrome.storage.local.remove([SESSION_KEY]);
  }

  function nowSec() {
    return Math.floor(Date.now() / 1000);
  }

  // ---------- 错误 ----------
  function fbError(json) {
    const msg = (json && json.error && json.error.message) || 'UNKNOWN_ERROR';
    const map = {
      EMAIL_EXISTS: '该邮箱已被注册',
      OPERATION_NOT_ALLOWED: '此登录方式未在 Firebase 中启用',
      TOO_MANY_ATTEMPTS_TRY_LATER: '尝试次数过多，请稍后重试',
      EMAIL_NOT_FOUND: '邮箱不存在',
      INVALID_PASSWORD: '密码错误',
      INVALID_LOGIN_CREDENTIALS: '邮箱或密码错误',
      USER_DISABLED: '该账号已被禁用',
      WEAK_PASSWORD: '密码强度不足（至少 6 位）',
      INVALID_EMAIL: '邮箱格式不正确'
    };
    const key = msg.split(' ')[0];
    return new Error(map[key] || msg);
  }

  // ---------- Auth ----------
  async function signUp(email, password) {
    const cfg = await getConfig();
    if (!cfg || !cfg.apiKey) throw new Error('请先填写并保存 Firebase 配置');
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const json = await res.json();
    if (!res.ok) throw fbError(json);
    await setSession({
      idToken: json.idToken,
      refreshToken: json.refreshToken,
      uid: json.localId,
      email: json.email,
      expiresAt: nowSec() + parseInt(json.expiresIn, 10)
    });
    return json;
  }

  async function signIn(email, password) {
    const cfg = await getConfig();
    if (!cfg || !cfg.apiKey) throw new Error('请先填写并保存 Firebase 配置');
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const json = await res.json();
    if (!res.ok) throw fbError(json);
    await setSession({
      idToken: json.idToken,
      refreshToken: json.refreshToken,
      uid: json.localId,
      email: json.email,
      expiresAt: nowSec() + parseInt(json.expiresIn, 10)
    });
    return json;
  }

  async function signOut() {
    await clearSession();
  }

  async function ensureFreshToken() {
    const cfg = await getConfig();
    const sess = await getSession();
    if (!cfg || !sess) return null;
    if (sess.expiresAt - nowSec() > 60) return sess;

    // refresh
    const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(sess.refreshToken)}`
    });
    const json = await res.json();
    if (!res.ok) {
      await clearSession();
      throw fbError(json);
    }
    const fresh = {
      idToken: json.id_token,
      refreshToken: json.refresh_token,
      uid: json.user_id,
      email: sess.email,
      expiresAt: nowSec() + parseInt(json.expires_in, 10)
    };
    await setSession(fresh);
    return fresh;
  }

  // ---------- Firestore REST ----------
  // 集合路径默认 messages
  const COLLECTION = 'messages';

  function docPath(cfg, id) {
    const base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/${COLLECTION}`;
    return id ? `${base}/${id}` : base;
  }

  // Firestore 字段类型转换
  function toFs(val) {
    if (val === null) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
      return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    }
    if (val instanceof Date) return { timestampValue: val.toISOString() };
    return { stringValue: String(val) };
  }

  function fromFs(field) {
    if (!field) return null;
    if ('stringValue' in field) return field.stringValue;
    if ('booleanValue' in field) return field.booleanValue;
    if ('integerValue' in field) return Number(field.integerValue);
    if ('doubleValue' in field) return Number(field.doubleValue);
    if ('timestampValue' in field) return field.timestampValue;
    if ('nullValue' in field) return null;
    return null;
  }

  function docToMessage(doc) {
    const f = doc.fields || {};
    const id = (doc.name || '').split('/').pop();
    return {
      id,
      uid: fromFs(f.uid),
      email: fromFs(f.email),
      nickname: fromFs(f.nickname),
      content: fromFs(f.content),
      createdAt: fromFs(f.createdAt) || doc.createTime
    };
  }

  async function listMessages({ pageSize = 50 } = {}) {
    const cfg = await getConfig();
    if (!cfg) throw new Error('请先填写 Firebase 配置');
    // runQuery 按 createdAt 降序
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents:runQuery`;
    const sess = await ensureFreshToken();
    const headers = { 'Content-Type': 'application/json' };
    if (sess) headers['Authorization'] = `Bearer ${sess.idToken}`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: COLLECTION }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: pageSize
      }
    };
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw fbError(json);
    return (Array.isArray(json) ? json : [])
      .filter((row) => row.document)
      .map((row) => docToMessage(row.document));
  }

  async function postMessage({ nickname, content }) {
    const cfg = await getConfig();
    if (!cfg) throw new Error('请先填写 Firebase 配置');
    const sess = await ensureFreshToken();
    if (!sess) throw new Error('请先登录后再发言');

    const url = docPath(cfg);
    const body = {
      fields: {
        uid: toFs(sess.uid),
        email: toFs(sess.email),
        nickname: toFs(nickname || sess.email.split('@')[0]),
        content: toFs(content),
        createdAt: toFs(new Date())
      }
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sess.idToken}`
      },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw fbError(json);
    return docToMessage(json);
  }

  async function deleteMessage(id) {
    const cfg = await getConfig();
    const sess = await ensureFreshToken();
    if (!sess) throw new Error('请先登录');
    const url = docPath(cfg, id);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sess.idToken}` }
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw fbError(json);
    }
    return true;
  }

  return {
    getConfig, setConfig, clearConfig,
    getSession, clearSession,
    signUp, signIn, signOut, ensureFreshToken,
    listMessages, postMessage, deleteMessage
  };
})();

window.FB = FB;
