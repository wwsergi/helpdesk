(function (w, d) {
  'use strict';

  // Auto-detect base URL from the script tag src
  var scripts = d.querySelectorAll('script[src*="embed.js"]');
  var scriptEl = scripts[scripts.length - 1];
  var scriptSrc = (scriptEl && scriptEl.src) ? scriptEl.src : '';
  var baseUrl = scriptSrc.replace(/\/embed\.js(\?.*)?$/, '');
  if (!baseUrl) baseUrl = w.location.origin;

  var WIDGET_URL = baseUrl + '/widget';
  var isOpen = false;
  var container, iframe, btn;

  var chatIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  var closeIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  function injectStyles() {
    var style = d.createElement('style');
    style.textContent = [
      '#claud-ia-btn {',
      '  position:fixed; bottom:24px; right:24px; z-index:2147483646;',
      '  width:56px; height:56px; border-radius:50%; border:none;',
      '  background:#F47B20; cursor:pointer;',
      '  box-shadow:0 4px 20px rgba(244,123,32,0.45);',
      '  display:flex; align-items:center; justify-content:center;',
      '  transition:transform .2s, box-shadow .2s;',
      '}',
      '#claud-ia-btn:hover { transform:scale(1.08); box-shadow:0 6px 28px rgba(244,123,32,0.55); }',
      '#claud-ia-frame-wrap {',
      '  position:fixed; bottom:92px; right:24px; z-index:2147483645;',
      '  width:380px; height:600px; border-radius:16px;',
      '  box-shadow:0 8px 40px rgba(0,0,0,0.18); overflow:hidden;',
      '  transform-origin:bottom right;',
      '  transition:transform .25s cubic-bezier(.175,.885,.32,1.275), opacity .2s;',
      '  transform:scale(0.85); opacity:0; pointer-events:none;',
      '}',
      '#claud-ia-frame-wrap.open { transform:scale(1); opacity:1; pointer-events:auto; }',
      '#claud-ia-frame-wrap iframe { width:100%; height:100%; border:none; display:block; }',
      '@media(max-width:480px){',
      '  #claud-ia-frame-wrap {',
      '    width:calc(100vw - 24px); height:calc(100vh - 110px);',
      '    bottom:86px; right:12px;',
      '  }',
      '  #claud-ia-btn { right:16px; bottom:16px; }',
      '}',
    ].join('\n');
    d.head.appendChild(style);
  }

  function createButton() {
    btn = d.createElement('button');
    btn.id = 'claud-ia-btn';
    btn.setAttribute('aria-label', 'Open chat');
    btn.innerHTML = chatIcon;
    btn.addEventListener('click', toggle);
    d.body.appendChild(btn);
  }

  function createFrame() {
    container = d.createElement('div');
    container.id = 'claud-ia-frame-wrap';
    iframe = d.createElement('iframe');
    iframe.src = WIDGET_URL;
    iframe.title = 'Claud-IA Chat';
    iframe.setAttribute('allow', 'microphone');
    container.appendChild(iframe);
    d.body.appendChild(container);
  }

  function toggle() {
    isOpen = !isOpen;
    container.classList.toggle('open', isOpen);
    btn.innerHTML = isOpen ? closeIcon : chatIcon;
    btn.setAttribute('aria-label', isOpen ? 'Close chat' : 'Open chat');
  }

  // Listen for close signal from the widget iframe
  w.addEventListener('message', function (e) {
    if (e.data === 'claud-ia:close' && isOpen) toggle();
  });

  function init() {
    injectStyles();
    createButton();
    createFrame();
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
