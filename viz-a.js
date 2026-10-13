// Escenas: hero, perfil (3) y maestría (5)
(() => {
  if (!window.Viz) return;
  const { T, P, TAU, add, base, clamp, lerp, smooth, easeOut, rng, solid, lineM, block, poly, dyn, dotTex, pointsM, label } = window.Viz;
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  // ===== HERO: superficie matemática de puntos =====
  add('hero', () => {
    const { scene } = base({ fov: 40, cam: [0, 4.4, 12], look: [0, 0, 0], aspect: .6 });
    scene.fog = new T.Fog(P.bg, 14, 34);
    const NX = 64, NZ = 40, W = 30, D = 20;
    const pos = new Float32Array(NX * NZ * 3);
    const attr = new T.BufferAttribute(pos, 3); attr.setUsage(T.DynamicDrawUsage);
    const idx = [];
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      const i = z * NX + x;
      if (x < NX - 1) idx.push(i, i + 1);
      if (z < NZ - 1) idx.push(i, i + NX);
    }
    const g1 = new T.BufferGeometry(); g1.setAttribute('position', attr);
    const g2 = new T.BufferGeometry(); g2.setAttribute('position', attr); g2.setIndex(idx);
    const pts = new T.Points(g1, pointsM(P.g6, .16));
    const lines = new T.LineSegments(g2, lineM(P.g4, .55));
    pts.frustumCulled = lines.frustumCulled = false;
    const grp = new T.Group(); grp.add(pts, lines); grp.position.set(3.5, -1.4, 0); scene.add(grp);
    return (t, dt, m) => {
      for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
        const px = (x / (NX - 1) - .5) * W, pz = (z / (NZ - 1) - .5) * D, r = Math.hypot(px - 2, pz);
        const y = Math.sin(px * .38 + t * .7) * Math.cos(pz * .5 - t * .5) * .9 + Math.sin(r * .9 - t * 1.4) * 1.1 * Math.exp(-r * .09);
        const i = (z * NX + x) * 3; pos[i] = px; pos[i + 1] = y; pos[i + 2] = pz;
      }
      attr.needsUpdate = true;
      grp.rotation.y = -.25 + m.x * .12; grp.rotation.x = m.y * .05;
    };
  });

  // Permite atenuar un grupo completo: guarda la opacidad base de sus materiales y devuelve una función f -> aplica f (0..1)
  const fadeKit = (obj, skip = []) => {
    const list = [];
    obj.traverse((o) => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach((mt) => { if (!skip.includes(mt) && !list.some((x) => x.m === mt)) list.push({ m: mt, base: mt.opacity, tr: mt.transparent }); });
    });
    return (f) => { list.forEach(({ m, base, tr }) => { m.transparent = f < .999 ? true : tr; m.opacity = base * f; }); obj.visible = f > .004; };
  };

  // ----- Tablero de Galton (se construye como pieza para poder usarlo dentro de una animación mayor) -----
  function makeGalton() {
    const NR = 9, NB = NR + 1, N = 2000, DX = .33, DY = .25, TOP = 2.55, BD = .06, ACROSS = 5, LAYERS = 5, D = .34, WH = 1.8, TAU_ROW = .23;
    const floorY = TOP - (NR - 1) * DY - .4 - WH, binX = (k) => (k - NR / 2) * DX, CELL = ACROSS * LAYERS;
    const rot = new T.Group(), board = new T.Group(); board.position.y = -.95; rot.add(board);
    // palillos: varillas alineadas en una retícula triangular perfecta, bien arriba
    const rod = new T.CylinderGeometry(.028, .028, D, 10); rod.rotateX(Math.PI / 2);
    const pegs = new T.InstancedMesh(rod, new T.MeshLambertMaterial({ color: P.ink }), (NR * (NR + 1)) / 2);
    const dm = new T.Object3D(); let pi = 0;
    for (let r = 0; r < NR; r++) for (let i = 0; i <= r; i++) { dm.position.set((i - r / 2) * DX, TOP - r * DY, 0); dm.updateMatrix(); pegs.setMatrixAt(pi++, dm.matrix); }
    board.add(pegs);
    // canastas: prismas rectangulares por debajo de los palillos
    for (let k = 0; k <= NB; k++) { const w = block(.04, WH, D, P.white, P.g5, .85); w.position.set(binX(k) - DX / 2, floorY + WH / 2, 0); board.add(w); }
    const fl = block(NB * DX + .06, .07, D + .02, P.g2, P.g6, .9); fl.position.set(0, floorY - .035, 0); board.add(fl);
    [[-1, -.77], [1, .77]].forEach(([s, a]) => { const w = block(1.16, .05, D, P.white, P.g5, .85); w.position.set(s * .485, TOP + .7, 0); w.rotation.z = a; board.add(w); });
    const curve = [];
    for (let i = 0; i <= 60; i++) { const k = i / 60 * NR, pk = Math.exp(-((k - NR / 2) ** 2) / (2 * NR / 4)) / Math.sqrt(2 * Math.PI * NR / 4); curve.push(V3(binX(0) + k * DX, floorY + N * pk / CELL * BD * .9, D / 2 + .03)); }
    const bell = poly(curve, P.ink, .9); board.add(bell);
    const R = rng(77), balls = [], counts = new Array(NB).fill(0);
    const mesh = new T.InstancedMesh(new T.SphereGeometry(BD * .45, 7, 6), new T.MeshLambertMaterial({ color: 0xffffff }), N);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; board.add(mesh);
    const cFall = new T.Color(P.sky), cLand = new T.Color(P.g6), SPAN = 26;
    for (let k = 0; k < N; k++) {
      const xs = [0]; let sum = 0, x = 0;
      for (let r = 0; r < NR; r++) { const d = R() < .5 ? 1 : 0; sum += d; x += (d ? .5 : -.5) * DX; xs.push(x); }
      const slot = counts[sum]++, col = slot % ACROSS, layer = Math.floor(slot / ACROSS) % LAYERS, row = Math.floor(slot / CELL);
      balls.push({ t0: SPAN * Math.pow(k / N, .72), xs, fx: binX(sum) + (col - (ACROSS - 1) / 2) * BD * .92, fy: floorY + BD / 2 + row * BD * .9, z: (layer - (LAYERS - 1) / 2) * BD * .95, landed: false, init: false });
    }
    mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    const PER = 34, FALL = .6, fade = fadeKit(rot, [bell.material]);
    return {
      rot,
      // t: tiempo propio del tablero; vis: visibilidad 0..1
      update(t, dt, m, vis) {
        const tc = t % PER, g = 1 - smooth((tc - PER + 1.8) / 1.6), rows = NR * TAU_ROW;
        fade(vis);
        if (vis < .004) return;
        for (let k = 0; k < N; k++) {
          const b = balls[k], a = tc - b.t0;
          let x, y;
          if (a < 0) {
            if (b.landed || !b.init) { b.landed = false; b.init = true; mesh.setColorAt(k, cFall); mesh.instanceColor.needsUpdate = true; }
            dm.position.set(0, 99, 0); dm.scale.setScalar(.0001); dm.updateMatrix(); mesh.setMatrixAt(k, dm.matrix); continue;
          }
          if (a < TAU_ROW * .6) { const s = a / (TAU_ROW * .6); x = 0; y = TOP + .5 - s * s * .5 + (1 - s) * .2; }
          else if (a < TAU_ROW * .6 + rows) {
            const q = (a - TAU_ROW * .6) / TAU_ROW, r = Math.min(NR - 1, Math.floor(q)), s = q - r;
            x = lerp(b.xs[r], b.xs[r + 1], s); const y0 = TOP - r * DY, y1 = TOP - (r + 1) * DY;
            y = lerp(y0, y1, s * s * .75 + s * .25) + .07 * Math.sin(Math.PI * s) + .05;
          } else {
            const s = clamp((a - TAU_ROW * .6 - rows) / FALL), yA = TOP - NR * DY + .05;
            x = lerp(b.xs[NR], b.fx, smooth(s)); y = lerp(yA, b.fy, s * s);
            if (s >= 1 && !b.landed) { b.landed = true; mesh.setColorAt(k, cLand); mesh.instanceColor.needsUpdate = true; }
          }
          dm.position.set(x, y, b.z); dm.scale.setScalar(Math.max(.0001, g)); dm.updateMatrix(); mesh.setMatrixAt(k, dm.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        bell.material.opacity = .9 * smooth((tc - 6) / 4) * g * vis;
        rot.rotation.y = -.55 + Math.sin(t * .25) * .12 + m.x * .3; rot.rotation.x = .1 + m.y * .08;
      },
    };
  }

  // ===== PERFIL · una sola animación: función escalar ajustada a una nube de puntos → otra función escalar con descenso del gradiente → tablero de Galton =====
  add('perfil', () => {
    const { scene, cam } = base({ cam: [0, 5.4, 10.8], look: [0, 0, 0], aspect: 1.3 });
    const camA = V3(0, 5.4, 10.8), camB = V3(0, .2, 10.4);
    const f1 = (x, z) => .03 * (x * x * x - 3 * x * z * z);                                           // función 1 (silla de mono)
    const bad = (x, z, t) => .22 * x - .12 * z + .35 * Math.sin(.9 * x + t * 1.3) * Math.cos(.8 * z - t); // ajuste inicial malo
    const f2 = (x, z) => .13 * (x * x + z * z) + .55 * Math.sin(1.5 * x) * Math.sin(1.5 * z) * Math.exp(-.04 * (x * x + z * z)) - .6; // función 2 (terreno con mínimos)
    const R = rng(31), N = 4800, sg = new T.Group(); scene.add(sg);
    const gauss = () => Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(TAU * R());
    // nube de puntos fija, por encima y por debajo de la función 1
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), px = [], pz = [], py = [];
    for (let i = 0; i < N; i++) {
      const x = (R() - .5) * 6.4, z = (R() - .5) * 6.4, y = f1(x, z) + gauss() * .34;
      px.push(x); pz.push(z); py.push(y); pos.set([x, y, z], i * 3);
    }
    const cattr = new T.BufferAttribute(col, 3); cattr.setUsage(T.DynamicDrawUsage);
    const geoP = new T.BufferGeometry(); geoP.setAttribute('position', new T.BufferAttribute(pos, 3)); geoP.setAttribute('color', cattr);
    const cloud = new T.Points(geoP, pointsM(P.g6, .075, true)); cloud.renderOrder = 2; cloud.frustumCulled = false; sg.add(cloud);
    // superficie compartida por las dos funciones
    const geo = new T.PlaneGeometry(6.8, 6.8, 36, 36); geo.rotateX(-Math.PI / 2);
    const surf = new T.Mesh(geo, new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: .62, side: T.DoubleSide, depthWrite: false }));
    const wire = new T.Mesh(geo, new T.MeshBasicMaterial({ color: P.g5, wireframe: true, transparent: true, opacity: .4, depthWrite: false }));
    const surfG = new T.Group(); surfG.add(surf, wire); sg.add(surfG);
    // puntos que descienden por el gradiente (sin trayectoria)
    const NB = 130, dm = new T.Object3D(), e = .01;
    const bm = new T.InstancedMesh(new T.SphereGeometry(.065, 10, 8), new T.MeshLambertMaterial({ color: P.ink }), NB); bm.frustumCulled = false;
    const balls = Array.from({ length: NB }, () => ({ x: 0, z: 0, age: 0, life: 0 }));
    const spawn = (b) => { const a = R() * TAU, r = Math.sqrt(R()) * 3.3; b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.age = 0; b.life = 3 + R() * 3; };
    balls.forEach(spawn);
    const ballsG = new T.Group(); ballsG.add(bm); sg.add(ballsG);
    const fCloud = fadeKit(cloud), fSurf = fadeKit(surfG), fBalls = fadeKit(ballsG);
    const gal = makeGalton(); scene.add(gal.rot);
    const sp = geo.attributes.position, up = new T.Color(P.g6), dn = new T.Color(P.sky), PER = 18;
    const W = { cloud: 1, morph: 0, desc: 0, gal: 0 }; let FW = 0, ft = 0, gt = 0;
    return (t, dt, m, S) => {
      const k = (r) => 1 - Math.exp(-dt * r), step = S.step;
      cam.userData.dy += ([-.046, .102, 0][step] - cam.userData.dy) * k(3);   // centra el contenido de cada paso en el escenario
      W.cloud += ((step === 0 ? 1 : 0) - W.cloud) * k(2.2);
      W.morph += ((step >= 1 ? 1 : 0) - W.morph) * k(1.3);
      W.desc += ((step === 1 ? 1 : 0) - W.desc) * k(2.2);
      W.gal += ((step === 2 ? 1 : 0) - W.gal) * k(1.7);
      // ciclo de ajuste de la función 1 (el ajuste solo es bueno al final del ciclo)
      if (step === 0) ft += dt; else if (W.cloud < .02) ft = 0;
      const tc = ft % PER, fw = smooth((tc - 1) / 9) * (1 - smooth((tc - PER + 1.6) / 1.4));
      FW += ((step === 0 ? fw : 1) - FW) * k(step === 0 ? 20 : 3);
      const u = smooth(W.morph), wGal = smooth(W.gal);
      const ys = (x, z) => lerp(lerp(bad(x, z, t), f1(x, z), FW), f2(x, z), u);
      fSurf(1 - wGal);
      if (wGal < .99) {
        for (let i = 0; i < sp.count; i++) sp.setY(i, ys(sp.getX(i), sp.getZ(i)));
        sp.needsUpdate = true; geo.computeVertexNormals();
      }
      // nube: fija; solo cambia el color según quede encima o debajo de la superficie
      fCloud(W.cloud);
      if (W.cloud > .02) {
        for (let i = 0; i < N; i++) { const c = py[i] > ys(px[i], pz[i]) ? up : dn; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        cattr.needsUpdate = true;
      }
      // descenso del gradiente rápido sobre la función 2, sin dejar rastro
      const vis = W.desc * smooth((W.morph - .8) / .2);
      fBalls(vis);
      if (vis > .004) {
        balls.forEach((b, i) => {
          b.age += dt;
          const gx = (f2(b.x + e, b.z) - f2(b.x - e, b.z)) / (2 * e), gz = (f2(b.x, b.z + e) - f2(b.x, b.z - e)) / (2 * e);
          b.x -= gx * dt * 1.6; b.z -= gz * dt * 1.6;
          if (b.age > b.life) spawn(b);
          dm.position.set(b.x, f2(b.x, b.z) + .13, b.z); dm.updateMatrix(); bm.setMatrixAt(i, dm.matrix);
        });
        bm.instanceMatrix.needsUpdate = true;
      } else if (W.desc < .01) balls.forEach(spawn);
      // tablero de Galton: aparece al final y arranca desde el principio
      if (W.gal > .02) gt += dt; else gt = 0;
      gal.update(gt, dt, m, wGal);
      cam.position.lerpVectors(camA, camB, wGal); cam.lookAt(0, 0, 0);
      sg.rotation.y = t * .16 + m.x * .4; sg.rotation.x = m.y * .1;
    };
  });

  // ===== MAESTRÍA · ARTÍCULO: cota de Fano — embudo de representación reducida =====
  add('fano', () => {
    const { scene } = base({ cam: [1.2, 2.4, 10], look: [.2, 0, 0], shift: .2, aspect: 1.7 });
    const g = new T.Group(); scene.add(g);
    const Rf = (x) => lerp(1.5, .38, smooth((x + 1.6) / 3.4));
    for (let x = -3.9; x <= 3.5; x += .74) {
      const p = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU; p.push(new T.Vector3(x, Rf(x) * Math.cos(a), Rf(x) * Math.sin(a))); }
      g.add(poly(p, P.g4, .7));
    }
    for (let k = 0; k < 8; k++) {
      const p = []; for (let x = -4.2; x <= 4.01; x += .2) { const a = k / 8 * TAU; p.push(new T.Vector3(x, Rf(x) * Math.cos(a), Rf(x) * Math.sin(a))); }
      g.add(poly(p, P.g3, .8));
    }
    const disc = new T.Mesh(new T.CircleGeometry(1.15, 40), new T.MeshBasicMaterial({ color: P.white, transparent: true, opacity: .5, side: T.DoubleSide, depthWrite: false }));
    disc.rotation.y = Math.PI / 2; disc.position.x = 1.9; g.add(disc);
    const rim = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; rim.push(new T.Vector3(1.9, 1.15 * Math.cos(a), 1.15 * Math.sin(a))); }
    g.add(poly(rim, P.ink, .9));
    const cls = [0, 1, 2].map((k) => {
      const a = k / 3 * TAU + 1, s = new T.Mesh(new T.SphereGeometry(.14, 14, 10), solid(P.ink));
      s.position.set(4.35, .45 * Math.cos(a), .45 * Math.sin(a)); g.add(s); return s;
    });
    const N = 260, pos = new Float32Array(N * 3), R = rng(9);
    const attr = new T.BufferAttribute(pos, 3); attr.setUsage(T.DynamicDrawUsage);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', attr);
    const pts = new T.Points(geo, pointsM(P.g6, .17)); pts.frustumCulled = false; g.add(pts);
    const pa = Array.from({ length: N }, () => ({ x: -4.2 + R() * 8.4, v: .6 + R() * .6, a: R() * TAU, r: Math.sqrt(R()) }));
    return (t, dt, m) => {
      pa.forEach((p, i) => {
        p.x += p.v * dt; p.a += dt * .4;
        if (p.x > 4.2) { p.x = -4.2; p.a = R() * TAU; p.r = Math.sqrt(R()); }
        const rr = Rf(p.x) * p.r;
        pos[i * 3] = p.x; pos[i * 3 + 1] = rr * Math.cos(p.a); pos[i * 3 + 2] = rr * Math.sin(p.a);
      });
      attr.needsUpdate = true;
      disc.material.opacity = .35 + .2 * Math.sin(t * 2.4);
      cls.forEach((s, k) => s.scale.setScalar(1 + .35 * Math.max(0, Math.sin(t * 3 + k * 2.1))));
      g.rotation.y = -.45 + m.x * .3; g.rotation.x = m.y * .15;
    };
  });

  // ===== PROYECTO · censura de video según el PDF =====
  // Se revisa 1 de cada n fotogramas (paso n = 3). En cada uno se buscan parches pequeños (umbral alto), medianos (umbral medio) y la imagen completa (umbral bajo)
  // con MobileNetV2; hay detección si coinciden las dos búsquedas locales o si pasa la global. Se enmarca lo detectado, se difumina con un filtro de medias, se bloquean
  // los n−1 fotogramas siguientes (heredan la decisión) y las detecciones cercanas se agrupan en una sola notificación.
  add('cnn', () => {
    const { scene } = base({ cam: [0, 0, 9.5], look: [0, 0, 0], aspect: 1.7 });
    const NFR = 15, STEP = 3, NCHK = 5, RW = 480, RH = 300, QW = 640, QH = 400, rdr = window.Viz.renderer, VIOL = (i) => i >= 3 && i <= 11;   // la pelea ocupa bloques completos de 3 fotogramas (4 al 12), así lo que se censura es realmente violento
    // ----- escena 3D de la que salen los fotogramas -----
    const fs2 = new T.Scene(), fc = new T.PerspectiveCamera(21, RW / RH, .1, 60); fc.position.set(0, 1.25, 8.4); fc.lookAt(0, 1.05, 0); fc.updateMatrixWorld(true); fc.updateProjectionMatrix();
    fs2.add(new T.AmbientLight(0xffffff, .85)); const sun = new T.DirectionalLight(0xffffff, .5); sun.position.set(-3, 6, 5); fs2.add(sun);
    const mat = (c) => new T.MeshLambertMaterial({ color: c }), scenery = [];
    const put = (m) => { fs2.add(m); scenery.push(m); return m; };
    // ----- escenario: plaza con edificio de arcos, torre con reloj, acera con baldosas, planteras, bancas, calle con paso peatonal, coches, pinos y árboles -----
    const road = put(new T.Mesh(new T.PlaneGeometry(80, 60), mat(0xffffff))); road.rotation.x = -Math.PI / 2; road.position.y = -.12;
    const box = (w, h, d, c, x, y, z) => { const m = put(new T.Mesh(new T.BoxGeometry(w, h, d), mat(c))); m.position.set(x, y, z); return m; };
    const cyl = (rt, rb, h, x, y, z, seg = 12) => { const m = put(new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), mat(0xffffff))); m.position.set(x, y, z); return m; };
    const ball = (r, x, y, z) => { const m = put(new T.Mesh(new T.SphereGeometry(r, 16, 12), mat(0xffffff))); m.position.set(x, y, z); return m; };
    box(80, .12, 3.6, 0xffffff, 0, -.06, 1.0);               // acera de primer plano
    box(80, .16, .12, 0xffffff, 0, -.06, -.86);              // bordillo
    box(80, .12, 2.4, 0xffffff, 0, -.06, -4.8);              // acera del otro lado
    box(80, .16, .12, 0xffffff, 0, -.06, -3.62);
    for (let x = -16; x <= 16; x += 1.6) box(.8, .012, .1, 0xffffff, x, -.113, -2.25);            // rayas de la carretera
    for (let x = -2.4; x <= 2.41; x += .6) box(.32, .012, 2.3, 0xffffff, x, -.113, -2.25);       // paso peatonal
    for (let zz = -.5; zz <= 2.6; zz += 1.55) box(26, .006, .012, 0xffffff, 0, .003, zz);        // baldosas de la acera (líneas a lo largo)
    for (let xx = -13; xx <= 13; xx += 1.6) box(.012, .006, 3.6, 0xffffff, xx, .003, 1.0);      // baldosas (líneas transversales)
    for (let bx = -10; bx <= 10; bx += 1.5) { cyl(.06, .07, .6, bx, .3, -.72); ball(.07, bx, .64, -.72); }   // bolardos
    // planteras con arbustos
    [-5.6, -3.4, 3.4, 5.6].forEach((x) => { box(1.0, .5, .5, 0xffffff, x, .25, -.5); [-.3, 0, .3].forEach((o, i) => ball(.26 - i % 2 * .04, x + o, .72 + i % 2 * .05, -.5)); });
    // bancas
    [-1.9, 1.9].forEach((x) => { box(1.3, .08, .42, 0xffffff, x, .5, -.2); box(1.3, .4, .06, 0xffffff, x, .8, -.4); [-.55, .55].forEach((o) => box(.08, .5, .38, 0xffffff, x + o, .25, -.2)); });
    // edificio principal con arcos, pilastras, balcones y cornisa con dentículos
    const wallZ = -6.2;
    box(46, 6.4, .8, 0xffffff, 0, 3.1, wallZ);
    box(46, .3, .9, 0xffffff, 0, .05, wallZ + .05);                                      // zócalo
    box(46, .12, 1.0, 0xffffff, 0, 3.28, wallZ + .12);                                   // moldura entre plantas
    box(46, .3, 1.15, 0xffffff, 0, 6.4, wallZ + .12);                                    // cornisa
    for (let dx = -22; dx <= 22; dx += .5) box(.2, .14, .1, 0xffffff, dx, 6.18, wallZ + .72);     // dentículos
    const archShape = (w, h) => { const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h); s.absarc(0, h, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0); return s; };
    for (let x = -12; x <= 12; x += 2) {
      const fr = new T.Mesh(new T.ShapeGeometry(archShape(1.78, 2.0), 32), mat(0xffffff)); fr.position.set(x, 0, wallZ + .405); put(fr);
      const dk = new T.Mesh(new T.ShapeGeometry(archShape(1.5, 1.9), 32), mat(0xffffff)); dk.position.set(x, 0, wallZ + .41); put(dk);
      box(.26, 3.05, .5, 0xffffff, x + 1, 1.52, wallZ + .4); box(.36, .14, .58, 0xffffff, x + 1, 3.05, wallZ + .4); box(.36, .12, .58, 0xffffff, x + 1, .06, wallZ + .4);   // pilastra con capitel y base
      box(.2, .2, .3, 0xffffff, x, 2.62, wallZ + .5);                                                                                           // clave del arco
      // ventana de la planta alta con arco, marco y balcón
      const wf = new T.Mesh(new T.ShapeGeometry(archShape(.86, 1.0), 24), mat(0xffffff)); wf.position.set(x, 3.7, wallZ + .42); put(wf);
      box(1.1, .1, .5, 0xffffff, x, 3.58, wallZ + .6); for (let rr = -.45; rr <= .451; rr += .15) box(.03, .32, .03, 0xffffff, x + rr, 3.78, wallZ + .8); box(1.1, .04, .04, 0xffffff, x, 3.95, wallZ + .8);
      // segunda ventana más pequeña en el ático
      box(.5, .6, .05, 0xffffff, x, 5.2, wallZ + .42); box(.62, .06, .08, 0xffffff, x, 4.88, wallZ + .45);
    }
    // torre con reloj
    box(2.6, 3.4, 2.0, 0xffffff, 0, 8.0, wallZ - .3); box(3.0, .24, 2.4, 0xffffff, 0, 9.8, wallZ - .3);
    { const cl = cyl(.7, .7, .1, 0, 8.4, wallZ + .75, 36); cl.rotation.x = Math.PI / 2;
      const hand = (len, ang) => { const h = new T.Mesh(new T.BoxGeometry(.06, len, .04), mat(0xffffff)); h.position.set(Math.sin(ang) * len / 2, 8.4 + Math.cos(ang) * len / 2, wallZ + .82); h.rotation.z = -ang; put(h); }; hand(.45, 0.6); hand(.32, 2.4);
      const roof = put(new T.Mesh(new T.ConeGeometry(1.9, 1.7, 4), mat(0xffffff))); roof.rotation.y = Math.PI / 4; roof.position.set(0, 10.8, wallZ - .3); }
    // horizonte: edificios lejanos
    [[-17, 7.5, 3.2], [-12.5, 9, 3.6], [11, 8, 3.4], [15.5, 10, 3.8], [-22, 8.6, 3], [22, 7.2, 3.4]].forEach(([x, h, w], i) => {
      box(w, h, 2.6, 0xffffff, x, h / 2, wallZ - 3.2 - (i % 2) * 1.2);
      for (let rw = 1; rw < h - .5; rw += 1.1) for (let cl = -1; cl <= 1; cl++) box(.4, .55, .05, 0xffffff, x + cl * (w * .28), rw + .4, wallZ - 3.2 - (i % 2) * 1.2 + 1.33);
    });
    // vegetación de la acera lejana: pinos, árboles redondos y setos
    const pine = (x, z, s) => {
      const g = new T.Group(), tr = new T.Mesh(new T.CylinderGeometry(.09 * s, .12 * s, .7 * s, 10), mat(0xffffff)); tr.position.y = .35 * s; g.add(tr);
      [[1, 1.2, .9], [.78, 1.1, 1.5], [.55, 1.0, 2.05], [.32, .8, 2.5]].forEach(([r, h, y]) => { const c = new T.Mesh(new T.ConeGeometry(r * s, h * s, 12), mat(0xffffff)); c.position.y = y * s; g.add(c); });
      g.position.set(x, 0, z); put(g);
    };
    const round = (x, z, s) => {
      const g = new T.Group(), tr = new T.Mesh(new T.CylinderGeometry(.08 * s, .11 * s, 1.2 * s, 10), mat(0xffffff)); tr.position.y = .6 * s; g.add(tr);
      [[0, 1.75, 0, .62], [.34, 1.45, .1, .42], [-.34, 1.5, -.1, .45], [0, 2.15, .1, .4]].forEach(([a, b, e, r]) => { const m = new T.Mesh(new T.SphereGeometry(r * s, 16, 12), mat(0xffffff)); m.position.set(a * s, b * s, e * s); g.add(m); });
      g.position.set(x, 0, z); put(g);
    };
    for (let i = 0, x = -12; x <= 12.1; i++, x += 2.1) { const z = -4.3 - (i % 2) * 1.0, s = 1.05 + .2 * ((i * 7) % 3) / 2; (i % 3 === 1 ? round(x, z, s) : pine(x, z, s)); }
    for (let hx = -10; hx <= 10; hx += 2.4) { box(1.7, .5, .5, 0xffffff, hx, .25, -5.6); ball(.3, hx - .4, .6, -5.6); ball(.3, hx + .4, .6, -5.6); ball(.34, hx, .66, -5.6); }
    // farolas ornamentales
    [-5.4, -1.1, 1.1, 5.4, -9, 9].forEach((x) => {
      const lg = new T.Group(), part = (geo, px, py, pz) => { const m = new T.Mesh(geo, mat(0xffffff)); m.position.set(px, py, pz); lg.add(m); return m; };
      part(new T.CylinderGeometry(.1, .13, .3, 12), 0, .15, 0); part(new T.CylinderGeometry(.04, .06, 2.7, 10), 0, 1.5, 0); part(new T.BoxGeometry(.5, .04, .04), .22, 2.8, 0); part(new T.BoxGeometry(.2, .26, .2), .5, 2.7, 0); part(new T.ConeGeometry(.17, .16, 4), .5, 2.91, 0).rotation.y = Math.PI / 4;
      lg.position.set(x, 0, -3.95); put(lg);
    });
    // semáforo en la esquina
    { const tg = new T.Group(), part = (geo, px, py, pz) => { const m = new T.Mesh(geo, mat(0xffffff)); m.position.set(px, py, pz); tg.add(m); return m; };
      part(new T.CylinderGeometry(.05, .06, 2.6, 10), 0, 1.3, 0); part(new T.BoxGeometry(.28, .8, .22), 0, 2.5, 0); [.26, 0, -.26].forEach((o) => part(new T.SphereGeometry(.09, 12, 10), 0, 2.5 + o, .12)); tg.position.set(3.6, 0, -.7); put(tg); }
    // muñeco articulado: cadera, cintura (tronco), cuello, hombros, codos, rodillas y tobillos (con bolitas visibles en las articulaciones)
    const person = (color) => {
      const g = new T.Group(), m = mat(color), skin = mat(0xf0d9c4);
      const part = (geo, x, y, z, parent) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
      const joint = (r, parent, y = 0) => { const o = new T.Mesh(new T.SphereGeometry(r, 14, 10), m); o.position.y = y; parent.add(o); return o; };
      // extremidad de dos segmentos: p = hombro/cadera, p.el = codo/rodilla; al final mano o zapato
      const limb = (parent, len1, len2, w, x, y, end) => {
        const p = new T.Group(); p.position.set(x, y, 0); joint(w * .72, p);
        part(new T.BoxGeometry(w, len1, w), 0, -len1 / 2, 0, p);
        const el = new T.Group(); el.position.y = -len1; p.add(el); joint(w * .6, el);
        part(new T.BoxGeometry(w * .9, len2, w * .9), 0, -len2 / 2, 0, el);
        const tip = new T.Group(); tip.position.y = -len2; el.add(tip);
        if (end === 'hand') { joint(w * .5, tip); part(new T.BoxGeometry(w * 1.1, w * .95, w * 1.1), 0, -w * .5, 0, tip); part(new T.BoxGeometry(w * .42, w * .5, w * .42), w * .72, -w * .3, w * .28, tip); }
        else { joint(w * .5, tip); part(new T.BoxGeometry(w * 1.25, w * .55, w * 2.1), 0, -w * .2, w * .5, tip); }
        p.el = el; parent.add(p); return p;
      };
      // parte inferior: pelvis y piernas
      part(new T.BoxGeometry(.5, .16, .28), 0, .72, 0, g);
      g.legL = limb(g, .42, .4, .17, -.13, .72, 'shoe'); g.legR = limb(g, .42, .4, .17, .13, .72, 'shoe');
      // tronco: gira en la cintura (y = .76)
      const upper = new T.Group(); upper.position.y = .76; g.add(upper); g.upper = upper;
      part(new T.BoxGeometry(.54, .84, .3), 0, .39, 0, upper);                   // torso
      part(new T.BoxGeometry(.58, .09, .34), 0, 0, 0, upper);                    // cinturón
      part(new T.BoxGeometry(.5, .06, .26), 0, .8, 0, upper);                    // hombros
      g.armL = limb(upper, .36, .34, .14, -.36, .76, 'hand'); g.armR = limb(upper, .36, .34, .14, .36, .76, 'hand');
      // cuello y cabeza: la cabeza gira sobre el cuello
      const neck = new T.Group(); neck.position.y = .86; upper.add(neck); joint(.08, neck); part(new T.CylinderGeometry(.07, .08, .12, 12), 0, .05, 0, neck);
      const head = new T.Group(); head.position.y = .1; neck.add(head); g.head = head;
      const sk = new T.Mesh(new T.SphereGeometry(.23, 20, 14), skin); sk.position.y = .2; head.add(sk);
      part(new T.SphereGeometry(.245, 18, 10, 0, Math.PI * 2, 0, Math.PI * .5), 0, .22, -.01, head);   // pelo
      part(new T.BoxGeometry(.06, .08, .06), 0, .18, .23, head);                                         // nariz
      fs2.add(g); return g;
    };
    const A = person(0x14327a), B = person(0x7c8fb8); B.rotation.y = Math.PI;
    window.Viz.lineArt(fs2);   // todo blanco con trazos gris claro
    // coreografía: se acercan caminando, A golpea a B, B retrocede y se inclina, y ambos se separan. s = tiempo del video (0..1)
    let midX = 0; const footBox = new T.Box3(), footBox2 = new T.Box3();
    const poseAt = (s) => {
      let ax, bx, aa, ab, aL = -.15, bL = .1, la = 0, lb = 0, st;
      if (s < .2) { const w = s / .2; ax = lerp(-2.4, -.9, w); bx = lerp(2.3, .5, w); aa = .1 + .2 * Math.sin(s * 60); ab = .1 - .15 * Math.sin(s * 60); st = .4 * Math.sin(s * 60); }
      else if (s < .8) { const k = (s - .2) / .6; ax = -.9 + .1 * Math.sin(s * 28); bx = .5 + .32 * smooth(k * 1.6); aa = 1.3 + .4 * Math.sin(s * 50); ab = 1.0 + .2 * Math.sin(s * 35); aL = -.3; bL = .9; la = .22 + .05 * Math.sin(s * 50); lb = .12 + .3 * smooth(k); st = .12 * Math.sin(s * 40); }
      else { const w = (s - .8) / .2, q = Math.min(1, w * 4), q3 = Math.min(1, w * 3); ax = lerp(-.9, -2.2, w); bx = lerp(.82, 2.0, w); aa = lerp(1.3, .1, q); ab = lerp(1.0, .1, q); la = lerp(.22, 0, q); lb = lerp(.42, 0, q3); bL = lerp(.9, .1, q3); st = .35 * Math.sin(s * 60); }
      midX = (ax + bx) / 2; A.position.x = ax; B.position.x = bx; A.armR.rotation.z = aa; B.armR.rotation.z = ab; A.armL.rotation.z = aL; B.armL.rotation.z = bL;
      A.legL.rotation.z = st; A.legR.rotation.z = -st; B.legL.rotation.z = -st; B.legR.rotation.z = st;
      const fight = s >= .2 && s < .8, pu = .5 - .5 * Math.sin(s * 50), pu2 = .5 - .5 * Math.sin(s * 35);
      A.armR.el.rotation.z = fight ? .95 * pu : .18 + .12 * Math.sin(s * 60); A.armL.el.rotation.z = fight ? .5 : .15;
      B.armR.el.rotation.z = fight ? .6 + .5 * pu2 : .15; B.armL.el.rotation.z = fight ? 1.0 : .15;
      [A.legL, A.legR, B.legL, B.legR].forEach((l) => { l.el.rotation.z = -Math.abs(st) * 1.1 - .04; });
      A.upper.rotation.z = -la * 1.3; B.upper.rotation.z = lb * 1.3;                        // se inclinan por la cintura
      A.head.rotation.z = la * .5 + (fight ? .06 * Math.sin(s * 50) : 0); B.head.rotation.z = -lb * (fight ? 1.1 : .5) + (fight ? .1 * Math.sin(s * 50 + 1) : 0);   // B echa la cabeza hacia atrás al recibir el golpe
      [A, B].forEach((p) => { p.position.y = 0; p.updateMatrixWorld(true); footBox.setFromObject(p.legL).union(footBox2.setFromObject(p.legR)); p.position.y = -footBox.min.y; });   // apoya los pies en la acera
    };
    const render = (w, h, bg, override) => {
      const tgt = new T.WebGLRenderTarget(w, h, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat }), out = new Uint8Array(w * h * 4);
      const oc = new T.Color(), oa = rdr.getClearAlpha(), os = rdr.getScissorTest(), oAuto = rdr.autoClear; rdr.getClearColor(oc);
      rdr.setScissorTest(false); rdr.autoClear = true; rdr.setRenderTarget(tgt); rdr.setClearColor(bg, 1);
      if (override) { scenery.forEach((o) => { o.visible = false; }); fs2.overrideMaterial = new T.MeshBasicMaterial({ color: 0x000000 }); }
      rdr.render(fs2, fc); rdr.readRenderTargetPixels(tgt, 0, 0, w, h, out);
      if (override) { scenery.forEach((o) => { o.visible = true; }); fs2.overrideMaterial = null; }
      rdr.setRenderTarget(null); rdr.setClearColor(oc, oa); rdr.setScissorTest(os); rdr.autoClear = oAuto; tgt.dispose(); return out;
    };
    // objetivos de render a doble resolución con mipmaps y anisotropía: el trazo fino se ve nítido al reducirlo (supermuestreo en la GPU)
    const mkRT = (w, h, hq) => { const rt = new T.WebGLRenderTarget(w, h, { minFilter: hq ? T.LinearMipmapLinearFilter : T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, generateMipmaps: !!hq }); if (hq) rt.texture.anisotropy = Math.min(8, rdr.capabilities.getMaxAnisotropy()); return rt; };
    const rtBig = mkRT(QW, QH, true), rtSmall = mkRT(80, 50, false);
    // cámara de grabación en movimiento continuo: sigue a los personajes, los rodea con un vaivén, se acerca durante la pelea, tiembla un poco y se aleja al final
    const _p = new T.Vector3(), _l = new T.Vector3();
    const camPose = (s) => {
      const f = smooth(clamp((s - .15) / .1)) * (1 - smooth(clamp((s - .8) / .1)));       // 1 mientras dura la pelea
      const az = lerp(-.32, .38, smooth(s)) + .16 * Math.sin(s * 7.5) * (.4 + f);
      const R = lerp(8.8, 8.0, s) - 1.9 * f + .28 * Math.sin(s * 11);
      const h = 1.15 + .4 * f + .12 * Math.sin(s * 9 + 1) + .02 * Math.sin(s * 83) * f;     // temblor de cámara en mano
      const lx = midX * .75 + .03 * Math.sin(s * 71) * f, ly = 1.12 + .12 * f + .05 * Math.sin(s * 8);
      _p.set(lx + Math.sin(az) * R, h, Math.cos(az) * R); _l.set(lx, ly, 0);
      return { fov: 21 + 3 * f };
    };
    const setCam = (cam, s) => { const o = camPose(s); cam.position.copy(_p); cam.lookAt(_l); cam.fov = o.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); };
    // cámara de visualización: al inicio orbita la escena en 3D y luego se funde con la cámara de grabación
    const vc = new T.PerspectiveCamera(21, RW / RH, .1, 120), _t = new T.Vector3(), _tl = new T.Vector3();
    const viewCam = (tg, s) => {
      const e = smooth(tg / 3.6), az = (1 - e) * 1.15, R = lerp(13, 8.4, e), h = lerp(4.2, 1.25, e), o = camPose(s); _t.copy(_p); _tl.copy(_l);
      vc.position.set(Math.sin(az) * R, h, Math.cos(az) * R).lerp(_t, e); vc.lookAt(new T.Vector3(0, lerp(1.0, 1.05, e), 0).lerp(_tl, e)); vc.fov = lerp(36, o.fov, e); vc.updateProjectionMatrix(); vc.updateMatrixWorld(true);
    };
    const liveRender = (rt, cam) => {
      const oc = new T.Color(), oa = rdr.getClearAlpha(), os = rdr.getScissorTest(), oAuto = rdr.autoClear; rdr.getClearColor(oc);
      rdr.setScissorTest(false); rdr.autoClear = true; rdr.setRenderTarget(rt); rdr.setClearColor(0xffffff, 1); rdr.render(fs2, cam || fc);
      rdr.setRenderTarget(null); rdr.setClearColor(oc, oa); rdr.setScissorTest(os); rdr.autoClear = oAuto;
    };
    const dsScene = new T.Scene(), dsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), dsMat = new T.MeshBasicMaterial({ map: null }); dsScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), dsMat));
    const downsample = (tex, rt) => {
      const oc = new T.Color(), oa = rdr.getClearAlpha(), os = rdr.getScissorTest(), oAuto = rdr.autoClear; rdr.getClearColor(oc);
      dsMat.map = tex; dsMat.needsUpdate = true; rdr.setScissorTest(false); rdr.autoClear = true; rdr.setRenderTarget(rt); rdr.setClearColor(0xffffff, 1); rdr.render(dsScene, dsCam);
      rdr.setRenderTarget(null); rdr.setClearColor(oc, oa); rdr.setScissorTest(os); rdr.autoClear = oAuto;
    };
    // el desenfoque conserva las formas: se reduce a 80×50 y se realza el contraste, así los trazos promediados siguen viéndose
    const blurMat = (tex) => {
      const m = new T.ShaderMaterial({
        uniforms: { map: { value: tex }, k: { value: 2.6 }, bias: { value: 3.6 }, uFade: { value: 1 } }, transparent: true,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: 'uniform sampler2D map; uniform float k; uniform float bias; uniform float uFade; varying vec2 vUv; void main(){ float l = dot(texture2D(map, vUv).rgb, vec3(.333)); gl_FragColor = vec4(mix(vec3(.50, .03, .05), vec3(.93, .14, .14), smoothstep(.35, 1., l)), uFade); }',
      });
      Object.defineProperty(m, 'opacity', { get() { return this.uniforms.uFade.value; }, set(v) { this.uniforms.uFade.value = v; } });
      return m;
    };
    const liveN = new T.MeshBasicMaterial({ map: rtBig.texture, transparent: true }), liveC = blurMat(rtBig.texture);
    const texOf = (a, w, h) => { const t = new T.DataTexture(a, w, h, T.RGBAFormat); t.minFilter = t.magFilter = T.LinearFilter; t.needsUpdate = true; return t; };
    // ----- parches: local pequeño 6×4 (umbral alto), local mediano 3×2 (medio), global 1×1 (bajo) -----
    const SC = [{ nx: 6, ny: 4, thr: .8 }, { nx: 3, ny: 2, thr: .5 }, { nx: 1, ny: 1, thr: .3 }];
    const conf = (mask, u0, v0, u1, v1) => { let hit = 0; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const x = Math.floor((u0 + (i + .5) / 8 * (u1 - u0)) * (RW - 1)), y = Math.floor((v0 + (j + .5) / 8 * (v1 - v0)) * (RH - 1)); if (mask[(y * RW + x) * 4] < 128) hit++; } return hit / 64; };
    // captura de un fotograma directamente en la GPU: queda como textura de render, sin lectura de píxeles
    const shotGPU = (w, h) => {
      const rt = mkRT(w, h, w > 100); liveRender(rt, fc); return rt.texture;
    };
    const frames = Array.from({ length: NFR }, (_, i) => {
      poseAt(i / (NFR - 1)); setCam(fc, i / (NFR - 1));
      const full = shotGPU(QW, QH), blur = (() => { const rt = mkRT(80, 50, false); downsample(full, rt); return rt.texture; })(), mask = render(RW, RH, 0xffffff, true);   // mask: solo para medir la confianza de los parches
      let x0 = RW, x1 = 0, y0 = RH, y1 = 0;
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) if (mask[(y * RW + x) * 4] < 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const sc = SC.map((s) => {
        const cells = [];
        for (let y = 0; y < s.ny; y++) for (let x = 0; x < s.nx; x++) {
          const h = conf(mask, x / s.nx, 1 - (y + 1) / s.ny, (x + 1) / s.nx, 1 - y / s.ny), c = VIOL(i) ? h / (s.nx === 1 ? .12 : .2) : h * .5 + .04 * ((x * 7 + y * 3 + i) % 3);   // sin violencia la CNN da confianzas bajas aunque haya personas
          cells.push({ c: Math.min(1, c) });
        }
        return { cells, max: Math.max(...cells.map((c) => c.c)), thr: s.thr };
      });
      const detected = (sc[0].max >= sc[0].thr && sc[1].max >= sc[1].thr) || sc[2].max >= sc[2].thr;
      // caja ajustada a los personajes en coordenadas del fotograma (u,v con v hacia arriba, 0..1), con un pequeño margen
      const box = { u0: Math.max(0, x0 / RW - .03), u1: Math.min(1, x1 / RW + .03), v0: Math.max(0, y0 / RH - .04), v1: Math.min(1, y1 / RH + .04) };
      return { mN: new T.MeshBasicMaterial({ map: full, transparent: true }), mC: blurMat(full), sc, detected, box };
    });
    // ----- disposición: tira de video arriba, análisis del fotograma en el centro, línea de avisos abajo -----
    const SW = .62, SH = .39, SS = .68, SX = (i) => -4.76 + i * SS, SY = 2.3, DW = 3.8, DH = 2.375, DX = -2.9, DY = -.95;
    const rectLoop = (c) => { const l = new T.LineLoop(new T.BufferGeometry().setFromPoints([new T.Vector3(-.5, -.5, 0), new T.Vector3(.5, -.5, 0), new T.Vector3(.5, .5, 0), new T.Vector3(-.5, .5, 0)]), new T.LineBasicMaterial({ color: c, transparent: true, opacity: 0 })); l.renderOrder = 8; l.frustumCulled = false; return l; };
    const mkBox = (parent, w, h, c) => { const a = rectLoop(c), b = rectLoop(c); b.userData.inset = 1; parent.add(a, b); return { a, b, w, h }; };
    const setBox = (bx, bb, k, op) => {
      const cu = (bb.u0 + bb.u1) / 2 - .5, cv = (bb.v0 + bb.v1) / 2 - .5, w = (bb.u1 - bb.u0) * bx.w * k, h = (bb.v1 - bb.v0) * bx.h * k;
      [bx.a, bx.b].forEach((l, i) => { const e = i ? Math.min(.045, w * .1) : 0; l.position.set(cu * bx.w, cv * bx.h, .03); l.scale.set(Math.max(.0001, w - e * 2), Math.max(.0001, h - e * 2), 1); l.material.opacity = op; });
    };
    const frameEdge = (w, h) => new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(w, h)), new T.LineBasicMaterial({ color: P.g4, transparent: true, opacity: 1 }));
    const stripEdges = [];
    const strip = frames.map((f, i) => {
      const m = new T.Mesh(new T.PlaneGeometry(SW, SH), f.mN); m.position.set(SX(i), SY, 0); m.renderOrder = 4; const e = frameEdge(SW, SH); m.add(e); stripEdges.push(e.material);
      scene.add(m); return { m, box: mkBox(m, SW, SH, 0x0f2a5e) };
    });
    const detail = new T.Mesh(new T.PlaneGeometry(DW, DH), frames[0].mN); detail.position.set(DX, DY, .01); detail.renderOrder = 4; scene.add(detail);
    const dEdge = frameEdge(DW, DH); detail.add(dEdge);
    // aviso de escena no apta que baja sobre la pantalla cuando el video se reproduce censurado
    const rec = new T.Mesh(new T.CircleGeometry(.07, 16), new T.MeshBasicMaterial({ color: P.ink, transparent: true })); rec.position.set(-DW / 2 + .2, DH / 2 - .2, .07); detail.add(rec);   // indicador de grabación
    const notice = block(DW * .62, .16, .02, P.ink, P.ink, .9); notice.position.set(0, DH / 2 - .17, .06); notice.scale.set(.0001, 1, 1); detail.add(notice);
    const dBox = mkBox(detail, DW, DH, 0x0f2a5e);
    const lens = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(SW + .12, SH + .12)), new T.LineBasicMaterial({ color: P.ink, transparent: true, opacity: 1 })); lens.renderOrder = 9; scene.add(lens);
    const pat = SC.map((s, k) => {
      const n = s.nx * s.ny, cw = DW / s.nx, ch = DH / s.ny, mesh = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), n);
      mesh.frustumCulled = false; mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3); mesh.renderOrder = 5; detail.add(mesh);
      const e = [];
      for (let y = 0; y < s.ny; y++) for (let x = 0; x < s.nx; x++) { const x0 = -DW / 2 + x * cw, x1 = x0 + cw, y1 = DH / 2 - y * ch, y0 = y1 - ch; e.push(x0, y0, 0, x1, y0, 0, x1, y0, 0, x1, y1, 0, x1, y1, 0, x0, y1, 0, x0, y1, 0, x0, y0, 0); }
      const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(new Float32Array(e), 3));
      const el = new T.LineSegments(eg, new T.LineBasicMaterial({ color: [P.sky, P.g5, P.ink][k], transparent: true, opacity: 0 })); el.position.z = .03; el.renderOrder = 5; detail.add(el);
      return { mesh, el, n, s, cw, ch };
    });
    // barras de activación por escala, con la raya de su umbral, y veredicto
    const BX = [1.15, 1.75, 2.35], BY = -2.15, BH = 2.0;
    const bars = SC.map((s, k) => {
      const b = block(.3, 1, .3, P.sky, P.g6, .85); b.position.x = BX[k]; scene.add(b);
      const t = new T.Mesh(new T.PlaneGeometry(.55, .035), new T.MeshBasicMaterial({ color: P.ink, transparent: true })); t.position.set(BX[k], BY + s.thr * BH, .2); scene.add(t); b.thrM = t;
      const base = new T.Mesh(new T.PlaneGeometry(.55, .02), new T.MeshBasicMaterial({ color: P.g4, transparent: true })); base.position.set(BX[k], BY, .1); scene.add(base); b.baseM = base;
      return b;
    });
    // dictamen con símbolos: tache = violencia detectada, paloma = sin violencia
    const symbol = (kind) => {
      const g = new T.Group(), col = kind === 'x' ? P.ink : P.g5, bar = (w, h, x, y, rot) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: col })); m.position.set(x, y, 0); m.rotation.z = rot; g.add(m); };
      const ring = new T.Mesh(new T.RingGeometry(.62, .67, 56), new T.MeshBasicMaterial({ color: col })); g.add(ring);
      if (kind === 'x') { bar(.78, .15, 0, 0, Math.PI / 4); bar(.78, .15, 0, 0, -Math.PI / 4); }
      else { bar(.3, .15, -.2, -.08, -Math.PI / 4); bar(.66, .15, .12, .04, Math.PI / 4); }
      g.position.set(3.95, DY, .3); g.scale.setScalar(.0001); scene.add(g); return g;
    };
    const symYes = symbol('x'), symNo = symbol('v');
    // línea de avisos: una marca por detección que luego se funde en una sola notificación
    const TLY = 1.68, tl = new T.Mesh(new T.PlaneGeometry(NFR * SS - .1, .02), new T.MeshBasicMaterial({ color: P.g4, transparent: true })); tl.position.set(SX((NFR - 1) / 2), TLY, 0); scene.add(tl);
    const chk = [0, 3, 6, 9, 12].map((i) => { const b = new T.Mesh(new T.CircleGeometry(.06, 12), new T.MeshBasicMaterial({ color: P.g6, transparent: true })); b.position.set(SX(i), TLY, .05); scene.add(b); return b; });
    // pulso de activación que viaja del fotograma por la red hasta las barras
    const pulse = new T.Mesh(new T.SphereGeometry(.11, 14, 10), new T.MeshBasicMaterial({ color: P.ink, transparent: true })); scene.add(pulse);
    const ticks = [3, 6, 9].map((i) => { const b = block(.16, .26, .1, P.g6, P.ink, .9); b.position.set(SX(i), TLY, 0); b.scale.setScalar(.0001); scene.add(b); return b; });
    const cluster = block(1, .2, .12, P.ink, P.ink, .9); cluster.position.set(0, TLY, 0); scene.add(cluster);
    const cA = new T.Color(P.sky), cB = new T.Color(P.ink), tmp = new T.Color(), dmat = new T.Object3D();
    let lastK = -1;
    // línea de tiempo (unidades de la animación): 1) video en vivo, 2) captura de fotogramas, 3) análisis, 4) video censurado
    const CYC = 40, TSH = 6, TCAP = 6.6, CGAP = .17, TA = 9.9, ASP = 1.5, T0 = .9, TK = 4.2, TE = TA + (T0 + NCHK * TK + 1.5) / ASP, TP = TE + .4, TV = 9, BIG = 7.4 / DW;
    const setPatches = (idx) => { pat.forEach((p, j) => { frames[idx].sc[j].cells.forEach((c, i) => p.mesh.setColorAt(i, tmp.setHex(0xffffff).lerp(cB, c.c))); p.mesh.instanceColor.needsUpdate = true; }); };
    // caja de cada fotograma bloqueado (los siguientes al violento heredan la del fotograma revisado)
    const boxOf = (i) => (VIOL(i) ? frames[i].box : (i >= 3 && i <= 11 ? frames[Math.floor(i / STEP) * STEP].box : null));
    const lb = (p, q, k) => ({ u0: lerp(p.u0, q.u0, k), u1: lerp(p.u1, q.u1, k), v0: lerp(p.v0, q.v0, k), v1: lerp(p.v1, q.v1, k) });
    return (t) => {
      const tg = t % CYC, gAll = smooth(tg / .6) * (1 - smooth((tg - CYC + 1.4) / 1.2));
      const tc = Math.max(0, (tg - TA) * ASP), inA = tg >= TA && tg < TE + .2;
      const ga = gAll * smooth((tg - TA + .3) / .5) * (1 - smooth((tg - TE) / .4));
      const inP4 = tg >= TP, tauV = inP4 ? clamp((tg - TP - 1.1) / TV) : (tg / TSH) % 1;
      // 1-2) la pantalla se mueve: grande al principio y al final, pequeña mientras se capturan y analizan los fotogramas
      const kBig = inP4 ? smooth((tg - TP) / 1.1) : 1 - smooth((tg - TSH) / 1);
      const scr = lerp(1, BIG, kBig), sx = lerp(DX, 0, kBig), sy = lerp(DY, -.4, kBig);
      detail.position.set(sx, sy, .01); detail.scale.setScalar(scr);
      // pantalla en vivo (la escena 3D animada) fuera del análisis; fotograma fijo durante el análisis
      const live = !inA;
      if (live) { poseAt(tauV); setCam(fc, tauV); const cam = tg < 3.8 && !inP4 ? (viewCam(tg, tauV), vc) : fc; liveRender(rtBig, cam); }
      const fi = tauV * (NFR - 1), censorTau = inP4 && tauV > 3 / 14 - .015 && tauV < 12 / 14 - .005;
      // (la censura en rojo se calcula en el shader de liveC sobre rtBig)
      liveN.opacity = liveC.opacity = gAll; rec.visible = live && (inP4 ? tauV > 0 : tg > 3.4); rec.material.opacity = gAll * (.35 + .65 * (Math.sin(t * 7) > 0 ? 1 : 0));
      // frames estáticos y bordes
      const stripAlpha = inP4 ? lerp(1, .18, smooth((tg - TP) / .8)) : 1;
      frames.forEach((fr) => { fr.mN.opacity = fr.mC.opacity = gAll * stripAlpha; }); stripEdges.forEach((m) => { m.opacity = gAll * stripAlpha; }); dEdge.material.opacity = gAll * .9;
      const k = clamp(Math.floor((tc - T0) / TK), 0, NCHK - 1), u = tc - T0 - k * TK, idx = k * STEP, F = frames[idx];
      if (k !== lastK) { lastK = k; setPatches(idx); }
      // 2) captura: cada fotograma sale de la pantalla y vuela a su lugar de la tira
      strip.forEach((s, i) => {
        const ci = easeOut((tg - (TCAP + i * CGAP)) / .55), kk = Math.floor(i / STEP), fk = frames[kk * STEP], when = T0 + kk * TK + 3.5 + (i % STEP) * .22, applied = fk.detected && tc > when;
        s.m.visible = ci > 0;
        s.m.position.set(lerp(DX, SX(i), ci), lerp(DY, SY, ci), 0); s.m.scale.setScalar(lerp(DW / SW, 1, ci));
        s.m.material = applied ? frames[i].mC : frames[i].mN;
        const bb = VIOL(i) ? frames[i].box : fk.box, kb = easeOut((tc - when) / .45);
        setBox(s.box, bb, fk.detected ? kb : 0, fk.detected && tc > when ? gAll * stripAlpha : 0);
      });
      lens.position.set(SX(idx), SY, .05); lens.material.opacity = ga * (tc > T0 - .3 ? 1 : 0); lens.scale.setScalar(1 + .05 * Math.sin(t * 6));
      // 3) material de la pantalla: en vivo (nítido o desenfocado) o el fotograma analizado
      let bx = null, notEnd = 0;
      if (live) {
        const cen = censorTau;
        detail.material = cen ? liveC : liveN;
        if (cen) { const i0 = Math.min(NFR - 1, Math.floor(fi)), i1 = Math.min(NFR - 1, i0 + 1), b0 = boxOf(i0), b1 = boxOf(i1); bx = b0 && b1 ? lb(b0, b1, fi - i0) : b0; notEnd = smooth((tauV - (3 / 14 - .06)) / .05) * (1 - smooth((tauV - (12 / 14 - .04)) / .04)); }
      } else { detail.material = F.detected && u > 3.9 ? F.mC : F.mN; }
      notice.scale.set(Math.max(.0001, notEnd), 1, 1); notice.visible = notEnd > .01;
      // parches: local pequeño, local mediano y global
      pat.forEach((p, j) => {
        const a2 = .35 + j * .45, rv = smooth((u - a2) / .45), vis = (inA && u > a2 ? 1 : 0) * (1 - smooth((u - 1.85) / .35)) * ga;
        p.mesh.material.opacity = .5 * vis; p.el.material.opacity = .9 * vis;
        for (let i = 0; i < p.n; i++) { const cx = i % p.s.nx, cy = Math.floor(i / p.s.nx), rr = clamp(rv * 1.4 - (i / p.n) * .4); dmat.position.set(-DW / 2 + (cx + .5) * p.cw, DH / 2 - (cy + .5) * p.ch, .015); dmat.scale.set(p.cw * Math.max(rr, .0001), p.ch * Math.max(rr, .0001), 1); dmat.updateMatrix(); p.mesh.setMatrixAt(i, dmat.matrix); }
        p.mesh.instanceMatrix.needsUpdate = true;
      });
      // recuadro sobre el fotograma analizado (análisis) o sobre el video en vivo (censura)
      if (inA) setBox(dBox, F.box, F.detected ? easeOut((u - 3.5) / .45) : 0, F.detected && u > 3.5 ? ga : 0);
      else setBox(dBox, F.box, 0, 0);   // el video censurado final va sin recuadro de localización
      // el pulso sale del fotograma y llega a las barras
      const pp = clamp((u - 1.95) / .9), px2 = lerp(DX + DW / 2 + .05, BX[0] - .4, easeOut(pp));
      pulse.position.set(px2, DY, .2); pulse.visible = inA && pp > 0 && pp < 1; pulse.material.opacity = ga; pulse.scale.setScalar(1 + .25 * Math.sin(pp * Math.PI));
      chk.forEach((cc) => { cc.material.opacity = ga; cc.visible = ga > .01; }); tl.visible = lens.visible = ga > .01;
      bars.forEach((b, j) => {
        const v = F.sc[j].max, h = Math.max(.001, v * BH * smooth((u - 2.85) / .4) * ga), on = v >= F.sc[j].thr;
        b.scale.y = h; b.position.y = BY + h / 2; b.body.material.color.copy(cA).lerp(cB, on ? smooth((u - 3.2) / .25) : 0); b.thrM.material.opacity = ga; b.baseM.material.opacity = ga; b.visible = b.thrM.visible = b.baseM.visible = ga > .01;
      });
      const vs = smooth((u - 3.25) / .3) * ga;
      symYes.visible = F.detected && vs > .01; symNo.visible = !F.detected && vs > .01;
      symYes.scale.setScalar(Math.max(.0001, vs * (1 + .05 * Math.sin(t * 5)))); symNo.scale.setScalar(Math.max(.0001, vs));
      // avisos: una marca por detección; las cercanas se agrupan en una sola notificación
      ticks.forEach((b, i) => { const born = easeOut((tc - (T0 + (i + 1) * TK + 3.7)) / .4) * (1 - smooth((tc - (T0 + NCHK * TK + .6)) / .5)); b.scale.setScalar(Math.max(.0001, born * ga)); });
      const cs = smooth((tc - (T0 + NCHK * TK + .5)) / .9) * ga, x0 = SX(3) - SW / 2, x1 = SX(11) + SW / 2;
      cluster.visible = cs > .01; cluster.scale.set(Math.max(.001, (x1 - x0) * cs), 1, 1); cluster.position.x = x0 + (x1 - x0) * cs / 2; tl.material.opacity = ga;
    };
  });
  // ===== MAESTRÍA · PROYECTO: paralelización en el clúster LAVIS (UNAM) =====
  add('hpc', () => {
    const { scene } = base({ cam: [0, 0, 10.2], aspect: 1.6 });
    const head = block(1.1, 1.6, .8, P.g6, P.ink, .9); head.position.set(-3.4, 0, 0); scene.add(head);
    const lb = label('LAVIS'); lb.position.set(-3.4, -1.45, 0); scene.add(lb);
    const workers = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      const w = block(.8, .9, .5, P.white, P.g5, .8); w.position.set(-.5 + i * 1.3, (1 - j) * 1.5, 0); scene.add(w);
      w.busy = 0; workers.push(w);
      scene.add(poly([head.position.clone().add(new T.Vector3(.55, 0, 0)), w.position.clone().add(new T.Vector3(-.4, 0, 0))], P.g3, .8));
    }
    const pk = Array.from({ length: 12 }, () => { const b = block(.2, .2, .2, P.ink, P.ink, .5); b.visible = false; b.age = 99; b.w = 0; scene.add(b); return b; });
    let acc = 0, n = 0;
    const TRAVEL = .7;
    return (t, dt) => {
      acc += dt;
      while (acc > .22) {
        acc -= .22;
        const p = pk.find((x) => !x.visible);
        if (p) { p.visible = true; p.age = 0; p.w = workers[n++ % 12]; }
      }
      pk.forEach((p) => {
        if (!p.visible) return;
        p.age += dt;
        const u = p.age / TRAVEL;
        if (u >= 1) { p.visible = false; p.w.busy = 1.4; return; }
        const a = new T.Vector3(-2.7, 0, 0), b = p.w.position;
        p.position.lerpVectors(a, b, u); p.position.z = Math.sin(u * Math.PI) * .5;
      });
      workers.forEach((w) => {
        w.busy = Math.max(0, w.busy - dt);
        const k = clamp(w.busy / 1.4);
        window.Viz.tint(w.body.material, P.white, P.g6, k);
        w.scale.setScalar(1 + .08 * k);
      });
    };
  });
})();
