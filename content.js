(function() {
  'use strict';

  let state = {
    words: [],
    currentIndex: 0,
    wpm: 400,
    isPlaying: false,
    isPaused: false,
    lastFrameTime: 0,
    accumulator: 0,
    overlay: null,
    settings: {
      fontSize: 48,
      theme: 'dark',
      punctuationPause: true
    }
  };

  const PUNCTUATION_DELAYS = {
    ',': 150,
    ';': 150,
    '.': 300,
    '!': 400,
    '?': 400,
    ':': 200
  };

  function loadSettings(callback) {
    chrome.storage.local.get(['speedReadSettings', 'speedReadWpm'], (result) => {
      if (result.speedReadSettings) {
        state.settings = { ...state.settings, ...result.speedReadSettings };
      }
      if (result.speedReadWpm) {
        state.wpm = result.speedReadWpm;
      }
      callback();
    });
  }

  function saveWpm(wpm) {
    state.wpm = Math.max(100, Math.min(1500, wpm));
    chrome.storage.local.set({ speedReadWpm: state.wpm });
  }

  function extractTextLightweight() {
    const candidates = [
      document.querySelector('article'),
      document.querySelector('[role="main"]'),
      document.querySelector('main'),
      document.querySelector('.post-content'),
      document.querySelector('.article-content'),
      document.querySelector('.entry-content'),
      document.querySelector('.content')
    ];

    for (const el of candidates) {
      if (el && el.textContent.trim().length > 200) {
        return cleanText(el);
      }
    }

    let maxLen = 0;
    let bestContainer = null;
    const containers = document.querySelectorAll('div, section');
    for (const el of containers) {
      const text = el.textContent.trim();
      if (text.length > maxLen) {
        const pCount = el.querySelectorAll('p').length;
        if (pCount >= 2) {
          maxLen = text.length;
          bestContainer = el;
        }
      }
    }

    if (bestContainer && maxLen > 200) {
      return cleanText(bestContainer);
    }

    return null;
  }

  function cleanText(el) {
    const clone = el.cloneNode(true);
    const remove = clone.querySelectorAll('script, style, nav, footer, aside, .nav, .footer, .sidebar, .ad, .advertisement, .comments, .related, [role="navigation"]');
    remove.forEach(n => n.remove());

    let text = clone.textContent;
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  function extractFromElement(selector) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        return cleanText(el);
      }
    } catch (e) {}
    return null;
  }

  function tokenize(text) {
    const words = [];
    const sentences = text.split(/([.!?]+)/);

    let sentenceStart = true;
    for (let i = 0; i < sentences.length; i++) {
      const part = sentences[i];
      if (!part) continue;

      if (/^[.!?]+$/.test(part)) {
        if (words.length > 0) {
          words[words.length - 1].isSentenceEnd = true;
          words[words.length - 1].punctuation = part;
        }
        sentenceStart = true;
      } else {
        const tokens = part.split(/(\s+)/);
        for (const token of tokens) {
          if (!token.trim()) continue;
          const lastChar = token.slice(-1);
          const isPunctuation = /[,;:.!?]/.test(lastChar);
          words.push({
            text: token,
            displayHtml: token,
            isSentenceEnd: false,
            punctuation: isPunctuation ? lastChar : null,
            isNewSentence: sentenceStart
          });
          sentenceStart = false;
        }
      }
    }
    return words;
  }

  function buildDisplayHtml(words) {
    return words.map(w => {
      const text = w.text.replace(/[,;:.!?]+$/, '');
      const punct = w.text.match(/[,;:.!?]+$/)?.[0] || '';
      let highlightCount = text.length < 5 ? 1 : 2;
      if (text.length < highlightCount) highlightCount = text.length;

      const highlighted = text.slice(0, highlightCount);
      const rest = text.slice(highlightCount);

      let html = '';
      if (highlighted) {
        html += `<span class="sr-focus">${escapeHtml(highlighted)}</span>`;
      }
      if (rest) {
        html += `<span class="sr-rest">${escapeHtml(rest)}</span>`;
      }
      if (punct) {
        html += `<span class="sr-punct">${escapeHtml(punct)}</span>`;
      }

      return { ...w, displayHtml: html };
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function createOverlay() {
    const existing = document.getElementById('sr-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sr-overlay';
    overlay.innerHTML = `
      <div class="sr-backdrop"></div>
      <div class="sr-container">
        <div class="sr-display">
          <span class="sr-word sr-prev2"></span>
          <span class="sr-word sr-prev1"></span>
          <span class="sr-word sr-focus-word"></span>
          <span class="sr-word sr-next1"></span>
          <span class="sr-word sr-next2"></span>
        </div>
        <div class="sr-controls">
          <div class="sr-progress-container">
            <div class="sr-progress-bar"></div>
          </div>
          <div class="sr-stats">
            <span class="sr-wpm">${state.wpm} WPM</span>
            <span class="sr-counter">0 / 0</span>
          </div>
        </div>
        <div class="sr-loading">Extracting text...</div>
      </div>
    `;

    document.body.appendChild(overlay);

    const style = document.createElement('style');
    style.textContent = `
      #sr-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .sr-backdrop {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.92);
      }
      .sr-container {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
      }
      .sr-display {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 20px;
      }
      .sr-word {
        display: inline-block;
        transition: opacity 0.1s;
      }
      .sr-prev2, .sr-next2 {
        font-size: 24px;
        color: rgba(255, 255, 255, 0.2);
      }
      .sr-prev1, .sr-next1 {
        font-size: 32px;
        color: rgba(255, 255, 255, 0.35);
      }
      .sr-focus-word {
        font-size: ${state.settings.fontSize}px;
        font-weight: 700;
        color: #fff;
        text-align: center;
        min-width: 200px;
      }
      .sr-focus-word .sr-focus {
        color: #ff4444;
      }
      .sr-focus-word .sr-punct {
        color: rgba(255, 255, 255, 0.7);
      }
      .sr-controls {
        position: absolute;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        width: 80%;
        max-width: 600px;
      }
      .sr-progress-container {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 12px;
      }
      .sr-progress-bar {
        height: 100%;
        width: 0%;
        background: #ff4444;
        transition: width 0.1s;
      }
      .sr-stats {
        display: flex;
        justify-content: space-between;
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
      }
      .sr-loading {
        display: none;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: rgba(255, 255, 255, 0.7);
        font-size: 18px;
      }
      .sr-loading.sr-visible {
        display: block;
      }
    `;
    document.head.appendChild(style);

    return overlay;
  }

  function updateDisplay(index) {
    if (!state.overlay) return;

    const w = state.words;
    if (index < 0) index = 0;
    if (index >= w.length) index = w.length - 1;

    state.currentIndex = index;

    const prev2 = state.overlay.querySelector('.sr-prev2');
    const prev1 = state.overlay.querySelector('.sr-prev1');
    const focus = state.overlay.querySelector('.sr-focus-word');
    const next1 = state.overlay.querySelector('.sr-next1');
    const next2 = state.overlay.querySelector('.sr-next2');
    const progress = state.overlay.querySelector('.sr-progress-bar');
    const counter = state.overlay.querySelector('.sr-counter');
    const wpmDisplay = state.overlay.querySelector('.sr-wpm');

    prev2.textContent = w[index - 2]?.text || '';
    prev2.style.opacity = index >= 2 ? '1' : '0';
    prev1.textContent = w[index - 1]?.text || '';
    prev1.style.opacity = index >= 1 ? '1' : '0';
    focus.innerHTML = w[index]?.displayHtml || '';
    next1.textContent = w[index + 1]?.text || '';
    next1.style.opacity = index + 1 < w.length ? '1' : '0';
    next2.textContent = w[index + 2]?.text || '';
    next2.style.opacity = index + 2 < w.length ? '1' : '0';

    const pct = w.length > 0 ? (index / (w.length - 1)) * 100 : 0;
    progress.style.width = pct + '%';
    counter.textContent = `${index + 1} / ${w.length}`;
    wpmDisplay.textContent = `${state.wpm} WPM`;

    savePosition(index);
  }

  function getPageKey() {
    return 'sr_pos_' + location.href;
  }

  function savePosition(index) {
    try {
      sessionStorage.setItem(getPageKey(), JSON.stringify({
        index: index,
        url: location.href
      }));
    } catch (e) {}
  }

  function loadPosition() {
    try {
      const data = sessionStorage.getItem(getPageKey());
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.url === location.href) {
          return parsed.index;
        }
      }
    } catch (e) {}
    return 0;
  }

  function calculateWordDelay(word) {
    const baseDelay = 60000 / state.wpm;
    if (!state.settings.punctuationPause || !word.punctuation) {
      return baseDelay;
    }
    return baseDelay + (PUNCTUATION_DELAYS[word.punctuation] || 0);
  }

  function tick(currentTime) {
    if (!state.isPlaying || state.isPaused) {
      state.lastFrameTime = currentTime;
      if (state.isPlaying) {
        requestAnimationFrame(tick);
      }
      return;
    }

    if (state.lastFrameTime === 0) {
      state.lastFrameTime = currentTime;
    }

    const delta = currentTime - state.lastFrameTime;
    state.lastFrameTime = currentTime;
    state.accumulator += delta;

    const currentDelay = calculateWordDelay(state.words[state.currentIndex]);

    while (state.accumulator >= currentDelay && state.currentIndex < state.words.length - 1) {
      state.accumulator -= currentDelay;
      state.currentIndex++;
      updateDisplay(state.currentIndex);
      break;
    }

    if (state.currentIndex >= state.words.length - 1) {
      stop();
      return;
    }

    requestAnimationFrame(tick);
  }

  function start() {
    state.isPlaying = true;
    state.isPaused = false;
    state.lastFrameTime = 0;
    state.accumulator = 0;
    requestAnimationFrame(tick);
  }

  function pause() {
    state.isPaused = true;
  }

  function resume() {
    state.isPaused = false;
    state.lastFrameTime = 0;
    requestAnimationFrame(tick);
  }

  function stop() {
    state.isPlaying = false;
    state.isPaused = false;
    if (state.overlay) {
      state.overlay.remove();
      state.overlay = null;
    }
  }

  function skipToNextSentence() {
    for (let i = state.currentIndex + 1; i < state.words.length; i++) {
      if (state.words[i].isSentenceEnd) {
        state.currentIndex = i + 1;
        updateDisplay(state.currentIndex);
        return;
      }
    }
    state.currentIndex = state.words.length - 1;
    updateDisplay(state.currentIndex);
  }

  function skipToPrevSentence() {
    for (let i = state.currentIndex - 1; i >= 0; i--) {
      if (state.words[i].isSentenceEnd) {
        state.currentIndex = i + 1;
        updateDisplay(state.currentIndex);
        return;
      }
    }
    state.currentIndex = 0;
    updateDisplay(state.currentIndex);
  }

  function handleKeydown(e) {
    if (!state.isPlaying) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (state.isPaused) {
          resume();
        } else {
          pause();
        }
        break;
      case 'Escape':
        e.preventDefault();
        stop();
        break;
      case 'ArrowUp':
        e.preventDefault();
        saveWpm(state.wpm + 50);
        updateDisplay(state.currentIndex);
        break;
      case 'ArrowDown':
        e.preventDefault();
        saveWpm(state.wpm - 50);
        updateDisplay(state.currentIndex);
        break;
      case 'ArrowRight':
        e.preventDefault();
        pause();
        skipToNextSentence();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        pause();
        skipToPrevSentence();
        break;
    }
  }

  function run(mode, text, targetSelector) {
    loadSettings(() => {
      state.overlay = createOverlay();
      const loading = state.overlay.querySelector('.sr-loading');
      loading.classList.add('sr-visible');

      setTimeout(() => {
        let extractedText = null;

        if (mode === 'selection' && text) {
          extractedText = text;
        } else if (mode === 'nearest-article' && targetSelector) {
          extractedText = extractFromElement(targetSelector);
        }

        if (!extractedText) {
          extractedText = extractTextLightweight();
        }

        if (!extractedText || extractedText.length < 200) {
          extractedText = null;
        }

        if (!extractedText || extractedText.length < 50) {
          loading.textContent = 'No readable content found';
          setTimeout(() => {
            stop();
          }, 2000);
          return;
        }

        const rawWords = tokenize(extractedText);
        state.words = buildDisplayHtml(rawWords);

        const startIndex = loadPosition();
        state.currentIndex = Math.min(startIndex, state.words.length - 1);

        loading.classList.remove('sr-visible');
        document.addEventListener('keydown', handleKeydown);
        updateDisplay(state.currentIndex);
        start();
      }, 50);
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    run(message.mode, message.text, message.targetSelector);
    sendResponse({ started: true });
  });
})();