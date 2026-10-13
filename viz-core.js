// Núcleo de animaciones 3D: un solo renderer de Three.js compartido por todas las escenas.
// Cada elemento con [data-viz="nombre"] recibe su escena dibujada en su propio recuadro (scissor).
(() => {
  'use strict';
  const T = window.THREE;
  if (!T) { document.documentElement.classList.add('no-gl'); return; }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  // Paleta: blanco y grises claros (con un gris oscuro solo para dar contraste a lo importante)
  const P = { white: 0xffffff, g1: 0xf7f8fa, g2: 0xeceef2, g3: 0xdde1e8, g4: 0xc3c9d4, g5: 0x34508a, g6: 0x0f2a5e, ink: 0x061331, sky: 0x7c8fb8, bg: 0xffffff };

  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const rng = (seed) => {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  // ---------- materiales y piezas ----------
  const solid = (c = P.white, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const lineM = (c = P.g5, op = .7) => new T.LineBasicMaterial({ color: c, transparent: true, opacity: op });
  const edgesOf = (geo, c = P.g5, op = .6) => new T.LineSegments(new T.EdgesGeometry(geo), lineM(c, op));
  const _tc = new T.Color();
  const tint = (mat, a, b, k) => { mat.color.setHex(a).lerp(_tc.setHex(b), k); };

  function block(w, h, d, c = P.white, ec = P.g5, op = .6) {
    const geo = new T.BoxGeometry(w, h, d);
    const g = new T.Group();
    g.body = new T.Mesh(geo, solid(c));
    g.edges = edgesOf(geo, ec, op);
    g.add(g.body, g.edges);
    return g;
  }
  function poly(pts, c = P.g5, op = .8) {
    const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), lineM(c, op));
    return l;
  }
  // línea con vértices que se actualizan cada cuadro
  function dyn(n, c = P.g5, op = .8) {
    const arr = new Float32Array(n * 3);
    const attr = new T.BufferAttribute(arr, 3); attr.setUsage(T.DynamicDrawUsage);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', attr);
    const line = new T.Line(geo, lineM(c, op)); line.frustumCulled = false;
    return { line, arr, attr, geo };
  }
  function rrect(w, h, r, d) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -d / 2);
    return g;
  }

  let _dot;
  const dotTex = () => {
    if (_dot) return _dot;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, '#fff'); g.addColorStop(.72, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(32, 32, 30, 0, TAU); x.fill();
    return (_dot = new T.CanvasTexture(c));
  };
  const pointsM = (color = P.g5, size = .15, vertexColors = false) =>
    new T.PointsMaterial({ color: vertexColors ? 0xffffff : color, size, map: dotTex(), vertexColors, transparent: true, alphaTest: .05, depthWrite: false });

  // las animaciones no llevan anotaciones: label() devuelve un objeto vacío para que las escenas sigan funcionando
  function label() { const o = new T.Object3D(); o.material = { opacity: 0 }; return o; }

  // Estilo de línea: todas las mallas se vuelven blancas planas y reciben un trazo fino gris claro en sus aristas (renderizado en la GPU)
  function lineArt(root, o = {}) {
    const col = o.line || 0x8f99ab, white = new T.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), stroke = new T.LineBasicMaterial({ color: col }), hull = new T.MeshBasicMaterial({ color: col, side: T.BackSide }), list = [];
    root.traverse((m) => { if (m.isMesh) list.push(m); });
    list.forEach((m) => {
      const g = m.geometry, p = g.parameters || {};
      m.material = white;
      if ((p.width || 0) >= 40) return;                                   // los planos enormes (suelo, calle, muro) no llevan trazo en su borde
      if (/Sphere/.test(g.type)) { const h = new T.Mesh(g, hull); h.scale.setScalar(1.045); m.add(h); return; }   // contorno limpio en esferas
      m.add(new T.LineSegments(new T.EdgesGeometry(g, /Cylinder|Cone|Icosa|Torus|Circle/.test(g.type) ? 14 : 30), stroke));
    });
    return { white, stroke };
  }

  // ---------- registro de escenas ----------
  const registry = {};
  let last = null;
  const add = (name, factory) => { registry[name] = factory; };
  function base(o = {}) {
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(o.fov || 38, 1, .1, 200);
    cam.position.set(...(o.cam || [0, 0, 10]));
    cam.lookAt(...(o.look || [0, 0, 0]));
    cam.userData.aspect = o.aspect || 1.33;
    cam.userData.shift = o.shift === undefined ? .1 : o.shift; // fracción del ancho del escenario que la escena se corre a la izquierda (así los sólidos tapan parte del texto)
    scene.add(new T.AmbientLight(0xffffff, .72));
    const d = new T.DirectionalLight(0xffffff, .45); d.position.set(3, 6, 5); scene.add(d);
    return (last = { scene, cam });
  }

  window.Viz = { lineArt, registry, T, P, TAU, add, base, clamp, lerp, smooth, easeOut, rng, solid, lineM, edgesOf, tint, block, poly, dyn, rrect, dotTex, pointsM, label };

  // ---------- gestor ----------
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { document.documentElement.classList.add('no-gl'); return; }
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  window.Viz.renderer = renderer;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  const cv = renderer.domElement;
  cv.id = 'gl'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);

  let VW = 0, VH = 0;
  const fit = () => { VW = document.documentElement.clientWidth; VH = innerHeight; renderer.setSize(VW, VH); };
  addEventListener('resize', fit); fit();

  const ptr = { x: -1e4, y: -1e4 };
  addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
  document.addEventListener('mouseleave', () => { ptr.x = ptr.y = -1e4; });

  // Un elemento [data-viz="a"] muestra una escena; [data-viz-seq="a,b,c"] muestra varias y pasa de una a otra con una transición
  const items = [...document.querySelectorAll('[data-viz],[data-viz-seq]')].map((el) => ({
    el, names: (el.dataset.vizSeq || el.dataset.viz).split(','), cur: 0, prev: -1, k: 1, insts: {}, m: { x: 0, y: 0 },
  }));
  window.Viz.items = items;
  window.Viz.setSeq = (el, i) => {
    const it = items.find((x) => x.el === el);
    if (!it || it.cur === i || i < 0 || i >= it.names.length) return;
    const same = it.names[i] === it.names[it.cur], inst = it.insts[it.names[i]];
    if (same) {                       // misma escena: continúa y solo cambia su paso
      it.cur = i; it.prev = -1; it.k = 1;
      if (inst) { inst.S.step = i; inst.S.st = 0; }
      return;
    }
    it.prev = it.cur; it.cur = i; it.k = 0; it.snap = true;
    const n = inst; if (n) { n.t = 0; n.mats = null; n.S.step = i; n.S.st = 0; }
    const p = it.insts[it.names[it.prev]]; if (p) p.mats = null;
  };

  function getInst(it, name) {
    if (name in it.insts) return it.insts[name];
    const f = registry[name];
    let inst = null;
    if (f) {
      try {
        const r = f();
        last.cam.userData.dy = (window.VIZ_DY && window.VIZ_DY[name]) || 0;
        inst = { scene: last.scene, cam: last.cam, t: 0, mats: null, S: { step: it.cur, st: 0 }, update: typeof r === 'function' ? r : (r && r.update) || (() => {}) };
        if (reduce) for (let i = 0; i < 140; i++) { inst.t += .05; inst.update(inst.t, .05, it.m, inst.S); }
      } catch (err) { console.error('viz', name, err); }
    }
    return (it.insts[name] = inst);
  }

  // transición: se atenúa la opacidad de todos los materiales de la escena y se restaura después de dibujar
  function fadeOn(inst, f) {
    if (!inst.mats) {
      const set = new Set();
      inst.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => set.add(m)); });
      inst.mats = [...set];
    }
    inst.saved = inst.mats.map((m) => [m.opacity, m.transparent, m.uniforms && m.uniforms.uFade ? m.uniforms.uFade.value : null]);
    inst.mats.forEach((m) => { if (m.uniforms && m.uniforms.uFade) m.uniforms.uFade.value *= f; else { m.transparent = true; m.opacity *= f; } });
  }
  function fadeOff(inst) {
    inst.mats.forEach((m, i) => { const s = inst.saved[i]; if (s[2] !== null) m.uniforms.uFade.value = s[2]; else { m.opacity = s[0]; m.transparent = s[1]; } });
  }
  // cada escena se dibuja dentro de un rectángulo (x, yTop, w, h) en px de pantalla: primero toda la pantalla y luego su zona
  function draw(inst, x, yTop, w, h, f, zf, roll) {
    const cam = inst.cam, asp = w / h, yb = VH - (yTop + h);
    renderer.setViewport(x, yb, w, h); renderer.setScissor(x, yb, w, h);
    // centrado vertical por escena (fracción del alto del recuadro): se mide para que el contenido quede al centro del escenario
    const dy = cam.userData.dy || 0;
    if (dy) cam.setViewOffset(w, h, 0, -dy * h, w, h); else if (cam.view && cam.view.enabled) cam.clearViewOffset();
    cam.aspect = asp; cam.zoom = Math.min(1, asp / cam.userData.aspect) * zf; cam.updateProjectionMatrix();
    const fade = f < .999;
    if (fade) fadeOn(inst, f);
    if (roll) { cam.rotateZ(roll); cam.updateMatrixWorld(true); }
    renderer.clearDepth();
    renderer.render(inst.scene, cam);
    if (roll) { cam.rotateZ(-roll); cam.updateMatrixWorld(true); }
    if (fade) fadeOff(inst);
  }

  const SPEED = 1.7; // velocidad global de todas las animaciones
  let prev = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { prev = now; return; }
    const dt = Math.min(.05, (now - prev) / 1000); prev = now;
    renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      if (r.bottom < -80 || r.top > VH + 80 || r.right < 0 || r.left > VW || r.width < 4 || r.height < 4) continue;
      const cur = getInst(it, it.names[it.cur]);
      if (!cur) continue;
      const isSeq = it.el.classList.contains('seq-viz');
      // una secuencia empieza cuando su escenario queda fijo al centro de la pantalla
      if (isSeq && !it.started) {
        if (Math.abs(r.top + r.height / 2 - VH / 2) > VH * .22) continue;
        it.started = true; cur.t = 0;
      }
      const inside = ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom;
      const tx = inside ? ((ptr.x - r.left) / r.width) * 2 - 1 : 0, ty = inside ? -(((ptr.y - r.top) / r.height) * 2 - 1) : 0;
      it.m.x += (tx - it.m.x) * .08; it.m.y += (ty - it.m.y) * .08;
      if (it.k < 1) it.k = Math.min(1, it.k + dt / .8);
      const out = it.k < 1 && it.prev >= 0 ? getInst(it, it.names[it.prev]) : null;
      if (!reduce) { const sdt = dt * SPEED; for (const inst of [cur, out]) if (inst) { inst.t += sdt; inst.S.st += sdt; inst.update(inst.t, sdt, it.m, inst.S); } }
      // escritorio: el texto de cada paso va a la izquierda (l) o a la derecha (r) y la escena ocupa la zona libre del lado opuesto
      const wide = isSeq && innerWidth > 900;
      const sides = (it.el.dataset.sides || '').split(',');
      const zone = (idx) => {
        if (!wide) return [r.left, r.width];
        const tw = Math.min(400, r.width * .36), avail = r.width - tw - 56;
        return [r.left + (sides[idx] === 'l' ? r.width - avail : 0), avail];
      };
      // Transición entre escenas:
      //  · la que sale se encoge hacia el centro de su zona, gira y se desvanece;
      //  · la que entra abarca toda la pantalla (girada y con zoom), se contrae hasta su zona con un pequeño rebote y el texto espera.
      if (out) {
        const z = zone(it.prev), p = it.k, pe = p * p, s2 = 1 - .72 * pe, w2 = z[1] * s2, h2 = r.height * s2;
        draw(out, z[0] + (z[1] - w2) / 2, r.top + (r.height - h2) / 2, w2, h2, 1 - smooth(clamp(p * 1.6)), 1 + .25 * pe, pe * .7);
      }
      const cc = isSeq && !reduce ? clamp((cur.t - .3) / 1.7) : 1;
      const c = 1 + 2.2 * (cc - 1) ** 3 + 1.2 * (cc - 1) ** 2;        // easeOutBack suave
      if (isSeq) { const op = cc < .96; if (op !== it.opening) { it.opening = op; const sq = it.el.closest('.seq'); if (sq) sq.classList.toggle('opening', op); } }
      const zt = zone(it.cur);
      if (!it.zs || it.snap) { it.zs = zt.slice(); it.snap = false; }
      else { const kz = 1 - Math.exp(-dt * 4); it.zs[0] += (zt[0] - it.zs[0]) * kz; it.zs[1] += (zt[1] - it.zs[1]) * kz; }
      const z = it.zs, alpha = isSeq && !reduce ? smooth(clamp(cur.t / .7)) : 1, k2 = smooth(cc);
      draw(cur, lerp(0, z[0], c), lerp(0, r.top, c), lerp(VW, z[1], c), lerp(VH, r.height, c), alpha, lerp(1.45, 1, k2), (1 - k2) * -.6);
    }
  }
  // las escenas se registran en scripts posteriores: el ciclo arranca cuando todo el DOM y los scripts ya cargaron
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => requestAnimationFrame(frame)); else requestAnimationFrame(frame);
})();
