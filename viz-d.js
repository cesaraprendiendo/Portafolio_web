// Escenas rehechas: EEG → imagen 2D → filtros CNN, bosque con dron, conjuntos de Julia y árbol de decisión
(() => {
  if (!window.Viz) return;
  const { T, P, TAU, add, base, clamp, lerp, smooth, easeOut, rng, solid, lineM, block, poly, dyn, label } = window.Viz;
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  // ===== TESIS · un canal de EEG → imagen 2D → filtros CNN → promedio → apilado → clasificación con perceptrón =====
  add('eeg', () => {
    const { scene, cam } = base({ cam: [0, 5.2, 8.6], look: [0, 0, .2], aspect: 1.8 });
    const N1 = 256, NS = 16, NM = 14, NP = 7, PER = 30, TC = 3.5, SPD = 38, NIN = 24, NHID = 8, NOUT = 3;
    const f = (u, t) => .5 * Math.sin(u * 14 + t * 2.6) + .3 * Math.sin(u * 37 - t * 3.9) + .2 * Math.sin(u * 91 + t * 6.3);
    const vals = Array.from({ length: N1 }, (_, i) => (f(i / (N1 - 1), TC) + 1) / 2);
    const K = [[-1, 0, 1, -2, 0, 2, -1, 0, 1], [-1, -2, -1, 0, 0, 0, 1, 2, 1], [0, 1, 0, 1, -4, 1, 0, 1, 0]];
    const resp = K.map((k) => {
      const o = [];
      for (let y = 0; y < NM; y++) for (let x = 0; x < NM; x++) {
        let s = 0, q = 0;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) s += k[q++] * vals[(y + j) * NS + x + i];
        o.push(s);
      }
      const mn = Math.min(...o), mx = Math.max(...o);
      return o.map((v) => (v - mn) / (mx - mn || 1));
    });
    // promedio 2×2 de cada mapa (pooling) → 3 mapas de 7×7
    const pooled = resp.map((mp) => Array.from({ length: NP * NP }, (_, q) => {
      const br = Math.floor(q / NP), bc = q % NP; let s = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s += mp[(br * 2 + dy) * NM + bc * 2 + dx];
      return s / 4;
    }));
    // los 147 valores apilados se agrupan en 24 entradas del perceptrón
    const inVals = Array.from({ length: NIN }, (_, i) => {
      let s = 0, n = 0;
      for (let idx = 0; idx < 3 * NP * NP; idx++) if (Math.floor(idx * NIN / (3 * NP * NP)) === i) { s += pooled[Math.floor(idx / (NP * NP))][idx % (NP * NP)]; n++; }
      return s / Math.max(1, n);
    });
    const total = N1 + 3 * NM * NM;
    const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: 0xffffff }), total);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; scene.add(mesh);
    const dummy = new T.Object3D(), col = new T.Color(), c0 = new T.Color(0xe4e8ef), c1 = new T.Color(0x14327a), gray = new T.Color(0xdde1e8);
    const put = (idx, x, y, z, sx, sy, sz, v) => {
      dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix); mesh.setColorAt(idx, col.copy(c0).lerp(c1, clamp(v)));
    };
    const line = dyn(N1, P.g6, .8); scene.add(line.line);
    const kern = new T.Line(new T.BufferGeometry().setFromPoints([V3(-.255, 0, -.255), V3(.255, 0, -.255), V3(.255, 0, .255), V3(-.255, 0, .255), V3(-.255, 0, -.255)]), new T.LineBasicMaterial({ color: P.ink, transparent: true, opacity: 1 }));
    scene.add(kern);
    const IX = -3.9, MX = [-1.2, .75, 2.7], SX = -.9, SYL = [.1, .55, 1.0];
    // perceptrón: entradas, capa oculta y salidas (sobre el plano, vistos desde arriba)
    const NX = [.55, 2.35, 4.0], inP = Array.from({ length: NIN }, (_, i) => V3(NX[0], .8 + (i - (NIN - 1) / 2) * .115, 0));   // red de frente al usuario (plano XY)
    const hidP = Array.from({ length: NHID }, (_, j) => V3(NX[1], .8 + (j - (NHID - 1) / 2) * .36, 0)), outP = Array.from({ length: NOUT }, (_, k) => V3(NX[2], .8 + (k - (NOUT - 1) / 2) * .7, 0));
    const mkNode = (p, r) => { const m = new T.Mesh(new T.SphereGeometry(r, 14, 10), new T.MeshLambertMaterial({ color: 0xdde1e8 })); m.position.copy(p); m.scale.setScalar(.0001); scene.add(m); return m; };
    const inN = inP.map((p) => mkNode(p, .045)), hidN = hidP.map((p) => mkNode(p, .085)), outN = outP.map((p) => mkNode(p, .13));
    const segs1 = [], segs2 = [];
    inP.forEach((a) => hidP.forEach((b) => segs1.push(a, b))); hidP.forEach((a) => outP.forEach((b) => segs2.push(a, b)));
    const mkLines = (segs) => {
      const geo = new T.BufferGeometry().setFromPoints(segs); geo.setAttribute('color', new T.BufferAttribute(new Float32Array(segs.length * 3), 3));
      const l = new T.LineSegments(geo, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 })); l.frustumCulled = false; scene.add(l); return l;
    };
    const L1 = mkLines(segs1), L2 = mkLines(segs2);
    // pesos del perceptrón (cambian en cada ciclo, con ellos cambia la clase ganadora)
    let W1, W2, hid, out, win, cyc = -1;
    const net = (c) => {
      const R = rng(c * 13 + 5), g = () => Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(TAU * R());
      W1 = Array.from({ length: NIN }, () => Array.from({ length: NHID }, () => g() * 1.4));
      W2 = Array.from({ length: NHID }, () => Array.from({ length: NOUT }, () => g() * 1.6));
      hid = Array.from({ length: NHID }, (_, j) => Math.tanh(inVals.reduce((s, v, i) => s + (v - .5) * 2 * W1[i][j], 0)));
      const lg = Array.from({ length: NOUT }, (_, k) => hid.reduce((s, h, j) => s + h * W2[j][k], 0)), mx = Math.max(...lg), ex = lg.map((v) => Math.exp(v - mx)), sm = ex.reduce((a, b) => a + b, 0);
      out = ex.map((v) => v / sm); win = out.indexOf(Math.max(...out));
    };
    const tmpC = new T.Color(), cLine = new T.Color(0xdde1e8), cNavy = new T.Color(0x0f2a5e);
    const paintLines = (L, segs, strength, reveal) => {
      const ca = L.geometry.attributes.color, a = ca.array;
      for (let i = 0; i < segs.length / 2; i++) {
        const s = clamp(strength(i)); tmpC.copy(cLine).lerp(cNavy, s * reveal);
        a[i * 6] = a[i * 6 + 3] = tmpC.r; a[i * 6 + 1] = a[i * 6 + 4] = tmpC.g; a[i * 6 + 2] = a[i * 6 + 5] = tmpC.b;
      }
      ca.needsUpdate = true; L.material.opacity = .85 * clamp(reveal * 2);
    };
    return (t) => {
      const c = Math.floor(t / PER), tc = t % PER;
      if (c !== cyc) { cyc = c; net(c); }
      const g = Math.min(smooth(tc / .7), 1 - smooth((tc - PER + 1) / 1)), ts = Math.min(tc, TC);
      const d = smooth((tc - 11.6) / 1.6), e = smooth((tc - 13.6) / 1.6), fl = smooth((tc - 16.6) / 1.5);    // promedio, apilado, aplanado
      const imgOut = 1 - smooth((tc - 11.3) / .8);
      // 1) muestras: línea → imagen 2D
      for (let i = 0; i < N1; i++) {
        const u = i / (N1 - 1), fv = f(u, ts), lx = -4.4 + 8.8 * u, ly = fv * .9 + .4;
        const r = Math.floor(i / NS), cc = i % NS, gx = IX + (cc - 7.5) * .17, gz = (r - 7.5) * .17;
        const ee = smooth(clamp((tc - TC - u * 1.2) / .8)), h = lerp(.07, .03 + vals[i] * .34, ee);
        line.arr[i * 3] = lx; line.arr[i * 3 + 1] = ly; line.arr[i * 3 + 2] = 0;
        const s = lerp(.075, .155, ee) * g * imgOut;
        put(i, lerp(lx, gx, ee), lerp(ly, h / 2, ee) + Math.sin(ee * Math.PI) * .9, lerp(0, gz, ee), s, Math.max(.001, h * g * imgOut), s, ee < 1 ? (fv + 1) / 2 : vals[i]);
      }
      line.attr.needsUpdate = true; line.line.material.opacity = tc < TC ? .8 * g : Math.max(0, .8 * (1 - (tc - TC) * 1.4));
      // 2) convolución → 3) promedio → 4) apilado → 5) aplanado hacia las entradas del perceptrón
      const n = clamp(Math.floor((tc - 6) * SPD), -1, NM * NM - 1);
      for (let m = 0; m < 3; m++) for (let p = 0; p < NM * NM; p++) {
        const row = Math.floor(p / NM), cl = p % NM, v = resp[m][p], br = Math.floor(row / 2), bc = Math.floor(cl / 2), q = br * NP + bc, lead = row % 2 === 0 && cl % 2 === 0;
        const born = tc >= 6 ? easeOut((tc - 6 - p / SPD) / .3) : 0, pv = pooled[m][q];
        let x = MX[m] + (cl - 6.5) * .125, z = (row - 6.5) * .125, y = 0, sx = .11, hh = .02 + v * .34, cv = v;
        if (d > 0) {                                                  // promedio: cada bloque 2×2 se funde en una baldosa
          const cx = MX[m] + (bc - 3) * .25, cz = (br - 3) * .25;
          x = lerp(x, cx, d); z = lerp(z, cz, d);
          if (lead) { sx = lerp(.11, .235, d); hh = lerp(hh, .02 + pv * .34, d); cv = lerp(v, pv, d); } else { sx = lerp(.11, .0001, d); hh = lerp(hh, .001, d); }
        }
        if (e > 0) {                                                  // apilado: los tres mapas se montan en capas
          const cx = MX[m] + (bc - 3) * .25, cz = (br - 3) * .25;
          x = lerp(cx, SX + (bc - 3) * .25, e); z = lerp(cz, (br - 3) * .25 - .3, e); y = e * SYL[m]; hh = lerp(hh, .07, e);
        }
        let node = null;
        if (fl > 0 && lead) {                                         // aplanado: cada baldosa viaja a su entrada del perceptrón
          const idx = m * NP * NP + q, i = Math.floor(idx * NIN / (3 * NP * NP)), tgt = inP[i];
          const ff = smooth(clamp(fl * 1.4 - (idx / (3 * NP * NP)) * .4));
          x = lerp(x, tgt.x, ff); z = lerp(z, tgt.z, ff); y = lerp(y + hh / 2, tgt.y, ff) + Math.sin(ff * Math.PI) * .7; sx = lerp(sx, .05, ff); hh = lerp(hh, .05, ff); node = ff;
        }
        const k0 = tc >= 6 ? born * g : 0, yy = node !== null ? y : y + hh / 2;
        const vis = (lead || d < .999) ? 1 : 0, sc = fl > .999 ? 0 : 1;
        put(N1 + m * NM * NM + p, x, yy, z, sx * k0 * sc * vis, Math.max(.0005, hh * k0 * sc * vis), sx * k0 * sc * vis, cv);
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      kern.visible = tc >= 6 && tc < 11.4 && n >= 0;
      kern.position.set(IX + (n % NM - 6.5) * .17, .55, (Math.floor(n / NM) - 6.5) * .17);
      // 6) perceptrón: entradas → capa oculta → salidas, con pulso de activación y clase ganadora
      const sIn = smooth((tc - 17.7) / .6) * g, sL1 = smooth((tc - 18.4) / 1.4), sH = smooth((tc - 19.8) / .7) * g, sL2 = smooth((tc - 20.4) / 1.3), sO = smooth((tc - 21.8) / .7) * g, sWin = smooth((tc - 22.8) / 1.2);
      inN.forEach((nd, i) => { nd.scale.setScalar(Math.max(.0001, sIn)); nd.material.color.copy(c0).lerp(c1, clamp(inVals[i] * 1.2)); });
      hidN.forEach((nd, j) => { nd.scale.setScalar(Math.max(.0001, sH)); nd.material.color.copy(gray).lerp(cNavy, clamp(Math.abs(hid[j]) * sL1)); });
      outN.forEach((nd, k) => {
        const wn = k === win ? sWin : 0;
        nd.scale.setScalar(Math.max(.0001, sO * (1 + .9 * wn)));
        nd.material.color.copy(gray).lerp(cNavy, k === win ? sWin : clamp(out[k] * 1.2 * sL2) * .4);
      });
      paintLines(L1, segs1, (i) => Math.abs(((inVals[Math.floor(i / NHID)] - .5) * 2) * W1[Math.floor(i / NHID)][i % NHID]) / 1.2, sL1);
      paintLines(L2, segs2, (i) => Math.abs(hid[Math.floor(i / NOUT)] * W2[Math.floor(i / NOUT)][i % NOUT]) / 1.4, sL2);
      L1.material.opacity *= g; L2.material.opacity *= g;
      // cámara: zoom al apilamiento mientras se apila y se sostiene un momento; luego pasa al perceptrón
      const zs = smooth((tc - 12.8) / 1.8), zn = smooth((tc - 16.4) / 1.6), zo = 1 - smooth((tc - PER + 1.4) / 1.2);
      const px = lerp(lerp(0, -.9, zs), 2.3, zn), py = lerp(lerp(5.2, 3.1, zs), 1.0, zn), pz = lerp(lerp(8.6, 3.7, zs), 6.4, zn);
      const lx = lerp(lerp(0, -.9, zs), 2.3, zn), ly = lerp(lerp(0, .45, zs), .8, zn), lz = lerp(lerp(.2, -.3, zs), 0, zn);
      cam.position.set(lerp(0, px, zo), lerp(5.2, py, zo), lerp(8.6, pz, zo)); cam.lookAt(lerp(0, lx, zo), lerp(0, ly, zo), lerp(.2, lz, zo));
    };
  });

  // ===== PROYECTO · detección de objetos: búsqueda multiescala con CNN → rejilla → confianza conjunta → umbral → DBSCAN → valores extremos → margen → bounding box =====
  add('detect', () => {
    const { scene, cam } = base({ fov: 38, cam: [0, -1, 8.2], look: [0, 0, 0], aspect: 1.55 });
    const IW = 6.4, IH = 4, PER = 32;
    // "imagen": una captura de un bosque 3D de árboles dispersos (construido con Three.js y renderizado una vez a píxeles).
    // Un segundo render en máscara (árboles negros sobre blanco) da la verdad del terreno para evaluar la confianza de cada parche.
    const RW = 960, RH = 600, PPU = RW / IW, rdr = window.Viz.renderer;
    const snap = (() => {
      const fs2 = new T.Scene(), fc = new T.PerspectiveCamera(40, IW / IH, .1, 80); fc.position.set(0, 2.1, 9.5); fc.lookAt(0, 1.7, 0);   // vista casi de frente
      fc.updateMatrixWorld(true); fc.updateProjectionMatrix();
      fs2.add(new T.AmbientLight(0xffffff, .8)); const sun = new T.DirectionalLight(0xffffff, .55); sun.position.set(-4, 8, 3); fs2.add(sun);
      const ground = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshLambertMaterial({ color: 0xe6ebf3 })); ground.rotation.x = -Math.PI / 2; fs2.add(ground);
      const others = [ground], mat = (c) => new T.MeshLambertMaterial({ color: c }), add2 = (o) => { fs2.add(o); others.push(o); return o; };
      const road = new T.Mesh(new T.PlaneGeometry(60, 2.4), mat(0xaeb7c8)); road.rotation.x = -Math.PI / 2; road.position.set(0, .01, 3.9); add2(road);
      for (let x = -13; x <= 13; x += 2.4) { const dash = new T.Mesh(new T.BoxGeometry(1.2, .02, .12), mat(0xffffff)); dash.position.set(x, .03, 3.9); add2(dash); }
      [[-5.2, -7, 2.6, 1.8, 2, 0xcfd6e3, 0x8793ad], [-1.4, -9, 3.1, 2.5, 2.2, 0xdde2ec, 0x6f7b99], [4.4, -7.5, 2.8, 2, 2, 0xd3dae6, 0x8793ad]].forEach(([x, z, w, h, dd, wc, rc]) => {
        const hg = new T.Group(), body = new T.Mesh(new T.BoxGeometry(w, h, dd), mat(wc)); body.position.y = h / 2; hg.add(body);
        const roof = new T.Mesh(new T.ConeGeometry(Math.max(w, dd) * .78, .95, 4), mat(rc)); roof.rotation.y = Math.PI / 4; roof.position.y = h + .47; hg.add(roof);
        for (let rw = 0; rw < 2; rw++) for (let cl = 0; cl < 3; cl++) { const wi = new T.Mesh(new T.BoxGeometry(.34, .34, .03), mat(0xeef2fa)); wi.position.set((cl - 1) * w * .28, h * (.45 + rw * .3), dd / 2 + .02); hg.add(wi); const sill = new T.Mesh(new T.BoxGeometry(.44, .05, .06), mat(0xffffff)); sill.position.set((cl - 1) * w * .28, h * (.45 + rw * .3) - .22, dd / 2 + .04); hg.add(sill); }
        const chim = new T.Mesh(new T.BoxGeometry(.28, .7, .28), mat(0xffffff)); chim.position.set(w * .28, h + .55, 0); hg.add(chim);
        const door = new T.Mesh(new T.BoxGeometry(.4, .85, .03), mat(0x6f7b99)); door.position.set(0, .43, dd / 2 + .02); hg.add(door);
        hg.position.set(x, 0, z); add2(hg);
      });
      [-2.75, 0, 2.75].forEach((x) => {
        const lg = new T.Group(), pole = new T.Mesh(new T.CylinderGeometry(.05, .07, 3.2, 8), mat(0x34415e)); pole.position.y = 1.6; lg.add(pole);
        const arm = new T.Mesh(new T.BoxGeometry(.5, .05, .05), mat(0x34415e)); arm.position.set(.22, 3.2, 0); lg.add(arm);
        const head = new T.Mesh(new T.SphereGeometry(.2, 12, 10), new T.MeshBasicMaterial({ color: 0xffffff })); head.position.set(.48, 3.12, 0); lg.add(head);
        lg.position.set(x, 0, 2.7); add2(lg);
      });
      const solid2 = (g, x, y, z, parent) => { const m = new T.Mesh(g, mat(0xffffff)); m.position.set(x, y, z); parent.add(m); return m; };
      // coches en la calle
      const car = (x, z, dir) => {
        const g = new T.Group();
        solid2(new T.BoxGeometry(1.9, .46, .85), 0, .42, 0, g); solid2(new T.BoxGeometry(1.0, .4, .78), -.1 * dir, .85, 0, g);
        solid2(new T.BoxGeometry(.9, .26, .02), -.1 * dir, .86, .4, g); solid2(new T.BoxGeometry(.9, .26, .02), -.1 * dir, .86, -.4, g);
        [[-.62, .43], [.62, .43], [-.62, -.43], [.62, -.43]].forEach(([wx, wz]) => { const w = new T.Mesh(new T.CylinderGeometry(.22, .22, .12, 14), mat(0xffffff)); w.rotation.x = Math.PI / 2; w.position.set(wx, .22, wz); g.add(w); });
        solid2(new T.BoxGeometry(.06, .1, .2), .95 * dir, .5, .25, g); solid2(new T.BoxGeometry(.06, .1, .2), .95 * dir, .5, -.25, g);
        g.position.set(x, 0, z); g.rotation.y = dir > 0 ? 0 : Math.PI; add2(g);
      };
      car(-2.75, -1.8, 1); car(2.75, -2.3, -1);
      // peatones
      const walker = (x, z, s) => {
        const g = new T.Group();
        solid2(new T.BoxGeometry(.16 * s, .75 * s, .16 * s), -.1 * s, .38 * s, 0, g); solid2(new T.BoxGeometry(.16 * s, .75 * s, .16 * s), .1 * s, .38 * s, 0, g);
        solid2(new T.BoxGeometry(.46 * s, .7 * s, .26 * s), 0, 1.1 * s, 0, g); solid2(new T.BoxGeometry(.12 * s, .62 * s, .12 * s), -.32 * s, 1.08 * s, 0, g); solid2(new T.BoxGeometry(.12 * s, .62 * s, .12 * s), .32 * s, 1.08 * s, 0, g);
        solid2(new T.SphereGeometry(.2 * s, 14, 10), 0, 1.7 * s, 0, g); g.position.set(x, 0, z); add2(g);
      };
      walker(-2.1, 2.1, .95); walker(2.2, 1.9, 1); walker(.7, 2.4, .8);
      // banca
      const bench = (x, z) => { const g = new T.Group(); solid2(new T.BoxGeometry(1.3, .08, .42), 0, .5, 0, g); solid2(new T.BoxGeometry(1.3, .4, .06), 0, .8, -.2, g); [-.55, .55].forEach((lx) => solid2(new T.BoxGeometry(.08, .5, .38), lx, .25, 0, g)); g.position.set(x, 0, z); add2(g); };
      bench(-3.5, 2.3);
      // valla detrás de los árboles
      for (let fx = -6; fx <= 6; fx += .5) { const p = new T.Mesh(new T.BoxGeometry(.08, .9, .08), mat(0xffffff)); p.position.set(fx, .45, -3.4); add2(p); }
      [.32, .7].forEach((fy) => { const rl = new T.Mesh(new T.BoxGeometry(12.2, .05, .05), mat(0xffffff)); rl.position.set(0, fy, -3.4); add2(rl); });
      // señal de tránsito e hidrante
      const sgn = new T.Group(); solid2(new T.CylinderGeometry(.035, .035, 2.2, 8), 0, 1.1, 0, sgn); const disc = solid2(new T.CylinderGeometry(.3, .3, .04, 24), 0, 2.3, 0, sgn); disc.rotation.x = Math.PI / 2; sgn.position.set(-4.4, 0, 1.6); add2(sgn);
      const hyd = new T.Group(); solid2(new T.CylinderGeometry(.13, .15, .55, 12), 0, .28, 0, hyd); solid2(new T.SphereGeometry(.14, 12, 10), 0, .6, 0, hyd); solid2(new T.CylinderGeometry(.05, .05, .36, 8), 0, .4, 0, hyd).rotation.z = Math.PI / 2; hyd.position.set(4.5, 0, 1.8); add2(hyd);
      const R2 = rng(2024), crown = [0x34508a, 0x4a6fbf, 0x0f2a5e, 0x6f88c0], trunkM = new T.MeshLambertMaterial({ color: 0x061331 }), trees = [], pos = [];
      const v = new T.Vector3();
      for (const [x, z] of [[-4.1, -.4], [-1.4, .7], [1.4, -.7], [4.1, .5]]) {   // pocos árboles, bien separados
        pos.push([x, z]);
        const g = new T.Group(), s = .8 + R2() * .22, type = R2() < .55 ? 0 : 1, cm = new T.MeshLambertMaterial({ color: crown[Math.floor(R2() * crown.length)] });
        g.add(new T.Mesh(new T.CylinderGeometry(.16 * s, .2 * s, 1 * s, 8), trunkM)); g.children[0].position.y = .5 * s;
        if (type === 0) { [[0, 1.5, 0, .62], [.3, 1.2, .1, .42], [-.3, 1.3, -.1, .45]].forEach(([a, b, e, r]) => { const m = new T.Mesh(new T.IcosahedronGeometry(r * s, 1), cm); m.position.set(a * s, b * s, e * s); g.add(m); }); }
        else { [[.95, 1, .9], [.7, 1.1, 1.55], [.45, .9, 2.1]].forEach(([r, h, y]) => { const m = new T.Mesh(new T.ConeGeometry(r * s, h * s, 9), cm); m.position.y = y * s; g.add(m); }); }
        g.position.set(x, 0, z); fs2.add(g); trees.push(g);
      }
      window.Viz.lineArt(fs2);   // todo blanco con trazos gris claro
      // imagen: render directo a una textura de la GPU (sin leer píxeles), con mipmaps y anisotropía; la máscara sí se lee una vez para medir la confianza
      const tgt = new T.WebGLRenderTarget(1280, 800, { minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, generateMipmaps: true }); tgt.texture.anisotropy = Math.min(8, rdr.capabilities.getMaxAnisotropy());
      const mtgt = new T.WebGLRenderTarget(RW, RH, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat }), mask = new Uint8Array(RW * RH * 4);
      const oldClear = new T.Color(), oldA = rdr.getClearAlpha(), oldScissor = rdr.getScissorTest(), oldAuto = rdr.autoClear; rdr.getClearColor(oldClear);
      rdr.setScissorTest(false); rdr.autoClear = true;
      rdr.setRenderTarget(tgt); rdr.setClearColor(0xffffff, 1); rdr.render(fs2, fc);
      others.forEach((o) => { o.visible = false; }); fs2.overrideMaterial = new T.MeshBasicMaterial({ color: 0x000000 }); rdr.setRenderTarget(mtgt); rdr.setClearColor(0xffffff, 1); rdr.render(fs2, fc); rdr.readRenderTargetPixels(mtgt, 0, 0, RW, RH, mask);
      rdr.setRenderTarget(null); rdr.setClearColor(oldClear, oldA); rdr.setScissorTest(oldScissor); rdr.autoClear = oldAuto; mtgt.dispose();
      return { tex: tgt.texture, mask };
    })();
    const inside = (x, y) => { const ix = Math.floor((x + IW / 2) * PPU), iy = Math.floor((y + IH / 2) * PPU); return ix >= 0 && iy >= 0 && ix < RW && iy < RH && snap.mask[(iy * RW + ix) * 4] < 128; };
    const picTex = snap.tex;
    const picM = new T.MeshBasicMaterial({ map: picTex, transparent: true }); picM.userData.base = 1; const picMats = [picM];
    const img = new T.Mesh(new T.PlaneGeometry(IW, IH), picM); scene.add(img);
    const frame = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(IW, IH)), lineM(P.g4, .8)); scene.add(frame);

    // ----- búsqueda multiescala: parches de dos tamaños, confianza de la CNN (fracción del parche que toca al objeto) -----
    const mkPatches = (size, off) => {
      const list = [];
      for (let y0 = IH / 2 + off; y0 > -IH / 2; y0 -= size) for (let x0 = -IW / 2 - off; x0 < IW / 2; x0 += size) {
        const xa = Math.max(x0, -IW / 2), xb = Math.min(x0 + size, IW / 2), yb = Math.min(y0, IH / 2), ya = Math.max(y0 - size, -IH / 2);
        if (xb - xa < .1 || yb - ya < .1) continue;
        let hit = 0; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if (inside(xa + (i + .5) / 6 * (xb - xa), ya + (j + .5) / 6 * (yb - ya))) hit++;
        list.push({ xa, xb, ya, yb, c: smooth((hit / 36 - .05) / .5) });
      }
      return list;
    };
    const SETS = [mkPatches(.9, 0), mkPatches(.62, .2), mkPatches(.45, .1), mkPatches(.32, .22), mkPatches(.22, .08), mkPatches(.15, .12)];   // seis escalas, hasta parches muy pequeños   // cuatro escalas
    const cLo = new T.Color(0xffffff), cHi = new T.Color(0x0f2a5e), tmp = new T.Color(), dm = new T.Object3D();
    const pSets = SETS.map((list) => {
      const mat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const m = new T.InstancedMesh(new T.PlaneGeometry(1, 1), mat, list.length); m.frustumCulled = false; m.position.z = .02;
      m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      list.forEach((p, i) => m.setColorAt(i, tmp.copy(cLo).lerp(cHi, p.c)));
      const edge = [];
      list.forEach((p) => edge.push(p.xa, p.ya, 0, p.xb, p.ya, 0, p.xb, p.ya, 0, p.xb, p.yb, 0, p.xb, p.yb, 0, p.xa, p.yb, 0, p.xa, p.yb, 0, p.xa, p.ya, 0));
      const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(new Float32Array(edge), 3));
      const el = new T.LineSegments(eg, new T.LineBasicMaterial({ color: P.g5, transparent: true, opacity: 0 })); el.position.z = .03;
      scene.add(m, el); return { list, m, mat, el };
    });

    // ----- rejilla de puntos y confianza conjunta C(x,y) = suma de las confianzas de los parches que contienen el punto -----
    const STEP = .16, pts = [];
    for (let y = -IH / 2 + STEP / 2; y < IH / 2; y += STEP) for (let x = -IW / 2 + STEP / 2; x < IW / 2; x += STEP) {
      let C = 0; SETS.forEach((l) => l.forEach((p) => { if (x >= p.xa && x <= p.xb && y >= p.ya && y <= p.yb) C += p.c; }));
      pts.push({ x, y, C });
    }
    const MU = SETS.length * .5, keep = pts.map((p) => p.C >= MU);
    // DBSCAN real sobre los puntos que superan el umbral
    const EPS = STEP * 1.25, MINP = 4, lab = new Array(pts.length).fill(-2); let nc = 0;
    const near = (i) => { const r = []; for (let j = 0; j < pts.length; j++) if (keep[j] && Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) <= EPS) r.push(j); return r; };
    for (let i = 0; i < pts.length; i++) {
      if (!keep[i] || lab[i] !== -2) continue;
      const nb = near(i);
      if (nb.length < MINP) { lab[i] = -1; continue; }
      lab[i] = nc; const q = nb.slice();
      while (q.length) { const j = q.pop(); if (lab[j] === -1) lab[j] = nc; if (lab[j] !== -2) continue; lab[j] = nc; const n2 = near(j); if (n2.length >= MINP) q.push(...n2); }
      nc++;
    }
    const ext = Array.from({ length: nc }, () => ({ x1: 1e9, x2: -1e9, y1: 1e9, y2: -1e9, pts: [] }));
    pts.forEach((p, i) => { if (lab[i] >= 0) { const e = ext[lab[i]]; e.x1 = Math.min(e.x1, p.x); e.x2 = Math.max(e.x2, p.x); e.y1 = Math.min(e.y1, p.y); e.y2 = Math.max(e.y2, p.y); } });
    pts.forEach((p, i) => { if (lab[i] >= 0) { const e = ext[lab[i]]; if (p.x === e.x1 || p.x === e.x2 || p.y === e.y1 || p.y === e.y2) e.pts.push(p); } });
    const CC = [new T.Color(0x0f2a5e), new T.Color(0x4a6fbf), new T.Color(0x7c8fb8), new T.Color(0x2d4a8f)], cNoise = new T.Color(0xc3c9d4), cDot = new T.Color(0x061331);
    const dots = new T.InstancedMesh(new T.CircleGeometry(1, 14), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }), pts.length);
    dots.instanceMatrix.setUsage(T.DynamicDrawUsage); dots.frustumCulled = false; dots.position.z = .05;
    dots.instanceColor = new T.InstancedBufferAttribute(new Float32Array(pts.length * 3), 3); scene.add(dots);
    // extremos, bounding box ajustado y con margen
    const exDots = [];
    ext.forEach((e) => e.pts.forEach((p) => { const s = new T.Mesh(new T.SphereGeometry(.07, 12, 10), solid(P.ink)); s.position.set(p.x, p.y, .09); s.scale.setScalar(.0001); scene.add(s); exDots.push(s); }));
    const DELTA = .1, boxes = ext.map((e, i) => {
      const tight = dyn(5, P.g5, .9), wide = dyn(5, P.ink, 1); tight.line.position.z = .08; wide.line.position.z = .09; scene.add(tight.line, wide.line);
      const w = e.x2 - e.x1, h = e.y2 - e.y1;
      return { e, tight, wide, m: [e.x1 - DELTA * w, e.x2 + DELTA * w, e.y1 - DELTA * h, e.y2 + DELTA * h] };
    });
    const setRect = (d, a, b, c, e2, k) => {   // dibuja un rectángulo creciendo desde la esquina inferior izquierda según k (0..1)
      const x2 = lerp(a, b, k), y2 = lerp(c, e2, clamp(k * 1.6 - .3)), A = d.arr;
      A.set([a, c, 0, x2, c, 0, x2, y2, 0, a, y2, 0, a, c, 0]); d.attr.needsUpdate = true; d.line.visible = k > .01;
    };
    const px = 0;
    return (t, dt, m) => {
      const tc = t % PER, g = smooth(tc / 1) * (1 - smooth((tc - PER + 1.6) / 1.4));
      picMats.forEach((m) => { m.opacity = m.userData.base * g; }); frame.material.opacity = .8 * g;
      // 1-2) búsqueda multiescala
      const stg = SETS.map((_, k) => { const a = 3 + 1.05 * k; return [a, a + .9, a + 1.4, a + 2.1]; });
      pSets.forEach((s, k) => {
        const [a, b, c, d] = stg[k], vis = smooth((tc - a) / .5) * (1 - smooth((tc - c) / (d - c))) * g;
        s.mat.opacity = .55 * vis; s.el.material.opacity = .8 * vis;
        s.list.forEach((p, i) => {
          const rv = easeOut((tc - a - (i / s.list.length) * (b - a)) / .35) * .94;
          dm.position.set((p.xa + p.xb) / 2, (p.ya + p.yb) / 2, 0); dm.scale.set((p.xb - p.xa) * Math.max(rv, .0001), (p.yb - p.ya) * Math.max(rv, .0001), 1); dm.updateMatrix(); s.m.setMatrixAt(i, dm.matrix);
        });
        s.m.instanceMatrix.needsUpdate = true;
      });
      // 3-4) rejilla con confianza conjunta (diámetro) → 5) umbral → 6) DBSCAN (color por cluster)
      const born = (p) => easeOut((tc - 10.4 - (p.x + IW / 2) / IW * 1.4) / .5), thr = smooth((tc - 13.6) / 1.2), col = smooth((tc - 16.2) / 1.4), hide = smooth((tc - 23.8) / .7) * (1 - smooth((tc - 27.6) / .7));   // los puntos de ayuda se quitan un momento al mostrar el resultado final
      pts.forEach((p, i) => {
        const base2 = (.02 + p.C / SETS.length * .075) * born(p) * g;
        let s = base2;
        if (!keep[i]) s *= 1 - thr; else if (lab[i] < 0) s *= 1 - col;
        s *= 1 - hide;
        dm.position.set(p.x, p.y, 0); dm.scale.setScalar(Math.max(.0001, s)); dm.updateMatrix(); dots.setMatrixAt(i, dm.matrix);
        const cl = lab[i] >= 0 ? CC[lab[i] % CC.length] : cNoise;
        dots.setColorAt(i, tmp.copy(cDot).lerp(cl, col));
      });
      dots.instanceMatrix.needsUpdate = true; dots.instanceColor.needsUpdate = true;
      // 7) valores extremos
      exDots.forEach((s, i) => { s.scale.setScalar(Math.max(.0001, easeOut((tc - 18.6 - (i % 8) * .06) / .5) * g * (1 - hide))); });
      // 8) bounding box ajustado → 9) margen y detección final
      const kt = easeOut((tc - 19.8) / 1.3) * g, km = smooth((tc - 21.6) / 1.4);
      boxes.forEach((b) => {
        setRect(b.tight, b.e.x1, b.e.x2, b.e.y1, b.e.y2, kt); b.tight.line.material.opacity = .9 * (1 - km * .6) * g * (1 - hide);
        const x1 = lerp(b.e.x1, b.m[0], km), x2 = lerp(b.e.x2, b.m[1], km), y1 = lerp(b.e.y1, b.m[2], km), y2 = lerp(b.e.y2, b.m[3], km);
        setRect(b.wide, x1, x2, y1, y2, km > 0 ? 1 : 0); b.wide.line.material.opacity = g * km;
      });
      cam.position.set(Math.sin(t * .22) * 1.2 + m.x * .8, -1 + m.y * .5, 8.2); cam.lookAt(0, 0, 0);
    };
  });

  // ===== TESIS · conjuntos de Julia de polinomios cuadráticos z² + c =====
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const PAL = `vec3 pal(float f){ vec3 a = vec3(.95,.96,.975), s = vec3(.45,.54,.72), b = vec3(.06,.16,.4), c = vec3(.02,.06,.17); vec3 col = mix(a, s, smoothstep(0., .3, f)); col = mix(col, b, smoothstep(.25, .7, f)); return mix(col, c, smoothstep(.72, 1., f)); }`;
  const juliaFrag = `uniform vec2 uC; uniform float uFade; varying vec2 vUv; ${PAL}
    void main(){
      vec2 z = (vUv - .5) * 3.0; float n = 0.; float esc = 0.;
      for (int k = 0; k < 110; k++) { if (dot(z, z) > 256.) { esc = 1.; break; } z = vec2(z.x*z.x - z.y*z.y, 2.*z.x*z.y) + uC; n += 1.; }
      vec3 col = vec3(.02,.06,.17);
      if (esc > .5) { float sm = n - log2(max(log2(dot(z, z)), 1e-4)) + 4.0; col = pal(clamp(sm / 20., 0., 1.)) * (.94 + .06 * sin(sm * 1.6)); }
      float a = 1. - smoothstep(.96, 1., length(vUv - .5) * 2.);
      gl_FragColor = vec4(col, a * uFade);
    }`;
  const mandFrag = `uniform float uFade; varying vec2 vUv; ${PAL}
    void main(){
      vec2 c = (vUv - .5) * 3.2 + vec2(-.55, 0.); vec2 z = vec2(0.); float n = 0.; float esc = 0.;
      for (int k = 0; k < 80; k++) { if (dot(z, z) > 256.) { esc = 1.; break; } z = vec2(z.x*z.x - z.y*z.y, 2.*z.x*z.y) + c; n += 1.; }
      vec3 col = vec3(.02,.06,.17);
      if (esc > .5) { float sm = n - log2(max(log2(dot(z, z)), 1e-4)) + 4.0; col = pal(clamp(sm / 18., 0., 1.)); }
      float a = 1. - smoothstep(.94, 1., length(vUv - .5) * 2.);
      gl_FragColor = vec4(col, a * uFade);
    }`;
  add('julia', () => {
    const { scene } = base({ cam: [0, 0, 8.2], aspect: 1.2 });
    const g = new T.Group(); scene.add(g);
    const mk = (frag, size, x, y, uniforms) => {
      const m = new T.Mesh(new T.PlaneGeometry(size, size), new T.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: Object.assign({ uFade: { value: 1 } }, uniforms), transparent: true, depthWrite: false }));
      m.position.set(x, y, 0); g.add(m); return m;
    };
    const uC = { value: new T.Vector2(-.4, .6) };
    mk(juliaFrag, 4.8, -.7, .15, { uC });
    const MS = 1.7, MX = 2.45, MY = 1.35;
    mk(mandFrag, MS, MX, MY, {});
    g.add(poly(Array.from({ length: 65 }, (_, i) => V3(MX + Math.cos(i / 64 * TAU) * MS / 2, MY + Math.sin(i / 64 * TAU) * MS / 2, .01)), P.g5, .8));
    const dot = new T.Mesh(new T.CircleGeometry(.055, 16), new T.MeshBasicMaterial({ color: P.white })); dot.position.z = .03;
    const ring = new T.Mesh(new T.RingGeometry(.075, .1, 20), new T.MeshBasicMaterial({ color: P.ink })); ring.position.z = .03;
    g.add(dot, ring);
    const l1 = label('z² + c', { px: 34 }); l1.position.set(-.7, -2.75, 0); g.add(l1);
    const l2 = label('plano de c', { px: 22 }); l2.position.set(MX, MY - MS / 2 - .22, 0); g.add(l2);
    return (t, dt, m) => {
      const a = t * .42, s = 1.03 + .08 * Math.sin(t * .31);
      const cx = s * (.5 * Math.cos(a) - .25 * Math.cos(2 * a)), cy = s * (.5 * Math.sin(a) - .25 * Math.sin(2 * a));
      uC.value.set(cx, cy);
      dot.position.x = ring.position.x = MX + (cx + .55) / 3.2 * MS; dot.position.y = ring.position.y = MY + cy / 3.2 * MS;
      g.rotation.y = m.x * .12; g.rotation.x = -m.y * .08;
    };
  });

  // ===== LOGRO · árbol de decisión (decisiones financieras bajo incertidumbre) =====
  add('dtree', () => {
    const { scene } = base({ cam: [0, 0, 11.5], aspect: 1.2 });
    const PER = 16;
    const root = V3(-4.0, 0, 0);
    const opts = [
      { name: 'Expandir', c: V3(-1.1, 2.2, 0), leaves: [[.5, 140, 3.0], [.3, 20, 2.1], [.2, -90, 1.2]] },
      { name: 'Mantener', c: V3(-1.1, .1, 0), leaves: [[.6, 60, .5], [.4, 10, -.3]] },
      { name: 'Reducir', c: V3(-1.1, -2.0, 0), leaves: [[.7, 30, -1.6], [.3, 20, -2.4]] },
    ];
    opts.forEach((o) => { o.ev = Math.round(o.leaves.reduce((s, l) => s + l[0] * l[1], 0)); });
    const best = opts.reduce((b, o, i) => (o.ev > opts[b].ev ? i : b), 0);
    const edges = [], texts = [];
    const edge = (a, b, t0, t1, o) => { const d = dyn(2, P.g4, 1); scene.add(d.line); const e = { d, a, b, t0, t1, o, bestPath: o.best }; edges.push(e); return e; };
    const txt = (s, p, t0, px = 22, color) => { const l = label(s, { px, color }); l.position.copy(p); scene.add(l); const x = { l, t0 }; texts.push(x); return x; };
    const rootN = block(.55, .55, .55, P.white, P.ink, 1); rootN.position.copy(root); scene.add(rootN);
    const nodes = [], leafM = [];
    opts.forEach((o, i) => {
      o.best = i === best;
      o.e = edge(root, o.c, i * .35, i * .35 + 1.2, o);
      const n = new T.Mesh(new T.SphereGeometry(.3, 20, 14), solid(P.white)); n.position.copy(o.c); n.scale.setScalar(.001); scene.add(n); nodes.push(n);
      txt(o.name, V3((root.x + o.c.x) / 2 - .1, (root.y + o.c.y) / 2 + (i === 1 ? .3 : i === 0 ? .35 : -.35), 0), i * .35 + .9, 24, '#061331');
      o.le = o.leaves.map(([p, v, y], k) => {
        const lp = V3(2.5, y, 0), t0 = 2.6 + i * .5 + k * .2;
        const e = edge(o.c, lp, t0, t0 + .9, o);
        const cone = new T.Mesh(new T.ConeGeometry(.2, .42, 3), solid(v >= 100 ? P.g6 : P.g3)); cone.rotation.z = -Math.PI / 2; cone.position.copy(lp); cone.scale.setScalar(.001); scene.add(cone); leafM.push({ cone, t0: t0 + .7, o, v });
        txt('p = ' + p, V3(.7, (o.c.y + y) / 2 + .25, 0), t0 + .6, 18, '#3a5088');
        txt((v > 0 ? '+' : '−') + Math.abs(v), V3(3.3, y, 0), t0 + .8, 24, v < 0 ? '#0f2a5e' : '#061331');
        return e;
      });
      o.evT = txt('VE = ' + o.ev, V3(o.c.x, o.c.y + .62, 0), 6 + i * .5, 24, '#0f2a5e');
    });
    const marker = new T.Mesh(new T.SphereGeometry(.14, 14, 10), solid(P.ink)); scene.add(marker);
    const path = [root, opts[best].c, V3(2.5, opts[best].leaves[0][2], 0)];
    const tmp = new T.Color(), cTan = new T.Color(P.g3), cBlue = new T.Color(P.g6);
    return (t) => {
      const tc = t % PER, g = 1 - smooth((tc - PER + 1) / 1), pick = smooth((tc - 8.6) / 1);
      rootN.scale.setScalar(Math.max(.001, g));
      edges.forEach((e) => {
        const u = easeOut((tc - e.t0) / (e.t1 - e.t0));
        const p = e.a.clone().lerp(e.b, u);
        e.d.arr.set([e.a.x, e.a.y, e.a.z, p.x, p.y, p.z]); e.d.attr.needsUpdate = true;
        e.d.line.visible = u > .001;
        tmp.copy(cTan).lerp(cBlue, e.o.best ? pick : 0); e.d.line.material.color.copy(tmp);
        e.d.line.material.opacity = g * (e.o.best ? 1 : 1 - .55 * pick);
      });
      nodes.forEach((n, i) => { const s = easeOut((tc - i * .35 - 1) / .5) * g * (i === best ? 1 + .15 * pick : 1); n.scale.setScalar(Math.max(.001, s)); tint(n.material, P.white, i === best ? P.g6 : P.g3, pick); });
      leafM.forEach((l) => { const s = easeOut((tc - l.t0) / .4) * g; l.cone.scale.setScalar(Math.max(.001, s * (l.o.best && l.v > 100 ? 1 + .35 * pick : 1))); });
      texts.forEach((x) => { x.l.material.opacity = smooth((tc - x.t0) / .5) * g; });
      const mt = clamp((tc - 9.6) / 3);
      marker.visible = tc > 9.6 && tc < PER - 1;
      const seg = mt < .45 ? [path[0], path[1], mt / .45] : [path[1], path[2], (mt - .45) / .55];
      marker.position.lerpVectors(seg[0], seg[1], smooth(seg[2]));
    };
    function tint(m, a, b, k) { m.color.setHex(a).lerp(tmp.setHex(b), k); }
  });

  // ===== CONTACTO · autómata celular incrustado: una cuadrícula sobre una región aleatoria cuyo estado final es el color de la página =====
  add('automata', () => {
    const { scene } = base({ cam: [0, 0, 12], fov: 30, aspect: 1 });
    const GW = 46, GH = 42, CS = .15, STEP = .12, PER = 28;
    // estados: 0 = color de fondo de la hoja (no se dibuja), 1..3 = azules cada vez más oscuros
    const COLORS = [null, new T.Color(0xa7b6d6), new T.Color(0x34508a), new T.Color(0x061331)];
    const mesh = new T.InstancedMesh(new T.PlaneGeometry(CS * .88, CS * .88), new T.MeshBasicMaterial({ color: 0xffffff }), GW * GH);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; scene.add(mesh);
    mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(GW * GH * 3), 3);
    const gridMat = new T.LineBasicMaterial({ color: 0xc3c9d4, transparent: true, opacity: .6 });
    let grid = null, region = new Uint8Array(GW * GH), s = new Uint8Array(GW * GH), R = rng(1), cyc = -1, acc = 0, g = 0;
    const dm = new T.Object3D();
    const X = (i) => (i % GW - (GW - 1) / 2) * CS, Y = (i) => ((GH - 1) / 2 - Math.floor(i / GW)) * CS;
    function build(seed) {
      R = rng(seed);
      // región aleatoria: unión de manchas con borde irregular
      const blobs = Array.from({ length: 4 + Math.floor(R() * 3) }, () => ({ x: (.22 + R() * .56) * GW, y: (.22 + R() * .56) * GH, r: 6 + R() * 6 }));
      for (let i = 0; i < GW * GH; i++) {
        const cx = i % GW, cy = Math.floor(i / GW);
        let v = 0; blobs.forEach((b) => { v += Math.exp(-((cx - b.x) ** 2 + (cy - b.y) ** 2) / (b.r * b.r)); });
        region[i] = v + (R() - .5) * .3 > .6 ? 1 : 0;
        s[i] = region[i] ? (R() < .18 ? 0 : 1 + Math.floor(R() * 3)) : 0;
      }
      // contorno de cada celda de la región (la cuadrícula)
      const seg = [], h = CS / 2;
      for (let i = 0; i < GW * GH; i++) if (region[i]) {
        const x = X(i), y = Y(i);
        seg.push(x - h, y - h, 0, x + h, y - h, 0, x + h, y - h, 0, x + h, y + h, 0, x + h, y + h, 0, x - h, y + h, 0, x - h, y + h, 0, x - h, y - h, 0);
      }
      if (grid) { scene.remove(grid); grid.geometry.dispose(); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(seg), 3));
      grid = new T.LineSegments(geo, gridMat); scene.add(grid);
    }
    function paint() {
      for (let i = 0; i < GW * GH; i++) {
        const st = s[i], on = region[i] && st > 0;
        dm.position.set(X(i), Y(i), .01); dm.scale.setScalar(on ? Math.max(.0001, g) : .0001); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix);
        if (on) mesh.setColorAt(i, COLORS[st]);
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    }
    function step(prog) {
      const ns = new Uint8Array(GW * GH), w = [0, 0, 0, 0];
      const pd = prog * prog * .3, pn = .025 * (1 - prog);
      for (let i = 0; i < GW * GH; i++) {
        if (!region[i]) continue;
        const cx = i % GW, cy = Math.floor(i / GW);
        w[0] = w[1] = w[2] = w[3] = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx, y = cy + dy;
          w[x < 0 || y < 0 || x >= GW || y >= GH || !region[y * GW + x] ? 0 : s[y * GW + x]]++;
        }
        w[0] *= 1.2; // sesgo hacia el color del fondo: es el estado al que tiende todo el autómata
        let best = 0, bv = -1;
        for (let k = 0; k < 4; k++) { const v = w[k] + R() * .3; if (v > bv) { bv = v; best = k; } }
        if (R() < pn) best = Math.floor(R() * 4);
        if (R() < pd) best = 0;
        ns[i] = best;
      }
      s = ns;
    }
    return (t, dt) => {
      const c = Math.floor(t / PER), tc = t % PER;
      if (c !== cyc) { cyc = c; build(((Math.random() * 1e9) | 0) + c); acc = 0; paint(); }
      g = smooth(tc / 1.2) * (1 - smooth((tc - PER + 1.8) / 1.6));
      acc += dt;
      if (tc < PER - 3) while (acc >= STEP) { acc -= STEP; step(clamp(tc / (PER - 9))); paint(); }
      else paint();
      gridMat.opacity = .6 * g;
    };
  });

})();
