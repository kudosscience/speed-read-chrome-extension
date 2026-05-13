(function() {
  let lastTarget = null;
  const MAX_DEPTH = 5;

  function findNearestArticle(el) {
    if (!el) return null;
    for (let depth = 0; depth < MAX_DEPTH && el; depth++) {
      if (el.tagName === 'ARTICLE') return el;
      if (el.getAttribute && el.getAttribute('role') === 'article') return el;
      el = el.parentElement;
    }
    return null;
  }

  function getSelector(el) {
    if (!el) return null;
    let path = [];
    while (el && el !== document.body) {
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        path.unshift(selector);
        break;
      }
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (classes) selector += '.' + classes;
      }
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(' > ');
  }

  document.addEventListener('contextmenu', (e) => {
    const target = e.target;
    const articleEl = findNearestArticle(target);
    if (articleEl) {
      lastTarget = getSelector(articleEl);
    } else {
      lastTarget = getSelector(target);
    }
    chrome.runtime.sendMessage({ type: 'set-last-click-target', selector: lastTarget });
  }, true);
})();