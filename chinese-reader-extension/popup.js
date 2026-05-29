// popup.js
const $ = (id) => document.getElementById(id);

const els = {
  toggleBtn: $('toggleBtn'),
  subtitleBtn: $('subtitleBtn'),
  stopBtn: $('stopBtn'),
  status: $('status'),
  rate: $('rate'),
  pitch: $('pitch'),
  volume: $('volume'),
  voice: $('voice'),
  chineseOnly: $('chineseOnly'),
  mediaBoost: $('mediaBoost'),
  rateVal: $('rateVal'),
  pitchVal: $('pitchVal'),
  volumeVal: $('volumeVal'),
  optionsBtn: $('optionsBtn')
};

const defaultSettings = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voice: '',
  voicePreset: '',
  chineseOnly: true,
  highlightColor: '#3b82f6',
  mediaBoost: true,
  subtitlePollMs: 300,
  subtitleInterrupt: true
};

let settings = { ...defaultSettings };

function sendToContent(message) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].id) return resolve(null);
      chrome.tabs.sendMessage(tabs[0].id, message, (resp) => {
        if (chrome.runtime.lastError) return resolve(null);
        resolve(resp);
      });
    });
  });
}

function setStatus(resp) {
  const enabled = !!(resp && resp.enabled);
  const subtitleOn = !!(resp && resp.subtitleWatching);
  const mode = resp && resp.mode;

  let label = '未激活';
  if (subtitleOn) label = '字幕跟读中';
  else if (mode === 'select-subtitle') label = '等待框选字幕';
  else if (mode === 'editing') label = '调整选区中';
  else if (enabled) label = '已激活';

  els.status.textContent = label;
  els.status.className = 'status ' + (enabled || subtitleOn ? 'status-on' : 'status-off');

  const selectMode = enabled && (mode === 'select-once' || mode === 'editing');
  els.toggleBtn.textContent = selectMode ? '关闭框选朗读' : '开启框选朗读';
  els.toggleBtn.classList.toggle('active', selectMode);

  els.subtitleBtn.textContent = subtitleOn || mode === 'select-subtitle' ? '退出字幕跟读' : '视频字幕跟读';
  els.subtitleBtn.classList.toggle('active', subtitleOn || mode === 'select-subtitle');
}

async function refreshStatus() {
  const resp = await sendToContent({ action: 'getStatus' });
  setStatus(resp);
}

async function loadVoices() {
  const resp = await sendToContent({ action: 'getVoices' });
  const voices = (resp && resp.voices) || [];

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
    opt.textContent = `${v.name}（${v.lang}）`;
    els.voice.appendChild(opt);
  }
  els.voice.value = settings.voice || '';
}

function applyToUI() {
  els.rate.value = settings.rate;
  els.pitch.value = settings.pitch;
  els.volume.value = settings.volume;
  els.chineseOnly.checked = !!settings.chineseOnly;
  els.mediaBoost.checked = settings.mediaBoost !== false;
  els.rateVal.textContent = Number(settings.rate).toFixed(1);
  els.pitchVal.textContent = Number(settings.pitch).toFixed(1);
  els.volumeVal.textContent = formatVolume(settings.volume);
}

function formatVolume(v) {
  return Math.round(v * 100) + '%';
}

function saveSettings() {
  chrome.storage.sync.set({ settings });
}

async function init() {
  const result = await chrome.storage.sync.get(['settings']);
  settings = { ...defaultSettings, ...(result.settings || {}) };
  applyToUI();
  await loadVoices();
  await refreshStatus();
}

// ========== 事件绑定 ==========
els.toggleBtn.addEventListener('click', async () => {
  const resp = await sendToContent({ action: 'toggleSelection' });
  if (resp) setStatus(resp);
  else alert('当前页面无法启用框选朗读，请在普通网页上使用。');
});

els.subtitleBtn.addEventListener('click', async () => {
  const resp = await sendToContent({ action: 'toggleSubtitle' });
  if (resp) {
    setStatus(resp);
    if (resp.enabled) window.close();
  } else {
    alert('当前页面无法启用字幕跟读，请在视频网页上使用。');
  }
});

els.stopBtn.addEventListener('click', async () => {
  await sendToContent({ action: 'stopSpeaking' });
});

els.rate.addEventListener('input', () => {
  settings.rate = parseFloat(els.rate.value);
  els.rateVal.textContent = settings.rate.toFixed(1);
  saveSettings();
});

els.pitch.addEventListener('input', () => {
  settings.pitch = parseFloat(els.pitch.value);
  els.pitchVal.textContent = settings.pitch.toFixed(1);
  saveSettings();
});

els.volume.addEventListener('input', () => {
  settings.volume = parseFloat(els.volume.value);
  els.volumeVal.textContent = formatVolume(settings.volume);
  saveSettings();
  sendToContent({ action: 'applyMediaBoost' });
});

els.voice.addEventListener('change', () => {
  settings.voice = els.voice.value;
  saveSettings();
});

els.chineseOnly.addEventListener('change', () => {
  settings.chineseOnly = els.chineseOnly.checked;
  saveSettings();
});

els.mediaBoost.addEventListener('change', () => {
  settings.mediaBoost = els.mediaBoost.checked;
  saveSettings();
  sendToContent({ action: 'applyMediaBoost' });
});

els.optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage
    ? chrome.runtime.openOptionsPage()
    : window.open(chrome.runtime.getURL('options.html'));
});

document.addEventListener('DOMContentLoaded', init);
