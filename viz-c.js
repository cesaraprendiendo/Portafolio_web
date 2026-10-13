// Escenas: Ensambladora JAC (6), Bambú Diseño (3), logro, habilidades (3) y contacto
(() => {
  if (!window.Viz) return;
  const { T, P, TAU, add, base, clamp, lerp, smooth, easeOut, rng, solid, lineM, tint, block, poly, dyn, pointsM, label } = window.Viz;
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  // ===== JAC · teoría de grafos: un grafo real de estaciones (3D) sobre el que se lanza Kruskal para obtener el árbol de expansión de costo mínimo (MCST) =====
  add('graphflow', () => {
    const { scene } = base({ cam: [0, 0, 10.2], aspect: 1.7 });
    const g = new T.Group(); scene.add(g);
    const Rn = rng(61), N = 17, pts = [];
    for (let tries = 0; tries < 4000 && pts.length < N; tries++) {
      const p = V3((Rn() - .5) * 8.4, (Rn() - .5) * 4.8, (Rn() - .5) * 2.2);
      if (pts.every((q) => q.distanceTo(p) > 1.35)) pts.push(p);
    }
    const n = pts.length, ekey = (i, j) => (i < j ? i * 100 + j : j * 100 + i), E = new Map();
    for (let i = 0; i < n; i++) {                                   // cada nodo se conecta con sus 3 vecinos más cercanos
      pts.map((p, j) => [pts[i].distanceTo(p), j]).filter(([, j]) => j !== i).sort((a, b) => a[0] - b[0]).slice(0, 3).forEach(([d, j]) => E.set(ekey(i, j), { a: Math.min(i, j), b: Math.max(i, j), w: d }));
    }
    const par = Array.from({ length: n }, (_, i) => i), find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
    E.forEach((e) => { par[find(e.a)] = find(e.b); });
    for (;;) {                                                      // si el grafo quedó desconectado, se une con la arista más corta entre componentes
      let best = null; const roots = new Set(par.map((_, i) => find(i)));
      if (roots.size === 1) break;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (find(i) !== find(j)) { const d = pts[i].distanceTo(pts[j]); if (!best || d < best.w) best = { a: i, b: j, w: d }; }
      E.set(ekey(best.a, best.b), best); par[find(best.a)] = find(best.b);
    }
    const edges = [...E.values()].sort((x, y) => x.w - y.w);
    // Kruskal real: se recorren las aristas por peso y se aceptan si no forman ciclo
    const uf = Array.from({ length: n }, (_, i) => i), f2 = (x) => (uf[x] === x ? x : (uf[x] = f2(uf[x])));
    let total = 0; edges.forEach((e) => { const ra = f2(e.a), rb = f2(e.b); e.ok = ra !== rb; if (e.ok) { uf[ra] = rb; total += e.w; } });
    const nodeAt = new Array(n).fill(1e9), STEP = .3, K0 = 3.6, PER = K0 + edges.length * STEP + 3.8;
    edges.forEach((e, j) => { if (e.ok) { nodeAt[e.a] = Math.min(nodeAt[e.a], K0 + j * STEP); nodeAt[e.b] = Math.min(nodeAt[e.b], K0 + j * STEP); } });
    const nodes = pts.map((p) => { const m = new T.Mesh(new T.SphereGeometry(.19, 20, 14), new T.MeshLambertMaterial({ color: P.g3 })); m.position.copy(p); m.scale.setScalar(.0001); g.add(m); return m; });
    const Y = V3(0, 1, 0), tubeM = new T.MeshLambertMaterial({ color: P.g6 });
    edges.forEach((e) => {
      e.line = new T.Line(new T.BufferGeometry().setFromPoints([pts[e.a], pts[e.b]]), new T.LineBasicMaterial({ color: P.g4, transparent: true, opacity: 0 })); g.add(e.line);
      e.tube = new T.Mesh(new T.CylinderGeometry(.055, .055, 1, 12), tubeM); e.tube.visible = false; g.add(e.tube);
      e.dir = pts[e.b].clone().sub(pts[e.a]); e.len = e.dir.length(); e.dir.normalize();
    });
    const cDim = new T.Color(P.g3), cOn = new T.Color(P.ink), cMid = new T.Color(P.g5), pulses = Array.from({ length: 14 }, () => { const s = new T.Mesh(new T.SphereGeometry(.08, 10, 8), new T.MeshBasicMaterial({ color: P.white })); s.visible = false; g.add(s); return s; });
    const tree = edges.filter((e) => e.ok);
    return (t, dt, m) => {
      const tc = t % PER, grow = smooth(tc / .8) * (1 - smooth((tc - PER + 1.1) / 1.0));
      g.scale.setScalar(Math.max(.001, grow));
      nodes.forEach((nd, i) => {
        const born = easeOut((tc - .1 - i * .07) / .45), on = smooth((tc - nodeAt[i]) / .3);
        nd.scale.setScalar(Math.max(.0001, born * (1 + .3 * Math.max(0, 1 - Math.abs(tc - nodeAt[i]) * 2.6))));
        nd.material.color.copy(cDim).lerp(cOn, on);
      });
      edges.forEach((e, j) => {
        const show = smooth((tc - 1.7 - j * .03) / .5), u = tc - (K0 + j * STEP);
        if (u < 0) { e.line.material.opacity = .5 * show; e.line.material.color.setHex(P.g4); e.tube.visible = false; return; }
        const act = u < STEP * 1.1;
        if (e.ok) {                                                  // se acepta: la arista se vuelve un tubo marino que crece de un extremo al otro
          e.line.material.opacity = .12; const k = smooth(u / (STEP * .8)), L = e.len * k;
          e.tube.visible = true; e.tube.scale.set(1, Math.max(.001, L), 1); e.tube.quaternion.setFromUnitVectors(Y, e.dir);
          e.tube.position.copy(pts[e.a]).addScaledVector(e.dir, L / 2);
        } else {                                                     // se rechaza: forma un ciclo, destella y se apaga
          e.tube.visible = false; e.line.material.color.setHex(act ? P.ink : P.g4); e.line.material.opacity = act ? .95 : lerp(.95, .1, smooth((u - STEP) / .5));
        }
        if (act && e.ok) e.line.material.opacity = .9;
      });
      // al terminar, pulsos recorren el árbol resultante
      const ft = tc - (K0 + edges.length * STEP + .4);
      pulses.forEach((s, i) => {
        s.visible = ft > 0; if (ft <= 0) return;
        const e = tree[(i * 3) % tree.length], u = ((ft * .7 + i * .21) % 1);
        s.position.copy(pts[e.a]).lerp(pts[e.b], i % 2 ? u : 1 - u); s.scale.setScalar(1 + .3 * Math.sin(u * Math.PI));
      });
      g.rotation.y = .35 * Math.sin(t * .22) + m.x * .3; g.rotation.x = .1 + m.y * .12;
    };
  });

  // ===== JAC · control de inventario de herramientas (GUI Python + SQL) =====
  add('inventory', () => {
    const { scene } = base({ cam: [0, 5.6, 8.6], look: [0, -.2, 0], aspect: 1.5 });
    const COLS = 4, ROWS = 3, MIN = 2, HS = .22, R = rng(17);
    const g = new T.Group(); g.position.x = .9; scene.add(g);
    const plate = new T.Mesh(new T.PlaneGeometry(6, 4.6), new T.MeshBasicMaterial({ color: P.white, transparent: true, opacity: .6 }));
    plate.rotation.x = -Math.PI / 2; plate.position.y = -.02; g.add(plate);
    const bins = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const b = block(.9, 1, .9, 0x1f3d7a, P.ink, .9); b.position.set((c - 1.5) * 1.35, 0, (r - 1) * 1.4); g.add(b);
      const ring = new T.Mesh(new T.RingGeometry(.62, .68, 32), new T.MeshBasicMaterial({ color: P.ink, transparent: true, opacity: 0, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(b.position.x, .01, b.position.z); g.add(ring);
      bins.push({ b, ring, v: 5 + Math.floor(R() * 4), shown: 5, x: b.position.x, z: b.position.z });
    }
    const db = new T.Group(); db.position.set(-4.5, 0, 0); g.add(db);
    [.2, .62, 1.04].forEach((y) => {
      const geo = new T.CylinderGeometry(.62, .62, .36, 28), m = new T.Mesh(geo, solid(P.white));
      m.position.y = y; db.add(m, new T.LineSegments(new T.EdgesGeometry(geo), lineM(P.g6, .8)).translateY(y));
    });
    const lk = dyn(2, P.ink, 0); g.add(lk.line);
    let acc = 0, flash = 0;
    return (t, dt, m) => {
      acc += dt;
      if (acc > .85) {
        acc = 0; const b = bins[Math.floor(R() * bins.length)];
        const d = R() < .6 ? -(1 + Math.floor(R() * 2)) : 1 + Math.floor(R() * 2);
        b.v = clamp(b.v + d, 0, 9);
        if (b.v <= MIN + 0 && R() < .5) b.v = 1;
        lk.arr.set([b.x, .4, b.z, -4.5, .6, 0]); lk.attr.needsUpdate = true; flash = 1;
      }
      flash = Math.max(0, flash - dt * 2.5); lk.line.material.opacity = flash;
      bins.forEach((b, i) => {
        b.shown += (b.v - b.shown) * Math.min(1, dt * 5);
        const h = Math.max(.06, b.shown * HS);
        b.b.scale.y = h; b.b.position.y = h / 2;
        const low = b.v <= MIN;
        tint(b.b.body.material, 0x1f3d7a, 0x061331, low ? .95 : 0);
        b.ring.material.opacity = low ? .35 + .35 * Math.sin(t * 6 + i) : 0;
      });
      g.rotation.y = m.x * .3; g.rotation.x = m.y * .06;
    };
  });

  // ===== JAC · macros de Excel (VBA): documentos que se generan solos =====
  add('docs', () => {
    const { scene } = base({ cam: [0, 1.4, 10], look: [0, 0, 0], aspect: 1.6 });
    const SP = .9, FL = 1.1, NPG = 9, STY = -1.7;
    const mkPage = (full) => {
      const g = new T.Group(), b = block(1.25, 1.65, .04, P.white, P.g5, .85); g.add(b);
      g.stripes = [0, 1, 2, 3, 4].map((i) => {
        const s = new T.Mesh(new T.PlaneGeometry(.9, .07), new T.MeshBasicMaterial({ color: i === 0 ? P.g6 : P.g5 }));
        s.geometry.translate(.45, 0, 0); s.position.set(-.45, .55 - i * .27, .03); s.scale.x = full ? 1 : .001; g.add(s); return s;
      });
      return g;
    };
    const tpl = mkPage(true); tpl.position.set(-3.1, 0, 0); scene.add(tpl);
    const lb = label('plantilla', { px: 24 }); lb.position.set(-3.1, -1.4, 0); scene.add(lb);
    const tray = block(1.9, .08, 2.4, P.g2, P.g5, .8); tray.position.set(3.1, STY - .08, 0); scene.add(tray);
    const pages = Array.from({ length: NPG }, () => { const p = mkPage(false); p.visible = false; scene.add(p); return p; });
    const total = NPG * SP + FL + 1.2;
    return (t) => {
      const tc = t % total, out = clamp((tc - (total - .5)) / .5);
      pages.forEach((p, k) => {
        const u = (tc - k * SP) / FL; p.visible = u > 0;
        if (u <= 0) return;
        const e = smooth(u), yT = STY + k * .09 + .03;
        p.position.set(lerp(-3.1, 3.1, e), lerp(0, yT, e) + Math.sin(clamp(u) * Math.PI) * 1.5, 0);
        p.rotation.x = -Math.PI / 2 * e; p.rotation.y = Math.sin(clamp(u) * Math.PI) * .4;
        p.stripes.forEach((s, i) => (s.scale.x = Math.max(.001, clamp(u * 2.4 - i * .35))));
        p.scale.setScalar(Math.max(.001, 1 - out));
      });
    };
  });

  // ===== JAC · Power Automate: un workflow completo con 22 nodos (disparador, orígenes, transformaciones, condiciones, ramas y acciones) por el que circulan ejecuciones =====
  add('kpiflow', () => {
    const { scene } = base({ cam: [0, 0, 10.4], aspect: 1.75 });
    const spec = [
      ['T', -4.7, 0, 'cyl'],
      ['A1', -3.55, 1.6], ['A2', -3.55, 0], ['A3', -3.55, -1.6],
      ['M1', -2.4, 1.0], ['M2', -2.4, -1.0],
      ['C1', -1.25, 2.1], ['C2', -1.25, .7], ['C3', -1.25, -.7], ['C4', -1.25, -2.1],
      ['D1', -.1, 1.4, 'dia'], ['D2', -.1, -1.4, 'dia'],
      ['B1', 1.05, 2.25], ['B2', 1.05, .85], ['B3', 1.05, -.55], ['B4', 1.05, -1.95],
      ['O1', 2.2, 2.45], ['O2', 2.2, 1.2], ['O3', 2.2, 0], ['O4', 2.2, -1.2], ['O5', 2.2, -2.45],
      ['END', 3.5, 0, 'sph'],
    ];
    const idx = Object.fromEntries(spec.map((s, i) => [s[0], i]));
    const links = [['T', 'A1'], ['T', 'A2'], ['T', 'A3'], ['A1', 'M1'], ['A2', 'M1'], ['A2', 'M2'], ['A3', 'M2'], ['M1', 'C1'], ['M1', 'C2'], ['M2', 'C3'], ['M2', 'C4'],
      ['C1', 'D1'], ['C2', 'D1'], ['C3', 'D2'], ['C4', 'D2'], ['D1', 'B1'], ['D1', 'B2'], ['D2', 'B3'], ['D2', 'B4'],
      ['B1', 'O1'], ['B1', 'O2'], ['B2', 'O2'], ['B2', 'O3'], ['B3', 'O3'], ['B3', 'O4'], ['B4', 'O4'], ['B4', 'O5'],
      ['O1', 'END'], ['O2', 'END'], ['O3', 'END'], ['O4', 'END'], ['O5', 'END']];
    const out = spec.map(() => []);
    const nodes = spec.map(([name, x, y, kind], i) => {
      let nd;
      if (kind === 'cyl') { nd = new T.Group(); const cg = new T.CylinderGeometry(.26, .26, .3, 32); cg.rotateX(Math.PI / 2); const c = new T.Mesh(cg, solid(P.white)); nd.add(c, new T.LineSegments(new T.EdgesGeometry(cg, 40), lineM(P.g5, .9))); nd.rotation.y = 0; nd.body = c; }
      else if (kind === 'dia') { const geo = new T.OctahedronGeometry(.34); nd = new T.Group(); const c = new T.Mesh(geo, solid(P.white)); nd.add(c, new T.LineSegments(new T.EdgesGeometry(geo), lineM(P.g5, .9))); nd.body = c; }
      else if (kind === 'sph') { const geo = new T.SphereGeometry(.3, 22, 16); nd = new T.Group(); const c = new T.Mesh(geo, solid(P.white)); nd.add(c, new T.LineSegments(new T.EdgesGeometry(geo, 20), lineM(P.g5, .7))); nd.body = c; }
      else { nd = block(.5, .34, .26, P.white, P.g5, .85); }
      nd.position.set(x, y, 0); nd.pulse = 0; nd.scale.setScalar(.0001); nd.born = i; scene.add(nd); return nd;
    });
    const edges = links.map(([a, b]) => {
      const A = nodes[idx[a]].position, B = nodes[idx[b]].position, line = new T.Line(new T.BufferGeometry().setFromPoints([A, B]), new T.LineBasicMaterial({ color: P.g4, transparent: true, opacity: .6 }));
      scene.add(line); const e = { a: idx[a], b: idx[b], line, glow: 0 }; out[e.a].push(e); return e;
    });
    const R = rng(88), tokens = [], tokenGeo = new T.SphereGeometry(.085, 12, 10);
    const spawn = () => { const m = new T.Mesh(tokenGeo, new T.MeshBasicMaterial({ color: P.ink })); scene.add(m); const e = out[0][Math.floor(R() * out[0].length)]; tokens.push({ m, e, u: 0, speed: 1.5 + R() * .7 }); nodes[0].pulse = 1; };
    let acc = 0;
    const cOn = new T.Color(P.ink), cOff = new T.Color(P.white), cl = new T.Color(P.g4), ch = new T.Color(P.ink);
    return (t, dt) => {
      const fade = 1;
      acc += dt; if (acc > .55 && t > 1.8) { acc = 0; if (tokens.length < 10) spawn(); }
      nodes.forEach((nd, i) => {
        const b = easeOut((t - .05 - i * .06) / .45); nd.pulse = Math.max(0, nd.pulse - dt * 1.7);
        nd.scale.setScalar(Math.max(.0001, b * (1 + .22 * nd.pulse)));
        if (nd.body) nd.body.material.color.copy(cOff).lerp(cOn, nd.pulse); else window.Viz.tint(nd.body ? nd.body.material : nd.children[0].material, P.white, P.ink, nd.pulse);
      });
      edges.forEach((e, j) => { e.glow = Math.max(0, e.glow - dt * 1.4); const sh = smooth((t - .6 - j * .04) / .5); e.line.material.color.copy(cl).lerp(ch, e.glow); e.line.material.opacity = (.55 + .45 * e.glow) * sh; });
      for (let k = tokens.length - 1; k >= 0; k--) {
        const tk = tokens[k]; tk.u += dt * tk.speed / 1.6; tk.e.glow = 1;
        const A = nodes[tk.e.a].position, B = nodes[tk.e.b].position;
        if (tk.u >= 1) {
          nodes[tk.e.b].pulse = 1; const nx = out[tk.e.b];
          if (!nx.length) { scene.remove(tk.m); tokens.splice(k, 1); continue; }
          tk.e = nx[Math.floor(R() * nx.length)]; tk.u = 0;
        }
        tk.m.position.lerpVectors(nodes[tk.e.a].position, nodes[tk.e.b].position, tk.u); tk.m.position.z = .2;
      }
    };
  });

  // ===== JAC · Power BI: varias fuentes consolidadas en un solo tablero =====
  add('powerbi', () => {
    const { scene } = base({ cam: [0, 0, 10.4], aspect: 1.5 });
    const R = rng(23), srcPos = [V3(-3.8, 1.8, 0), V3(-3.8, 0, 0), V3(-3.8, -1.8, 0)];
    const shapes = [new T.CylinderGeometry(.42, .42, .6, 24), new T.BoxGeometry(.8, .6, .5), new T.OctahedronGeometry(.48)];
    shapes.forEach((geo, i) => {
      const m = new T.Mesh(geo, solid(P.white)); m.position.copy(srcPos[i]); scene.add(m);
      const e = new T.LineSegments(new T.EdgesGeometry(geo), lineM(P.g6, .85)); e.position.copy(srcPos[i]); scene.add(e);
      const l = label(['SQL', 'Excel', 'Sistemas'][i], { px: 22 }); l.position.set(srcPos[i].x, srcPos[i].y - .72, 0); scene.add(l);
    });
    const panel = block(4.2, 3.7, .1, P.white, P.g5, .9); panel.position.set(1.7, 0, 0); scene.add(panel);
    const head = block(4.0, .4, .12, P.g2, P.g5, .6); head.position.set(1.7, 1.55, .02); scene.add(head);
    const bars = Array.from({ length: 6 }, (_, i) => { const b = block(.42, 1, .3, P.g3, P.g5, .8); b.position.set(.2 + i * .6, -1.5, .2); scene.add(b); return { b, v: .4, to: .4, x: .2 + i * .6 }; });
    srcPos.forEach((p, i) => scene.add(poly([p.clone().add(V3(.55, 0, 0)), V3(-.45, p.y * .45, 0)], P.g3, .9)));
    const N = 18, pos = new Float32Array(N * 3), attr = new T.BufferAttribute(pos, 3); attr.setUsage(T.DynamicDrawUsage);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', attr);
    const pts = new T.Points(geo, pointsM(P.ink, .2)); pts.frustumCulled = false; scene.add(pts);
    const pp = Array.from({ length: N }, (_, i) => ({ s: i % 3, u: R() }));
    let acc = 0;
    return (t, dt) => {
      pp.forEach((p, i) => {
        p.u += dt * .45; if (p.u > 1) p.u -= 1;
        const a = srcPos[p.s], x = lerp(a.x + .55, -.45, p.u * 1);
        pos[i * 3] = x; pos[i * 3 + 1] = lerp(a.y, a.y * .45, p.u); pos[i * 3 + 2] = .1;
      });
      attr.needsUpdate = true;
      acc += dt; if (acc > 1.6) { acc = 0; bars.forEach((b) => (b.to = .3 + R() * 2)); }
      bars.forEach((b) => { b.v += (b.to - b.v) * Math.min(1, dt * 3); b.b.scale.y = b.v; b.b.position.y = -1.6 + b.v / 2; tint(b.b.body.material, P.sky, P.g6, b.v / 2.3); });
    };
  });

  // ===== JAC · regresión logística (ajuste en vivo por descenso de gradiente) =====
  add('logreg', () => {
    const { scene } = base({ cam: [0, 6.6, 10.2], look: [0, .3, 0] });
    const R = rng(33), NE = 44, XB = 3.5, ZB = 2.4;
    const gauss = () => Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(TAU * R());
    const data = [];
    for (let i = 0; i < NE; i++) data.push({ x: -1.5 + gauss() * .85, z: -.7 + gauss() * .85, y: 0 });
    for (let i = 0; i < NE; i++) data.push({ x: 1.5 + gauss() * .85, z: .8 + gauss() * .85, y: 1 });
    const mesh = new T.InstancedMesh(new T.SphereGeometry(.1, 12, 10), new T.MeshLambertMaterial({ color: 0xffffff }), data.length);
    const d = new T.Object3D(), cW = new T.Color(0xffffff), cD = new T.Color(P.ink);
    data.forEach((p, i) => { d.position.set(p.x, .1, p.z); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); mesh.setColorAt(i, p.y ? cD : cW); });
    scene.add(mesh);
    const floor = new T.Mesh(new T.PlaneGeometry(7, 4.8), new T.MeshBasicMaterial({ color: P.g3, transparent: true, opacity: .75 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const geo = new T.PlaneGeometry(7, 4.8, 28, 19); geo.rotateX(-Math.PI / 2);
    scene.add(new T.Mesh(geo, solid(P.g2, { transparent: true, opacity: .5, side: T.DoubleSide, depthWrite: false })));
    scene.add(new T.Mesh(geo, new T.MeshBasicMaterial({ color: P.g5, wireframe: true, transparent: true, opacity: .3 })));
    const bd = dyn(2, P.ink, 1); scene.add(bd.line);
    const pos = geo.attributes.position, sg = (z) => 1 / (1 + Math.exp(-z));
    let w = [0, .05, -.05], acc = 0, t0 = 0;
    const step = () => {
      const g = [0, 0, 0];
      for (const p of data) { const e = sg(w[0] + w[1] * p.x + w[2] * p.z) - p.y; g[0] += e; g[1] += e * p.x; g[2] += e * p.z; }
      for (let i = 0; i < 3; i++) w[i] -= .35 * g[i] / data.length;
    };
    const draw = () => {
      for (let i = 0; i < pos.count; i++) pos.setY(i, sg(w[0] + w[1] * pos.getX(i) + w[2] * pos.getZ(i)) * 1.8);
      pos.needsUpdate = true; geo.computeVertexNormals();
      const c = [];
      [-XB, XB].forEach((x) => { if (Math.abs(w[2]) > 1e-4) { const z = -(w[0] + w[1] * x) / w[2]; if (Math.abs(z) <= ZB) c.push([x, z]); } });
      [-ZB, ZB].forEach((z) => { if (Math.abs(w[1]) > 1e-4) { const x = -(w[0] + w[2] * z) / w[1]; if (Math.abs(x) <= XB) c.push([x, z]); } });
      if (c.length >= 2) { bd.arr.set([c[0][0], .03, c[0][1], c[1][0], .03, c[1][1]]); bd.line.visible = true; } else bd.line.visible = false;
      bd.attr.needsUpdate = true;
    };
    draw();
    return (t, dt, m) => {
      if (t - t0 > 10) { t0 = t; w = [(R() - .5) * 1.2, (R() - .5) * .6, (R() - .5) * .6]; }
      acc += dt; while (acc > .05) { acc -= .05; step(); }
      draw();
    };
  });

  // ===== BAMBÚ · presupuestos automáticos =====
  add('quote', () => {
    const { scene } = base({ cam: [0, .4, 10.4], aspect: 1.7 });
    const NBR = 5, PER = 7, BY = -1.9, SX = 2.4, SEGK = .38;
    const bars = Array.from({ length: NBR }, (_, i) => { const b = block(.45, 1, .45, P.g2, P.g5, .85); b.position.x = -3.6 + i * .7; scene.add(b); return b; });
    scene.add(poly([V3(-4.2, BY, 0), V3(-.5, BY, 0)], P.g4, .9));
    scene.add(poly([V3(1.6, BY, 0), V3(3.2, BY, 0)], P.g4, .9));
    const lt = label('total', { px: 24 }); lt.position.set(SX, BY - .5, 0); scene.add(lt);
    const clock = new T.Group(); clock.position.set(-3.2, 2.5, 0); scene.add(clock);
    const ring = new T.Mesh(new T.TorusGeometry(.5, .04, 8, 40), solid(P.g5)); clock.add(ring);
    const hand = poly([V3(0, 0, 0), V3(0, .4, 0)], P.ink, 1); clock.add(hand);
    let cyc = -1, hs = [];
    return (t) => {
      const c = Math.floor(t / PER), tc = t % PER;
      if (c !== cyc) { cyc = c; const R = rng(c * 53 + 9); hs = bars.map(() => .6 + R() * 1.5); }
      const out = clamp((tc - 6.4) / .5);
      let acc = 0;
      bars.forEach((b, i) => {
        const grow = easeOut((tc - i * .15) / .6), u = clamp((tc - (1.4 + i * .5)) / .6), e = smooth(u);
        const h = hs[i] * grow, seg = hs[i] * SEGK;
        const yBase = BY + acc + seg / 2; acc += seg;
        const hh = lerp(h, seg, e);
        b.scale.set(lerp(1, 2.2, e) * Math.max(.001, 1 - out), Math.max(.001, hh * (1 - out)), Math.max(.001, 1 - out));
        b.position.set(lerp(-3.6 + i * .7, SX, e), lerp(BY + h / 2, yBase, e) + Math.sin(e * Math.PI) * .9, 0);
        tint(b.body.material, P.sky, P.g5, e);
        if (tc > 4.6 && tc < 6) tint(b.body.material, P.g5, P.g6, .5 + .5 * Math.sin(tc * 10) * .5);
      });
      clock.rotation.z = -clamp(tc / 4.6) * TAU * 2;
      lt.visible = tc > 4.6; lt.position.y = BY - .5;
    };
  });

  // ===== BAMBÚ · diseño gráfico (curvas vectoriales de Illustrator) =====
  add('vector', () => {
    const { scene } = base({ cam: [0, 0, 9.6] });
    const NA = 5, NS = 90;
    const fillGeo = (color, op) => {
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(NS * 9), 3));
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color, transparent: true, opacity: op, side: T.DoubleSide, depthWrite: false })); m.frustumCulled = false; scene.add(m); return m;
    };
    const back = fillGeo(P.g3, .7), front = fillGeo(P.white, .95);
    const outline = dyn(NS + 1, P.ink, 1); scene.add(outline.line);
    const anchors = Array.from({ length: NA }, () => { const b = block(.17, .17, .02, P.white, P.ink, 1); scene.add(b); return b; });
    const hl = Array.from({ length: NA }, () => { const l = dyn(3, P.g5, 1); scene.add(l.line); return l; });
    const hd = Array.from({ length: NA * 2 }, () => { const s = new T.Mesh(new T.SphereGeometry(.06, 8, 6), solid(P.ink)); scene.add(s); return s; });
    const fill = (mesh, sample, k, dx, dy) => {
      const a = mesh.geometry.attributes.position.array; let cx = 0, cy = 0;
      sample.forEach((p) => { cx += p.x; cy += p.y; }); cx /= sample.length; cy /= sample.length;
      for (let i = 0; i < NS; i++) {
        const p = sample[i], q = sample[(i + 1) % sample.length], o = i * 9;
        a.set([cx * k + dx, cy * k + dy, 0, p.x * k + dx, p.y * k + dy, 0, q.x * k + dx, q.y * k + dy, 0], o);
      }
      mesh.geometry.attributes.position.needsUpdate = true;
    };
    return (t, dt, m) => {
      const pts = [];
      for (let i = 0; i < NA; i++) {
        const a = i / NA * TAU + .3;
        pts.push(V3(Math.cos(a) * (2.2 + .6 * Math.sin(t * .7 + i * 1.9)), Math.sin(a) * (1.7 + .5 * Math.sin(t * .6 + i * 2.3)), 0));
      }
      const curve = new T.CatmullRomCurve3(pts, true, 'centripetal');
      const s = curve.getPoints(NS - 1);
      s.forEach((p, i) => { outline.arr[i * 3] = p.x; outline.arr[i * 3 + 1] = p.y; outline.arr[i * 3 + 2] = .05; });
      outline.arr.set([s[0].x, s[0].y, .05], NS * 3); outline.attr.needsUpdate = true;
      fill(back, s, 1.08, -.18, -.14); fill(front, s, 1, 0, 0);
      for (let i = 0; i < NA; i++) {
        const p = pts[i], tg = curve.getTangent(i / NA).multiplyScalar(.55);
        anchors[i].position.set(p.x, p.y, .1);
        hl[i].arr.set([p.x - tg.x, p.y - tg.y, .08, p.x, p.y, .08, p.x + tg.x, p.y + tg.y, .08]); hl[i].attr.needsUpdate = true;
        hd[i * 2].position.set(p.x - tg.x, p.y - tg.y, .09); hd[i * 2 + 1].position.set(p.x + tg.x, p.y + tg.y, .09);
      }
    };
  });

  // ===== BAMBÚ · sitios web con HTML, CSS y JavaScript =====
  add('web', () => {
    const { scene } = base({ cam: [0, 0, 10.6], aspect: 1.5 });
    const g = new T.Group(); scene.add(g);
    const frame = block(7.4, 4.9, .1, P.white, P.g5, .9); g.add(frame);
    const bar = block(7.4, .42, .12, P.g2, P.g5, .7); bar.position.set(0, 2.24, .02); g.add(bar);
    [0, 1, 2].forEach((i) => { const d = new T.Mesh(new T.SphereGeometry(.06, 8, 6), solid(P.g5)); d.position.set(-3.4 + i * .2, 2.24, .1); g.add(d); });
    const defs = [
      [0, 1.65, 6.8, .42, P.g2], [-1.75, .45, 3.2, 1.5, P.white], [1.85, .45, 3.0, 1.5, P.sky],
      [-2.3, -1.15, 2.1, 1.1, P.white], [0, -1.15, 2.1, 1.1, P.white], [2.3, -1.15, 2.1, 1.1, P.white], [0, -2.0, 6.8, .34, P.g2],
    ];
    const els = defs.map(([x, y, w, h, c], i) => {
      const b = block(w, h, .12, c, P.g5, .8); b.body.material.transparent = true; g.add(b);
      return { b, x, y, dx: i % 2 ? 0 : (i < 3 ? -1 : 1) * 4, dy: i % 2 ? (i > 3 ? -3 : 3) : 0, i };
    });
    const cur = new T.Mesh(new T.ConeGeometry(.14, .38, 10), solid(P.ink)); cur.rotation.z = Math.PI * .85; g.add(cur);
    const cards = els.slice(3, 6);
    cur.position.set(0, -3, .5);
    const PER = 10;
    return (t, dt, m) => {
      const tc = t % PER;
      els.forEach((e) => {
        const uin = easeOut((tc - e.i * .25) / .6), uout = easeOut((tc - 8 - (6 - e.i) * .1) / .5), k = Math.max(0, uin - uout);
        e.b.position.set(e.x + (1 - k) * e.dx, e.y + (1 - k) * e.dy, 0);
        e.b.scale.setScalar(Math.max(.001, .6 + .4 * k));
        e.b.body.material.opacity = k; e.b.edges.material.opacity = .8 * k;
      });
      const hov = Math.floor((tc - 2.8) / 1.3);
      let tx = 0, ty = -3.4, hi = -1;
      if (tc > 2.6 && tc < 7.8 && hov >= 0 && hov < 3) { hi = hov; tx = cards[hi].x + .3; ty = cards[hi].y - .2; }
      cur.position.x += (tx - cur.position.x) * Math.min(1, dt * 6); cur.position.y += (ty - cur.position.y) * Math.min(1, dt * 6); cur.position.z = .5;
      cards.forEach((c, i) => { const on = i === hi; c.b.position.z += ((on ? .3 : 0) - c.b.position.z) * Math.min(1, dt * 8); });
      g.rotation.y = -.2 + m.x * .25; g.rotation.x = m.y * .1;
    };
  });

})();
