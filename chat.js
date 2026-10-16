/* Chatbot flotante (n8n Chat Trigger). Se abre en dos tiempos: ancho y luego alto. */
(function () {
  'use strict';

  var WEBHOOK = 'https://servidor-n8n-n8n.e8xd0p.easypanel.host/webhook/093ba19a-2bc0-4872-a646-3a47c530f0f3/chat';
  var STORE = 'chat-session-id';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sid() {
    var id = null;
    try { id = localStorage.getItem(STORE); } catch (e) {}
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
      try { localStorage.setItem(STORE, id); } catch (e) {}
    }
    return id;
  }
  var sessionId = sid();

  var root = document.createElement('div');
  root.className = 'chat';
  root.innerHTML =
    '<div class="chat-backdrop" aria-hidden="true"></div>' +
    '<section class="chat-box" id="chat-box" role="dialog" aria-label="¿Quién soy?" aria-hidden="true">' +
      '<header class="chat-head"><span class="chat-title"><i></i>¿Quién soy?</span>' +
        '<button type="button" class="chat-close" aria-label="Cerrar chat">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button></header>' +
      '<div class="chat-log" aria-live="polite"></div>' +
      '<form class="chat-form" autocomplete="off">' +
        '<input type="text" name="q" placeholder="Escribe tu mensaje…" maxlength="1000" aria-label="Mensaje">' +
        '<button type="submit" aria-label="Enviar">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
        '</button>' +
      '</form>' +
    '</section>' +
    '<button type="button" class="chat-fab" aria-label="Abrir chat" aria-expanded="false" aria-controls="chat-box">' +
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>' +
    '</button>';
  document.body.appendChild(root);

  var fab = root.querySelector('.chat-fab');
  var box = root.querySelector('.chat-box');
  var backdrop = root.querySelector('.chat-backdrop');
  var log = root.querySelector('.chat-log');
  var form = root.querySelector('.chat-form');
  var input = form.q;
  var sendBtn = form.querySelector('button');
  var busy = false, greeted = false, timer = 0;

  function esc(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Markdown mínimo y seguro: el texto se escapa antes de convertirlo.
  function inline(t) {
    var codes = [];
    t = esc(t).replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return '@@C' + (codes.length - 1) + '@@'; });
    t = t
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+?)\*\*|__([^_]+?)__/g, function (_, a, b) { return '<strong>' + (a || b) + '</strong>'; })
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?![_\w])/g, '$1<em>$2</em>');
    return t.replace(/@@C(\d+)@@/g, function (_, i) { return '<code>' + codes[i] + '</code>'; });
  }

  function md(src) {
    var out = [], list = null, para = [];
    function endPara() { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } }
    function endList() { if (list) { out.push('</' + list + '>'); list = null; } }
    var parts = src.replace(/\r\n?/g, '\n').split(/```[^\n]*\n?([\s\S]*?)```/);
    parts.forEach(function (chunk, k) {
      if (k % 2) { endPara(); endList(); out.push('<pre><code>' + esc(chunk.replace(/\n$/, '')) + '</code></pre>'); return; }
      chunk.split('\n').forEach(function (line) {
        var m;
        if (!line.trim()) { endPara(); endList(); }
        else if ((m = line.match(/^\s*#{1,6}\s+(.*)$/))) { endPara(); endList(); out.push('<p><strong>' + inline(m[1]) + '</strong></p>'); }
        else if ((m = line.match(/^\s*[-*+•]\s+(.*)$/))) { endPara(); if (list !== 'ul') { endList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); }
        else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { endPara(); if (list !== 'ol') { endList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); }
        else { endList(); para.push(inline(line.trim())); }
      });
      endPara(); endList();
    });
    return out.join('');
  }

  function add(text, who) {
    var m = document.createElement('div');
    m.className = 'msg ' + who;
    if (who === 'bot' && text) m.innerHTML = md(text); else m.textContent = text;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function open() {
    clearTimeout(timer);
    root.classList.add('is-open');
    fab.setAttribute('aria-expanded', 'true');
    box.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('chat-lock');
    // 1) se extiende horizontalmente, 2) luego verticalmente
    timer = setTimeout(function () {
      root.classList.add('is-tall');
      timer = setTimeout(function () { input.focus({ preventScroll: true }); }, reduce ? 0 : 420);
    }, reduce ? 0 : 380);
    if (!greeted) { greeted = true; add('¡Hola! Soy el asistente del portafolio. ¿En qué puedo ayudarte?', 'bot'); }
  }

  function close() {
    clearTimeout(timer);
    root.classList.remove('is-tall');
    // primero se pliega en vertical, luego en horizontal
    timer = setTimeout(function () {
      root.classList.remove('is-open');
      fab.setAttribute('aria-expanded', 'false');
      box.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('chat-lock');
      fab.focus({ preventScroll: true });
    }, reduce ? 0 : 380);
  }

  fab.addEventListener('click', function () { root.classList.contains('is-open') ? close() : open(); });
  root.querySelector('.chat-close').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('is-open')) close();
  });

  function reply(data) {
    if (data == null) return '';
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return reply(data[0]);
    return data.output || data.text || data.message || data.response || '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q || busy) return;
    input.value = '';
    add(q, 'user');
    busy = true; sendBtn.disabled = true;
    var typing = add('', 'bot typing');
    typing.innerHTML = '<span></span><span></span><span></span>';

    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, 60000);
    fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sendMessage', sessionId: sessionId, chatInput: q }),
      signal: ctl.signal
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (txt) {
        var data = txt;
        try { data = JSON.parse(txt); } catch (err) {}
        typing.remove();
        add(reply(data) || 'No recibí respuesta. Intenta de nuevo.', 'bot');
      })
      .catch(function () {
        typing.remove();
        add('No pude conectar con el asistente. Intenta de nuevo en un momento.', 'bot err');
      })
      .then(function () {
        clearTimeout(t);
        busy = false; sendBtn.disabled = false;
        input.focus({ preventScroll: true });
      });
  });
})();
