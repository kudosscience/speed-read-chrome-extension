let lastClickTarget = null;

chrome.contextMenus.create({
  id: 'speed-read-page',
  title: 'Speed Read Page',
  contexts: ['page', 'selection']
});

chrome.contextMenus.create({
  id: 'speed-read-selection',
  title: 'Speed Read Selection',
  contexts: ['selection']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  let mode, text = null;

  if (info.menuItemId === 'speed-read-selection' && info.selectionText) {
    mode = 'selection';
    text = info.selectionText;
  } else if (info.menuItemId === 'speed-read-page') {
    if (info.selectionText) {
      mode = 'selection';
      text = info.selectionText;
    } else if (lastClickTarget) {
      mode = 'nearest-article';
    } else {
      mode = 'page';
    }
  }

  if (mode) {
    injectAndStart(tab.id, mode, text);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'speed-read') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        injectAndStart(tabs[0].id, 'page', null);
      }
    });
  }
});

chrome.action.onClicked.addListener((tab) => {
  injectAndStart(tab.id, 'page', null);
});

function injectAndStart(tabId, mode, text) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Speed Read: Injection failed', chrome.runtime.lastError);
      return;
    }

    const payload = { mode };
    if (text) payload.text = text;
    if (mode === 'nearest-article' && lastClickTarget) {
      payload.targetSelector = lastClickTarget;
    }

    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Speed Read: Message failed', chrome.runtime.lastError);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'set-last-click-target') {
    lastClickTarget = message.selector;
  }
  sendResponse({ received: true });
});