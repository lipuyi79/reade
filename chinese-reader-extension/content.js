// content.js - 内容脚本
// 框选交互 / 文本提取 / TTS / 视频字幕跟读 / 媒体音量增益

(function () {
  'use strict';

  if (window.__chineseReaderInjected) return;
  window.__chineseReaderInjected = true;

  // ========== 状态管理 ==========
  // mode: 'idle' | 'select-once' | 'select-subtitle' | 'editing' | 'subtitle-watching'
  const state = {
    enabled: false,
    mode: 'idle',
    pendingAction: null,        // 'speak' | 'subtitle'，editing 阶段确认后要做的事
    selecting: false,
    startX: 0,
    startY: 0,
    overlay: null,
    box: null,                  // 选区可视框
    handles: [],                // 8 个调整把手
    confirmBar: null,           // 编辑阶段的"确认/取消"
    toolbar: null,
    lockedRegion: null,
    lockedFrame: null,
    subtitleTimer: null,
    subtitleObserver: null,
    lastSubtitleText: '',
    recentSubtitles: [],
    settings: {
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,              // 现在范围 0-2，>1 走 GainNode 放大
      voice: '',
      voicePreset: '',
      highlightColor: '#3b82f6',
      chineseOnly: true,
      subtitlePollMs: 300,
      subtitleInterrupt: true,
      mediaBoost: true          // 是否同步放大网页内 <video>/<audio>
    },
    currentUtterance: null,
    isPaused: false
  };

  // ========== 音色预设 ==========
  // 关键词命中即可（按顺序优先），覆盖 Edge / Windows / Chrome / Mac 上常见的中文神经语音
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

  function findVoiceByPreset(presetId) {
    const preset = VOICE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return null;
    const voices = window.speechSynthesis.getVoices();
    for (const k of preset.keys) {
      const hit = voices.find((v) => (v.name || '').toLowerCase().includes(k.toLowerCase()));
      if (hit) return hit;
    }
    return null;
  }

  // ========== 初始化设置 ==========
  chrome.storage.sync.get(['settings'], (result) => {
    if (result.settings) Object.assign(state.settings, result.settings);
    applyMediaBoost();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      Object.assign(state.settings, changes.settings.newValue || {});
      applyMediaBoost();
    }
  });

  // ========== 媒体音量增益 (Web Audio) ==========
  const mediaBoost = {
    ctx: null,
    nodes: new WeakMap(),       // mediaEl -> { source, gain }
    observer: null
  };

  function ensureCtx() {
    if (mediaBoost.ctx) return mediaBoost.ctx;
    try {
      mediaBoost.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      mediaBoost.ctx = null;
    }
    return mediaBoost.ctx;
  }

  function attachMediaElement(el) {
    if (!el || mediaBoost.nodes.has(el)) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    try {
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = Math.max(1, state.settings.volume || 1);
      source.connect(gain).connect(ctx.destination);
      mediaBoost.nodes.set(el, { source, gain });

      // 用户交互后才能 resume
      const resume = () => {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      };
      el.addEventListener('play', resume);
      document.addEventListener('click', resume, { once: true });
    } catch (e) {
      // 已经接到别的 source / 跨域 → 忽略
    }
  }

  function setBoostGain(value) {
    const v = Math.max(1, value);
    document.querySelectorAll('video, audio').forEach((el) => {
      const node = mediaBoost.nodes.get(el);
      if (node && node.gain) node.gain.gain.value = v;
    });
  }

  function applyMediaBoost() {
    if (!state.settings.mediaBoost) {
      setBoostGain(1);
      return;
    }
    const targetGain = Math.max(1, state.settings.volume || 1);

    // 接管现有媒体元素
    document.querySelectorAll('video, audio').forEach(attachMediaElement);
    setBoostGain(targetGain);

    // 监听后续插入的媒体元素
    if (!mediaBoost.observer) {
      mediaBoost.observer = new MutationObserver((mutations) => {
        if (!state.settings.mediaBoost) return;
        mutations.forEach((m) => {
          m.addedNodes.forEach((n) => {
            if (n.nodeType !== 1) return;
            if (n.tagName === 'VIDEO' || n.tagName === 'AUDIO') attachMediaElement(n);
            else if (n.querySelectorAll) n.querySelectorAll('video,audio').forEach(attachMediaElement);
          });
        });
      });
      try {
        mediaBoost.observer.observe(document.documentElement, { childList: true, subtree: true });
      } catch (_) {}
    }
  }

  // ========== 中文提取 ==========
  function extractChinese(text) {
    if (!text) return '';
    if (!state.settings.chineseOnly) return text.trim();
    const chineseRegex = /[一-鿿　-〿＀-￯0-9\s。，、；：？！「」『』（）《》""'']/g;
    const matched = text.match(chineseRegex);
    if (!matched) return '';
    return matched.join('').replace(/\s+/g, ' ').trim();
  }

  function hasChinese(text) {
    return /[一-鿿]/.test(text);
  }

  // ========== 命中检测 ==========
  function getTextInRect(rect) {
    const texts = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
          if (parent.closest('.__cr-overlay, .__cr-toolbar, .__cr-box, .__cr-locked-frame, .__cr-handle, .__cr-confirm')) {
            return NodeFilter.FILTER_REJECT;
          }
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const range = document.createRange();
    let node;
    while ((node = walker.nextNode())) {
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (const r of rects) {
        if (rectsIntersect(r, rect)) {
          texts.push(node.nodeValue);
          break;
        }
      }
    }
    range.detach && range.detach();
    return texts.join(' ');
  }

  function rectsIntersect(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function findContainerForRect(rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let el = document.elementFromPoint(cx, cy);
    if (!el) return document.body;
    while (el && el !== document.body) {
      const r = el.getBoundingClientRect();
      if (r.left <= rect.left && r.top <= rect.top && r.right >= rect.right && r.bottom >= rect.bottom) {
        return el;
      }
      el = el.parentElement;
    }
    return document.body;
  }

  // ========== 选区遮罩 / 拖框 ==========
  function createOverlay() {
    if (state.overlay) return;
    const overlay = document.createElement('div');
    overlay.className = '__cr-overlay';
    document.documentElement.appendChild(overlay);

    const box = document.createElement('div');
    box.className = '__cr-box';
    box.style.borderColor = state.settings.highlightColor;
    box.style.backgroundColor = state.settings.highlightColor + '22';
    overlay.appendChild(box);

    state.overlay = overlay;
    state.box = box;

    overlay.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function destroyOverlay() {
    if (!state.overlay) return;
    state.overlay.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    state.overlay.remove();
    state.overlay = null;
    state.box = null;
    removeHandles();
    removeConfirmBar();
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (state.mode === 'editing') return;  // 编辑阶段不在 overlay 上重新拖
    e.preventDefault();
    e.stopPropagation();
    state.selecting = true;
    state.startX = e.clientX;
    state.startY = e.clientY;
    updateBox(e.clientX, e.clientY);
    state.box.style.display = 'block';
  }

  function onMouseMove(e) {
    if (!state.selecting) return;
    e.preventDefault();
    updateBox(e.clientX, e.clientY);
  }

  function onMouseUp(e) {
    if (!state.selecting) return;
    e.preventDefault();
    state.selecting = false;

    const rect = state.box.getBoundingClientRect();
    if (rect.width < 5 || rect.height < 5) {
      state.box.style.display = 'none';
      return;
    }

    // 进入"可调整"阶段
    state.mode = 'editing';
    state.pendingAction =
      state.pendingAction ||
      (state.mode === 'select-subtitle' ? 'subtitle' : 'speak');

    showHandles();
    showConfirmBar();
  }

  function updateBox(x, y) {
    const left = Math.min(state.startX, x);
    const top = Math.min(state.startY, y);
    const width = Math.abs(state.startX - x);
    const height = Math.abs(state.startY - y);
    state.box.style.left = left + 'px';
    state.box.style.top = top + 'px';
    state.box.style.width = width + 'px';
    state.box.style.height = height + 'px';
  }

  // ========== 选区调整 (8 把手 + 中心拖动) ==========
  const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function showHandles() {
    removeHandles();
    if (!state.box || !state.overlay) return;
    state.box.classList.add('__cr-box-editing');
    state.box.style.pointerEvents = 'auto';

    HANDLE_DIRS.forEach((dir) => {
      const h = document.createElement('div');
      h.className = '__cr-handle __cr-handle-' + dir;
      h.dataset.dir = dir;
      h.addEventListener('mousedown', onHandleDown);
      state.box.appendChild(h);
      state.handles.push(h);
    });

    // 中心拖动
    state.box.addEventListener('mousedown', onBoxDragDown);
  }

  function removeHandles() {
    state.handles.forEach((h) => h.remove());
    state.handles = [];
    if (state.box) {
      state.box.classList.remove('__cr-box-editing');
      state.box.style.pointerEvents = 'none';
      state.box.removeEventListener('mousedown', onBoxDragDown);
    }
  }

  let editDrag = null;  // { kind: 'resize'|'move', dir, startX, startY, startRect }

  function getBoxRect() {
    return {
      left: parseFloat(state.box.style.left) || 0,
      top: parseFloat(state.box.style.top) || 0,
      width: parseFloat(state.box.style.width) || 0,
      height: parseFloat(state.box.style.height) || 0
    };
  }

  function setBoxRect(r) {
    // 限制最小尺寸
    if (r.width < 10) r.width = 10;
    if (r.height < 10) r.height = 10;
    // 限制视口内
    r.left = Math.max(0, Math.min(window.innerWidth - r.width, r.left));
    r.top = Math.max(0, Math.min(window.innerHeight - r.height, r.top));
    state.box.style.left = r.left + 'px';
    state.box.style.top = r.top + 'px';
    state.box.style.width = r.width + 'px';
    state.box.style.height = r.height + 'px';
    positionConfirmBar();
  }

  function onHandleDown(e) {
    e.preventDefault();
    e.stopPropagation();
    editDrag = {
      kind: 'resize',
      dir: e.currentTarget.dataset.dir,
      startX: e.clientX,
      startY: e.clientY,
      startRect: getBoxRect()
    };
    document.addEventListener('mousemove', onEditMove);
    document.addEventListener('mouseup', onEditUp);
  }

  function onBoxDragDown(e) {
    if (e.target !== state.box) return;  // 点把手时不算 move
    e.preventDefault();
    e.stopPropagation();
    editDrag = {
      kind: 'move',
      startX: e.clientX,
      startY: e.clientY,
      startRect: getBoxRect()
    };
    document.addEventListener('mousemove', onEditMove);
    document.addEventListener('mouseup', onEditUp);
  }

  function onEditMove(e) {
    if (!editDrag) return;
    e.preventDefault();
    const dx = e.clientX - editDrag.startX;
    const dy = e.clientY - editDrag.startY;
    const r = { ...editDrag.startRect };

    if (editDrag.kind === 'move') {
      r.left += dx;
      r.top += dy;
    } else {
      const dir = editDrag.dir;
      if (dir.includes('e')) r.width = editDrag.startRect.width + dx;
      if (dir.includes('s')) r.height = editDrag.startRect.height + dy;
      if (dir.includes('w')) {
        r.left = editDrag.startRect.left + dx;
        r.width = editDrag.startRect.width - dx;
      }
      if (dir.includes('n')) {
        r.top = editDrag.startRect.top + dy;
        r.height = editDrag.startRect.height - dy;
      }
      // 反向拖过 0：翻转
      if (r.width < 0) {
        r.left += r.width;
        r.width = Math.abs(r.width);
      }
      if (r.height < 0) {
        r.top += r.height;
        r.height = Math.abs(r.height);
      }
    }
    setBoxRect(r);
  }

  function onEditUp() {
    editDrag = null;
    document.removeEventListener('mousemove', onEditMove);
    document.removeEventListener('mouseup', onEditUp);
  }

  // ========== 编辑确认条 ==========
  function showConfirmBar() {
    removeConfirmBar();
    const bar = document.createElement('div');
    bar.className = '__cr-confirm';
    bar.innerHTML = `
      <span class="__cr-confirm-tip">拖动边缘缩放，拖动中心移动</span>
      <button data-act="confirm" class="__cr-confirm-ok">✓ 确认</button>
      <button data-act="redraw" class="__cr-confirm-redraw">↺ 重画</button>
      <button data-act="cancel" class="__cr-confirm-cancel">✕ 取消</button>
    `;
    document.documentElement.appendChild(bar);
    state.confirmBar = bar;
    positionConfirmBar();

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'confirm') confirmSelection();
      else if (act === 'redraw') redrawSelection();
      else if (act === 'cancel') cancelSelection();
    });
  }

  function positionConfirmBar() {
    if (!state.confirmBar || !state.box) return;
    const r = getBoxRect();
    let top = r.top + r.height + 8;
    if (top + 44 > window.innerHeight) top = Math.max(8, r.top - 44);
    let left = Math.max(8, Math.min(r.left, window.innerWidth - 320));
    state.confirmBar.style.top = top + 'px';
    state.confirmBar.style.left = left + 'px';
  }

  function removeConfirmBar() {
    if (state.confirmBar) {
      state.confirmBar.remove();
      state.confirmBar = null;
    }
  }

  function confirmSelection() {
    const r = getBoxRect();
    const plainRect = {
      left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height,
      width: r.width, height: r.height
    };
    const action = state.pendingAction;
    state.pendingAction = null;

    if (action === 'subtitle') {
      lockSubtitleRegion(plainRect);
    } else {
      // 一次性朗读：清理选框并朗读
      const rawText = getTextInRect(plainRect);
      const text = extractChinese(rawText);
      destroyOverlay();
      document.body.classList.remove('__cr-active');
      state.mode = 'idle';
      state.enabled = false;
      if (!text || (state.settings.chineseOnly && !hasChinese(text))) {
        showToast('未在框选区域内找到中文文本');
        return;
      }
      showToolbar({ text, rect: plainRect, mode: 'once' });
      speak(text);
    }
  }

  function redrawSelection() {
    removeHandles();
    removeConfirmBar();
    state.box.style.display = 'none';
    state.mode = state.pendingAction === 'subtitle' ? 'select-subtitle' : 'select-once';
  }

  function cancelSelection() {
    state.pendingAction = null;
    disable();
  }

  // ========== 字幕跟读 ==========
  function lockSubtitleRegion(rect) {
    state.lockedRegion = rect;
    state.mode = 'subtitle-watching';
    state.lastSubtitleText = '';
    state.recentSubtitles = [];

    destroyOverlay();
    document.body.classList.remove('__cr-active');

    // 锁定框：边框可调整，内部 pointer-events:none 不挡视频
    const frame = document.createElement('div');
    frame.className = '__cr-locked-frame';
    frame.style.left = rect.left + 'px';
    frame.style.top = rect.top + 'px';
    frame.style.width = rect.width + 'px';
    frame.style.height = rect.height + 'px';
    frame.style.borderColor = state.settings.highlightColor;

    // 8 个把手
    HANDLE_DIRS.forEach((dir) => {
      const h = document.createElement('div');
      h.className = '__cr-handle __cr-handle-locked __cr-handle-' + dir;
      h.dataset.dir = dir;
      h.addEventListener('mousedown', onLockedHandleDown);
      frame.appendChild(h);
    });

    // 顶部 grip：整体平移
    const grip = document.createElement('div');
    grip.className = '__cr-locked-grip';
    grip.title = '拖动移动监听区';
    grip.textContent = '⠿ 字幕监听区（可拖动调整）';
    grip.addEventListener('mousedown', onLockedGripDown);
    frame.appendChild(grip);

    document.documentElement.appendChild(frame);
    state.lockedFrame = frame;

    showToolbar({ text: '已进入字幕跟读模式', rect, mode: 'subtitle' });

    startSubtitleWatch(rect);
    showToast('字幕跟读已启动，可拖动边框调整监听区');
  }

  function startSubtitleWatch(rect) {
    if (state.subtitleTimer) clearInterval(state.subtitleTimer);
    if (state.subtitleObserver) state.subtitleObserver.disconnect();

    const interval = clamp(state.settings.subtitlePollMs || 300, 100, 2000);
    state.subtitleTimer = setInterval(checkSubtitleRegion, interval);
    try {
      const container = findContainerForRect(rect);
      const observer = new MutationObserver(() => checkSubtitleRegion());
      observer.observe(container, { childList: true, subtree: true, characterData: true });
      state.subtitleObserver = observer;
    } catch (_) {}
    checkSubtitleRegion();
  }

  function getLockedRect() {
    if (!state.lockedFrame) return null;
    return {
      left: parseFloat(state.lockedFrame.style.left) || 0,
      top: parseFloat(state.lockedFrame.style.top) || 0,
      width: parseFloat(state.lockedFrame.style.width) || 0,
      height: parseFloat(state.lockedFrame.style.height) || 0
    };
  }

  function setLockedRect(r) {
    if (r.width < 20) r.width = 20;
    if (r.height < 20) r.height = 20;
    r.left = Math.max(0, Math.min(window.innerWidth - r.width, r.left));
    r.top = Math.max(0, Math.min(window.innerHeight - r.height, r.top));
    state.lockedFrame.style.left = r.left + 'px';
    state.lockedFrame.style.top = r.top + 'px';
    state.lockedFrame.style.width = r.width + 'px';
    state.lockedFrame.style.height = r.height + 'px';
    state.lockedRegion = {
      left: r.left, top: r.top, width: r.width, height: r.height,
      right: r.left + r.width, bottom: r.top + r.height
    };
  }

  let lockedDrag = null;

  function onLockedHandleDown(e) {
    e.preventDefault();
    e.stopPropagation();
    lockedDrag = {
      kind: 'resize',
      dir: e.currentTarget.dataset.dir,
      startX: e.clientX,
      startY: e.clientY,
      startRect: getLockedRect()
    };
    document.addEventListener('mousemove', onLockedMove);
    document.addEventListener('mouseup', onLockedUp);
  }

  function onLockedGripDown(e) {
    e.preventDefault();
    e.stopPropagation();
    lockedDrag = {
      kind: 'move',
      startX: e.clientX,
      startY: e.clientY,
      startRect: getLockedRect()
    };
    document.addEventListener('mousemove', onLockedMove);
    document.addEventListener('mouseup', onLockedUp);
  }

  function onLockedMove(e) {
    if (!lockedDrag) return;
    e.preventDefault();
    const dx = e.clientX - lockedDrag.startX;
    const dy = e.clientY - lockedDrag.startY;
    const r = { ...lockedDrag.startRect };

    if (lockedDrag.kind === 'move') {
      r.left += dx;
      r.top += dy;
    } else {
      const dir = lockedDrag.dir;
      if (dir.includes('e')) r.width = lockedDrag.startRect.width + dx;
      if (dir.includes('s')) r.height = lockedDrag.startRect.height + dy;
      if (dir.includes('w')) {
        r.left = lockedDrag.startRect.left + dx;
        r.width = lockedDrag.startRect.width - dx;
      }
      if (dir.includes('n')) {
        r.top = lockedDrag.startRect.top + dy;
        r.height = lockedDrag.startRect.height - dy;
      }
      if (r.width < 0) { r.left += r.width; r.width = Math.abs(r.width); }
      if (r.height < 0) { r.top += r.height; r.height = Math.abs(r.height); }
    }
    setLockedRect(r);
  }

  function onLockedUp() {
    if (!lockedDrag) return;
    lockedDrag = null;
    document.removeEventListener('mousemove', onLockedMove);
    document.removeEventListener('mouseup', onLockedUp);
    // 重新订阅新位置的 MutationObserver 容器
    if (state.lockedRegion) {
      state.lastSubtitleText = '';
      state.recentSubtitles = [];
      startSubtitleWatch(state.lockedRegion);
    }
  }

  function unlockSubtitleRegion() {
    if (state.subtitleTimer) {
      clearInterval(state.subtitleTimer);
      state.subtitleTimer = null;
    }
    if (state.subtitleObserver) {
      state.subtitleObserver.disconnect();
      state.subtitleObserver = null;
    }
    if (state.lockedFrame) {
      state.lockedFrame.remove();
      state.lockedFrame = null;
    }
    state.lockedRegion = null;
    state.mode = 'idle';
    state.lastSubtitleText = '';
    state.recentSubtitles = [];
    stopSpeaking();
  }

  function checkSubtitleRegion() {
    if (!state.lockedRegion) return;
    const raw = getTextInRect(state.lockedRegion);
    const text = extractChinese(raw);
    if (!text) return;
    if (state.settings.chineseOnly && !hasChinese(text)) return;
    if (text === state.lastSubtitleText) return;
    if (state.recentSubtitles.includes(text)) {
      state.lastSubtitleText = text;
      return;
    }

    state.lastSubtitleText = text;
    state.recentSubtitles.push(text);
    if (state.recentSubtitles.length > 6) state.recentSubtitles.shift();

    if (state.toolbar) {
      const txtEl = state.toolbar.querySelector('.__cr-toolbar-text');
      if (txtEl) txtEl.textContent = truncate(text, 80);
    }

    if (state.settings.subtitleInterrupt) speak(text);
    else if (!window.speechSynthesis.speaking) speak(text);
  }

  // ========== 工具栏 ==========
  function showToolbar({ text, rect, mode }) {
    if (state.toolbar) state.toolbar.remove();

    const toolbar = document.createElement('div');
    toolbar.className = '__cr-toolbar';
    toolbar.dataset.mode = mode;

    const top = Math.min(rect.bottom + 8, window.innerHeight - 100);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 320));
    toolbar.style.top = top + 'px';
    toolbar.style.left = left + 'px';

    const isSubtitle = mode === 'subtitle';
    const headerLabel = isSubtitle ? '🎬 字幕跟读中' : '📖 朗读';

    toolbar.innerHTML = `
      <div class="__cr-toolbar-head">
        <span class="__cr-toolbar-title">${headerLabel}</span>
        <button data-act="close" class="__cr-toolbar-x" title="关闭">✕</button>
      </div>
      <div class="__cr-toolbar-text" title="${escapeHtml(text)}">${escapeHtml(truncate(text, 80))}</div>
      <div class="__cr-toolbar-actions">
        ${
          isSubtitle
            ? `
              <button data-act="toggle-interrupt" title="切换：新字幕是否打断当前朗读">${
                state.settings.subtitleInterrupt ? '🔁 打断:开' : '🔁 打断:关'
              }</button>
              <button data-act="stop" title="停止当前朗读">⏹</button>
              <button data-act="exit-subtitle" title="退出字幕跟读">⏏ 退出</button>
              `
            : `
              <button data-act="play" title="播放/继续">▶</button>
              <button data-act="pause" title="暂停">⏸</button>
              <button data-act="stop" title="停止">⏹</button>
              <button data-act="copy" title="复制文本">📋</button>
              `
        }
      </div>
    `;

    document.documentElement.appendChild(toolbar);
    state.toolbar = toolbar;

    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'play') {
        if (state.isPaused) {
          window.speechSynthesis.resume();
          state.isPaused = false;
        } else {
          speak(text);
        }
      } else if (act === 'pause') {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          state.isPaused = true;
        }
      } else if (act === 'stop') {
        stopSpeaking();
      } else if (act === 'copy') {
        navigator.clipboard.writeText(text).then(
          () => showToast('已复制'),
          () => showToast('复制失败')
        );
      } else if (act === 'toggle-interrupt') {
        state.settings.subtitleInterrupt = !state.settings.subtitleInterrupt;
        chrome.storage.sync.set({ settings: state.settings });
        btn.textContent = state.settings.subtitleInterrupt ? '🔁 打断:开' : '🔁 打断:关';
        showToast('打断模式：' + (state.settings.subtitleInterrupt ? '开' : '关'));
      } else if (act === 'exit-subtitle') {
        unlockSubtitleRegion();
        toolbar.remove();
        state.toolbar = null;
        showToast('已退出字幕跟读');
      } else if (act === 'close') {
        if (mode === 'subtitle') unlockSubtitleRegion();
        else stopSpeaking();
        toolbar.remove();
        state.toolbar = null;
      }
    });
  }

  // ========== 语音合成 ==========
  function speak(text) {
    if (!('speechSynthesis' in window)) {
      showToast('当前浏览器不支持语音合成');
      return;
    }
    window.speechSynthesis.cancel();
    state.isPaused = false;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = clamp(state.settings.rate, 0.1, 10);
    utter.pitch = clamp(state.settings.pitch, 0, 2);
    // utterance.volume 规范上限就是 1.0；超过的部分由 GainNode 在 <video>/<audio> 上放大整体音量
    utter.volume = clamp(state.settings.volume, 0, 1);

    const voices = window.speechSynthesis.getVoices();
    const presetVoice = state.settings.voicePreset
      ? findVoiceByPreset(state.settings.voicePreset)
      : null;
    const preferred =
      presetVoice ||
      voices.find((v) => v.name === state.settings.voice) ||
      voices.find((v) => v.lang === 'zh-CN') ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('zh'));
    if (preferred) utter.voice = preferred;

    utter.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        showToast('朗读出错: ' + e.error);
      }
    };

    state.currentUtterance = utter;
    window.speechSynthesis.speak(utter);
  }

  function stopSpeaking() {
    window.speechSynthesis.cancel();
    state.isPaused = false;
    state.currentUtterance = null;
  }

  // ========== 工具函数 ==========
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function truncate(s, n) {
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function showToast(msg) {
    let toast = document.querySelector('.__cr-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = '__cr-toast';
      document.documentElement.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('__cr-toast-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('__cr-toast-show'), 1800);
  }

  // ========== 模式切换 ==========
  function enable(mode) {
    const targetMode = mode || 'select-once';
    if (state.mode === 'subtitle-watching') unlockSubtitleRegion();

    state.enabled = true;
    state.mode = targetMode;
    state.pendingAction = targetMode === 'select-subtitle' ? 'subtitle' : 'speak';
    createOverlay();
    document.body.classList.add('__cr-active');

    if (targetMode === 'select-subtitle') {
      showToast('字幕跟读：拖动框选字幕区域，可调整后按"确认"');
    } else {
      showToast('框选朗读：拖出矩形 → 调整 → 确认');
    }
  }

  function disable() {
    if (!state.enabled && state.mode === 'idle') return;
    state.enabled = false;

    if (state.mode === 'subtitle-watching') {
      unlockSubtitleRegion();
    } else {
      destroyOverlay();
    }
    state.mode = 'idle';
    state.pendingAction = null;
    document.body.classList.remove('__cr-active');
    stopSpeaking();
    if (state.toolbar) {
      state.toolbar.remove();
      state.toolbar = null;
    }
  }

  function isActive() {
    return state.enabled || state.mode === 'subtitle-watching' || state.mode === 'editing';
  }

  function toggle(mode) {
    if (isActive()) disable();
    else enable(mode);
  }

  // Esc 退出
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isActive()) {
      disable();
    } else if (e.key === 'Enter' && state.mode === 'editing') {
      e.preventDefault();
      confirmSelection();
    }
  });

  // ========== 消息监听 ==========
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'toggleSelection':
        toggle('select-once');
        sendResponse({ enabled: isActive(), mode: state.mode });
        break;
      case 'enableSelection':
        enable('select-once');
        sendResponse({ enabled: true, mode: state.mode });
        break;
      case 'enableSubtitle':
        enable('select-subtitle');
        sendResponse({ enabled: true, mode: state.mode });
        break;
      case 'toggleSubtitle':
        if (state.mode === 'subtitle-watching' || state.mode === 'select-subtitle' ||
            (state.mode === 'editing' && state.pendingAction === 'subtitle')) {
          disable();
        } else {
          enable('select-subtitle');
        }
        sendResponse({ enabled: isActive(), mode: state.mode });
        break;
      case 'disableSelection':
        disable();
        sendResponse({ enabled: false, mode: state.mode });
        break;
      case 'readText':
        if (message.text) {
          const text = extractChinese(message.text);
          if (text) speak(text);
          else showToast('未提取到中文文本');
        }
        sendResponse({ ok: true });
        break;
      case 'stopSpeaking':
        stopSpeaking();
        sendResponse({ ok: true });
        break;
      case 'getStatus':
        sendResponse({
          enabled: isActive(),
          mode: state.mode,
          speaking: window.speechSynthesis.speaking,
          subtitleWatching: state.mode === 'subtitle-watching'
        });
        break;
      case 'getVoices': {
        const list = window.speechSynthesis.getVoices().map((v) => ({
          name: v.name, lang: v.lang, default: v.default
        }));
        sendResponse({ voices: list, presets: VOICE_PRESETS });
        break;
      }
      case 'previewVoice':
        speak(message.text || '你好，这是一段测试朗读。');
        sendResponse({ ok: true });
        break;
      case 'applyMediaBoost':
        applyMediaBoost();
        sendResponse({ ok: true });
        break;
    }
    return true;
  });
})();
