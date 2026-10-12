// Escenas: licenciatura (3), Gobierno Municipal (3) y Sentria (4)
(() => {
  if (!window.Viz) return;
  const { T, P, TAU, add, base, clamp, lerp, smooth, easeOut, rng, solid, lineM, tint, block, poly, dyn, rrect, pointsM, label } = window.Viz;
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  // ===== LICENCIATURA · PRÁCTICAS: modelo epidemiológico SIR =====
  add('sir', () => {
    const { scene } = base({ cam: [0, 5.2, 8.8], look: [0, .5, 0], shift: .2 });
    const N = 200, R = rng(5), CYC = 20, SAMP = .2, MAXS = Math.ceil(CYC / SAMP) + 2;
    const XB = 3.5, ZA = -1.7, ZB = 2.1;
    const ag = Array.from({ length: N }, () => ({ x: 0, z: 0, vx: 0, vz: 0, s: 0, tI: 0 }));
    const mesh = new T.InstancedMesh(new T.SphereGeometry(.075, 10, 8), new T.MeshLambertMaterial({ color: 0xffffff }), N);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(mesh);
    const arena = new T.Mesh(new T.PlaneGeometry(7.6, 4.2), new T.MeshBasicMaterial({ color: P.white, transparent: true, opacity: .6 }));
    arena.rotation.x = -Math.PI / 2; arena.position.set(0, -.02, .2); scene.add(arena);
    const edge = new T.LineSegments(new T.EdgesGeometry(arena.geometry), lineM(P.g4, .9));
    edge.rotation.x = -Math.PI / 2; edge.position.set(0, -.01, .2); scene.add(edge);
    // gráfica de fondo
    const panel = new T.Group(); panel.position.set(0, 1.8, -2.9); scene.add(panel);
    const pb = new T.Mesh(new T.PlaneGeometry(7.4, 2.7), new T.MeshBasicMaterial({ color: P.white, transparent: true, opacity: .65 }));
    panel.add(pb, new T.LineSegments(new T.EdgesGeometry(pb.geometry), lineM(P.g4, .9)));
    const cs = { S: dyn(MAXS, P.g5, 1), I: dyn(MAXS, P.ink, 1), R: dyn(MAXS, P.g4, 1) };
    Object.values(cs).forEach((c) => { c.line.position.set(0, -1.15, .02); panel.add(c.line); });
    const cols = [new T.Color(P.white), new T.Color(P.ink), new T.Color(P.g5)];
    const dummy = new T.Object3D();
    let t0 = -1, samp = 0, ns = 0;
    const reset = (t) => {
      t0 = t; samp = 0; ns = 0;
      ag.forEach((a, i) => {
        a.x = (R() - .5) * 2 * XB; a.z = ZA + R() * (ZB - ZA);
        const th = R() * TAU; a.vx = Math.cos(th) * .6; a.vz = Math.sin(th) * .6; a.s = i < 4 ? 1 : 0; a.tI = 0;
      });
    };
    return (t, dt) => {
      if (t0 < 0 || t - t0 > CYC) reset(t);
      for (let i = 0; i < N; i++) {
        const a = ag[i];
        const th = (R() - .5) * 3 * dt * 4; const c = Math.cos(th), s = Math.sin(th);
        const vx = a.vx * c - a.vz * s, vz = a.vx * s + a.vz * c; a.vx = vx; a.vz = vz;
        a.x += a.vx * dt; a.z += a.vz * dt;
        if (a.x < -XB || a.x > XB) { a.vx *= -1; a.x = clamp(a.x, -XB, XB); }
        if (a.z < ZA || a.z > ZB) { a.vz *= -1; a.z = clamp(a.z, ZA, ZB); }
      }
      const inf = ag.filter((a) => a.s === 1);
      for (const a of ag) {
        if (a.s === 0) {
          for (const b of inf) {
            if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 < .09 && R() < 1 - Math.exp(-2.4 * dt)) { a.s = 1; a.tI = 0; break; }
          }
        } else if (a.s === 1) { a.tI += dt; if (a.tI > 4.2) a.s = 2; }
      }
      let cS = 0, cI = 0, cR = 0;
      ag.forEach((a, i) => {
        a.s === 0 ? cS++ : a.s === 1 ? cI++ : cR++;
        dummy.position.set(a.x, .075, a.z); dummy.scale.setScalar(a.s === 1 ? 1.25 : 1); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, cols[a.s]);
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      samp += dt;
      if (samp >= SAMP && ns < MAXS) {
        samp = 0;
        const x = -3.4 + 6.8 * (ns / (MAXS - 1));
        [['S', cS], ['I', cI], ['R', cR]].forEach(([k, v]) => {
          const c = cs[k]; c.arr[ns * 3] = x; c.arr[ns * 3 + 1] = v / N * 2.3; c.arr[ns * 3 + 2] = 0;
          c.geo.setDrawRange(0, ns + 1); c.attr.needsUpdate = true;
        });
        ns++;
      }
    };
  });

  // ===== LICENCIATURA · CONGRESO: problema de Sturm–Liouville (modos de una cuerda) =====
  add('sturm', () => {
    const { scene } = base({ cam: [0, 0, 10.4], shift: .2, aspect: 1.4 });
    const g = new T.Group(); g.rotation.y = -.22; scene.add(g);
    const M = 5, NP = 90, L = 7.2, X0 = -3.2, A = .34;
    const rows = [];
    for (let n = 1; n <= M; n++) {
      const y0 = 2.45 - 1.05 * (n - 1);
      const env = [], env2 = [];
      for (let i = 0; i < NP; i++) { const u = i / (NP - 1), e = A * Math.sin(n * Math.PI * u); env.push(V3(X0 + L * u, y0 + e, -.05)); env2.push(V3(X0 + L * u, y0 - e, -.05)); }
      g.add(poly(env, P.g3, .8), poly(env2, P.g3, .8));
      const d = dyn(NP, P.g6, 1); g.add(d.line);
      const dot = new T.Mesh(new T.SphereGeometry(.09, 12, 10), solid(P.ink)); g.add(dot);
      const lb = label(`n = ${n}`, { px: 24 }); lb.position.set(-4.05, y0, 0); g.add(lb);
      rows.push({ n, y0, d, dot });
    }
    const ys = -2.55, sum = dyn(NP, P.ink, 1); g.add(sum.line);
    const ls = label('suma', { px: 24 }); ls.position.set(-4.05, ys, 0); g.add(ls);
    [-1, 1].forEach((s) => rows.concat([{ y0: ys }]).forEach((r) => { const e = new T.Mesh(new T.SphereGeometry(.06, 8, 6), solid(P.g5)); e.position.set(s < 0 ? X0 : X0 + L, r.y0, 0); g.add(e); }));
    return (t, dt, m) => {
      for (let i = 0; i < NP; i++) { sum.arr[i * 3] = X0 + L * i / (NP - 1); sum.arr[i * 3 + 2] = 0; sum.arr[i * 3 + 1] = ys; }
      for (const r of rows) {
        for (let i = 0; i < NP; i++) {
          const u = i / (NP - 1), y = A * Math.sin(r.n * Math.PI * u) * Math.cos(r.n * 1.5 * t);
          r.d.arr[i * 3] = X0 + L * u; r.d.arr[i * 3 + 1] = r.y0 + y; r.d.arr[i * 3 + 2] = 0;
          sum.arr[i * 3 + 1] += y * (1.1 / r.n);
        }
        r.d.attr.needsUpdate = true;
        const k = Math.round(.5 / r.n * (NP - 1));
        r.dot.position.set(r.d.arr[k * 3], r.d.arr[k * 3 + 1], 0);
      }
      sum.attr.needsUpdate = true;
      g.rotation.y = -.22 + m.x * .25; g.rotation.x = m.y * .1;
    };
  });

  // ===== GOBIERNO · chatbot de WhatsApp con n8n =====
  add('chatbot', () => {
    const { scene } = base({ cam: [0, 0, 9.4], aspect: 1.6 });
    const g = new T.Group(); g.rotation.y = -.18; scene.add(g);
    const phone = new T.Mesh(rrect(.95, 1.9, .2, .2), solid(P.white)); phone.position.set(-3.5, -.2, 0);
    g.add(phone, new T.LineSegments(new T.EdgesGeometry(phone.geometry), lineM(P.g5, .8)).translateX(-3.5).translateY(-.2));
    const nodes = [[-1.3, .8, P.white], [1.0, 1.1, P.g6], [3.3, 0, P.white]].map(([x, s, c], i) => {
      const b = i === 2 ? block(1.2, .9, .3, c, P.g5, .8) : block(s, s, s, c, i === 1 ? P.ink : P.g5, .8);
      b.position.set(x, .5, 0); g.add(b);
      return b;
    });
    [['WhatsApp', -3.5], ['Webhook', -1.3], ['n8n', 1.0], ['Sheets', 3.3]].forEach(([s, x]) => { const l = label(s, { px: 24 }); l.position.set(x, -1.95, 0); g.add(l); });
    g.add(poly([V3(-3.0, .5, 0), V3(3.3, .5, 0)], P.g4, .8));
    g.add(poly([V3(1.0, -.9, 0), V3(-3.0, -.9, 0)], P.g3, .9));
    const bub = (c, ec) => { const m = new T.Mesh(rrect(.78, .38, .12, .1), solid(c)); const e = new T.LineSegments(new T.EdgesGeometry(m.geometry), lineM(ec, .9)); m.add(e); g.add(m); return m; };
    const fw = bub(P.white, P.g6), rp = bub(P.ink, P.ink);
    const chip = block(.3, .2, .12, P.g4, P.g6, .8); g.add(chip);
    const PER = 4.2;
    return (t, dt, m) => {
      const tc = t % PER;
      const u = clamp(tc / 1.7);
      fw.visible = tc < 1.75; fw.position.set(lerp(-3.0, 1.0, easeOut(u) * .6 + u * .4), .5, .2);
      const pulse = (c, a, b) => Math.max(0, Math.sin(clamp((tc - a) / (b - a)) * Math.PI));
      nodes[0].scale.setScalar(1 + .18 * pulse(0, .55, 1.05));
      nodes[1].scale.setScalar(1 + .2 * pulse(1, 1.7, 2.3));
      nodes[2].scale.setScalar(1 + .2 * pulse(2, 2.9, 3.4));
      chip.visible = tc > 2.2 && tc < 3.0; chip.position.set(lerp(1.5, 3.0, clamp((tc - 2.2) / .8)), .5, .2);
      const r = clamp((tc - 2.2) / 1.7); rp.visible = tc > 2.2 && tc < 3.95;
      if (r < .2) rp.position.set(1.0, lerp(.5, -.9, r / .2), .2); else rp.position.set(lerp(1.0, -3.0, (r - .2) / .8), -.9, .2);
      g.rotation.y = -.18 + m.x * .25; g.rotation.x = m.y * .1;
    };
  });

  // ===== GOBIERNO · base de datos ligera en Google Sheets y Drive =====
  add('sheets', () => {
    const { scene } = base({ cam: [0, 6, 8.6], look: [0, 0, 0], aspect: 1.6 });
    const COLS = 6, ROWS = 6, cw = .78, PERIOD = 9, RT = .75;
    const g = new T.Group(); g.position.x = -1; scene.add(g);
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const b = block(cw * .92, .1, .6, r === 0 ? P.g3 : P.white, P.g5, .7);
      b.position.set((c - 2.5) * cw, 0, (r - 2.5) * .66); g.add(b); cells.push({ b, r, c });
    }
    const folder = block(1.3, .9, 1.2, P.g1, P.g6, .9); folder.position.set(4.1, .45, 0); g.add(folder);
    const tab = block(.6, .16, .35, P.g2, P.g6, .9); tab.position.set(3.8, .98, -.45); g.add(tab);
    const chips = Array.from({ length: ROWS - 1 }, () => { const b = block(.34, .06, .22, P.ink, P.ink, .6); g.add(b); return b; });
    let fill = 0;
    return (t, dt, m) => {
      const tc = t % PERIOD, clear = clamp((tc - 7.4) / .8);
      cells.forEach(({ b, r, c }) => {
        if (r === 0) { b.position.y = 0; return; }
        const a = clamp((tc - (r - 1) * RT - c * .06) / .5);
        b.position.y = Math.sin(a * Math.PI) * .3;
        tint(b.body.material, P.white, P.g5, a >= 1 ? 1 - clear : a);
      });
      let landed = 0;
      chips.forEach((ch, i) => {
        const u = (tc - (i * RT + .35)) / .7;
        ch.visible = u > 0 && u < 1;
        if (u >= 1 && tc < 7.4) landed++;
        if (ch.visible) ch.position.set(lerp(2.3, 3.8, u), .15 + Math.sin(u * Math.PI) * 1.1, (i - 2) * .25 * (1 - u));
      });
      folder.scale.y = 1 + .06 * landed * (tc < 7.4 ? 1 : 0);
      g.rotation.y = m.x * .25; g.rotation.x = m.y * .06;
    };
  });

  // ===== GOBIERNO · interfaz de monitoreo en Apps Script (tablero) =====
  add('dashboard', () => {
    const { scene } = base({ cam: [0, 0, 10.6], aspect: 1.4 });
    const g = new T.Group(); scene.add(g);
    const R = rng(21);
    const panel = (x, y) => { const p = block(3.9, 2.8, .08, P.white, P.g4, .9); p.position.set(x, y, 0); g.add(p); return p; };
    const p1 = panel(-2.0, 1.55), p2 = panel(2.0, 1.55), p3 = panel(-2.0, -1.55), p4 = panel(2.0, -1.55);
    // barras
    const bars = Array.from({ length: 6 }, (_, i) => { const b = block(.38, 1, .3, P.sky, P.g6, .85); b.position.set(-1.4 + i * .56, -1, .2); p1.add(b); return { b, v: .5, to: .5 }; });
    // línea
    const lc = dyn(26, P.ink, 1); lc.line.position.z = .15; p2.add(lc.line);
    const vals = Array.from({ length: 26 }, () => .5);
    const dot = new T.Mesh(new T.SphereGeometry(.09, 12, 10), solid(P.ink)); p2.add(dot);
    // dona
    let donut = new T.Group(); donut.position.z = .2; p3.add(donut);
    const fr = [.45, .3, .25];
    const buildDonut = () => {
      donut.children.slice().forEach((c) => { donut.remove(c); c.geometry.dispose(); });
      let a0 = 0;
      fr.forEach((f, k) => {
        const m = new T.Mesh(new T.TorusGeometry(.8, .2, 10, 36, f * TAU - .08), solid([P.g6, P.g5, P.sky][k]));
        m.rotation.z = a0; donut.add(m); a0 += f * TAU;
      });
    };
    buildDonut();
    // KPIs
    const kp = [-1.15, 0, 1.15].map((x) => { const b = block(.95, 1.5, .2, P.g1, P.g5, .8); b.position.set(x, 0, .15); p4.add(b); const bar = block(.55, .14, .22, P.ink, P.ink, .5); bar.position.set(x, -.35, .3); p4.add(bar); return { bar, v: .5, to: .5, x }; });
    let tick = 0, acc = 0;
    return (t, dt, m) => {
      tick += dt;
      if (tick > 2.2) {
        tick = 0;
        bars.forEach((b) => (b.to = .3 + R() * 1.6));
        const a = .2 + R() * .4, b2 = .15 + R() * .3; fr[0] = a; fr[1] = b2; fr[2] = 1 - a - b2; buildDonut();
        kp.forEach((k) => (k.to = .25 + R() * .6));
      }
      acc += dt;
      if (acc > .22) { acc = 0; vals.shift(); vals.push(clamp(vals[vals.length - 1] + (R() - .5) * .35, .1, .95)); }
      bars.forEach((b) => { b.v += (b.to - b.v) * Math.min(1, dt * 4); b.b.scale.y = b.v; b.b.position.y = -1.1 + b.v / 2; });
      vals.forEach((v, i) => { lc.arr[i * 3] = -1.6 + 3.2 * i / 25; lc.arr[i * 3 + 1] = -.9 + v * 1.8; lc.arr[i * 3 + 2] = 0; });
      lc.attr.needsUpdate = true; dot.position.set(1.6, -.9 + vals[25] * 1.8, .15);
      donut.rotation.z = -t * .35;
      kp.forEach((k) => { k.v += (k.to - k.v) * Math.min(1, dt * 4); k.bar.scale.x = k.v / .55; k.bar.position.x = k.x - (.55 - k.v) / 2; });
      [p1, p2, p3, p4].forEach((p, i) => { const s = window.Viz.easeOut((t - i * .15) / .6); p.scale.setScalar(Math.max(.001, s)); });
      g.rotation.y = -.05 + m.x * .25; g.rotation.x = m.y * .1;
    };
  });

  // ===== SENTRIA · reglas de negocio automatizadas (Python + openpyxl) =====
  add('rules', () => {
    const { scene } = base({ cam: [0, 0, 10.4], aspect: 1.7 });
    const GX = -.7, lanes = [1.7, 0, -1.7], SZ = [.34, .5, .7], COL = [P.sky, P.g5, P.g6];
    const arch = new T.Group(); scene.add(arch);
    const l = block(.16, 3.2, .16, P.white, P.g6, .9); l.position.set(GX, 0, .8); arch.add(l);
    const r = block(.16, 3.2, .16, P.white, P.g6, .9); r.position.set(GX, 0, -.8); arch.add(r);
    const top = block(.16, .16, 1.76, P.white, P.g6, .9); top.position.set(GX, 1.6, 0); arch.add(top);
    const lb = label('reglas de negocio', { px: 24 }); lb.position.set(GX, 2.35, 0); scene.add(lb);
    scene.add(poly([V3(-4.4, 0, 0), V3(GX, 0, 0)], P.g4, .9));
    lanes.forEach((y) => {
      const p = []; for (let i = 0; i <= 30; i++) { const x = GX + 4.3 * i / 30; p.push(V3(x, y * smooth((x - GX) / 2), 0)); }
      scene.add(poly(p, P.g3, .9));
      const bin = block(.8, .8, .8, P.g1, P.g5, .8); bin.body.material.transparent = true; bin.body.material.opacity = .35; bin.position.set(4.0, y, 0); scene.add(bin);
    });
    const SP = .75, V = 1.9, tNum = (k) => rng(k * 31 + 7)();
    const pool = Array.from({ length: 14 }, () => { const b = block(1, 1, 1, P.g5, P.ink, .6); b.visible = false; scene.add(b); return b; });
    return (t) => {
      pool.forEach((b) => (b.visible = false));
      let flash = 0;
      const kMax = Math.floor(t / SP), kMin = Math.max(0, Math.floor((t - 6) / SP));
      for (let k = kMin; k <= kMax; k++) {
        const ty = Math.floor(tNum(k) * 3), a = t - k * SP, x = -4.4 + V * a;
        if (x > 3.75) continue;
        const b = pool[k % pool.length]; b.visible = true;
        b.position.set(x, x > GX ? lanes[ty] * smooth((x - GX) / 2) : 0, 0);
        b.scale.setScalar(SZ[ty]); b.body.material.color.setHex(COL[ty]);
        flash = Math.max(flash, 1 - Math.min(1, Math.abs(x - GX) / .5));
        if (x > 3.3) b.scale.setScalar(SZ[ty] * clamp((3.75 - x) / .45));
      }
      [l, r, top].forEach((p) => tint(p.body.material, P.white, P.g5, flash));
    };
  });

  // ===== SENTRIA · metaheurística de bin packing 3D =====
  add('binpack', () => {
    const { scene } = base({ cam: [0, 3.2, 8.8], look: [0, 0, 0] });
    const CW = 4.4, CH = 2.4, CD = 2.6, NB = 13, GAP = .42;
    const g = new T.Group(); scene.add(g);
    const cont = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(CW, CH, CD)), lineM(P.g6, .95)); g.add(cont);
    const floor = new T.Mesh(new T.PlaneGeometry(CW + .6, CD + .6), new T.MeshBasicMaterial({ color: P.white, transparent: true, opacity: .55, side: T.DoubleSide }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -CH / 2 - .02; g.add(floor);
    const tones = [P.sky, P.g5, P.white, P.g3, P.g6, P.g2];
    let boxes = [], seed = 1, cStart = 0;
    const build = (sd) => {
      boxes.forEach((b) => { g.remove(b); });
      const R = rng(sd * 97 + 3);
      let parts = [{ x: 0, y: 0, z: 0, w: CW, h: CH, d: CD }];
      while (parts.length < NB) {
        parts.sort((a, b) => b.w * b.h * b.d - a.w * a.h * a.d);
        const p = parts.shift(), rel = [p.w / CW, p.h / CH, p.d / CD], ax = rel.indexOf(Math.max(...rel)), f = .35 + R() * .3;
        const key = ['w', 'h', 'd'][ax], pos = ['x', 'y', 'z'][ax];
        const a = Object.assign({}, p), b = Object.assign({}, p);
        a[key] = p[key] * f; b[key] = p[key] * (1 - f); b[pos] = p[pos] + a[key];
        parts.push(a, b);
      }
      parts.sort((a, b) => a.y + R() * .4 - (b.y + R() * .4));
      boxes = parts.map((p, i) => {
        const b = block(p.w - .05, p.h - .05, p.d - .05, tones[Math.floor(R() * tones.length)], P.g6, .85);
        b.fin = V3(p.x + p.w / 2 - CW / 2, p.y + p.h / 2 - CH / 2, p.z + p.d / 2 - CD / 2); b.ts = i * GAP; g.add(b); return b;
      });
    };
    build(seed);
    const total = NB * GAP + .6 + 1.8;
    return (t, dt, m) => {
      const tc = t - cStart;
      if (tc > total + .6) { seed++; cStart = t; build(seed); return; }
      boxes.forEach((b) => {
        const u = (tc - b.ts) / .55, out = clamp((tc - total) / .5);
        b.visible = u > 0;
        const e = window.Viz.easeOut(u);
        b.position.set(b.fin.x, b.fin.y + (1 - e) * 5, b.fin.z);
        b.scale.setScalar(Math.max(.001, 1 - out));
      });
      g.rotation.y = .5 + Math.sin(t * .25) * .35 + m.x * .3; g.rotation.x = m.y * .08;
    };
  });

  // ===== SENTRIA · interfaz en Streamlit + control de versiones en GitHub =====
  add('gitui', () => {
    const { scene } = base({ cam: [0, 0, 10.4], aspect: 1.5 });
    const g = new T.Group(); g.rotation.y = -.15; scene.add(g);
    const win = block(3.6, 4.2, .12, P.white, P.g5, .9); win.position.set(-2.5, 0, 0); g.add(win);
    const bar = block(3.6, .4, .14, P.g2, P.g5, .9); bar.position.set(-2.5, 1.9, .01); g.add(bar);
    [0, 1, 2].forEach((i) => { const d = new T.Mesh(new T.SphereGeometry(.07, 10, 8), solid(P.g5)); d.position.set(-4.1 + i * .22, 1.9, .1); g.add(d); });
    const knobs = [0, 1, 2].map((i) => {
      const y = .85 - i * .85;
      g.add(poly([V3(-4.0, y, .1), V3(-1.0, y, .1)], P.g4, 1));
      const k = new T.Mesh(new T.SphereGeometry(.14, 14, 10), solid(P.ink)); k.position.set(-3, y, .15); g.add(k);
      return { k, y, ph: i * 1.7 };
    });
    const btn = block(1.2, .4, .2, P.ink, P.ink, .6); btn.position.set(-2.5, -1.55, .15); g.add(btn);
    // gráfico de commits
    const nodes = [[0.7, 1.0], [1.7, 1.0], [2.7, 1.0], [3.7, 1.0], [2.2, -.6], [3.1, -.6]];
    const segs = [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 3]];
    const cm = nodes.map(([x, y], i) => { const s = new T.Mesh(new T.SphereGeometry(.15, 14, 10), solid(i === 3 ? P.ink : P.g4)); s.position.set(x, y, 0); g.add(s); return s; });
    const sl = segs.map(([a, b]) => { const l = poly([V3(...nodes[a], 0), V3(...nodes[b], 0)], P.g5, 1); g.add(l); return l; });
    const mainL = label('main', { px: 24 }); mainL.position.set(.7, 1.55, 0); g.add(mainL);
    const brL = label('rama', { px: 24 }); brL.position.set(2.2, -1.15, 0); g.add(brL);
    const gl = label('GitHub', { px: 26 }); gl.position.set(2.3, -2.4, 0); g.add(gl);
    const times = [.3, 1.0, 3.9, 4.6, 1.8, 2.7];
    return (t, dt, m) => {
      const tc = t % 7;
      knobs.forEach((o) => { o.k.position.x = -2.5 + Math.sin(t * .9 + o.ph) * 1.2; });
      btn.position.z = .15 - .08 * Math.max(0, Math.sin(tc * 2.2 * Math.PI / 3.5) > .9 ? 1 : 0);
      cm.forEach((s, i) => { const on = tc > times[i]; s.visible = on; s.scale.setScalar(on ? 1 + .4 * Math.max(0, 1 - (tc - times[i]) * 3) : 1); });
      sl.forEach((l, i) => { const [a, b] = segs[i]; l.visible = tc > Math.max(times[a], times[b]) - .05; });
      g.rotation.y = -.15 + m.x * .25; g.rotation.x = m.y * .1;
    };
  });

})();
