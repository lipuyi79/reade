// background.js - 后台服务脚本
// 处理快捷键、右键菜单、跨标签消息

chrome.runtime.onInstalled.addListener(() => {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'toggle-selection',
    title: '开启/关闭框选朗读模式',
    contexts: ['page', 'selection']
  });

  chrome.contextMenus.create({
    id: 'toggle-subtitle',
    title: '开启/关闭视频字幕跟读',
    contexts: ['page', 'video']
  });

  chrome.contextMenus.create({
    id: 'read-selection',
    title: '朗读选中的中文',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'stop-speaking',
    title: '停止朗读',
    contexts: ['page']
  });

  // 初始化默认设置
  chrome.storage.sync.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.sync.set({
        settings: {
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          voice: '',
          autoStart: false,
          highlightColor: '#3b82f6',
          chineseOnly: true,
          subtitlePollMs: 300,
          subtitleInterrupt: true
        }
      });
    }
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'toggle-selection') {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSelection' });
  } else if (info.menuItemId === 'toggle-subtitle') {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSubtitle' });
  } else if (info.menuItemId === 'read-selection') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'readText',
      text: info.selectionText || ''
    });
  } else if (info.menuItemId === 'stop-speaking') {
    chrome.tabs.sendMessage(tab.id, { action: 'stopSpeaking' });
  }
});

// 处理快捷键
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].id) return;

    if (command === 'toggle-selection') {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSelection' });
    } else if (command === 'toggle-subtitle') {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSubtitle' });
    } else if (command === 'stop-speaking') {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stopSpeaking' });
    }
  });
});

// 处理来自 popup 的消息转发
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'content') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, message, sendResponse);
      }
    });
    return true;
  }
});
