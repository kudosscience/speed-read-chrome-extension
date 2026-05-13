document.addEventListener('DOMContentLoaded', () => {
  const wpmSlider = document.getElementById('wpm');
  const wpmValue = document.getElementById('wpm-value');
  const fontSizeSlider = document.getElementById('fontSize');
  const fontSizeValue = document.getElementById('font-size-value');
  const themeSelect = document.getElementById('theme');
  const punctuationCheck = document.getElementById('punctuationPause');
  const saveBtn = document.getElementById('save');
  const savedMessage = document.getElementById('saved-message');

  wpmSlider.addEventListener('input', () => {
    wpmValue.textContent = wpmSlider.value;
  });

  fontSizeSlider.addEventListener('input', () => {
    fontSizeValue.textContent = fontSizeSlider.value;
  });

  chrome.storage.local.get(['speedReadSettings', 'speedReadWpm'], (result) => {
    if (result.speedReadSettings) {
      if (result.speedReadSettings.fontSize) {
        fontSizeSlider.value = result.speedReadSettings.fontSize;
        fontSizeValue.textContent = result.speedReadSettings.fontSize;
      }
      if (result.speedReadSettings.theme) {
        themeSelect.value = result.speedReadSettings.theme;
      }
      if (result.speedReadSettings.punctuationPause !== undefined) {
        punctuationCheck.checked = result.speedReadSettings.punctuationPause;
      }
    }
    if (result.speedReadWpm) {
      wpmSlider.value = result.speedReadWpm;
      wpmValue.textContent = result.speedReadWpm;
    }
  });

  saveBtn.addEventListener('click', () => {
    const settings = {
      fontSize: parseInt(fontSizeSlider.value, 10),
      theme: themeSelect.value,
      punctuationPause: punctuationCheck.checked
    };

    chrome.storage.local.set({
      speedReadSettings: settings,
      speedReadWpm: parseInt(wpmSlider.value, 10)
    }, () => {
      savedMessage.classList.add('visible');
      setTimeout(() => {
        savedMessage.classList.remove('visible');
      }, 2000);
    });
  });
});