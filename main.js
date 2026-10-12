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
      nav.classList.toggle('hide', y > last && y > 240);
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
    const box = document.createElement('div'), thumb = document.createElement('i');
    box.className = 'slidebox'; box.setAttribute('role', 'slider'); box.setAttribute('aria-label', 'Avance de la sección');
    box.setAttribute('aria-valuemin', '0'); box.setAttribute('aria-valuemax', '100'); box.style.setProperty('--n', steps.length);
    box.appendChild(thumb); stage.appendChild(box);
    const mid = () => innerHeight * (innerWidth <= 900 ? .66 : .5);
    const centers = () => steps.map((st) => { const r = st.getBoundingClientRect(); return r.top + r.height / 2; });
    let cur = -1;
    const pick = () => {
      const c = centers(), m = mid();
      let best = 0, bd = 1e9;
      c.forEach((y, k) => { const d = Math.abs(y - m); if (d < bd) { bd = d; best = k; } });
      // progreso continuo entre el primer y el último paso
      let p = 0;
      if (c.length > 1) {
        const f = (c[0] - m) / (c[0] - c[c.length - 1] || 1);
        p = Math.min(1, Math.max(0, f));
      }
      box.style.setProperty('--p', p.toFixed(4)); box.setAttribute('aria-valuenow', Math.round(p * 100));
      if (best === cur) return;
      cur = best;
      steps.forEach((st, k) => st.classList.toggle('on', k === best));
      if (window.Viz && Viz.setSeq) Viz.setSeq(viz, best);
    };
    box.addEventListener('click', (e) => {
      const r = box.getBoundingClientRect(), k = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (steps.length - 1));
      const y = centers()[k];
      scrollTo({ top: scrollY + y - mid(), behavior: reduce ? 'auto' : 'smooth' });
    });
    addEventListener('scroll', pick, { passive: true }); addEventListener('resize', pick); pick();
  });

  // ---------- Ver más: los enlaces a PDF se activan al poner la ruta real en el href ----------
  $$('.btn-more').forEach((a) => a.addEventListener('click', (e) => { if (a.getAttribute('href') === '#') e.preventDefault(); }));

  // ---------- Contacto: valida y prepara un correo ----------
  (() => {
    const form = $('#contact-form'); if (!form) return;
    const btn = $('button', form), label = $('.btn-label', btn), status = $('.status', form);
    const TO = 'cesaraprendiendo@gmail.com';
    const fields = ['nombre', 'email', 'mensaje'].map((k) => ({ k, el: form.elements[k], err: $('#err-' + k) }));
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
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      status.textContent = '';
      const ok = fields.map(check);
      if (ok.includes(false)) { status.textContent = 'Revisa los campos marcados.'; fields[ok.indexOf(false)].el.focus(); return; }
      const v = Object.fromEntries(fields.map((f) => [f.k, f.el.value.trim()]));
      const subject = encodeURIComponent(`Contacto desde tu portafolio — ${v.nombre}`);
      const body = encodeURIComponent(`${v.mensaje}\n\n— ${v.nombre}\n${v.email}`);
      label.textContent = 'Abriendo tu correo…';
      location.href = `mailto:${TO}?subject=${subject}&body=${body}`;
      status.textContent = 'Si no se abrió tu correo, escríbeme directo a ' + TO;
      setTimeout(() => { label.textContent = 'Preparar mensaje'; }, 3500);
    });
  })();
})();
