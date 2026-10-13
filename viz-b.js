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

  // ===== GOBIERNO · chatbot de WhatsApp con n8n (minimalista): un mensaje entra, se procesa y se guarda; la respuesta regresa =====
  add('chatbot', () => {
    const { scene } = base({ cam: [0, 0, 9], aspect: 1.9 });
    const g = new T.Group(); scene.add(g);
    const NAVY = new T.Color(P.ink), GREY = new T.Color(P.g4), tmp = new T.Color();
    const slab = (parent, w, h, r, d, x, y, z = 0, fill = P.white, ec = P.g5) => { const geo = rrect(w, h, r, d), m = new T.Mesh(geo, solid(fill)); m.add(new T.LineSegments(new T.EdgesGeometry(geo, 25), lineM(ec, .9))); m.position.set(x, y, z); parent.add(m); return m; };
    const disc = (r, x, y, z, color, parent) => { const m = new T.Mesh(new T.CircleGeometry(r, 28), new T.MeshBasicMaterial({ color, transparent: true })); m.position.set(x, y, z); parent.add(m); return m; };
    const XB = -3.1, XN = 0, XS = 3.1;
    // burbuja de chat (con tres puntos que parpadean al escribir)
    const B = new T.Group(); B.position.set(XB, 0, 0); g.add(B);
    slab(B, 1.5, 1.0, .34, .14, 0, 0);
    { const tail = new T.Mesh(new T.CircleGeometry(.17, 3), new T.MeshBasicMaterial({ color: P.white })); tail.rotation.z = Math.PI * 1.05; tail.position.set(-.45, -.55, .02); B.add(tail);
      const tl = poly([V3(-.62, -.49, .1), V3(-.35, -.49, .1)], P.g5, 0); }
    const dots = [-.3, 0, .3].map((x) => disc(.075, x, 0, .12, P.g5, B));
    // nodo de n8n: cuadrado redondeado con un anillo
    const N = new T.Group(); N.position.set(XN, 0, 0); g.add(N);
    const nBody = slab(N, 1.1, 1.1, .26, .16, 0, 0);
    { const ring = new T.Mesh(new T.RingGeometry(.2, .26, 40), new T.MeshBasicMaterial({ color: P.g5 })); ring.position.z = .12; N.add(ring); }
    const nCore = disc(.1, 0, 0, .13, P.g5, N);
    // almacenamiento: cuadrado redondeado con cuadrícula 2×2 que se va llenando
    const S = new T.Group(); S.position.set(XS, 0, 0); g.add(S);
    slab(S, 1.2, 1.2, .16, .14, 0, 0);
    const cells = [[-.27, .27], [.27, .27], [-.27, -.27], [.27, -.27]].map(([x, y]) => { const m = new T.Mesh(new T.PlaneGeometry(.42, .42), new T.MeshBasicMaterial({ color: P.g6, transparent: true, opacity: 0 })); m.position.set(x, y, .1); S.add(m); return m; });
    // hilos
    const L1 = poly([V3(XB + .85, 0, -.02), V3(XN - .65, 0, -.02)], P.g4, .95), L2 = poly([V3(XN + .65, 0, -.02), V3(XS - .72, 0, -.02)], P.g4, .95); g.add(L1, L2);
    // paquetes
    const mkPkt = (r, c, ec) => { const m = new T.Mesh(new T.CircleGeometry(r, 24), new T.MeshBasicMaterial({ color: c, transparent: true })); const ring = new T.Mesh(new T.RingGeometry(r, r + .03, 24), new T.MeshBasicMaterial({ color: ec })); m.add(ring); m.visible = false; g.add(m); return m; };
    const p1 = mkPkt(.12, P.ink, P.ink), p2 = mkPkt(.12, P.ink, P.ink), p3 = mkPkt(.15, P.white, P.ink);
    const PER = 6.4, pulse = (tc, a, b) => Math.max(0, Math.sin(clamp((tc - a) / (b - a)) * Math.PI));
    const lerp3 = (a, b, u) => a + (b - a) * u;
    return (t, dt, m) => {
      const tc = t % PER, gs = smooth(tc / .8) * (1 - smooth((tc - PER + 1) / .9));
      g.scale.setScalar(Math.max(.001, gs));
      // los tres puntos de la burbuja parpadean mientras se escribe el mensaje
      dots.forEach((d, i) => { const on = tc < 1.1 ? .35 + .65 * Math.max(0, Math.sin(tc * 9 - i * 1.1)) : .35; d.material.opacity = on; });
      B.scale.setScalar(1 + .08 * pulse(tc, .9, 1.3) + .1 * pulse(tc, 4.7, 5.2));
      // 1) la burbuja envía el mensaje al nodo
      const u1 = clamp((tc - 1.1) / 1.0); p1.visible = u1 > 0 && u1 < 1; p1.position.set(lerp3(XB + .85, XN - .65, easeOut(u1)), 0, .2);
      L1.material.color.copy(GREY).lerp(NAVY, smooth((tc - 1.1) / .8) * (tc < PER - 1 ? 1 : 0));
      // 2) el nodo procesa y envía el dato al almacenamiento
      N.scale.setScalar(1 + .1 * pulse(tc, 2.0, 2.7));
      nCore.material.color.copy(tmp.setHex(P.g5)).lerp(NAVY, pulse(tc, 2.0, 2.7));
      const u2 = clamp((tc - 2.7) / 1.0); p2.visible = u2 > 0 && u2 < 1; p2.position.set(lerp3(XN + .65, XS - .72, easeOut(u2)), 0, .2);
      L2.material.color.copy(GREY).lerp(NAVY, smooth((tc - 2.7) / .8) * (tc < PER - 1 ? 1 : 0));
      // 3) el almacenamiento se llena celda por celda
      S.scale.setScalar(1 + .1 * pulse(tc, 3.7, 4.4));
      cells.forEach((c, i) => { c.material.opacity = .9 * smooth((tc - 3.8 - i * .18) / .35) * (tc < PER - 1 ? 1 : 0); });
      // 4) la respuesta regresa al chat
      const u3 = clamp((tc - 4.3) / 1.4); p3.visible = u3 > 0 && u3 < 1; p3.position.set(lerp3(XN - .65, XB + .85, easeOut(u3)), 0, .2);
      g.rotation.y = m.x * .2; g.rotation.x = m.y * .08;
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

})();
