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
    state.wpm = clampWpm(wpm);
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

    for (const part of sentences) {
    return text;
  }

        markSentenceEnd(words, part);

        continue;
      }

      sentenceStart = appendTextTokens(words, part, sentenceStart);
    }
    return words;
  }

  function markSentenceEnd(words, punctuation) {
    const lastWord = words.at(-1);
    if (!lastWord) {
      return;
    }

    lastWord.isSentenceEnd = true;
    lastWord.punctuation = punctuation;
  }

  function appendTextTokens(words, part, sentenceStart) {
    const tokens = part.split(/(\s+)/);
    for (const token of tokens) {
      if (!token.trim()) continue;
      const lastChar = token.slice(-1);
      const isPunctuation = /[,;:.!?]/.test(lastChar);
      words.push({
        text: token,
        isSentenceEnd: false,
        punctuation: isPunctuation ? lastChar : null,
        isNewSentence: sentenceStart
      });
      sentenceStart = false;
    }
    return sentenceStart;
  }
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

      return {
        ...w,
        displayParts: {
          focus: highlighted,
          rest: rest,
          punct: punct
        }
      };
    });
  }

  function clampWpm(value) {
    return Math.max(100, Math.min(1500, value));
  }

  function adjustWpm(delta) {
    saveWpm(clampWpm(state.wpm + delta));
  }

  function renderWord(container, word) {
    container.replaceChildren();
    if (!word?.displayParts) {
      return;
    }

    if (word.displayParts.focus) {
      const focusSpan = document.createElement('span');
      focusSpan.className = 'sr-focus';
      focusSpan.textContent = word.displayParts.focus;
      container.appendChild(focusSpan);
    }

    if (word.displayParts.rest) {
      const restSpan = document.createElement('span');
      restSpan.className = 'sr-rest';
      restSpan.textContent = word.displayParts.rest;
      container.appendChild(restSpan);
    }

    if (word.displayParts.punct) {
      const punctSpan = document.createElement('span');
      punctSpan.className = 'sr-punct';
      punctSpan.textContent = word.displayParts.punct;
      container.appendChild(punctSpan);
    }
  }

  function createOverlay() {
    const existing = document.getElementById('sr-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sr-overlay';

    const backdrop = document.createElement('div');
    backdrop.className = 'sr-backdrop';

    const container = document.createElement('div');
    container.className = 'sr-container';

    const display = document.createElement('div');
    display.className = 'sr-display';

    const prev2 = document.createElement('span');
    prev2.className = 'sr-word sr-prev2';

    const prev1 = document.createElement('span');
    prev1.className = 'sr-word sr-prev1';

    const focus = document.createElement('span');
    focus.className = 'sr-word sr-focus-word';

    const next1 = document.createElement('span');
    next1.className = 'sr-word sr-next1';

    const next2 = document.createElement('span');
    next2.className = 'sr-word sr-next2';

    display.append(prev2, prev1, focus, next1, next2);

    const controls = document.createElement('div');
    controls.className = 'sr-controls';

    const controlButtons = document.createElement('div');
    controlButtons.className = 'sr-control-buttons';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'sr-btn sr-prev';
    prevBtn.title = 'Previous sentence';
    prevBtn.setAttribute('aria-label', 'Previous sentence');
    prevBtn.textContent = '⏮';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'sr-btn sr-play';
    playBtn.title = 'Play/Pause';
    playBtn.setAttribute('aria-label', 'Play/Pause');
    playBtn.textContent = '▶';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'sr-btn sr-next';
    nextBtn.title = 'Next sentence';
    nextBtn.setAttribute('aria-label', 'Next sentence');
    nextBtn.textContent = '⏭';

    const speedDownBtn = document.createElement('button');
    speedDownBtn.type = 'button';
    speedDownBtn.className = 'sr-btn sr-speed-down';
    speedDownBtn.title = 'Slower';
    speedDownBtn.setAttribute('aria-label', 'Slower');
    speedDownBtn.textContent = '−';

    const speedUpBtn = document.createElement('button');
    speedUpBtn.type = 'button';
    speedUpBtn.className = 'sr-btn sr-speed-up';
    speedUpBtn.title = 'Faster';
    speedUpBtn.setAttribute('aria-label', 'Faster');
    speedUpBtn.textContent = '+';

    controlButtons.append(prevBtn, playBtn, nextBtn, speedDownBtn, speedUpBtn);

    const progressContainer = document.createElement('div');
    progressContainer.className = 'sr-progress-container';

    const progressBar = document.createElement('div');
    progressBar.className = 'sr-progress-bar';
    progressContainer.appendChild(progressBar);

    const stats = document.createElement('div');
    stats.className = 'sr-stats';

    const wpmDisplay = document.createElement('span');
    wpmDisplay.className = 'sr-wpm';
    wpmDisplay.textContent = `${state.wpm} WPM`;

    const counter = document.createElement('span');
    counter.className = 'sr-counter';
    counter.textContent = '0 / 0';

    stats.append(wpmDisplay, counter);

    const loading = document.createElement('div');
    loading.className = 'sr-loading';
    loading.textContent = 'Extracting text...';

    controls.append(controlButtons, progressContainer, stats);
    container.append(display, controls, loading);
    overlay.append(backdrop, container);

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
      .sr-control-buttons {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .sr-btn {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
      }
      .sr-btn:active { transform: scale(0.98); }
      .sr-btn[disabled] { opacity: 0.4; cursor: default; }
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
    renderWord(focus, w[index]);
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

  function updatePlayButton() {
    if (!state.overlay) return;
    const btn = state.overlay.querySelector('.sr-play');
    if (!btn) return;
    btn.textContent = state.isPlaying && !state.isPaused ? '⏸' : '▶';
  }

  function getPageKey() {
    return 'sr_pos_' + location.href;
  }

  function savePosition(index) {
    sessionStorage.setItem(getPageKey(), JSON.stringify({
      index: index,
      url: location.href
    }));
  }

  function loadPosition() {
    const data = sessionStorage.getItem(getPageKey());
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.url === location.href) {
        return parsed.index;
      }
    }
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

    if (state.accumulator >= currentDelay && state.currentIndex < state.words.length - 1) {
      state.accumulator -= currentDelay;
      state.currentIndex++;
      updateDisplay(state.currentIndex);
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
    updatePlayButton();
    requestAnimationFrame(tick);
  }

  function pause() {
    state.isPaused = true;
    updatePlayButton();
  }

  function resume() {
    state.isPaused = false;
    state.lastFrameTime = 0;
    updatePlayButton();
    requestAnimationFrame(tick);
  }

  function stop() {
    state.isPlaying = false;
    state.isPaused = false;
    document.removeEventListener('keydown', handleKeydown);
    if (state.overlay) {
      state.overlay.remove();
      state.overlay = null;
    }
    // no overlay to update
  }

  function togglePlayback() {
    if (!state.isPlaying) {
      start();
      return;
    }

    if (state.isPaused) {
      resume();
      return;
    }

    pause();
  }

  function goToPreviousSentence() {
    pause();
    skipToPrevSentence();
  }

  function goToNextSentence() {
    pause();
    skipToNextSentence();
  }

  function increaseSpeed() {
    adjustWpm(50);
    updateDisplay(state.currentIndex);
  }

  function decreaseSpeed() {
    adjustWpm(-50);
    updateDisplay(state.currentIndex);
  }

  function bindOverlayControls() {
    const playBtn = state.overlay.querySelector('.sr-play');
    const prevBtn = state.overlay.querySelector('.sr-prev');
    const nextBtn = state.overlay.querySelector('.sr-next');
    const speedUpBtn = state.overlay.querySelector('.sr-speed-up');
    const speedDownBtn = state.overlay.querySelector('.sr-speed-down');

    if (!playBtn || !prevBtn || !nextBtn || !speedUpBtn || !speedDownBtn) {
      console.error('Speed Read: overlay controls failed to initialize');
      stop();
      return false;
    }

    playBtn.addEventListener('click', togglePlayback);
    prevBtn.addEventListener('click', goToPreviousSentence);
    nextBtn.addEventListener('click', goToNextSentence);
    speedUpBtn.addEventListener('click', increaseSpeed);
    speedDownBtn.addEventListener('click', decreaseSpeed);

    return true;
  }

  function initializeReadingSession(mode, text, targetSelector, loading) {
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

    if (!bindOverlayControls()) {
      return;
    }

    updateDisplay(state.currentIndex);
    start();
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
        adjustWpm(50);
        updateDisplay(state.currentIndex);
        break;
      case 'ArrowDown':
        e.preventDefault();
        adjustWpm(-50);
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
        initializeReadingSession(mode, text, targetSelector, loading);
      }, 50);
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    run(message.mode, message.text, message.targetSelector);
    sendResponse({ started: true });
  });
})();