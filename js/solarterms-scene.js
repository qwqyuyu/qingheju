/* ==========================================
   solarterms-scene.js — 节气长卷画布引擎
   组合：画布景物引擎（移植自独立节气长卷）+ 索引与题字
   ========================================== */

(() => {
    'use strict';

    /* ---------- 基础工具 ---------- */
    const TAU = Math.PI * 2, PI = Math.PI;
    let cv = null, ctx = null, host = null;
    const RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = t => t * t * (3 - 2 * t);
    const fr = x => x - Math.floor(x);
    function rng(s) {
        return () => {
            s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    const RT = new Float32Array(8192);
    { const g = rng(20261002); for (let i = 0; i < 8192; i++) RT[i] = g(); }
    const R = i => RT[i & 8191];
    const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';

    /* ---------- 画面几何 ---------- */
    let W = 0, H = 0, U = 1, DPR = 1, LAND = true, HZ = 0, SX = 0, BAND = 0, TX = 0, TY = 0, TS = 1, SYlow = 0;
    let SXc = 0, SYc = 0, SR = 1;
    let far0Y, farY, midY, bankY, far0P, farP, midP, bankP, bankEdge, far0Top, farTop, midTop, CB;
    const pk = z => Math.pow(1 - Math.abs(Math.sin(PI * z)), 1.5);

    /* ---------- 参数向量：颜色 + 数值，场景之间整体插值 ---------- */
    const S0 = 0, S1 = 1, H1 = 2, H2 = 3, BK = 4, W0 = 5, W1 = 6, DK = 7, SUN = 8, LA = 9, LB = 10, NC = 11;
    const SUNR = 0, CORE = 1, HALO = 2, DY = 3, ALT = 4, REFL = 5, BUD = 6, BLOOM = 7, LEAF = 8, MIX = 9, SNOW = 10, NN = 11;
    const NP = NC * 3 + NN, P = new Float32Array(NP), F = new Float32Array(NP);
    const col = (i, a) => {
        const k = i * 3;
        return a === undefined
            ? 'rgb(' + (P[k] | 0) + ',' + (P[k + 1] | 0) + ',' + (P[k + 2] | 0) + ')'
            : 'rgba(' + (P[k] | 0) + ',' + (P[k + 1] | 0) + ',' + (P[k + 2] | 0) + ',' + a + ')';
    };
    const cmix = (i, j, t, a = 1) => {
        const k = i * 3, m = j * 3;
        return 'rgba(' + (lerp(P[k], P[m], t) | 0) + ',' + (lerp(P[k + 1], P[m + 1], t) | 0) + ',' +
            (lerp(P[k + 2], P[m + 2], t) | 0) + ',' + a + ')';
    };
    const shade = (i, f) => {
        const k = i * 3, m = 1 + f;
        return 'rgb(' + (Math.min(255, P[k] * m) | 0) + ',' + (Math.min(255, P[k + 1] * m) | 0) + ',' +
            (Math.min(255, P[k + 2] * m) | 0) + ')';
    };
    const num = i => P[NC * 3 + i];

    /* ==========================================================
       以下景物图层与绘制逻辑移植自独立节气长卷，仅把全屏窗口
       替换为容器尺寸；界面文字与索引由本文件下方的控制器处理。
       ========================================================== */

    const rain = o => (a, t) => {
        const { n = 160, col = '#fff', len = 3, slant = .22, sp = 1.3, al = .5, w = .12, k = 0 } = o;
        ctx.strokeStyle = col; ctx.globalAlpha = a * al; ctx.lineWidth = U * w; ctx.lineCap = 'round'; ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const j = k + i * 3, p = fr(R(j) + t * sp * (.7 + R(j + 1) * .6));
            const y = p * H * 1.15 - H * .08, x = R(j + 2) * (W + H * slant * 1.15) - p * H * slant * 1.15;
            const l = U * len * (.6 + R(j + 1) * .8);
            ctx.moveTo(x, y); ctx.lineTo(x - l * slant, y + l);
        }
        ctx.stroke();
    };

    const snow = o => (a, t) => {
        const { n = 120, sz = .5, sp = .08, col = '#fff', al = .95, k = 500 } = o;
        ctx.fillStyle = col; ctx.globalAlpha = a * al; ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const j = k + i * 4, d = R(j + 3), p = fr(R(j) + t * sp * (.5 + d));
            const x = fr(R(j + 1) + Math.sin(t * .5 + R(j + 2) * TAU) * .025 + t * .012 * (d - .3)) * W * 1.1 - W * .05;
            const y = p * H * 1.1 - H * .05, r = U * sz * (.3 + d * .9);
            ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
    };

    const flakes = o => (a, t) => {
        const { n = 30, cols, sz = 1, sp = .06, k = 900, drift = .04 } = o, m = cols.length;
        ctx.globalAlpha = a * .92;
        for (let c = 0; c < m; c++) {
            ctx.fillStyle = cols[c]; ctx.beginPath();
            for (let i = c; i < n; i += m) {
                const j = k + i * 5, d = R(j + 3), p = fr(R(j) + t * sp * (.6 + d * .8));
                const x = fr(R(j + 1) + p * drift * 3 + Math.sin(t * .8 + R(j + 2) * TAU) * .03) * W * 1.1 - W * .05;
                const y = p * H * 1.1 - H * .05, r = U * sz * (.5 + d * .7), rot = t * (.6 + d) + R(j + 4) * TAU;
                ctx.moveTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r);
                ctx.ellipse(x, y, r, r * (.35 + .3 * Math.abs(Math.sin(rot * 1.3))), rot, 0, TAU);
            }
            ctx.fill();
        }
    };

    const fireflies = o => (a, t) => {
        const { n = 46, col, k = 1500 } = o;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < n; i++) {
            const j = k + i * 6;
            const x = (R(j) + .06 * Math.sin(t * (.2 + R(j + 2) * .3) + R(j + 3) * TAU) + .03 * Math.sin(t * .9 + R(j + 4) * 6)) * W;
            const y = H * (.36 + R(j + 1) * .54) + Math.sin(t * (.3 + R(j + 3) * .4) + R(j + 2) * TAU) * H * .04;
            const b = Math.pow(.5 + .5 * Math.sin(t * (1.2 + R(j + 5) * 1.8) + R(j + 4) * TAU), 2.2);
            const r = U * (1.5 + R(j + 5) * 2.3);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, rgba(col, a * b)); g.addColorStop(.16, rgba(col, a * b * .75));
            g.addColorStop(.4, rgba(col, a * b * .22)); g.addColorStop(1, rgba(col, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        }
    };

    const stars = o => (a, t) => {
        const { n = 90, col = '#fff', k = 2200, x0 = 0, x1 = 1, y1 = .56 } = o;
        ctx.fillStyle = col;
        for (let i = 0; i < n; i++) {
            const j = k + i * 4, x = lerp(x0, x1, R(j)) * W, y = R(j + 1) * H * y1;
            const tw = .4 + .6 * Math.abs(Math.sin(t * (.6 + R(j + 2) * 1.2) + R(j + 3) * TAU));
            const r = U * (.09 + R(j + 2) * .17);
            ctx.globalAlpha = a * tw * .95; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        }
    };

    function swallow(x, y, s, rot, fl) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.beginPath();
        ctx.ellipse(0, 0, 1.1, .3, 0, 0, TAU);
        ctx.moveTo(-.8, 0); ctx.lineTo(-2.7, -.55); ctx.lineTo(-1.5, 0); ctx.lineTo(-2.7, .55); ctx.closePath();
        const wy = 2.7 * fl;
        ctx.moveTo(.5, 0); ctx.quadraticCurveTo(.2, -wy * .6, -1.5, -wy); ctx.quadraticCurveTo(-.2, -wy * .35, -.3, 0); ctx.closePath();
        ctx.moveTo(.5, 0); ctx.quadraticCurveTo(.2, wy * .6, -1.5, wy); ctx.quadraticCurveTo(-.2, wy * .35, -.3, 0); ctx.closePath();
        ctx.fill(); ctx.restore();
    }
    const swallows = o => (a, t) => {
        const { n = 5, col, k = 3000, xm = 1 } = o;
        ctx.fillStyle = col; ctx.globalAlpha = a;
        for (let i = 0; i < n; i++) {
            const j = k + i * 5, dir = R(j) < .6 ? 1 : -1, sp = .06 + R(j + 1) * .04, p = fr(R(j + 2) + t * sp);
            const x = ((dir > 0 ? p : 1 - p) * 1.3 - .15) * W * xm;
            const f = t * (.8 + R(j + 3) * .5) + R(j + 4) * TAU;
            const y = H * (.2 + R(j + 3) * .3) + Math.sin(f) * H * .05;
            const dy = Math.cos(f) * H * .05 * (.8 + R(j + 3) * .5), dx = dir * W * 1.3 * sp * xm;
            swallow(x, y, U * (.8 + R(j + 4) * .55), Math.atan2(dy, dx), .3 + .7 * Math.abs(Math.sin(t * 8 + i * 1.7)));
        }
    };

    const geese = o => (a, t, ts) => {
        const { n = 9, col, yy = .2, sz = 1, sp = .018, dir = 1, st = .3 } = o;
        ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = a;
        const p = fr(st + ts * sp), gx = (dir > 0 ? p : 1 - p) * W * 1.5 - W * .25;
        const gy = H * yy + Math.sin(t * .3) * H * .008, s = U * sz;
        ctx.lineWidth = s * .34; ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const side = i % 2 ? 1 : -1, m = Math.ceil(i / 2);
            const x = gx - dir * m * s * 3.3;
            const y = gy + side * m * s * 1.5 + Math.sin(t * .7 + i) * s * .2 - m * s * .5;
            const f = Math.sin(t * 3.2 + i * .7) * s * .9;
            ctx.moveTo(x - s * 1.5, y - f); ctx.quadraticCurveTo(x - s * .6, y - f * .2 - s * .25, x, y);
            ctx.quadraticCurveTo(x + s * .6, y - f * .2 - s * .25, x + s * 1.5, y - f);
        }
        ctx.stroke();
    };

    const kite = o => (a, t) => {
        const { col, line } = o;
        const x = W * (LAND ? .61 : .36) + Math.sin(t * .5) * U * 3;
        const y = H * (LAND ? .15 : .3) + Math.sin(t * .8 + 1) * U * 1.6, s = U * 2.4;
        const rot = -.5 + Math.sin(t * .9) * .12;
        const ax = W * (LAND ? .37 : .56), ay = bankY(ax) + U;
        ctx.globalAlpha = a; ctx.strokeStyle = line; ctx.lineWidth = Math.max(.7, U * .07); ctx.beginPath();
        ctx.moveTo(x, y); ctx.quadraticCurveTo(lerp(x, ax, .3), lerp(y, ay, .85), ax, ay); ctx.stroke();
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.strokeStyle = col; ctx.lineWidth = U * .24; ctx.lineCap = 'round'; ctx.beginPath();
        for (const dx of [-.22, .22]) {
            ctx.moveTo(dx * s, s * 1.1);
            for (let q = 1; q <= 10; q++) ctx.lineTo(dx * s + Math.sin(t * 3 + q * .7 + dx * 4) * s * .06 * q, s * 1.1 + q * s * .3);
        }
        ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .72, 0); ctx.lineTo(0, s * 1.25); ctx.lineTo(-s * .72, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = line; ctx.lineWidth = U * .1; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s * 1.25); ctx.moveTo(-s * .72, 0); ctx.lineTo(s * .72, 0); ctx.stroke();
        ctx.restore();
    };

    const willow = o => (a, t) => {
        const { col, col2, k = 3600 } = o, n = LAND ? 17 : 9, m = 18, pts = [];
        ctx.lineCap = 'round'; ctx.globalAlpha = a;
        for (let i = 0; i < n; i++) {
            const j = k + i * 4, x0 = W * (R(j) * (LAND ? .42 : .5) - .02);
            const L = H * (.13 + R(j + 1) * .2 + .1 * R(j)), ph = R(j + 2) * TAU;
            for (let q = 0; q <= m; q++) {
                const f = q / m;
                pts[q * 2] = x0 + (Math.sin(t * 1.1 + ph + f * 2.2) * .6 + .55) * U * 4.5 * f * f;
                pts[q * 2 + 1] = f * L - U;
            }
            ctx.strokeStyle = col2; ctx.lineWidth = U * .12; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
            for (let q = 1; q <= m; q++) ctx.lineTo(pts[q * 2], pts[q * 2 + 1]);
            ctx.stroke();
            ctx.strokeStyle = col; ctx.lineWidth = U * .34; ctx.beginPath();
            for (let q = 2; q <= m; q++) {
                const x = pts[q * 2], y = pts[q * 2 + 1], sd = q % 2 ? 1 : -1;
                ctx.moveTo(x, y); ctx.lineTo(x + sd * U * .85, y + U * 1.15);
            }
            ctx.stroke();
        }
    };

    const floes = o => (a, t) => {
        const { col, edge, n = 18, k = 4000 } = o;
        ctx.globalAlpha = a * .94;
        for (let i = 0; i < n; i++) {
            const j = k + i * 23, d = (i + R(j)) / n, yy = HZ + (H * .9 - HZ) * (.06 + .94 * d);
            const s = U * (1.6 + 5.4 * d) * (.6 + R(j + 1) * .8);
            const x = fr(R(j + 2) + t * .007 * (.5 + d)) * (W + s * 4) - s * 2;
            const bob = Math.sin(t * .9 + R(j + 3) * TAU) * U * .12, m = 6 + (R(j + 4) * 3 | 0), th = U * .28 * (.5 + d);
            for (let pass = 0; pass < 2; pass++) {
                ctx.fillStyle = pass ? col : edge; ctx.beginPath();
                for (let q = 0; q < m; q++) {
                    const an = q / m * TAU + R(j + 5) * 6, rr = s * (.68 + .32 * R(j + 6 + q));
                    const px = x + Math.cos(an) * rr, py = yy + bob + Math.sin(an) * rr * .28 + (pass ? 0 : th);
                    q ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
                }
                ctx.closePath(); ctx.fill();
            }
        }
    };

    const ripples = o => (a, t) => {
        const { col, n = 14, k = 4300 } = o;
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(.7, U * .1);
        for (let i = 0; i < n; i++) {
            const j = k + i * 4, q = t * (.35 + R(j) * .25) + R(j + 1);
            const ph = fr(q), cyc = Math.floor(q), d = R(j + 2 + cyc * 7);
            const x = R(j + 3 + cyc * 11) * W, y = HZ + (H * .9 - HZ) * (.08 + .9 * d), rr = U * (1 + 5.5 * d) * ph;
            ctx.globalAlpha = a * (1 - ph) * .75; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * .26, 0, 0, TAU); ctx.stroke();
            if (ph > .3) { ctx.beginPath(); ctx.ellipse(x, y, rr * .55, rr * .143, 0, 0, TAU); ctx.stroke(); }
        }
    };

    const storm = o => (a, t) => {
        const { cols } = o;
        ctx.globalAlpha = a;
        for (let L = 0; L < 2; L++) {
            ctx.fillStyle = cols[L]; ctx.beginPath();
            const n = LAND ? 16 : 9;
            for (let i = 0; i <= n; i++) {
                const j = 4600 + L * 80 + i * 3, r = H * (.075 + R(j) * .085) * (L ? .8 : 1);
                const x = i / n * W + (R(j + 1) - .5) * W * .05 + Math.sin(t * .25 + i + L) * U * .9;
                const y = H * (L ? -.015 : .035) + R(j + 2) * H * .05 - r * .2;
                ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
            }
            ctx.fill();
        }
    };

    const lightning = o => (a, t, ts) => {
        if (RM) return;
        const per = 2.4, q = (ts + .95) / per, c = Math.floor(q), p = fr(q) * per;
        if (c < 1 || p > .55) return;
        const inten = Math.exp(-p * 6) * (p > .09 && p < .15 ? .3 : 1), j = 4800 + c * 37;
        let x = W * (LAND ? .3 + R(j) * .3 : .2 + R(j) * .5), y = H * .07;
        const end = HZ - H * .1;
        ctx.strokeStyle = o.col; ctx.lineJoin = 'miter'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y);
        let i = 0, bx = x, by = y;
        while (y < end && i < 24) {
            y += H * (.03 + R(j + i * 2 + 1) * .05); x += (R(j + i * 2 + 2) - .5) * W * .07; ctx.lineTo(x, y);
            if (i === 3) { bx = x; by = y; }
            i++;
        }
        ctx.moveTo(bx, by);
        for (let q2 = 0; q2 < 4; q2++) { bx += W * (.02 + R(j + 60 + q2) * .03); by += H * (.02 + R(j + 70 + q2) * .035); ctx.lineTo(bx, by); }
        ctx.lineWidth = U * 1.7; ctx.globalAlpha = a * clamp(inten * .5); ctx.stroke();
        ctx.lineWidth = U * .42; ctx.globalAlpha = a * clamp(inten * 2.4); ctx.stroke();
        ctx.globalAlpha = a * inten * .2; ctx.fillStyle = o.col; ctx.fillRect(0, 0, W, H);
    };

    const risers = o => (a, t) => {
        ctx.fillStyle = o.col;
        for (let i = 0; i < 24; i++) {
            const j = 10400 + i * 4, p = fr(R(j) + t * (.07 + R(j + 1) * .06));
            const x = W * R(j + 2) + Math.sin(t * 2.2 + i) * U * 1.4 * p, y = lerp(H * .88, H * .46, p);
            const r = U * (.16 + R(j + 3) * .15);
            ctx.globalAlpha = a * Math.sin(p * PI) * .9; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        }
    };

    const wind = o => (a, t) => {
        const { col, n = 7, k = 10700, y0 = .2, y1 = .7, dir = 1, al = .55 } = o;
        ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(.8, U * .14);
        for (let i = 0; i < n; i++) {
            const j = k + i * 4, p = fr(R(j) + t * (.11 + R(j + 1) * .08));
            const len = W * (.1 + R(j + 2) * .12), x = (dir > 0 ? p : 1 - p) * (W + len * 2) - len;
            const y = H * lerp(y0, y1, R(j + 3));
            ctx.globalAlpha = a * Math.sin(p * PI) * al; ctx.beginPath();
            for (let q = 0; q <= 14; q++) {
                const f = q / 14, xx = x + f * len * dir, yy = y + Math.sin(f * 5 + t * 2 + i) * U * .8 * f;
                q ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
            }
            ctx.stroke();
        }
    };

    const duckweed = o => (a, t) => {
        const { cols, n = 84, k = 5000 } = o;
        ctx.globalAlpha = a * .92;
        for (let c = 0; c < 2; c++) {
            ctx.fillStyle = cols[c]; ctx.beginPath();
            for (let i = c; i < n; i += 2) {
                const j = k + i * 5, cl = i / 7 | 0, cx = R(5300 + cl * 3), cd = R(5301 + cl * 3);
                const d = clamp(cd + (R(j) - .5) * .16), y = HZ + (H * .9 - HZ) * (.1 + .88 * d), s = U * (.3 + 1.2 * d);
                const x = fr(cx + (R(j + 1) - .5) * .12 * (1.5 - d) + t * .003) * W + Math.sin(t * .6 + R(j + 2) * 6) * U * .2;
                ctx.moveTo(x + s, y); ctx.ellipse(x, y, s, s * .34, 0, 0, TAU);
            }
            ctx.fill();
        }
    };

    const sprouts = o => (a, t) => {
        ctx.strokeStyle = o.col; ctx.lineCap = 'round'; ctx.lineWidth = U * .3; ctx.globalAlpha = a; ctx.beginPath();
        const n = Math.floor(W / (U * 2.6));
        for (let i = 0; i < n; i++) {
            const x = (i + .5 + (R(5600 + i) - .5) * .5) * U * 2.6, y = bankY(x) + U * .3;
            const h = U * (1.2 + R(5700 + i) * 1.1), sw = Math.sin(t * 1.7 + i * .5) * U * .16;
            ctx.moveTo(x, y); ctx.quadraticCurveTo(x - h * .1, y - h * .6, x - h * .55 + sw, y - h);
            ctx.moveTo(x, y); ctx.quadraticCurveTo(x + h * .1, y - h * .6, x + h * .55 + sw, y - h);
        }
        ctx.stroke();
    };

    function petal(cx, cy, an, len, wid) {
        const c = Math.cos(an), s = Math.sin(an), tx = cx + c * len, ty = cy + s * len;
        const mx = cx + c * len * .45, my = cy + s * len * .45;
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(mx - s * wid, my + c * wid, tx, ty);
        ctx.quadraticCurveTo(mx + s * wid, my - c * wid, cx, cy);
    }
    const lotus = o => (a, t) => {
        const { leaf, leaf2, flower, flower2, stem, stage, k = 6000 } = o;
        const n = stage ? (LAND ? 26 : 15) : (LAND ? 22 : 12);
        ctx.lineCap = 'round'; ctx.globalAlpha = a;
        for (let i = 0; i < n; i++) {
            const j = k + i * 7, d = (i + R(j)) / n, y = HZ + (H * .92 - HZ) * (.14 + .86 * d);
            const x = W * (.24 + R(j + 1) * .8), s = U * (1.3 + 4.4 * d) * (stage ? 1 : .82) * (.75 + R(j + 2) * .5);
            const sw = Math.sin(t * .8 + R(j + 3) * TAU) * s * .05, ty = R(j + 4);
            if (!stage && ty < .42) {
                ctx.strokeStyle = stem; ctx.lineWidth = s * .07; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sw, y - s * 1.3); ctx.stroke();
                ctx.fillStyle = leaf2; ctx.beginPath(); ctx.ellipse(x + sw, y - s * 1.65, s * .16, s * .52, .12, 0, TAU); ctx.fill();
            } else if (stage && ty < .3) {
                const fx = x + sw * 3, fy = y - s * 1.5;
                ctx.strokeStyle = stem; ctx.lineWidth = s * .07; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - s, fx, fy); ctx.stroke();
                ctx.fillStyle = flower2; ctx.beginPath(); petal(fx, fy, -PI / 2 - .95, s * .75, s * .22); petal(fx, fy, -PI / 2 + .95, s * .75, s * .22); ctx.fill();
                ctx.fillStyle = flower; ctx.beginPath(); petal(fx, fy, -PI / 2 - .45, s * .88, s * .24); petal(fx, fy, -PI / 2 + .45, s * .88, s * .24); ctx.fill();
                ctx.fillStyle = flower2; ctx.beginPath(); petal(fx, fy, -PI / 2, s * .98, s * .26); ctx.fill();
            } else if (stage && ty < .55) {
                const lx = x + sw * 2, ly = y - s * .95, rt = -.1 + sw / s;
                ctx.strokeStyle = stem; ctx.lineWidth = s * .07; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.stroke();
                ctx.fillStyle = leaf2; ctx.beginPath(); ctx.ellipse(lx, ly, s * 1.05, s * .3, rt, 0, TAU); ctx.fill();
                ctx.fillStyle = leaf; ctx.beginPath(); ctx.ellipse(lx, ly + s * .05, s * .78, s * .15, rt, 0, PI); ctx.fill();
            } else {
                ctx.fillStyle = ty > .8 ? leaf2 : leaf; ctx.beginPath(); ctx.moveTo(x, y); ctx.ellipse(x, y, s, s * .3, 0, .35, TAU - .05); ctx.closePath(); ctx.fill();
            }
        }
    };

    function dragonfly(x, y, s, rot, t, body, wing) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = wing;
        const f = .7 + .3 * Math.sin(t * 38);
        for (const sd of [-1, 1]) for (const [off, len, skew] of [[.34, .86, .34], [.1, .76, .22]]) {
            ctx.save(); ctx.translate(off * s, 0); ctx.rotate(sd * skew);
            ctx.beginPath(); ctx.ellipse(0, sd * len * s * .5 * f, s * .115, len * s * .5 * f, 0, 0, TAU); ctx.fill(); ctx.restore();
        }
        ctx.strokeStyle = body; ctx.lineWidth = s * .17; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s * .5, 0); ctx.lineTo(-s * 1.7, 0); ctx.stroke();
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(s * .62, 0, s * .2, 0, TAU); ctx.fill(); ctx.restore();
    }
    const dragonflies = o => (a, t) => {
        ctx.globalAlpha = a;
        for (let i = 0; i < 3; i++) {
            const j = 6400 + i * 91, tt = t * .4 + R(j) * 10, sg = Math.floor(tt), f = ease(clamp(fr(tt) * 2));
            const x0 = R(j + 1 + sg * 3), y0 = R(j + 2 + sg * 3), x1 = R(j + 4 + sg * 3), y1 = R(j + 5 + sg * 3);
            const x = W * (.3 + lerp(x0, x1, f) * .5), y = H * (.5 + lerp(y0, y1, f) * .22) + Math.sin(t * 5 + i) * U * .2;
            dragonfly(x, y, U * 2.2, Math.atan2((y1 - y0) * H * .22, (x1 - x0) * W * .5), t + i, o.body, o.wing);
        }
    };

    const BX = new Float32Array(4096), BY = new Float32Array(4096), BS = new Float32Array(4096);
    const field = o => (a, t) => {
        const { c0, c1, stalk, ear, kind, k = 7000 } = o;
        ctx.globalAlpha = a;
        const g = ctx.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, c0); g.addColorStop(1, c1);
        ctx.fillStyle = g; ctx.fillRect(0, HZ - 1, W, H - HZ + 1);
        const rows = LAND ? 14 : 13; ctx.lineCap = 'butt';
        for (let r = 0; r < rows; r++) {
            const f = r / (rows - 1), y = HZ + (H * .95 - HZ) * Math.pow(f, 1.5) + U * .7;
            const h = U * (1 + 5.6 * f), sp = Math.max(3.4, h * .45);
            const n = Math.min(4094, Math.ceil(W / sp) + 2), off = R(k + r) * sp;
            const far = h < U * 3, fine = h > U * 4.2;
            if (y - h > bankY(W) + U * 2) break;
            ctx.globalAlpha = a * (.5 + .5 * f); ctx.strokeStyle = stalk; ctx.lineWidth = Math.max(.7, h * .045); ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const x = i * sp - off + (R(k + 40 + r * 131 + i) - .5) * sp * .6;
                const sw = (Math.sin(x / W * 9 - t * 1.3 + r * .45) * .2 + .1) * h;
                const tx = x + sw, ty = y - h * (1 - .3 * Math.abs(sw / h));
                if (!far) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - h * .6, tx, ty); }
                BX[i] = tx; BY[i] = ty; BS[i] = sw / h;
            }
            if (!far) ctx.stroke();
            ctx.strokeStyle = ear; ctx.lineWidth = Math.max(1.1, h * .13); ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const tx = BX[i], ty = BY[i], s = BS[i];
                if (kind === 2) {
                    ctx.moveTo(tx, ty);
                    if (fine) ctx.quadraticCurveTo(tx + h * .2, ty - h * .14, tx + h * .34, ty + h * .2);
                    else ctx.lineTo(tx + h * .3, ty + h * .12);
                } else { ctx.moveTo(tx, ty); ctx.lineTo(tx + s * h * .5, ty - h * .3); }
            }
            ctx.stroke();
            if (kind === 1 && fine) {
                ctx.lineWidth = Math.max(.6, h * .024); ctx.beginPath();
                for (let i = 0; i < n; i++) {
                    const tx = BX[i], ty = BY[i], s = BS[i], ex = tx + s * h * .5, ey = ty - h * .3;
                    ctx.moveTo(tx, ty - h * .05); ctx.lineTo(ex - h * .17, ey - h * .3);
                    ctx.moveTo(tx, ty - h * .05); ctx.lineTo(ex + h * .2, ey - h * .3);
                }
                ctx.stroke();
            }
        }
    };

    const sunRings = o => (a, t) => {
        ctx.strokeStyle = o.col; const n = 6;
        for (let i = 0; i < n; i++) {
            const p = fr(i / n + t * .07), r = SR * (1.25 + p * 5.4);
            ctx.globalAlpha = a * (1 - p) * (1 - p) * .85; ctx.lineWidth = U * (.6 - .44 * p);
            ctx.beginPath(); ctx.arc(SXc, SYc, r, 0, TAU); ctx.stroke();
        }
    };

    const glints = o => (a, t) => {
        const { col = '#fff', n = 60, k = 7400 } = o;
        ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(.8, U * .13);
        for (let i = 0; i < n; i++) {
            const j = k + i * 4, d = R(j), s = Math.pow(Math.max(0, Math.sin(t * (1.2 + R(j + 1) * 2) + R(j + 2) * TAU)), 3);
            if (s < .05) continue;
            const y = HZ + (H * .9 - HZ) * (.04 + .94 * d), x = R(j + 3) * W, w = U * (.5 + 2.6 * d) * s;
            ctx.globalAlpha = a * s * .8; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.stroke();
        }
    };

    const heat = o => (a, t) => {
        ctx.strokeStyle = o.col; ctx.lineWidth = Math.max(.8, U * .15); ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
            const y = H * (.27 + i * .04), amp = U * (.45 + .09 * i), len = W * .26;
            const x0 = fr(R(7700 + i) + t * .022 * (i % 2 ? 1 : -1)) * W * .5 - W * .25;
            ctx.globalAlpha = a * (.2 + .05 * i); ctx.beginPath();
            for (let s = 0; s < 3; s++) {
                const xs = x0 + s * W * .5;
                for (let x = 0; x <= len; x += U * 1.2) {
                    const yy = y + Math.sin((xs + x) / U * .35 + t * 2.2 + i) * amp;
                    x ? ctx.lineTo(xs + x, yy) : ctx.moveTo(xs + x, yy);
                }
            }
            ctx.stroke();
        }
    };

    function cloud(x, y, s, seed) {
        ctx.save(); ctx.beginPath(); ctx.rect(x - s * 3.2, y - s * 4, s * 6.4, s * 4); ctx.clip(); ctx.beginPath();
        for (let i = 0; i < 7; i++) {
            const f = i / 6, r = s * (.42 + .7 * Math.sin(f * PI)) * (.8 + R(seed + i) * .4);
            const cx = x + (f - .5) * s * 3.7, cy = y - r * .3;
            ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU);
        }
        for (let i = 0; i < 3; i++) {
            const r = s * (.6 + R(seed + 10 + i) * .35), cx = x + (i - 1 + (R(seed + 14 + i) - .5) * .5) * s * .95;
            const cy = y - s * (.95 + R(seed + 17 + i) * .5);
            ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU);
        }
        ctx.fill(); ctx.restore();
    }
    const clouds = o => (a, t, ts) => {
        const { col, shade } = o, n = LAND ? 4 : 3;
        for (let i = 0; i < n; i++) {
            const j = 7800 + i * 29, s = U * (3.4 + R(j) * 3.2);
            const x = fr((i + R(j + 1) * .6) / n + ts * .006 * (1 + R(j + 2))) * (W + s * 8) - s * 4;
            const y = H * (.2 + R(j + 3) * .2 + (i % 2) * .06);
            ctx.globalAlpha = a * .55; ctx.fillStyle = shade; cloud(x + s * .3, y + s * .22, s, j);
            ctx.globalAlpha = a * .97; ctx.fillStyle = col; cloud(x, y, s, j);
        }
    };

    const dewGrass = o => (a, t) => {
        const { col, col2, dew, k = 8000 } = o, n = LAND ? 96 : 50, bd = [];
        ctx.lineCap = 'round'; ctx.globalAlpha = a;
        for (let pass = 0; pass < 2; pass++) {
            ctx.strokeStyle = pass ? col : col2; ctx.lineWidth = U * (pass ? .36 : .28); ctx.beginPath();
            for (let i = pass; i < n; i += 2) {
                const j = k + i * 5, x = W * (.02 + R(j) * .96), y = bankY(x) + U * .6;
                const h = U * (4.5 + R(j + 1) * 8), lean = (R(j + 2) - .5) * 2;
                const sw = Math.sin(t * .9 + R(j + 3) * TAU) * U * .25;
                const tx = x + lean * h * .7 + sw, ty = y - h * (1 - .35 * Math.abs(lean));
                const cx = x + lean * h * .15, cy = y - h * .9, q = .55 + R(j + 4) * .4, q1 = 1 - q;
                ctx.moveTo(x, y); ctx.quadraticCurveTo(cx, cy, tx, ty);
                if (R(j + 3) < .55) bd.push(q1 * q1 * x + 2 * q1 * q * cx + q * q * tx, q1 * q1 * y + 2 * q1 * q * cy + q * q * ty + U * .32, U * (.3 + R(j + 4) * .34), R(j + 3));
            }
            ctx.stroke();
        }
        ctx.fillStyle = dew; ctx.beginPath();
        for (let i = 0; i < bd.length; i += 4) { ctx.moveTo(bd[i] + bd[i + 2], bd[i + 1]); ctx.arc(bd[i], bd[i + 1], bd[i + 2], 0, TAU); }
        ctx.fill();
        ctx.strokeStyle = dew; ctx.lineWidth = Math.max(.8, U * .11);
        for (let i = 0; i < bd.length; i += 4) {
            const s = Math.pow(Math.max(0, Math.sin(t * 1.5 + bd[i + 3] * 40)), 10);
            if (s < .05) continue;
            const L = U * 1.7 * s, x = bd[i], y = bd[i + 1];
            ctx.globalAlpha = a * s; ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L); ctx.stroke();
        }
    };

    const nightHalf = o => (a, t) => {
        const { side, col, moon, star = '#fff' } = o;
        const x0 = side > 0 ? SXc : 0, w = side > 0 ? W - SXc : SXc;
        ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(x0, 0, w, H);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = moon; ctx.beginPath();
        ctx.arc(SXc, SYc, SR, side > 0 ? -PI / 2 : PI / 2, side > 0 ? PI / 2 : PI * 1.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = star; const n = LAND ? 46 : 26;
        for (let i = 0; i < n; i++) {
            const j = 2600 + i * 4, x = x0 + R(j) * w, y = R(j + 1) * H * .5, r = U * (.09 + R(j + 2) * .16);
            if (Math.hypot(x - SXc, y - SYc) < SR * 1.3) continue;
            ctx.globalAlpha = a * (.4 + .6 * Math.abs(Math.sin(t * (.6 + R(j + 2) * 1.2) + R(j + 3) * TAU)));
            ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        }
    };

    const chrys = o => (a, t) => {
        const { pet, pet2, pet3, core, stem, k = 8600 } = o;
        const xs = LAND ? [.35, .376, .412, .44, .66, .688, .722, .756] : [.4, .48, .57, .76, .86];
        ctx.globalAlpha = a; ctx.lineCap = 'round';
        const rings = [[26, 1, .085, pet2], [18, .74, .1, pet], [11, .45, .12, pet3]];
        for (let i = 0; i < xs.length; i++) {
            const j = k + i * 6, x = W * xs[i], y0 = bankY(x) + U;
            const h = U * (6 + R(j + 1) * 9), sw = Math.sin(t * .8 + i * 1.3) * U * .3;
            const fx = x + sw + (R(j + 2) - .5) * U * 4.5, fy = y0 - h, r = U * (2.9 + R(j + 3) * 1.9);
            ctx.strokeStyle = stem; ctx.lineWidth = U * .3; ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x, y0 - h * .6, fx, fy); ctx.stroke();
            ctx.fillStyle = stem; ctx.beginPath();
            for (let L = 0; L < 3; L++) { const q = .2 + L * .22, sd = (L + i) % 2 ? 1 : -1; const lx = lerp(x, fx, q * q), ly = y0 - h * q; petal(lx, ly, sd > 0 ? -.5 : PI + .5, U * 2.1, U * .6); }
            ctx.fill();
            ctx.save(); ctx.translate(fx, fy); ctx.scale(1, .84);
            for (const [m, len, wd, c] of rings) {
                ctx.fillStyle = c; ctx.beginPath();
                for (let q = 0; q < m; q++) petal(0, 0, q / m * TAU + len * 3 + i + Math.sin(t * .5 + i) * .04, r * len, r * wd);
                ctx.fill();
            }
            ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r * .12, 0, TAU); ctx.fill(); ctx.restore();
        }
    };

    const frost = o => (a, t) => {
        ctx.fillStyle = o.col; ctx.globalAlpha = a * .85; ctx.beginPath(); const n = Math.floor(W / U * 2.2);
        for (let i = 0; i < n; i++) {
            const x = R(9000 + i) * W, d = R(9500 + i), y = bankY(x) + d * d * U * 4, r = U * (.1 + .17 * R(9900 + i));
            ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill(); ctx.strokeStyle = o.col; ctx.lineWidth = U * .24; ctx.stroke(bankEdge);
        ctx.globalAlpha = a * .5; ctx.lineWidth = Math.max(1, U * .14); ctx.beginPath(); ctx.moveTo(0, HZ); ctx.lineTo(W, HZ); ctx.stroke();
    };

    const iceShore = o => (a, t, ts) => {
        const { col, edge, n = 16, grow = 1 } = o, g = grow ? ease(clamp(.3 + ts / 4)) : 1;
        ctx.globalAlpha = a * .88;
        for (let i = 0; i < n; i++) {
            const j = 9100 + i * 19, near = i % 2, x = R(j) * W;
            const y = near ? bankY(x) - U * (.4 + R(j + 1) * 2.2) : HZ + U * (.4 + R(j + 1) * 2.4);
            const w = U * (5 + R(j + 2) * 13) * g * (near ? 1.3 : .8), hh = w * (near ? .12 : .07);
            for (let pass = 0; pass < 2; pass++) {
                ctx.fillStyle = pass ? col : edge; ctx.beginPath();
                for (let q = 0; q < 9; q++) {
                    const an = q / 9 * TAU, rr = .72 + .28 * R(j + 3 + q);
                    const px = x + Math.cos(an) * w * rr, py = y + Math.sin(an) * hh * rr + (pass ? 0 : U * .2);
                    q ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
                }
                ctx.closePath(); ctx.fill();
            }
        }
    };

    const mist = o => (a, t) => {
        const { col, y = .6, h = .1, al = .6 } = o, yy = H * y, hh = H * h;
        const g = ctx.createLinearGradient(0, yy - hh, 0, yy + hh);
        g.addColorStop(0, rgba(col, 0)); g.addColorStop(.5, rgba(col, al * a)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.fillRect(0, yy - hh, W, hh * 2);
    };

    const reeds = o => (a, t) => {
        const { stem, head, k = 9300 } = o, n = LAND ? 38 : 20;
        ctx.lineCap = 'round'; ctx.globalAlpha = a;
        for (let i = 0; i < n; i++) {
            const j = k + i * 5, cl = R(9400 + (i / 6 | 0)), x = W * fr(cl * .9 + .24 + (R(j) - .5) * .13), y = bankY(x) + U;
            const h = U * (8 + R(j + 1) * 10), sw = (Math.sin(t * 1.1 + R(j + 2) * TAU + x * .004) * .5 + .6) * U * 1.7;
            const tx = x + sw + h * .12, ty = y - h;
            ctx.strokeStyle = stem; ctx.lineWidth = U * .17; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - h * .6, tx, ty);
            ctx.moveTo(lerp(x, tx, .12), y - h * .42); ctx.quadraticCurveTo(x + h * .12, y - h * .62, x + h * .3 + sw, y - h * .5); ctx.stroke();
            const ang = -1.05 + sw / (U * 5);
            ctx.fillStyle = head; ctx.beginPath(); ctx.ellipse(tx + Math.cos(ang) * U * 1.5, ty + Math.sin(ang) * U * 1.5, U * 1.9, U * .46, ang, 0, TAU); ctx.fill();
        }
    };

    const trails = o => (a, t, ts) => {
        const { col } = o, cx = W * (LAND ? .3 : .16), cy = -H * .04;
        const D = Math.hypot(W, H), sw = .1 + ease(clamp(ts / 5)) * .34;
        ctx.strokeStyle = col; ctx.lineCap = 'round';
        for (let i = 0; i < 80; i++) {
            const j = 9700 + i * 3, r = D * (.05 + R(j) * .85), a0 = R(j + 1) * PI + t * .006;
            ctx.globalAlpha = a * (.22 + R(j + 2) * .6); ctx.lineWidth = Math.max(.7, U * (.07 + R(j + 2) * .13));
            ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + sw * (.6 + R(j + 2) * .5)); ctx.stroke();
        }
    };

    const corner = o => (a, t) => {
        const { kind, wood, c1, c2, c3 } = o, B = CB;
        ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.strokeStyle = wood;
        for (const s of B.segs) { ctx.lineWidth = s[6]; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.quadraticCurveTo(s[2], s[3], s[4], s[5]); ctx.stroke(); }
        if (kind === 'plum') {
            ctx.strokeStyle = '#fff';
            for (const s of B.segs) {
                if (s[6] < U * .3) continue;
                const d = s[6] * .42; ctx.lineWidth = s[6] * .5; ctx.beginPath(); ctx.moveTo(s[0], s[1] - d);
                ctx.quadraticCurveTo(s[2], s[3] - d, s[4], s[5] - d); ctx.stroke();
            }
            for (const nd of B.nodes) {
                if (nd[2] < 1 || nd[3] < .24) continue;
                const r = U * (.95 + nd[3] * .75), x = nd[0], y = nd[1];
                if (nd[3] < .44) { ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(x, y, r * .45, 0, TAU); ctx.fill(); }
                else {
                    ctx.fillStyle = c1; ctx.beginPath();
                    for (let q = 0; q < 5; q++) {
                        const an = q / 5 * TAU + nd[3] * 9, px = x + Math.cos(an) * r * .62, py = y + Math.sin(an) * r * .62;
                        ctx.moveTo(px + r * .56, py); ctx.arc(px, py, r * .56, 0, TAU);
                    }
                    ctx.fill();
                    ctx.fillStyle = c3; ctx.beginPath(); ctx.arc(x, y, r * .27, 0, TAU); ctx.fill();
                }
            }
        } else {
            for (const nd of B.nodes) {
                if (nd[2] < 2 || nd[3] < .4) continue;
                const r = U * (1.2 + nd[3] * .8), x = nd[0] + Math.sin(t * 1.2 + nd[3] * 20) * U * .12, y = nd[1] + r * 1.25;
                ctx.strokeStyle = wood; ctx.lineWidth = U * .13; ctx.beginPath(); ctx.moveTo(nd[0], nd[1]); ctx.lineTo(x, y - r * .8); ctx.stroke();
                ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(x, y, r, r * .9, 0, 0, TAU); ctx.fill();
                ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(x - r * .32, y - r * .22, r * .34, r * .22, -.6, 0, TAU); ctx.fill();
                ctx.fillStyle = wood; ctx.beginPath(); ctx.ellipse(x, y - r * .82, r * .46, r * .16, 0, 0, TAU); ctx.fill();
            }
        }
    };

    const icicles = o => (a, t, ts) => {
        const { col, col2 } = o, xm = W * (LAND ? .6 : .42), sp = U * 1.9, n = Math.floor(xm / sp);
        const len = i => U * .5 + U * (1 + Math.pow(R(9800 + i), 2) * 12) * Math.sin(clamp((xm - i * sp) / (W * .25)) * PI / 2);
        for (let p = 0; p < 2; p++) {
            const dx = p ? 0 : U * .3; ctx.fillStyle = p ? col : col2; ctx.globalAlpha = a * (p ? .97 : .9);
            ctx.beginPath(); ctx.moveTo(0, -2);
            for (let i = 0; i < n; i++) {
                const x = i * sp + dx, L = len(i);
                ctx.lineTo(x, U * .5); ctx.quadraticCurveTo(x + sp * .4, U * .9, x + sp * .5, L);
                ctx.quadraticCurveTo(x + sp * .6, U * .9, x + sp, U * .5);
            }
            ctx.lineTo(n * sp + dx, -2); ctx.closePath(); ctx.fill();
        }
        let bi = 0, bl = 0;
        for (let i = 0; i < n; i++) { const L = len(i); if (L > bl) { bl = L; bi = i; } }
        const p = fr(ts * .45), dy = p * p * H * .55;
        ctx.fillStyle = col2; ctx.globalAlpha = a * (1 - p);
        ctx.beginPath(); ctx.ellipse(bi * sp + sp * .5, bl + dy, U * .24, U * .38, 0, 0, TAU); ctx.fill();
    };

    const lantern = o => (a, t) => {
        const p = TREE.lan, x0 = TX + p.x * TS, y0 = TY + p.y * TS, L = U * 2.2, r = U * 2.4;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(x0, y0); ctx.rotate(Math.sin(t * 1.3) * .1);
        ctx.strokeStyle = o.gold; ctx.lineWidth = U * .13; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, L); ctx.stroke();
        ctx.fillStyle = o.red; ctx.beginPath(); ctx.ellipse(0, L + r * .85, r, r * .85, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = o.red2; ctx.lineWidth = U * .11; ctx.beginPath();
        ctx.ellipse(0, L + r * .85, r * .52, r * .85, 0, 0, TAU); ctx.moveTo(0, L); ctx.lineTo(0, L + r * 1.7); ctx.stroke();
        ctx.fillStyle = o.gold; ctx.fillRect(-r * .42, L - r * .06, r * .84, r * .2); ctx.fillRect(-r * .42, L + r * 1.58, r * .84, r * .2);
        ctx.strokeStyle = o.gold; ctx.lineWidth = U * .15; ctx.beginPath();
        for (const d of [-.22, 0, .22]) { ctx.moveTo(d * r, L + r * 1.8); ctx.lineTo(d * r * 1.5, L + r * 3); }
        ctx.stroke(); ctx.restore();
    };

    const cracks = o => (a, t) => {
        ctx.strokeStyle = o.col; ctx.lineWidth = Math.max(.7, U * .1); ctx.lineJoin = 'round'; ctx.globalAlpha = a * .75; ctx.beginPath();
        for (let i = 0; i < (o.n || 10); i++) {
            const j = 10100 + i * 23, d = R(j + 1), dir = R(j + 2) < .5 ? 1 : -1;
            let x = R(j) * W, y = HZ + (H * .9 - HZ) * (.1 + .85 * d);
            ctx.moveTo(x, y);
            for (let q = 0; q < 6; q++) {
                x += dir * U * (2 + R(j + 3 + q) * 5) * (.5 + d); y += (R(j + 10 + q) - .5) * U * 1.7 * (.5 + d); ctx.lineTo(x, y);
                if (q === 2) { ctx.lineTo(x + dir * U * 2 * (.5 + d), y - U * 1.2 * (.5 + d)); ctx.moveTo(x, y); }
            }
        }
        ctx.stroke();
    };

    function leafShape(s) {
        ctx.beginPath(); ctx.moveTo(0, -s * .7);
        ctx.bezierCurveTo(s * .9, -s * 1.3, s * 1.5, -s * .1, 0, s * 1.2);
        ctx.bezierCurveTo(-s * 1.5, -s * .1, -s * .9, -s * 1.3, 0, -s * .7); ctx.fill();
    }
    const bigLeaf = o => (a, t, ts) => {
        const { cols, vein } = o;
        for (let i = 0; i < 4; i++) {
            const j = 10900 + i * 5, sp = .085 + R(j) * .04, p = fr(.12 + i * .24 + ts * sp), w = ts * 1.3 + i * 2.1, sw = Math.sin(w);
            const x = W * (LAND ? .3 + R(j + 2) * .34 : .2 + R(j + 2) * .5) + sw * U * 7;
            const y = lerp(-H * .06, H * .94, p) - Math.abs(Math.cos(w)) * U * 2.4, s = U * (i ? 1.5 + R(j + 3) * .9 : 3.6);
            ctx.save(); ctx.translate(x, y); ctx.rotate(sw * .9 + i); ctx.scale(1, .55 + .45 * Math.cos(ts * 1.9 + i));
            ctx.globalAlpha = a; ctx.fillStyle = cols[i % cols.length]; leafShape(s);
            ctx.strokeStyle = vein; ctx.lineWidth = U * .11; ctx.lineCap = 'round'; ctx.beginPath();
            ctx.moveTo(0, -s * 1.15); ctx.lineTo(0, s * 1.05);
            ctx.moveTo(0, -s * .1); ctx.lineTo(s * .55, -s * .5);
            ctx.moveTo(0, -s * .1); ctx.lineTo(-s * .55, -s * .5); ctx.stroke(); ctx.restore();
        }
    };

    /* ---------- 同一棵桃树走完四季 ---------- */
    const TREE = (() => {
        const rd = rng(41), segs = [], an = [];
        (function grow(x, y, ang, len, w, d) {
            ang = clamp(ang, -2.75, -.38);
            const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, b = (rd() - .5) * .36;
            const cx = (x + x2) / 2 - Math.sin(ang) * len * b, cy = (y + y2) / 2 + Math.cos(ang) * len * b;
            segs.push({ x, y, cx, cy, x2, y2, w, d, hz: Math.abs(Math.cos(ang)) });
            if (d >= 2) an.push({ x: cx, y: cy, d });
            if (d >= 6) { an.push({ x: x2, y: y2, d: 7 }); return; }
            const n = d === 0 ? 2 : (rd() < .3 ? 3 : 2);
            for (let i = 0; i < n; i++) grow(x2, y2, ang + (i - (n - 1) / 2) * (.62 + rd() * .3) + (rd() - .5) * .3, len * (.66 + rd() * .17), w * .64, d + 1);
        })(0, 0, -PI / 2 + .2, .3, .06, 0);
        let top = 0; for (const a of an) top = Math.min(top, a.y);
        const k = 1 / (-top + .05);
        for (const s of segs) { s.x *= k; s.y *= k; s.cx *= k; s.cy *= k; s.x2 *= k; s.y2 *= k; s.w *= k; }
        const blobs = [], flowers = [], buds = []; let lan = { x: 0, y: -.5 };
        for (const a of an) {
            a.x *= k; a.y *= k;
            const nb = a.d >= 5 ? 2 : a.d >= 3 ? 2 : 1;
            for (let i = 0; i < nb; i++) {
                const y = a.y + (rd() - .62) * .08, v = rd() * .5 - y * .6;
                blobs.push({ x: a.x + (rd() - .5) * .1, y, r: .03 + rd() * .036, th: rd(), c: rd(), ph: rd() * TAU, sh: v < .42 ? 0 : v < .74 ? 1 : 2 });
            }
            const nf = a.d >= 4 ? 2 : 1;
            for (let i = 0; i < nf; i++) flowers.push({ x: a.x + (rd() - .5) * .055, y: a.y + (rd() - .5) * .055, r: .0095 + rd() * .009, th: rd(), c: rd() < .55 ? 0 : 1, ph: rd() * TAU });
            if (a.d >= 5) buds.push({ x: a.x, y: a.y, r: .0055 + rd() * .004, th: rd() });
            if (a.d === 7 && a.x > lan.x) lan = { x: a.x, y: a.y };
        }
        const byD = []; for (const s of segs) (byD[s.d] = byD[s.d] || []).push(s);
        const s0 = segs[0], q = clamp(.2 / -s0.y2);
        const fx = 2 * (1 - q) * q * s0.cx + q * q * s0.x2, fy = 2 * (1 - q) * q * s0.cy + q * q * s0.y2;
        return { segs, byD, blobs, flowers, buds, lan, fl: { x: fx, y: fy, w: s0.w * .42 } };
    })();

    function drawTree(t) {
        const s = TS, bud = num(BUD), bloom = num(BLOOM), leaf = num(LEAF), mx = num(MIX), sn = num(SNOW);
        ctx.save(); ctx.translate(TX, TY); ctx.lineCap = 'round'; ctx.strokeStyle = col(DK);
        for (const g of TREE.byD) {
            if (!g) continue;
            ctx.lineWidth = Math.max(1, g[0].w * s); ctx.beginPath();
            for (const q of g) { ctx.moveTo(q.x * s, q.y * s); ctx.quadraticCurveTo(q.cx * s, q.cy * s, q.x2 * s, q.y2 * s); }
            ctx.stroke();
        }
        ctx.fillStyle = col(DK); ctx.beginPath();
        { const f = TREE.fl, lx = (f.x - f.w) * s, rx = (f.x + f.w) * s, ty = f.y * s;
          ctx.moveTo(-.09 * s, .024 * s); ctx.quadraticCurveTo(lx * .5 - .02 * s, .004 * s, lx, ty);
          ctx.lineTo(rx, ty); ctx.quadraticCurveTo(rx * .6 + .03 * s, 0, .125 * s, .024 * s);
          ctx.quadraticCurveTo(.018 * s, .052 * s, -.09 * s, .024 * s); ctx.fill(); }
        if (sn > .01) {
            ctx.strokeStyle = '#fff'; ctx.globalAlpha = clamp(sn * 1.6);
            for (const g of TREE.byD) {
                if (!g || g[0].d > 5) continue;
                const w = g[0].w * s, d = w * .36; ctx.lineWidth = Math.max(1.2, w * (.3 + .4 * sn)); ctx.beginPath();
                for (const q of g) {
                    if (q.hz < .34 || q.d === 0) continue;
                    ctx.moveTo(q.x * s, q.y * s - d); ctx.quadraticCurveTo(q.cx * s, q.cy * s - d, q.x2 * s, q.y2 * s - d);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        if (bud > .01) {
            ctx.fillStyle = col(LB); ctx.beginPath();
            for (const b of TREE.buds) { if (b.th > bud) continue; const r = Math.max(1.3, b.r * s); ctx.moveTo(b.x * s + r, b.y * s); ctx.arc(b.x * s, b.y * s, r, 0, TAU); }
            ctx.fill();
        }
        if (leaf > .01) {
            const rs = .3 + .7 * leaf, st = [shade(LA, -.2), shade(LB, -.15), col(LA), col(LB), shade(LA, .16), shade(LB, .13)];
            for (let g = 0; g < 6; g++) {
                const sh = g >> 1, cb = g & 1; ctx.fillStyle = st[g]; ctx.beginPath();
                for (const b of TREE.blobs) {
                    if (b.sh !== sh || b.th > leaf || (b.c < mx ? 1 : 0) !== cb) continue;
                    const x = (b.x + Math.sin(t * 1.2 + b.ph) * .005) * s, y = (b.y + Math.cos(t * .9 + b.ph) * .004) * s, r = b.r * s * rs;
                    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
                }
                ctx.fill();
            }
        }
        if (bloom > .01) {
            for (let c = 0; c < 2; c++) {
                ctx.fillStyle = c ? '#fbd3db' : '#f0809d'; ctx.beginPath();
                for (const f of TREE.flowers) {
                    if (f.c !== c || f.th > bloom) continue;
                    const x = (f.x + Math.sin(t * 1.3 + f.ph) * .003) * s, y = f.y * s, r = f.r * s;
                    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
                }
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function makeBranch(seed, x, y, ang, len, w, depth) {
        const rd = rng(seed), segs = [], nodes = [];
        (function g(x, y, ang, len, w, d) {
            const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, b = (rd() - .5) * .3;
            const cx = (x + x2) / 2 - Math.sin(ang) * len * b, cy = (y + y2) / 2 + Math.cos(ang) * len * b;
            segs.push([x, y, cx, cy, x2, y2, w]); nodes.push([cx, cy, d, rd()]); nodes.push([x2, y2, d, rd()]);
            if (d >= depth) return;
            for (let i = 0; i < 2; i++) g(x2, y2, ang + (i ? 1 : -1) * (.3 + rd() * .42) + (rd() - .4) * .2, len * (.62 + rd() * .2), w * .62, d + 1);
        })(x, y, ang, len, w, 0);
        return { segs, nodes };
    }

    /* ---------- 二十四节气：配色、景物、三候 ---------- */
    const D = [
        { n: '立春', s: '春', d: '二月四日前后', h: ['东风解冻', '蛰虫始振', '鱼陟负冰'], c: ['#c9d9d4', '#f2eedc', '#a9c0b8', '#7fa193', '#56705f', '#c3d6d3', '#9dbcbc', '#2a3a33', '#f4b99a', '#9ac46a', '#c6dc72'], ink: '#25352e', sun: [6.2, .95, .55, 0], refl: .45, tree: [.6, 0, 0, 0, 0], L: { gnd: [floes({ col: '#f6faf8', edge: '#86a9ad' })], fx: [wind({ col: '#ffffff', y0: .3, y1: .72 })] } },
        { n: '雨水', s: '春', d: '二月十九日前后', h: ['獭祭鱼', '候雁北', '草木萌动'], c: ['#b4c8c6', '#e4e8da', '#9bb5b0', '#74968f', '#476a62', '#b3cac7', '#86aaa8', '#223632', '#f6f2e4', '#9ccc6c', '#c2e07c'], ink: '#1f3330', sun: [6, .5, .4, 0], refl: .15, tree: [1, 0, 0, 0, 0], L: { gnd: [mist({ col: [236, 242, 236], y: .6, h: .09, al: .55 }), ripples({ col: '#f4f8f5', n: 16 })], fx: [rain({ n: 190, col: '#f5f9f6', al: .6, len: 2.6, slant: .2 })] } },
        { n: '惊蛰', s: '春', d: '三月六日前后', h: ['桃始华', '仓庚鸣', '鹰化为鸠'], c: ['#38375a', '#c6adc0', '#7d789b', '#5a5880', '#2f3152', '#a79fbe', '#6f6c96', '#1b1a30', '#efe2ea', '#8fc27a', '#b9d98a'], ink: '#f8eef4', sun: [5.8, .3, .25, 0], refl: .2, tree: [1, .34, 0, 0, 0], L: { air: [storm({ cols: ['#4a4870', '#2a2946'] })], fx: [rain({ n: 70, col: '#e9dcec', al: .4, len: 3.4, slant: .3, sp: 1.6, k: 300 }), risers({ col: '#f7d774' }), lightning({ col: '#fff7cf' })] } },
        { n: '春分', s: '春', d: '三月二十一日前后', h: ['玄鸟至', '雷乃发声', '始电'], c: ['#cbe4e3', '#f8edd7', '#a8cdbd', '#7fb59a', '#4a7f63', '#c4e2dd', '#93c4b8', '#2b4034', '#f2683c', '#9fce72', '#c9dd86'], ink: '#f5f0e0', sun: [7.2, 1, .6, 0], refl: .7, tree: [1, 1, 0, 0, 0], L: { fx: [swallows({ col: '#20302c', n: 6, xm: .74 }), nightHalf({ side: 1, col: '#4c57a0', moon: '#f4edd4' })] } },
        { n: '清明', s: '春', d: '四月五日前后', h: ['桐始华', '田鼠化为鴽', '虹始见'], c: ['#cbe2d2', '#f4f2dc', '#a6cfa9', '#72b081', '#3d7a57', '#c0e0d2', '#8ac4ae', '#1f3b2c', '#f8dc86', '#8fc866', '#c2e27e'], ink: '#1e3b2c', sun: [6.4, .8, .5, 0], refl: .4, tree: [1, .3, .42, .5, 0], L: { gnd: [mist({ col: [244, 246, 232], y: .6, h: .1, al: .6 })], fx: [flakes({ n: 28, cols: ['#f29ab0', '#fbd3db'], sz: .5, sp: .07 }), willow({ col: '#86c25c', col2: '#5c8a47' }), kite({ col: '#e5482f', line: '#1f3b2c' })] } },
        { n: '谷雨', s: '春', d: '四月二十日前后', h: ['萍始生', '鸣鸠拂其羽', '戴胜降于桑'], c: ['#a4c6b6', '#dfe7c8', '#86b996', '#569a6c', '#2f6a4b', '#a5cdb9', '#6aac92', '#183326', '#f0f2da', '#62b254', '#a4d66a'], ink: '#173326', sun: [6, .4, .3, 0], refl: .1, tree: [0, 0, .72, .5, 0], L: { gnd: [duckweed({ cols: ['#3a8a4a', '#9bd65e'] }), ripples({ col: '#eaf5e6', n: 9, k: 4500 })], bank: [sprouts({ col: '#b9e86c' })], fx: [rain({ n: 250, col: '#f1f8ee', al: .62, len: 3.8, slant: .14, sp: 1.5, k: 100 })] } },
        { n: '立夏', s: '夏', d: '五月六日前后', h: ['蝼蝈鸣', '蚯蚓出', '王瓜生'], c: ['#a4dbd8', '#f6f1c6', '#7cc5a6', '#3fa67b', '#1f7652', '#a5dccd', '#54b6a0', '#0f3a2d', '#ffb52b', '#3aa452', '#86d05a'], ink: '#0f3a2d', sun: [7, 1, .65, 0], refl: .75, tree: [0, 0, .9, .4, 0], L: { gnd: [glints({ n: 50 }), lotus({ stage: 0, leaf: '#2a946a', leaf2: '#8fdc8e', stem: '#1f6f4f' })], fx: [dragonflies({ body: '#d0412c', wing: 'rgba(255,255,255,.6)' })] } },
        { n: '小满', s: '夏', d: '五月二十一日前后', h: ['苦菜秀', '靡草死', '麦秋至'], c: ['#b6e0d0', '#f7f1bc', '#96cc8a', '#68b25c', '#3a8438', '#b9db6c', '#5f9e36', '#1d3d17', '#ffc83a', '#379640', '#7cc653'], ink: '#1d3d17', sun: [7.4, 1, .7, 0], refl: 0, tree: [0, 0, 1, .35, 0], L: { gnd: [field({ c0: '#bfdf70', c1: '#5c9c34', stalk: '#4c8e2c', ear: '#e0ee84', kind: 0 })], fx: [wind({ col: '#fbfde6', y0: .64, y1: .84, n: 6, k: 10800, al: .5 })] } },
        { n: '芒种', s: '夏', d: '六月六日前后', h: ['螳螂生', '鵙始鸣', '反舌无声'], c: ['#f0d67e', '#fdf3cb', '#b7c97c', '#8aac52', '#55782c', '#f5d665', '#d99a22', '#3a2a08', '#ff8a1c', '#3f9440', '#7dbb48'], ink: '#3a2a08', sun: [7.8, 1, .75, 0], refl: 0, tree: [0, 0, 1, .3, 0], L: { gnd: [field({ c0: '#f7da6a', c1: '#d6951e', stalk: '#bf821a', ear: '#fff0a4', kind: 1, k: 7300 })], fx: [swallows({ col: '#3a2a08', n: 3, k: 3200, xm: .74 })] } },
        { n: '夏至', s: '夏', d: '六月二十一日前后', h: ['鹿角解', '蜩始鸣', '半夏生'], c: ['#35b3cc', '#fbf0a0', '#5fc2a6', '#22987a', '#0e6b55', '#8fdcd0', '#25a5a8', '#06352e', '#fffbe6', '#1c8a4c', '#5fc04f'], ink: '#06352e', sun: [9.6, 1, .95, 0], refl: 1, tree: [0, 0, 1, .3, 0], L: { air: [sunRings({ col: '#fff6bd' })], gnd: [glints({ n: 90, k: 7500 })] } },
        { n: '小暑', s: '夏', d: '七月七日前后', h: ['温风至', '蟋蟀居壁', '鹰始挚'], c: ['#f2b46c', '#fde9b8', '#b3c88c', '#7aad6b', '#3a7a4e', '#f0dba6', '#94c5a0', '#24401f', '#ff6a33', '#2d8c48', '#6fbd52'], ink: '#3a2710', sun: [8.4, 1, .8, 0], refl: .8, tree: [0, 0, 1, .3, 0], L: { air: [heat({ col: '#fffaf0' })], gnd: [lotus({ stage: 1, leaf: '#2b8a5e', leaf2: '#5cba78', flower: '#f0608a', flower2: '#fcc4d2', stem: '#1f6a4a', k: 6200 })] } },
        { n: '大暑', s: '夏', d: '七月二十三日前后', h: ['腐草为萤', '土润溽暑', '大雨时行'], c: ['#0f1c38', '#35546c', '#1f3c50', '#173142', '#0b1c27', '#24455e', '#10263a', '#050d15', '#f4e7b0', '#143a32', '#1d4e42'], ink: '#ecf4d2', sun: [5.4, .95, .4, 0], refl: .6, tree: [0, 0, 1, .4, 0], L: { sky: [stars({ n: 70, col: '#eaf2ff' })], fx: [fireflies({ col: [214, 246, 110] })] } },
        { n: '立秋', s: '秋', d: '八月八日前后', h: ['凉风至', '白露降', '寒蝉鸣'], c: ['#a2d0e4', '#f7edc8', '#8fbba0', '#689a72', '#3b6b4b', '#add5da', '#6ea9ae', '#1c3a34', '#ffb245', '#4c9846', '#e6bd3a'], ink: '#1c3a3a', sun: [7.2, 1, .65, 0], refl: .75, tree: [0, 0, 1, .13, 0], L: { gnd: [glints({ n: 40, k: 7600 })], fx: [wind({ col: '#ffffff', y0: .25, y1: .7, dir: -1, k: 10900 }), bigLeaf({ cols: ['#dba621', '#c98a1e', '#e6c44e'], vein: '#7a5512' })] } },
        { n: '处暑', s: '秋', d: '八月二十三日前后', h: ['鹰乃祭鸟', '天地始肃', '禾乃登'], c: ['#74bbe0', '#f6eac0', '#9db98a', '#7c9c5a', '#56722f', '#ddd070', '#a89a30', '#22361e', '#ffa42a', '#58983f', '#dcb83a'], ink: '#17323a', sun: [7, 1, .65, 0], refl: 0, tree: [0, 0, .96, .28, 0], L: { air: [clouds({ col: '#fdfaf0', shade: '#b9d3df' })], gnd: [field({ c0: '#e2d472', c1: '#a6982e', stalk: '#8c8c28', ear: '#f6da68', kind: 2, k: 7600 })] } },
        { n: '白露', s: '秋', d: '九月八日前后', h: ['鸿雁来', '玄鸟归', '群鸟养羞'], c: ['#b6c7e2', '#f6e6da', '#a2b3cc', '#7d92ad', '#4a6280', '#c5d4e4', '#92a9c4', '#1f2c44', '#ffd2a8', '#6c9852', '#dcc058'], ink: '#1f2c44', sun: [6.4, .95, .7, 0], refl: .6, tree: [0, 0, .9, .5, 0], L: { air: [geese({ n: 7, col: '#33415c', yy: .25, sz: .7, st: .22 })], gnd: [mist({ col: [250, 246, 244], y: .6, h: .1, al: .7 })], bank: [dewGrass({ col: '#6f8f78', col2: '#3c5560', dew: '#ffffff' })] } },
        { n: '秋分', s: '秋', d: '九月二十三日前后', h: ['雷始收声', '蛰虫坯户', '水始涸'], c: ['#eed29a', '#faeed2', '#d7ae72', '#b88240', '#6a4a28', '#edd5a5', '#c69a5c', '#3a2610', '#f08a24', '#e09a1c', '#f4cf4f'], ink: '#3a2610', sun: [7.2, 1, .6, 0], refl: .7, tree: [0, 0, .86, .5, 0], L: { fx: [nightHalf({ side: -1, col: '#48528e', moon: '#f7f0d6' }), flakes({ n: 80, cols: ['#f29a0e', '#ffd44e'], sz: .5, sp: .05, k: 1200 })] } },
        { n: '寒露', s: '秋', d: '十月八日前后', h: ['鸿雁来宾', '雀入大水为蛤', '菊有黄华'], c: ['#bfcbda', '#f3e6cd', '#a7a6b8', '#877f96', '#554b60', '#c2cad8', '#8e96ad', '#2a2433', '#f4bd70', '#d67e28', '#ebb63a'], ink: '#2a2433', sun: [6.6, 1, .6, 0], refl: .6, tree: [0, 0, .66, .4, 0], L: { air: [geese({ n: 11, col: '#342d40', yy: .2, sz: 1, st: .26 })], bank: [chrys({ pet: '#fbcf2c', pet2: '#e9990f', pet3: '#fff1a6', core: '#d98a12', stem: '#42603f' })], fx: [wind({ col: '#ffffff', y0: .3, y1: .7, n: 5, k: 11000, al: .45 })] } },
        { n: '霜降', s: '秋', d: '十月二十三日前后', h: ['豺乃祭兽', '草木黄落', '蛰虫咸俯'], c: ['#e0c4ae', '#f9ecda', '#c6a28e', '#ab6c58', '#683a35', '#e6cfc0', '#c49c90', '#3d1c1a', '#ee5a3a', '#c62f1e', '#ea762a'], ink: '#3d1c1a', sun: [6.4, 1, .6, 0], refl: .6, tree: [0, 0, .44, .35, 0], L: { bank: [frost({ col: '#fffcf6' })], fx: [flakes({ n: 24, cols: ['#c62f1e', '#ea762a', '#a3281b'], sz: .95, sp: .075, k: 1700 }), corner({ kind: 'persimmon', wood: '#3d1c1a', c1: '#f0871c', c2: '#f9bb62' })] } },
        { n: '立冬', s: '冬', d: '十一月七日前后', h: ['水始冰', '地始冻', '雉入大水为蜃'], c: ['#b6bec5', '#ece5d8', '#a5aab0', '#848a93', '#555b66', '#c6cdd2', '#9faab4', '#24282f', '#f5c79a', '#8a6a3a', '#a8834a'], ink: '#24282f', sun: [6, .9, .5, 0], refl: .45, tree: [0, 0, .07, .5, 0], L: { gnd: [mist({ col: [240, 238, 232], y: .61, h: .08, al: .55 }), iceShore({ col: '#f1f5f6', edge: '#8996a3' })], fx: [flakes({ n: 7, cols: ['#8a6a3a', '#a8834a'], sz: .8, sp: .06, k: 1900 })] } },
        { n: '小雪', s: '冬', d: '十一月二十二日前后', h: ['虹藏不见', '天气上升', '闭塞成冬'], c: ['#a8b7c7', '#e8e8e3', '#9eabb9', '#7d8b9b', '#4f5d6d', '#b9c6d1', '#8f9eae', '#1f2933', '#f2e8da', '#8a6a3a', '#a8834a'], ink: '#1f2933', sun: [5.8, .5, .35, 0], refl: .15, tree: [0, 0, 0, .5, .22], L: { gnd: [iceShore({ col: '#eef3f6', edge: '#7e8d9c', n: 12, grow: 0 })], bank: [reeds({ stem: '#cdb88c', head: '#f3e8cf' })], fx: [snow({ n: 120, sz: .3, sp: .065 })] } },
        { n: '大雪', s: '冬', d: '十二月七日前后', h: ['鹖鴠不鸣', '虎始交', '荔挺出'], c: ['#78899f', '#c3ccd6', '#a9b7c6', '#d5dde5', '#f3f5f7', '#eef2f5', '#d3dce4', '#1c2733', '#e8edf1', '#8a6a3a', '#a8834a'], ink: '#141d27', sun: [5.6, .35, .2, 0], refl: 0, tree: [0, 0, 0, .5, 1], L: { fx: [snow({ n: 320, sz: .62, sp: .1, k: 2000 })] } },
        { n: '冬至', s: '冬', d: '十二月二十二日前后', h: ['蚯蚓结', '麋角解', '水泉动'], c: ['#0d1433', '#c7797a', '#2b2a4c', '#1e2040', '#0f1228', '#4a3f66', '#1a1d3a', '#06081a', '#ff6b3d', '#8a6a3a', '#a8834a'], ink: '#f4e7cd', sun: [5.4, 1, 1, .9], refl: .85, tree: [0, 0, 0, .5, .5], L: { sky: [trails({ col: '#f8dc92' })] } },
        { n: '小寒', s: '冬', d: '一月六日前后', h: ['雁北乡', '鹊始巢', '雉始雊'], c: ['#bccde1', '#f1f2f3', '#b0c0d3', '#8fa4bd', '#5d7694', '#d5dfea', '#a8bad0', '#1b2a40', '#f8d8c0', '#8a6a3a', '#a8834a'], ink: '#1b2a40', sun: [5.8, .85, .5, 0], refl: .2, tree: [0, 0, 0, .5, .45], L: { gnd: [cracks({ col: '#8fa6c0', n: 6 })], fx: [snow({ n: 70, sz: .3, sp: .06, k: 2400 }), corner({ kind: 'plum', wood: '#2a2030', c1: '#d81e4a', c2: '#a3123a', c3: '#ffd66b' })] } },
        { n: '大寒', s: '冬', d: '一月二十日前后', h: ['鸡始乳', '征鸟厉疾', '水泽腹坚'], c: ['#cfdbe8', '#f7f3ea', '#c0cbd8', '#a0aec0', '#77879b', '#dde6ee', '#b7c6d6', '#1a2433', '#f9e0cc', '#8a6a3a', '#a8834a'], ink: '#1a2433', sun: [6, .9, .5, 0], refl: .25, tree: [0, 0, 0, .5, .7], L: { gnd: [cracks({ col: '#8094ab', n: 12 })], fx: [lantern({ red: '#d92a26', red2: '#a81c1c', gold: '#f2c14e' }), icicles({ col: '#ffffff', col2: '#94b1ce' }), snow({ n: 36, sz: .26, sp: .05, k: 2700 })] } }
    ];

    const SC = D.map((d, i) => {
        const lon = (315 + i * 15) % 360, p = new Float32Array(NP);
        d.c.forEach((h, k) => { const c = hex(h); p[k * 3] = c[0]; p[k * 3 + 1] = c[1]; p[k * 3 + 2] = c[2]; });
        const o = NC * 3;
        p[o + SUNR] = d.sun[0]; p[o + CORE] = d.sun[1]; p[o + HALO] = d.sun[2]; p[o + DY] = d.sun[3];
        p[o + ALT] = (Math.sin(lon * PI / 180) + 1) / 2; p[o + REFL] = d.refl;
        p[o + BUD] = d.tree[0]; p[o + BLOOM] = d.tree[1]; p[o + LEAF] = d.tree[2]; p[o + MIX] = d.tree[3]; p[o + SNOW] = d.tree[4];
        const bk = hex(d.c[BK]), lum = bk[0] * .3 + bk[1] * .59 + bk[2] * .11;
        return { ...d, lon, P: p, al: 0, t0: 0, strip: lum > 150 ? '#1c2733' : '#f6f1e3' };
    });

    /* ---------- 容器尺寸与山水骨架 ---------- */
    function resize() {
        if (!cv || !host) return;
        const rect = host.getBoundingClientRect();
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(1, Math.round(rect.width));
        H = Math.max(1, Math.round(rect.height));
        cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
        U = Math.min(W, H) / 100; LAND = W / H > 1.15; HZ = H * .62; SX = W * (LAND ? .5 : .27); BAND = Math.max(H * .09, 62);
        const XN = 1 / Math.max(W, H * .9);
        far0Y = x => { const v = x * XN; return H * (.57 - .2 * (.52 * pk(v * 1.25 + .25) + .33 * pk(v * 2.9 + .8) + .15 * pk(v * 6.1 + .1))); };
        farY = x => { const v = x * XN; return H * (.58 - .165 * (.55 * pk(v * 1.7 + .62) + .3 * pk(v * 3.9 + .2) + .15 * pk(v * 8.3 + .5))); };
        midY = x => { const v = x * XN; return H * (.618 - .08 * (.5 + .5 * (.6 * Math.sin(v * 7.1 + 1.1) + .3 * Math.sin(v * 15.3 + 2.9) + .1 * Math.sin(v * 33 + .3)))); };
        bankY = x => H - BAND - H * .115 * (1 - ease(clamp(x / (W * .62)))) + Math.sin(x * .013) * U * .25;
        const build = (fy, base) => {
            const p = new Path2D(); let top = H; p.moveTo(-2, base);
            for (let x = -2; x <= W + 4; x += 4) { const y = fy(x); if (y < top) top = y; p.lineTo(x, y); }
            p.lineTo(W + 4, base); p.closePath(); return [p, top];
        };
        [far0P, far0Top] = build(far0Y, HZ + 1); [farP, farTop] = build(farY, HZ + 1);
        [midP, midTop] = build(midY, HZ + 1); [bankP] = build(bankY, H + 2);
        bankEdge = new Path2D(); bankEdge.moveTo(-2, bankY(-2));
        for (let x = 2; x <= W + 4; x += 4) bankEdge.lineTo(x, bankY(x));
        TX = W * (LAND ? .165 : .23); TY = bankY(TX) + U * .6; TS = Math.min(H * .5, W * .85);
        SYlow = Math.min(far0Y(SX), farY(SX), midY(SX));
        CB = makeBranch(77, -U * 2, H * .07, .2, LAND ? W * .14 : W * .1, U * 1.5, 4);
        {
            const y0 = H * .07, lim = H * .24; let my = 0;
            for (const nd of CB.nodes) my = Math.max(my, nd[1]);
            if (my > lim) {
                const f = (lim - y0) / (my - y0), sq = y => y > y0 ? y0 + (y - y0) * f : y;
                for (const g of CB.segs) { g[1] = sq(g[1]); g[3] = sq(g[3]); g[5] = sq(g[5]); }
                for (const nd of CB.nodes) nd[1] = sq(nd[1]);
            }
        }
    }

    /* ---------- 逐帧绘制 ---------- */
    function layers(slot, t) {
        for (let i = 0; i < 24; i++) {
            const S = SC[i];
            if (S.al <= .002) continue;
            const L = S.L[slot];
            if (!L) continue;
            const a = ease(S.al), ts = t - S.t0;
            for (let k = 0; k < L.length; k++) { L[k](a, t, ts); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        }
    }
    function hill(p, c0, c1, top) {
        const g = ctx.createLinearGradient(0, top, 0, HZ);
        g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fill(p);
    }

    function draw(t) {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        let g = ctx.createLinearGradient(0, 0, 0, HZ);
        g.addColorStop(0, col(S0)); g.addColorStop(.55, cmix(S0, S1, .4)); g.addColorStop(1, col(S1));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, HZ + 2);
        SR = U * num(SUNR); SXc = SX; SYc = lerp(SYlow - SR * .9, H * .14, num(ALT)) + num(DY) * SR;
        layers('sky', t);
        const hl = num(HALO);
        if (hl > .01) {
            g = ctx.createRadialGradient(SXc, SYc, SR * .5, SXc, SYc, SR * 3.8);
            g.addColorStop(0, col(SUN, hl * .6)); g.addColorStop(1, col(SUN, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(SXc, SYc, SR * 3.8, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = col(SUN, num(CORE)); ctx.beginPath(); ctx.arc(SXc, SYc, SR, 0, TAU); ctx.fill();
        layers('air', t);
        hill(far0P, cmix(H1, S1, .55), cmix(H1, S1, .9), far0Top);
        hill(farP, col(H1), cmix(H1, S1, .62), farTop);
        hill(midP, col(H2), cmix(H2, W0, .5), midTop);
        g = ctx.createLinearGradient(0, HZ, 0, H);
        g.addColorStop(0, col(W0)); g.addColorStop(1, col(W1)); ctx.fillStyle = g; ctx.fillRect(0, HZ, W, H - HZ);
        const rf = num(REFL);
        if (rf > .02) {
            ctx.save(); ctx.beginPath(); ctx.rect(0, HZ, W, H - HZ); ctx.clip(); ctx.translate(0, HZ * 1.75); ctx.scale(1, -.75);
            ctx.globalAlpha = .16 + .14 * rf; ctx.fillStyle = col(H1); ctx.fill(farP);
            ctx.globalAlpha = .2 + .2 * rf; ctx.fillStyle = col(H2); ctx.fill(midP); ctx.restore();
            ctx.fillStyle = col(SUN); const n = 16, st = (H - HZ) * .045;
            for (let k = 0; k < n; k++) {
                const w = SR * (1.5 - k * .07) * (.55 + .45 * Math.sin(t * 1.7 + k * 1.3)), y = HZ + st * (k + .6);
                ctx.globalAlpha = rf * (1 - k / n) * .6; ctx.fillRect(SXc - w, y, w * 2, Math.max(1, st * .24));
            }
            ctx.globalAlpha = 1;
        }
        layers('gnd', t);
        g = ctx.createLinearGradient(0, H - BAND - H * .12, 0, H);
        g.addColorStop(0, col(BK)); g.addColorStop(1, shade(BK, -.12)); ctx.fillStyle = g; ctx.fill(bankP);
        layers('bank', t);
        drawTree(t);
        layers('fx', t);
    }

    /* ---------- 页面控制器 ---------- */
    let cur = 0, clock = 0, wall = 0, tGo = 0, last = 0, rafId = 0, running = false, visible = true;
    let textSwap = 0;
    let metaMap = {};
    let onChange = null;

    const $ = id => document.getElementById(id);
    const nameEl = $('scene_name');
    const sealEl = $('scene_seal');
    const houEl = $('scene_hou');
    const metaEl = $('scene_meta');
    const idxEl = $('scene_idx');
    const textEl = $('scene_text');

    function setText(i) {
        const S = SC[i];
        const info = metaMap[S.n] || {};
        nameEl.innerHTML = '<span>' + S.n[0] + '</span><span>' + S.n[1] + '</span>';
        sealEl.textContent = S.s;
        houEl.innerHTML = S.h.map((h, k) =>
            '<li><small>' + ['初候', '二候', '三候'][k] + '</small>' + h + '</li>').join('');
        metaEl.innerHTML = '<span>' + (info.date || S.d) + '</span>' +
            (info.lunarDate ? '<span>农历 ' + info.lunarDate + '</span>' : '');

        /* 每个节气的字色由长卷原始配色决定，题字始终位于同侧天空区域 */
        host.style.setProperty('--scene-ink', S.ink);
        host.style.setProperty('--scene-strip', S.strip);

        Array.prototype.forEach.call(idxEl.children, (b, k) => {
            if (k === i) b.setAttribute('aria-current', 'true');
            else b.removeAttribute('aria-current');
        });

        /* 窄屏索引可横向滚动：让当前节气停在可视区中间 */
        const active = idxEl.children[i];
        if (active && idxEl.scrollWidth > idxEl.clientWidth + 4) {
            const left = active.offsetLeft - (idxEl.clientWidth - active.offsetWidth) / 2;
            idxEl.scrollTo({ left: Math.max(0, left), behavior: RM ? 'auto' : 'smooth' });
        }
    }

    function go(i) {
        i = ((i % 24) + 24) % 24;
        if (i === cur) return;
        F.set(P); cur = i; tGo = wall; SC[i].t0 = clock;
        textEl.classList.add('out');
        clearTimeout(textSwap);
        textSwap = setTimeout(() => {
            setText(i); void textEl.offsetWidth; textEl.classList.remove('out');
        }, 160);
        if (onChange) onChange(i, SC[i]);
    }

    function frame(ms) {
        if (!running) return;
        const now = ms / 1000, dt = Math.min(.05, Math.max(0, now - last));
        last = now; wall += dt; if (!RM) clock += dt;
        const e = ease(clamp((wall - tGo) / 1.1)), T = SC[cur].P;
        for (let i = 0; i < NP; i++) P[i] = F[i] + (T[i] - F[i]) * e;
        for (let i = 0; i < 24; i++) {
            const S = SC[i], tg = i === cur ? 1 : 0;
            S.al += clamp(tg - S.al, -dt / 1.1, dt / 1.1);
        }
        draw(clock);
        rafId = requestAnimationFrame(frame);
    }

    function start() {
        if (running || !cv) return;
        running = true; last = performance.now() / 1000;
        rafId = requestAnimationFrame(frame);
    }
    function stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
    }

    SC.forEach((S, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = '<span>' + S.n + '</span>';
        b.setAttribute('aria-label', S.n);
        b.addEventListener('click', () => go(i));
        idxEl.appendChild(b);
    });

    cv = $('scene_canvas');
    host = $('scene_hero');
    if (!cv || !host) return;
    ctx = cv.getContext('2d', { alpha: false });
    if (!ctx) return;

    resize();
    P.set(SC[cur].P); F.set(P); SC[cur].al = 1; tGo = wall = 0;
    setText(cur);
    textEl.classList.add('in');
    start();

    const ro = window.ResizeObserver ? new ResizeObserver(() => {
        resize(); draw(clock);
    }) : null;
    if (ro) ro.observe(host);

    const io = window.IntersectionObserver ? new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (visible && !document.hidden) start(); else stop();
    }, { threshold: 0 }) : null;
    if (io) io.observe(host);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop();
        else if (visible) start();
    });

    window.SolarTermScene = {
        setIndex: go,
        getIndex: () => cur,
        getTerm: i => SC[i],
        setMeta(map) { metaMap = map || {}; setText(cur); },
        setOnChange(fn) { onChange = fn; },
        resize() { resize(); draw(clock); },
        destroy() {
            stop();
            if (ro) ro.disconnect();
            if (io) io.disconnect();
        }
    };
})();
