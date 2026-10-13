// Portafolio — interacciones: navegación, aparición al hacer scroll, palabras rotativas y contacto
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- Barra de navegación: se esconde al bajar, vuelve al subir ----------
  (() => {
    const nav = $('#nav'); let last = scrollY;
    addEventListener('scroll', () => {
      const y = scrollY;
      nav.classList.toggle('line', y > 20);
      last = y;
    }, { passive: true });
  })();

  // ---------- Enlace activo según la sección visible ----------
  (() => {
    const links = $$('.nav nav a'), map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const a = map.get(e.target.id); if (!a) return;
      if (e.isIntersecting) { links.forEach((l) => l.classList.remove('on')); a.classList.add('on'); }
    }), { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  })();

  // ---------- Aparición al hacer scroll ----------
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); }
  }), { threshold: .12 });
  $$('.rv').forEach((el) => io.observe(el));

  // ---------- Palabras rotativas ----------
  $$('.rotator').forEach((el) => {
    const words = el.dataset.words.split('|');
    let i = 0;
    el.textContent = words[0];
    if (words.length < 2 || reduce) return;
    setInterval(() => {
      el.classList.add('out');
      setTimeout(() => {
        i = (i + 1) % words.length; el.textContent = words[i];
        el.classList.add('pre'); el.classList.remove('out');
        void el.offsetWidth;
        el.classList.remove('pre');
      }, 400);
    }, +el.dataset.interval || 2800);
  });

  // ---------- Secuencias: el paso que está al centro de la pantalla decide qué escena 3D se muestra ----------
  $$('.seq').forEach((seq) => {
    const viz = $('.seq-viz', seq), steps = $$('.step', seq), stage = $('.stage', seq);
    viz.dataset.sides = steps.map((st) => st.dataset.side || 'r').join(',');
    const mid = () => innerHeight * (innerWidth <= 900 ? .66 : .5);
    const centers = () => steps.map((st) => { const r = st.getBoundingClientRect(); return r.top + r.height / 2; });
    let cur = -1;
    const pick = () => {
      const c = centers(), m = mid();
      let best = 0, bd = 1e9;
      c.forEach((y, k) => { const d = Math.abs(y - m); if (d < bd) { bd = d; best = k; } });
      if (best === cur) return;
      cur = best;
      steps.forEach((st, k) => st.classList.toggle('on', k === best));
      if (window.Viz && Viz.setSeq) Viz.setSeq(viz, best);
    };
    addEventListener('scroll', pick, { passive: true }); addEventListener('resize', pick); pick();
  });

  // ---------- Slidebox vertical a la izquierda: aparece tras la portada, un punto por animación (grandes al inicio de cada sección), año de la sección y arrastre que salta de animación en animación ----------
  (() => {
    const first = $('#perfil'); if (!first) return;
    const rail = document.createElement('div'), fill = document.createElement('i'), handle = document.createElement('b'), year = document.createElement('span');
    rail.className = 'rail'; rail.setAttribute('role', 'slider'); rail.setAttribute('aria-label', 'Avance de la página: salta entre animaciones'); rail.setAttribute('aria-orientation', 'vertical');
    rail.setAttribute('aria-valuemin', '0'); rail.setAttribute('aria-valuemax', '100'); rail.tabIndex = 0;
    fill.className = 'rail-fill'; handle.className = 'rail-handle'; year.className = 'rail-year';
    const mid = () => innerHeight * (innerWidth <= 900 ? .66 : .5);
    // destinos: inicio de cada sección (punto grande) y cada animación (punto pequeño)
    const targets = [];
    ['#perfil', '#educacion', '#experiencia', '#logros', '#habilidades', '#contacto'].forEach((id) => { const el = $(id); if (el) targets.push({ el, big: true, kind: 'sec' }); });
    $$('.step').forEach((el) => targets.push({ el, big: false, kind: 'step' }));
    // contenido que queda entre posiciones: el bloque de Bambú y el final de las secciones más altas que la ventana
    { const r3 = $('.row3'); if (r3) targets.push({ el: r3.closest('.org') || r3, big: false, kind: 'block' }); }
    ['#logros', '#habilidades'].forEach((id) => { const el = $(id); if (el) targets.push({ el, big: false, kind: 'secEnd' }); });
    targets.forEach((tg) => { tg.dot = document.createElement('span'); tg.dot.className = 'rail-dot' + (tg.big ? ' big' : ''); rail.appendChild(tg.dot); });
    rail.append(fill, handle, year); document.body.appendChild(rail);
    // años: cada institución o empresa trae el suyo en su encabezado
    const spans = [...$$('.org'), ...$$('[data-year]')].map((el) => ({ el, txt: el.dataset.year || ((($('.org-meta b', el) || {}).textContent || '').match(/\d{4}/) || [''])[0] })).filter((s) => s.txt);
    let start = 0, span = 1, pos = [], bounds = [];
    const measure = () => {
      start = first.getBoundingClientRect().top + scrollY - 40;
      span = Math.max(1, document.documentElement.scrollHeight - innerHeight - start);
      targets.forEach((tg) => {
        const r = tg.el.getBoundingClientRect();
        const top = r.top + scrollY;
        tg.y = tg.kind === 'sec' ? top - 40 : tg.kind === 'block' ? (r.height < innerHeight - 90 ? top + r.height / 2 - innerHeight / 2 : top - 100) : tg.kind === 'secEnd' ? top + r.height - innerHeight + 24 : top + r.height / 2 - mid();
        tg.on = tg.kind !== 'secEnd' || tg.y - (top - 40) > 60;     // el final de una sección solo cuenta si no cabe en la ventana
        tg.dot.style.display = tg.on ? '' : 'none';
        tg.f = Math.min(1, Math.max(0, (tg.y - start) / span));
        tg.dot.style.top = (tg.f * 100).toFixed(2) + '%';
      });
      calcAllowed();
      bounds = spans.map((s) => { const r = s.el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, txt: s.txt }; });
    };
    let drag = false, dragF = null, lastYear = null, lastNear = -1;
    // ---------- la página solo puede quedarse en las posiciones del slidebox ----------
    // al dejar de desplazarte se ajusta a la más cercana; si te moviste un poco hacia un lado, avanza a la siguiente en esa dirección (si no, cada rueda del ratón regresaría al mismo punto)
    let allowed = [0];
    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const calcAllowed = () => { const mx = maxScroll(); allowed = [...new Set([0, mx, ...targets.filter((tg) => tg.on).map((tg) => Math.round(tg.y))].map((v) => Math.round(Math.max(0, Math.min(mx, v)))))].sort((p, q) => p - q); };
    const nearestIdx = (y) => { let bi = 0, bd = 1e9; allowed.forEach((v, i) => { const d = Math.abs(v - y); if (d < bd) { bd = d; bi = i; } }); return bi; };
    let snapping = false, startY = null, lastY = scrollY, idleT = 0, relT = 0;
    const THR = 30;
    const settle = () => {
      if (drag || snapping) return;
      const y = scrollY, i0 = nearestIdx(startY === null ? y : startY), ny = nearestIdx(y), d = y - (startY === null ? y : startY);
      let i = ny;
      if (d > THR && ny <= i0) i = Math.min(allowed.length - 1, i0 + 1); else if (d < -THR && ny >= i0) i = Math.max(0, i0 - 1);
      startY = null; const target = allowed[i];
      if (Math.abs(y - target) > 2) {
        snapping = true; scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
        clearTimeout(relT); relT = setTimeout(() => { snapping = false; lastY = scrollY; idleT = setTimeout(settle, 60); }, reduce ? 60 : 900);
      } else lastY = y;
    };
    addEventListener('scroll', () => {
      if (snapping) return;
      if (startY === null) startY = lastY;
      lastY = scrollY; clearTimeout(idleT); idleT = setTimeout(settle, 140);
    }, { passive: true });

    const near = (f) => { let bi = 0, bd = 1e9; targets.forEach((tg, i) => { if (!tg.on) return; const d = Math.abs(tg.f - f); if (d < bd) { bd = d; bi = i; } }); return bi; };
    const update = () => {
      const p = Math.min(1, Math.max(0, (scrollY - start) / span)), f = dragF === null ? p : dragF;
      rail.style.setProperty('--p', f.toFixed(4)); rail.setAttribute('aria-valuenow', Math.round(f * 100));
      rail.classList.toggle('on', scrollY > start - innerHeight * .55);
      const n = near(p); if (n !== lastNear) { lastNear = n; targets.forEach((tg, i) => tg.dot.classList.toggle('now', i === n)); }
      const c = scrollY + innerHeight / 2, b = bounds.find((x) => c >= x.top && c <= x.bottom), txt = b ? b.txt : '';
      if (txt !== lastYear) { lastYear = txt; year.textContent = txt; year.classList.toggle('show', !!txt); }
    };
    const jump = (tg) => { scrollTo({ top: tg.y, behavior: 'instant' }); };
    const pick = (clientY) => { const r = rail.getBoundingClientRect(), f = Math.min(1, Math.max(0, (clientY - r.top) / r.height)), tg = targets[near(f)]; dragF = tg.f; jump(tg); update(); };
    rail.addEventListener('pointerdown', (e) => { drag = true; rail.setPointerCapture(e.pointerId); rail.classList.add('drag'); pick(e.clientY); });
    rail.addEventListener('pointermove', (e) => { if (drag) pick(e.clientY); });
    const end = () => { drag = false; dragF = null; rail.classList.remove('drag'); update(); };
    rail.addEventListener('pointerup', end); rail.addEventListener('pointercancel', end);
    rail.addEventListener('keydown', (e) => {
      const d = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 }[e.key]; if (!d) return;
      e.preventDefault(); const p = Math.min(1, Math.max(0, (scrollY - start) / span)), sorted = targets.filter((x) => x.on).slice().sort((x, y) => x.f - y.f);
      const t = d > 0 ? sorted.find((x) => x.f > p + .002) : sorted.slice().reverse().find((x) => x.f < p - .002); if (t) jump(t);
    });
    addEventListener('scroll', update, { passive: true }); const re = () => { measure(); update(); };
    addEventListener('resize', re); addEventListener('load', re);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(re);
    measure(); update(); setInterval(re, 1500);
  })();

  // ---------- Ver más: los enlaces a PDF se activan al poner la ruta real en el href ----------
  $$('.btn-more').forEach((a) => a.addEventListener('click', (e) => { if (a.getAttribute('href') === '#') e.preventDefault(); }));

  // ---------- Contacto: valida y envía el formulario al formulario de n8n ----------
  (() => {
    const form = $('#contact-form'); if (!form) return;
    const btn = $('button', form), label = $('.btn-label', btn), status = $('.status', form);
    const TO = 'cesaraprendiendo@gmail.com';
    // Formulario de n8n (nodo Form Trigger): sus campos, en orden, son nombre, email y mensaje (field-0, field-1, field-2)
    const N8N_FORM = 'https://servidor-n8n-n8n.e8xd0p.easypanel.host/form/91b55046-044d-47ac-8a34-527fbeda336f';
    const KEYS = ['nombre', 'email', 'mensaje'];
    const fields = KEYS.map((k) => ({ k, el: form.elements[k], err: $('#err-' + k) }));
    const EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
    const rules = {
      nombre: (v) => (!v ? 'Escribe tu nombre.' : v.length < 2 ? 'El nombre es demasiado corto.' : ''),
      email: (v) => (!v ? 'Escribe tu correo.' : !EMAIL.test(v) ? 'Ese correo no parece válido.' : ''),
      mensaje: (v) => (!v ? 'Cuéntame un poco de lo que necesitas.' : ''),
    };
    const show = (f, msg) => { f.err.textContent = msg; f.el.classList.toggle('invalid', !!msg); f.el.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
    const check = (f) => { const m = rules[f.k](f.el.value.trim()); show(f, m); return !m; };
    fields.forEach((f) => {
      f.el.addEventListener('blur', () => { if (f.el.value.trim() || f.el.classList.contains('invalid')) check(f); });
      f.el.addEventListener('input', () => { if (f.el.classList.contains('invalid')) check(f); });
    });
    let sending = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sending) return;
      status.textContent = '';
      const ok = fields.map(check);
      if (ok.includes(false)) { status.textContent = 'Revisa los campos marcados.'; fields[ok.indexOf(false)].el.focus(); return; }
      const v = Object.fromEntries(fields.map((f) => [f.k, f.el.value.trim()]));
      // mismo formato que el formulario de n8n: multipart con un campo por pregunta
      const data = new FormData();
      KEYS.forEach((k, i) => { data.append('field-' + i, v[k]); data.append(k, v[k]); });
      sending = true; btn.disabled = true; label.textContent = 'Enviando…';
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
      try {
        // no-cors: el navegador envía los datos aunque el servidor de n8n no permita leer la respuesta desde otro dominio
        await fetch(N8N_FORM, { method: 'POST', body: data, mode: 'no-cors', signal: ctl.signal });
        form.reset(); fields.forEach((f) => show(f, ''));
        status.textContent = 'Mensaje enviado. ¡Gracias, te responderé pronto!';
      } catch (err) {
        status.textContent = 'No se pudo enviar el mensaje. Inténtalo de nuevo o escríbeme a ' + TO;
      } finally {
        clearTimeout(timer); sending = false; btn.disabled = false; label.textContent = 'Enviar mensaje';
      }
    });
  })();
})();
