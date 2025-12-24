import { NotFoundTemplateData } from "../../../types/NotFoundConfig";

export function notFoundTemplate(d: NotFoundTemplateData): string {
    const html = `<!DOCTYPE html>
<html lang="en" class="${d.themeClass}">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${d.title}</title>
        <link rel="icon" href="${d.faviconUrl}" type="image/x-icon" />
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            /* Détection automatique du thème via CSS */
            @media (prefers-color-scheme: dark) {
                html.auto {
                    color-scheme: dark;
                }
            }

            @media (prefers-color-scheme: light) {
                html.auto {
                    color-scheme: light;
                }
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 1rem;
                background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%);
                transition: background 0.3s ease;
            }

            /* Mode sombre */
            html.dark body,
            html.auto body {
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%);
            }

            /* Mode clair spécifique */
            html.light body {
                background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%);
            }

            /* Override auto en mode clair */
            @media (prefers-color-scheme: light) {
                html.auto body {
                    background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%);
                }
            }

            .container {
                width: 100%;
                max-width: 28rem;
                animation: fadeInUp 0.8s ease-out forwards;
            }

            .card {
                background: rgba(255, 255, 255, 0.95);
                border-radius: 1rem;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
                padding: 3rem 2rem;
                text-align: center;
                width: 100%;
                transform: scale(1);
                transition: all 0.3s ease;
                border: 1px solid rgba(203, 213, 225, 0.3);
            }

            /* Mode sombre - Card avec effet glow */
            html.dark .card,
            html.auto .card {
                background: rgba(15, 23, 42, 0.95);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5),
                            0 0 40px rgba(59, 130, 246, 0.15);
                border: 1px solid rgba(59, 130, 246, 0.2);
            }

            /* Mode clair spécifique pour la card */
            html.light .card {
                background: rgba(255, 255, 255, 0.95);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
                border: 1px solid rgba(203, 213, 225, 0.3);
            }

            @media (prefers-color-scheme: light) {
                html.auto .card {
                    background: rgba(255, 255, 255, 0.95);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
                    border: 1px solid rgba(203, 213, 225, 0.3);
                }
            }

            .card:hover {
                transform: scale(1.02);
                box-shadow: 0 15px 40px rgba(0, 0, 0, 0.12);
            }

            html.dark .card:hover,
            html.auto .card:hover {
                transform: scale(1.02);
                box-shadow: 0 25px 60px -12px rgba(59, 130, 246, 0.3),
                            0 0 60px rgba(59, 130, 246, 0.25);
                border: 1px solid rgba(59, 130, 246, 0.4);
            }

            @media (prefers-color-scheme: light) {
                html.auto .card:hover {
                    transform: scale(1.02);
                    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.12);
                }
            }

            .branding-container {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: 3rem;
            }

            .branding {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .logo {
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 0.5rem;
                background: linear-gradient(135deg, #22d3ee 0%, #3b82f6 50%, #9333ea 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
                animation: pulse-glow 2s ease-in-out infinite;
            }

            html.dark .logo,
            html.auto .logo {
                box-shadow: 0 10px 20px rgba(59, 130, 246, 0.4),
                            0 0 30px rgba(59, 130, 246, 0.2);
            }

            @media (prefers-color-scheme: light) {
                html.auto .logo {
                    box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
                }
            }

            .logo-text {
                color: white;
                font-weight: bold;
                font-size: 1.25rem;
            }

            .brand-name {
                font-size: 1.875rem;
                font-weight: bold;
                overflow: hidden;
                border-right: 3px solid #22d3ee;
                white-space: nowrap;
                animation: typing 2s steps(7, end) forwards, blink 0.75s step-end infinite;
                animation-delay: 0.5s;
                width: 0;
            }

            .brand-gradient {
                background: linear-gradient(90deg, #60a5fa 0%, #a78bfa 33%, #f9a8d4 66%, #fbbf24 100%);
                background-size: 200% 200%;
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: rainbow 3s ease infinite;
            }

            .error-number {
                animation: float 3s ease-in-out infinite;
                margin-bottom: 1.5rem;
            }

            .error-number h1 {
                font-size: 6rem;
                font-weight: bold;
                background: linear-gradient(90deg, #60a5fa 0%, #a78bfa 50%, #f9a8d4 100%);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04));
            }

            html.dark .error-number h1,
            html.auto .error-number h1 {
                filter: drop-shadow(0 0 20px rgba(96, 165, 250, 0.4));
            }

            @media (prefers-color-scheme: light) {
                html.auto .error-number h1 {
                    filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04));
                }
            }

            .title {
                font-size: 1.875rem;
                font-weight: bold;
                color: #1e293b;
                margin-bottom: 1rem;
                animation: fadeInUp 0.8s ease-out forwards;
                animation-delay: 0.1s;
                opacity: 0;
            }

            html.dark .title,
            html.auto .title {
                color: #f1f5f9;
            }

            @media (prefers-color-scheme: light) {
                html.auto .title {
                    color: #1e293b;
                }
            }

            .description {
                color: #475569;
                margin-bottom: 0.5rem;
                animation: fadeInUp 0.8s ease-out forwards;
                animation-delay: 0.2s;
                opacity: 0;
            }

            html.dark .description,
            html.auto .description {
                color: #94a3b8;
            }

            @media (prefers-color-scheme: light) {
                html.auto .description {
                    color: #475569;
                }
            }

            .method {
                color: #3b82f6;
                font-weight: 600;
            }

            html.dark .method,
            html.auto .method {
                color: #60a5fa;
            }

            @media (prefers-color-scheme: light) {
                html.auto .method {
                    color: #3b82f6;
                }
            }

            .path {
                color: #ec4899;
                font-weight: 600;
                word-break: break-all;
            }

            html.dark .path,
            html.auto .path {
                color: #f9a8d4;
            }

            @media (prefers-color-scheme: light) {
                html.auto .path {
                    color: #ec4899;
                }
            }

            .subdescription {
                color: #64748b;
                font-size: 0.875rem;
                margin-bottom: 2rem;
                animation: fadeInUp 0.8s ease-out forwards;
                animation-delay: 0.3s;
                opacity: 0;
            }

            @media (prefers-color-scheme: light) {
                html.auto .subdescription {
                    color: #64748b;
                }
            }

            .app-name {
                color: #475569;
                font-weight: 500;
            }

            html.dark .app-name,
            html.auto .app-name {
                color: #94a3b8;
            }

            @media (prefers-color-scheme: light) {
                html.auto .app-name {
                    color: #475569;
                }
            }

            .button {
                display: inline-block;
                background: linear-gradient(90deg, #3b82f6 0%, #9333ea 100%);
                color: white;
                font-weight: 600;
                padding: 0.75rem 2rem;
                border-radius: 0.5rem;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                transform: scale(1);
                transition: all 0.3s ease;
                text-decoration: none;
                cursor: pointer;
                border: none;
                animation: fadeInUp 0.8s ease-out forwards;
                animation-delay: 0.3s;
                opacity: 0;
            }

            .button:hover {
                background: linear-gradient(90deg, #2563eb 0%, #7c3aed 100%);
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                transform: scale(1.05);
            }

            html.dark .button:hover,
            html.auto .button:hover {
                box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.3),
                            0 0 20px rgba(59, 130, 246, 0.2);
            }

            @media (prefers-color-scheme: light) {
                html.auto .button:hover {
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                }
            }

            .button:active {
                transform: scale(0.95);
            }

            .contact {
                margin-top: 1.5rem;
                animation: fadeInUp 0.8s ease-out forwards;
                animation-delay: 0.3s;
                opacity: 0;
            }

            .contact-text {
                color: #64748b;
                font-size: 0.875rem;
            }

            .contact-link {
                color: #3b82f6;
                transition: color 0.2s ease;
                text-decoration: none;
            }

            html.dark .contact-link,
            html.auto .contact-link {
                color: #60a5fa;
            }

            @media (prefers-color-scheme: light) {
                html.auto .contact-link {
                    color: #3b82f6;
                }
            }

            .contact-link:hover {
                color: #2563eb;
            }

            html.dark .contact-link:hover,
            html.auto .contact-link:hover {
                color: #93c5fd;
            }

            @media (prefers-color-scheme: light) {
                html.auto .contact-link:hover {
                    color: #2563eb;
                }
            }

            .footer {
                margin-top: 1.5rem;
            }

            .footer-text {
                color: #64748b;
                font-size: 0.875rem;
            }

            html.dark .footer-text,
            html.auto .footer-text {
                color: #94a3b8;
            }

            @media (prefers-color-scheme: light) {
                html.auto .footer-text {
                    color: #64748b;
                }
            }

            .footer-link {
                color: #3b82f6;
                font-weight: 600;
                word-break: break-all;
                transition: color 0.2s ease;
                text-decoration: none;
            }

            html.dark .footer-link,
            html.auto .footer-link {
                color: #60a5fa;
            }

            @media (prefers-color-scheme: light) {
                html.auto .footer-link {
                    color: #3b82f6;
                }
            }

            .footer-link:hover {
                color: #8b5cf6;
            }

            html.dark .footer-link:hover,
            html.auto .footer-link:hover {
                color: #a78bfa;
            }

            @media (prefers-color-scheme: light) {
                html.auto .footer-link:hover {
                    color: #8b5cf6;
                }
            }

            .decorative {
                margin-top: 1.5rem;
                display: flex;
                justify-content: center;
                gap: 0.5rem;
            }

            .dot {
                width: 0.5rem;
                height: 0.5rem;
                border-radius: 50%;
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }

            .dot-red {
                background: #ef4444;
            }

            .dot-blue {
                background: #3b82f6;
                animation-delay: 0.1s;
            }

            .dot-green {
                background: #10b981;
                animation-delay: 0.2s;
            }

            @keyframes float {
                0%, 100% {
                    transform: translateY(0px);
                }
                50% {
                    transform: translateY(-20px);
                }
            }

            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes pulse-glow {
                0%, 100% {
                    box-shadow: 0 0 20px rgba(96, 165, 250, 0.3);
                }
                50% {
                    box-shadow: 0 0 40px rgba(96, 165, 250, 0.6);
                }
            }

            @keyframes typing {
                from { 
                    width: 0;
                } 
                to {
                    width: 100%;
                }
            }

            @keyframes blink {
                50% {
                    border-color: transparent;
                }
            }

            @keyframes rainbow {
                0% {
                    background-position: 0% 50%;
                }
                50% {
                    background-position: 100% 50%;
                }
                100% {
                    background-position: 0% 50%;
                }
            }

            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }

            @media (min-width: 768px) {
                .card {
                    padding: 3rem;
                }

                .error-number h1 {
                    font-size: 8rem;
                }

                .title {
                    font-size: 1.875rem;
                }

                .brand-name {
                    font-size: 1.875rem;
                }
            }

            ${d.customCSS}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <!-- Branding XyPriss -->
                <div class="branding-container">
                    <div class="branding">
                        <div class="logo">
                            <span class="logo-text">XP</span>
                        </div>
                        <h3 class="brand-name">
                            <span class="brand-gradient">XyPriss</span>
                        </h3>
                    </div>
                </div>

                <!-- 404 Number with floating animation -->
                <div class="error-number">
                    <h1>404</h1>
                </div>

                <!-- Title -->
                <h2 class="title">Page Not Found</h2>

                <!-- Description -->
                <p class="description">
                    ${
                        d.message
                            ? d.message
                            : `Cannot
                    <span class="method">${d.requestedMethod}</span>
                    <span class="path">${d.requestedPath}</span>`
                    }
                </p>

                ${
                    d.appName
                        ? `<p class="subdescription">
                    We've searched everywhere, but the page you're looking for
                    seems to have vanished or been moved from
                    <span class="app-name">${d.appName}</span>.
                </p>`
                        : ""
                }

                <!-- Button -->
                ${
                    d.redirectText && d.redirectTo
                        ? `<a
                    class="button"
                    href="${d.redirectTo}"
                >
                    ${d.redirectText}
                </a>`
                        : ""
                }

                <!-- Contact section -->
               ${
                   d.contactEmail
                       ? ` <div class="contact">
                    <span class="contact-text">
                        Need help? Contact us at
                        <a href="mailto:${d.contactEmail}" class="contact-link"
                            >${d.contactEmail}</a
                        >
                    </span>
                </div>`
                       : ""
               }

                <!-- By XyPriss -->
                <div class="footer">
                    <small class="footer-text">
                        By
                        <a href="https://XyPriss.nehonix.com" class="footer-link"
                            >XyPriss</a
                        >
                    </small>
                </div>

                <!-- Decorative elements -->
                <div class="decorative">
                    <div class="dot dot-red"></div>
                    <div class="dot dot-blue"></div>
                    <div class="dot dot-green"></div>
                </div>
            </div>
        </div>
    </body>
</html>
`;

    return html;
}
