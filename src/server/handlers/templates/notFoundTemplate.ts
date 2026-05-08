import { NotFoundTemplateData } from "../../../types/NotFoundConfig";

export function notFoundTemplate(d: NotFoundTemplateData): string {
    const html = `<!DOCTYPE html>
<html lang="en" class="${d.themeClass}">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${d.title}</title>
        <link rel="icon" href="${d.faviconUrl}" type="image/x-icon" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300&display=swap" rel="stylesheet" />
        <style>
            *, *::before, *::after {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            html, body {
                width: 100%;
                height: 100%;
                overflow: hidden;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                background: #060a1a;
            }

            /* ── Root container ── */
            .root {
                position: relative;
                width: 100vw;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                overflow: hidden;
            }

            /* ── Canvas — brand circles, z lowest ── */
            #cvs {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                z-index: 1;
            }

            /* ── Stick figures layer ── */
            #chars {
                position: absolute;
                width: 99%;
                height: 95%;
                z-index: 2;
                pointer-events: none;
            }

            .stick {
                position: absolute;
                object-fit: contain;
                width: 18%;
                height: 18%;
            }

            /* ── Message — fade in on top ── */
            #message {
                position: absolute;
                inset: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 100;
                padding: 1rem;
                text-align: center;
            }

            #msg-inner {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0;
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.6s ease, transform 0.6s ease;
            }

            #msg-inner.show {
                opacity: 1;
                transform: translateY(0);
            }

            /* ── Branding ── */
            .brand {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: clamp(1.25rem, 3vh, 2.25rem);
            }

            .brand-mark {
                width: 2rem;
                height: 2rem;
                border-radius: 8px;
                background: linear-gradient(135deg, #22d3ee 0%, #6366f1 55%, #8b5cf6 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 800;
                font-size: 0.6rem;
                letter-spacing: 0.03em;
                color: white;
                flex-shrink: 0;
            }

            .brand-name {
                font-size: 0.9375rem;
                font-weight: 600;
                color: #0f172a;
                letter-spacing: -0.01em;
            }

            /* ── Error label ── */
            .error-label {
                font-size: clamp(1.25rem, 2.5vw + 0.5rem, 2.1875rem);
                font-weight: 600;
                color: #0f172a;
                margin-bottom: clamp(0.25rem, 1vh, 0.5rem);
                letter-spacing: -0.02em;
            }

            /* ── 404 ── */
            .error-code {
                font-size: clamp(3.5rem, 10vw + 1rem, 5rem);
                font-weight: 700;
                color: #4338ca;
                letter-spacing: -0.05em;
                line-height: 1;
                margin-bottom: clamp(0.75rem, 2vh, 1.25rem);
            }

            /* ── Description ── */
            .description {
                font-size: clamp(0.8125rem, 1.25vw + 0.25rem, 0.9375rem);
                line-height: 1.65;
                color: #1e293b;
                max-width: min(480px, 85vw);
                margin-bottom: clamp(1.25rem, 3vh, 2rem);
            }

            .description code {
                font-family: 'Courier New', Courier, monospace;
                font-size: 0.9em;
                background: rgba(99, 102, 241, 0.12);
                color: #4338ca;
                padding: 0.1em 0.4em;
                border-radius: 4px;
                border: 1px solid rgba(99, 102, 241, 0.2);
            }

            /* ── Divider ── */
            .divider {
                width: 32px;
                height: 2px;
                background: linear-gradient(90deg, #6366f1, #8b5cf6);
                border-radius: 2px;
                margin-bottom: clamp(1rem, 2.5vh, 1.75rem);
            }

            /* ── Buttons ── */
            .btns {
                display: flex;
                gap: clamp(0.5rem, 2vw, 1.5rem);
                flex-wrap: wrap;
                justify-content: center;
            }

            .btn {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: clamp(0.4rem, 1vh, 0.5rem) clamp(0.875rem, 2vw, 1.5rem);
                font-family: inherit;
                font-size: clamp(0.8125rem, 1vw + 0.25rem, 1rem);
                font-weight: 500;
                cursor: pointer;
                transition: all 0.25s ease;
                text-decoration: none;
                border: none;
                border-radius: 2px;
                white-space: nowrap;
            }

            .btn:hover  { transform: scale(1.05); }
            .btn:active { transform: scale(0.97); }

            .btn-outline {
                background: transparent;
                color: #4f46e5;
                border: 2px solid #4f46e5;
            }

            .btn-outline:hover {
                background: #4f46e5;
                color: #fff;
            }

            .btn-filled {
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                color: #fff;
                border: none;
                box-shadow: 0 4px 18px rgba(99, 102, 241, 0.35);
            }

            .btn-filled:hover {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                box-shadow: 0 6px 22px rgba(99, 102, 241, 0.5);
            }

            /* ── Footer (inside message) ── */
            .msg-footer {
                margin-top: clamp(1.25rem, 3vh, 2rem);
                font-size: 0.6875rem;
                color: rgba(15, 23, 42, 0.4);
                letter-spacing: 0.04em;
            }

            .msg-footer a {
                color: #6366f1;
                text-decoration: none;
                font-weight: 600;
                transition: color 0.2s;
            }

            .msg-footer a:hover { color: #4338ca; }

            /* ──────────────────────────────────────────
               RESPONSIVE
            ────────────────────────────────────────── */

            @media (max-width: 480px) {
                .stick { width: 28%; height: 28%; }
                .btns  { gap: 0.5rem; }
            }

            @media (max-height: 500px) and (orientation: landscape) {
                .brand         { margin-bottom: 0.75rem; }
                .error-code    { font-size: 3rem; }
                .error-label   { font-size: 1.125rem; }
                .description   { display: none; }
                .divider       { display: none; }
                .msg-footer    { margin-top: 0.75rem; }
            }

            @media (min-width: 481px) and (max-width: 768px) {
                .stick { width: 22%; height: 22%; }
            }

            ${d.customCSS}
        </style>
    </head>
    <body>
        <div class="root">

            <!-- ① Canvas: brand-colored circles rush in from right -->
            <canvas id="cvs"></canvas>

            <!-- ② Stick figures -->
            <div id="chars"></div>

            <!-- ③ Message (fades in after 1.2s) -->
            <div id="message">
                <div id="msg-inner">

                    <div class="brand">
                        <div class="brand-mark">XP</div>
                        <span class="brand-name">${d.appName || 'XyPriss'}</span>
                    </div>

                    <div class="error-label">Page Not Found</div>
                    <div class="error-code">404</div>

                    <div class="divider"></div>

                    <p class="description">
                        ${
                            d.message
                                ? d.message
                                : `The resource <code>${d.requestedMethod} ${d.requestedPath}</code>
                                   doesn't exist or may have been moved.
                                   The page you're looking for might have been removed,
                                   renamed, or is temporarily unavailable.`
                        }
                    </p>

                    <div class="btns">
                        <button class="btn btn-outline" onclick="history.back()">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2"
                                 stroke-linecap="round" stroke-linejoin="round"
                                 aria-hidden="true">
                                <path d="m12 19-7-7 7-7"/>
                                <path d="M19 12H5"/>
                            </svg>
                            Go Back
                        </button>

                        <a class="btn btn-filled" href="${d.redirectTo || '/'}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2"
                                 stroke-linecap="round" stroke-linejoin="round"
                                 aria-hidden="true">
                                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
                            </svg>
                            ${d.redirectText || 'Go Home'}
                        </a>
                    </div>

                    <div class="msg-footer">
                        Powered by <a href="https://XyPriss.nehonix.com" rel="noopener">XyPriss</a>
                    </div>

                </div>
            </div>
        </div>

        <script>
        /* ═══════════════════════════════════════════
           1 — CIRCLE ANIMATION
        ═══════════════════════════════════════════ */
        (function () {
            var canvas = document.getElementById('cvs');
            var ctx    = canvas.getContext('2d');
            var circles = [];
            var timer   = 0;
            var rafId;

            function resize() {
                canvas.width  = window.innerWidth;
                canvas.height = window.innerHeight;
            }

            var BRAND_COLORS = ['#eef2ff', '#e0e7ff', '#dbeafe', '#cffafe', '#f3e8ff', '#ede9fe'];

            function initCircles() {
                circles = [];
                var w = canvas.width, h = canvas.height;
                for (var i = 0; i < 300; i++) {
                    var x = Math.floor(
                        Math.random() * (w * 3 - w * 1.2 + 1)
                    ) + w * 1.2;
                    var y = Math.floor(
                        Math.random() * (h - h * -0.2 + 1)
                    ) + h * -0.2;
                    var color = BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)];
                    circles.push({ x: x, y: y, size: w / 1000, color: color });
                }
            }

            function draw() {
                timer++;
                ctx.setTransform(1, 0, 0, 1, 0, 0);

                var distX  = canvas.width / 80;
                var growth = canvas.width / 1000;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                for (var i = 0; i < circles.length; i++) {
                    var c = circles[i];
                    ctx.beginPath();
                    if (timer < 65) {
                        c.x    -= distX;
                        c.size += growth;
                    } else if (timer < 500) {
                        c.x    -= distX  * 0.02;
                        c.size += growth * 0.2;
                    }
                    ctx.fillStyle = c.color;
                    ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
                    ctx.fill();
                }

                if (timer < 500) {
                    rafId = requestAnimationFrame(draw);
                }
            }

            function start() {
                if (rafId) cancelAnimationFrame(rafId);
                timer = 0;
                resize();
                initCircles();
                draw();
            }

            window.addEventListener('resize', start);
            start();
        })();


        /* ═══════════════════════════════════════════
           2 — STICK FIGURES ANIMATION
        ═══════════════════════════════════════════ */
        (function () {
            var BASE = 'https://raw.githubusercontent.com/RicardoYare/imagenes/9ef29f5bbe075b1d1230a996d87bca313b9b6a63/sticks/';
            var container = document.getElementById('chars');

            var figures = [
                { top: '0%',    src: BASE + 'stick0.svg', transform: 'rotateZ(-90deg)', speedX: 1500 },
                { top: '10%',   src: BASE + 'stick1.svg', speedX: 3000, speedR: 2000 },
                { top: '20%',   src: BASE + 'stick2.svg', speedX: 5000, speedR: 1000 },
                { top: '25%',   src: BASE + 'stick0.svg', speedX: 2500, speedR: 1500 },
                { top: '35%',   src: BASE + 'stick0.svg', speedX: 2000, speedR: 300  },
                { bottom: '5%', src: BASE + 'stick3.svg', speedX: 0 }
            ];

            function initChars() {
                container.innerHTML = '';

                figures.forEach(function (fig, idx) {
                    var img = document.createElement('img');
                    img.className = 'stick';
                    img.src = fig.src;
                    img.alt = '';

                    if (fig.top    !== undefined) img.style.top    = fig.top;
                    if (fig.bottom !== undefined) img.style.bottom = fig.bottom;
                    if (fig.transform)            img.style.transform = fig.transform;

                    container.appendChild(img);

                    if (idx === figures.length - 1) return;

                    img.animate(
                        [{ left: '110%' }, { left: '-22%' }],
                        { duration: fig.speedX, easing: 'linear', fill: 'forwards' }
                    );

                    if (idx === 0) return;

                    if (fig.speedR) {
                        img.animate(
                            [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' }],
                            { duration: fig.speedR, iterations: Infinity, easing: 'linear' }
                        );
                    }
                });
            }

            initChars();

            var resizeTimer;
            window.addEventListener('resize', function () {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(initChars, 150);
            });
        })();


        /* ═══════════════════════════════════════════
           3 — MESSAGE FADE-IN  (after 1.2 s)
        ═══════════════════════════════════════════ */
        setTimeout(function () {
            var el = document.getElementById('msg-inner');
            if (el) el.classList.add('show');
        }, 1200);
        </script>
    </body>
</html>`;

    return html;
}
