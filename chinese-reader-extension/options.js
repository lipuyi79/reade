// options.js
const $ = (id) => document.getElementById(id);

const els = {
  rate: $('rate'),
  pitch: $('pitch'),
  volume: $('volume'),
  voice: $('voice'),
  voicePreset: $('voicePreset'),
  chineseOnly: $('chineseOnly'),
  mediaBoost: $('mediaBoost'),
  highlightColor: $('highlightColor'),
  rateVal: $('rateVal'),
  pitchVal: $('pitchVal'),
  volumeVal: $('volumeVal'),
  previewBtn: $('previewBtn'),
  stopBtn: $('stopBtn'),
  previewText: $('previewText'),
  resetBtn: $('resetBtn'),
  savedTip: $('savedTip')
};

const VOICE_PRESETS = [
  { id: 'xiaoxiao',    label: '晓晓 · 温柔女声 (zh-CN)',     keys: ['Xiaoxiao', '晓晓'] },
  { id: 'yunxi',       label: '云希 · 阳光男声 (zh-CN)',     keys: ['Yunxi', '云希'] },
  { id: 'yunyang',     label: '云扬 · 新闻男声 (zh-CN)',     keys: ['Yunyang', '云扬'] },
  { id: 'yunjian',     label: '云健 · 体育解说 (zh-CN)',     keys: ['Yunjian', '云健'] },
  { id: 'xiaoyi',      label: '晓伊 · 活力女声 (zh-CN)',     keys: ['Xiaoyi', '晓伊'] },
  { id: 'yunfeng',     label: '云枫 · 沉稳男声 (zh-CN)',     keys: ['Yunfeng', '云枫'] },
  { id: 'yunhao',      label: '云皓 · 解说男声 (zh-CN)',     keys: ['Yunhao', '云皓'] },
  { id: 'yunxia',      label: '云夏 · 童声男 (zh-CN)',       keys: ['Yunxia', '云夏'] },
  { id: 'yunze',       label: '云泽 · 老年男声 (zh-CN)',     keys: ['Yunze', '云泽'] },
  { id: 'xiaochen',    label: '晓辰 · 朗读女声 (zh-CN)',     keys: ['Xiaochen', '晓辰'] }
];

const defaultSettings = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voice: '',
  voicePreset: '',
  chineseOnly: true,
  highlightColor: '#3b82f6',
  mediaBoost: true
};

let settings = { ...defaultSettings };

function showSaved() {
  els.savedTip.textContent = '已保存';
  els.savedTip.classList.add('show');
  clearTimeout(showSaved._t);
  showSaved._t = setTimeout(() => els.savedTip.classList.remove('show'), 1200);
}

function formatVolume(v) {
  return Math.round(v * 100) + '%';
}

function applyToUI() {
  els.rate.value = settings.rate;
  els.pitch.value = settings.pitch;
  els.volume.value = settings.volume;
  els.chineseOnly.checked = !!settings.chineseOnly;
  els.mediaBoost.checked = settings.mediaBoost !== false;
  els.highlightColor.value = settings.highlightColor || '#3b82f6';
  els.rateVal.textContent = Number(settings.rate).toFixed(1);
  els.pitchVal.textContent = Number(settings.pitch).toFixed(1);
  els.volumeVal.textContent = formatVolume(settings.volume);
}

function save() {
  chrome.storage.sync.set({ settings }, showSaved);
}

function findVoiceByPreset(presetId, voices) {
  const preset = VOICE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  for (const k of preset.keys) {
    const hit = voices.find((v) => (v.name || '').toLowerCase().includes(k.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

function loadVoices() {
  const voices = window.speechSynthesis.getVoices();

  // 预设下拉
  els.voicePreset.innerHTML = '<option value="">（不使用预设）</option>';
  for (const p of VOICE_PRESETS) {
    const opt = document.createElement('option');
    opt.value = p.id;
    const installed = !!findVoiceByPreset(p.id, voices);
    opt.textContent = p.label + (installed ? '' : '  · 未安装');
    if (!installed) opt.style.color = '#9ca3af';
    els.voicePreset.appendChild(opt);
  }
  els.voicePreset.value = settings.voicePreset || '';

  voices.sort((a, b) => {
    const aZh = a.lang && a.lang.toLowerCase().startsWith('zh');
    const bZh = b.lang && b.lang.toLowerCase().startsWith('zh');
    if (aZh && !bZh) return -1;
    if (!aZh && bZh) return 1;
    return a.name.localeCompare(b.name);
  });

  els.voice.innerHTML = '<option value="">系统默认（首选中文）</option>';
  for (const v of voices) {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name}（${v.lang}）${v.default ? ' [默认]' : ''}`;
    els.voice.appendChild(opt);
  }
  els.voice.value = settings.voice || '';
}

function speakPreview() {
  const text = (els.previewText.value || '你好，这是一段中文朗读测试。').trim();
  if (!text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = parseFloat(els.rate.value);
  utter.pitch = parseFloat(els.pitch.value);
  // utterance.volume 上限 1.0；options 页只控制 SR 本身
  utter.volume = Math.min(1, parseFloat(els.volume.value));

  const voices = window.speechSynthesis.getVoices();
  const presetVoice = settings.voicePreset ? findVoiceByPreset(settings.voicePreset, voices) : null;
  const preferred =
    presetVoice ||
    voices.find((v) => v.name === settings.voice) ||
    voices.find((v) => v.lang === 'zh-CN') ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('zh'));
  if (preferred) utter.voice = preferred;
  window.speechSynthesis.speak(utter);
}

async function init() {
  const result = await chrome.storage.sync.get(['settings']);
  settings = { ...defaultSettings, ...(result.settings || {}) };
  applyToUI();
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// 事件
els.rate.addEventListener('input', () => {
  settings.rate = parseFloat(els.rate.value);
  els.rateVal.textContent = settings.rate.toFixed(1);
  save();
});

els.pitch.addEventListener('input', () => {
  settings.pitch = parseFloat(els.pitch.value);
  els.pitchVal.textContent = settings.pitch.toFixed(1);
  save();
});

els.volume.addEventListener('input', () => {
  settings.volume = parseFloat(els.volume.value);
  els.volumeVal.textContent = formatVolume(settings.volume);
  save();
});

els.voice.addEventListener('change', () => {
  settings.voice = els.voice.value;
  save();
});

els.voicePreset.addEventListener('change', () => {
  settings.voicePreset = els.voicePreset.value;
  save();
});

els.chineseOnly.addEventListener('change', () => {
  settings.chineseOnly = els.chineseOnly.checked;
  save();
});

els.mediaBoost.addEventListener('change', () => {
  settings.mediaBoost = els.mediaBoost.checked;
  save();
});

els.highlightColor.addEventListener('change', () => {
  settings.highlightColor = els.highlightColor.value;
  save();
});

els.previewBtn.addEventListener('click', speakPreview);
els.stopBtn.addEventListener('click', () => window.speechSynthesis.cancel());

els.resetBtn.addEventListener('click', () => {
  if (!confirm('确定恢复默认设置？')) return;
  settings = { ...defaultSettings };
  applyToUI();
  save();
});

document.addEventListener('DOMContentLoaded', init);

// ==========================================================
// Firebase / 账号 / 留言板
// ==========================================================
const ADMIN_EMAIL = '15018647951@163.com';

const fbEls = {
  cfgCard: $('fbCfgCard'),
  boardCard: $('fbBoardCard'),
  apiKey: $('fbApiKey'),
  projectId: $('fbProjectId'),
  saveCfg: $('fbSaveCfg'),
  clearCfg: $('fbClearCfg'),

  signedOut: $('fbAuthSignedOut'),
  signedIn: $('fbAuthSignedIn'),
  email: $('fbEmail'),
  password: $('fbPassword'),
  loginBtn: $('fbLoginBtn'),
  registerBtn: $('fbRegisterBtn'),
  logoutBtn: $('fbLogoutBtn'),
  curEmail: $('fbCurEmail'),
  authErr: $('fbAuthErr'),

  nickname: $('fbNickname'),
  content: $('fbContent'),
  postBtn: $('fbPostBtn'),
  boardTip: $('fbBoardTip')
};

function fbSetTip(text, isError) {
  fbEls.boardTip.textContent = text || '';
  fbEls.boardTip.style.color = isError ? '#ef4444' : '#6b7280';
}

function fbSetAuthErr(text) {
  fbEls.authErr.textContent = text || '';
}

async function fbRefreshUI() {
  const cfg = await FB.getConfig();
  const sess = await FB.getSession();
  const signedIn = !!sess;
  const isAdmin = signedIn && (sess.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const cfgExists = !!(cfg && cfg.apiKey && cfg.projectId);

  // Firebase 配置卡可见性：尚未配置(首次设置) 或 已用管理员邮箱登录
  fbEls.cfgCard.hidden = cfgExists && !isAdmin;

  // 留言板对所有登录用户可见；未配置 Firebase 则一并隐藏
  fbEls.boardCard.hidden = !cfgExists || !signedIn;

  if (cfg) {
    fbEls.apiKey.value = cfg.apiKey || '';
    fbEls.projectId.value = cfg.projectId || '';
  }

  fbEls.signedOut.hidden = signedIn;
  fbEls.signedIn.hidden = !signedIn;
  if (signedIn) fbEls.curEmail.textContent = sess.email || '';

  // 配置不全 → 禁用账号 / 留言交互
  fbEls.loginBtn.disabled = !cfgExists;
  fbEls.registerBtn.disabled = !cfgExists;
  fbEls.postBtn.disabled = !cfgExists || !signedIn;

  if (!cfgExists) {
    fbSetTip('请先填写并保存 Firebase 配置（首次仅本次可见）', true);
  } else if (!signedIn) {
    fbSetTip('登录后才能发言', false);
  } else {
    fbSetTip('', false);
  }
}

// ---- 配置保存 ----
fbEls.saveCfg.addEventListener('click', async () => {
  const apiKey = fbEls.apiKey.value.trim();
  const projectId = fbEls.projectId.value.trim();
  if (!apiKey || !projectId) {
    alert('请填写完整的 API Key 和 Project ID');
    return;
  }
  await FB.setConfig({ apiKey, projectId });
  await fbRefreshUI();
  await fbLoadMessages();
  showSaved();
});

fbEls.clearCfg.addEventListener('click', async () => {
  if (!confirm('确认清除 Firebase 配置？这会同时退出登录。')) return;
  await FB.clearConfig();
  await FB.signOut();
  fbEls.apiKey.value = '';
  fbEls.projectId.value = '';
  await fbRefreshUI();
});

// ---- 登录 / 注册 ----
fbEls.loginBtn.addEventListener('click', async () => {
  fbSetAuthErr('');
  try {
    await FB.signIn(fbEls.email.value.trim(), fbEls.password.value);
    fbEls.password.value = '';
    await fbRefreshUI();
  } catch (e) {
    fbSetAuthErr(e.message);
  }
});

fbEls.registerBtn.addEventListener('click', async () => {
  fbSetAuthErr('');
  try {
    await FB.signUp(fbEls.email.value.trim(), fbEls.password.value);
    fbEls.password.value = '';
    await fbRefreshUI();
  } catch (e) {
    fbSetAuthErr(e.message);
  }
});

fbEls.logoutBtn.addEventListener('click', async () => {
  await FB.signOut();
  await fbRefreshUI();
});

// ---- 留言板（仅发布；列表只有管理员能在 Firestore 后台查看）----
fbEls.postBtn.addEventListener('click', async () => {
  const content = fbEls.content.value.trim();
  if (!content) {
    fbSetTip('内容不能为空', true);
    return;
  }
  fbEls.postBtn.disabled = true;
  try {
    await FB.postMessage({
      nickname: fbEls.nickname.value.trim(),
      content
    });
    fbEls.content.value = '';
    fbSetTip('已发布，感谢留言', false);
  } catch (e) {
    fbSetTip('发布失败：' + e.message, true);
  } finally {
    fbRefreshUI();
  }
});

(async function fbInit() {
  await fbRefreshUI();
})();
