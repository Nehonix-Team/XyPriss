/**
 * Fallback 404 HTML template function
 * Used when the external HTML template file is not available
 */

export interface NotFoundTemplateData {
    title: string;
    message: string;
    requestedPath: string;
    themeClass: string;
    customCSS: string;
    logoSection: string;
    suggestionsSection: string;
    redirectSection: string;
    redirectTo: string;
    backButtonSection: string;
    customContentSection: string;
    contactSection: string;
    redirectScript: string;
}

export const notFoundTempHtml = (data: NotFoundTemplateData): string => {
    return `<!DOCTYPE html>
<html lang="en" class="${data.themeClass}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <style>
        :root {
            --primary-color: #667eea;
            --secondary-color: #764ba2;
            --accent-color: #f093fb;
            --text-primary: #2d3748;
            --text-secondary: #4a5568;
            --bg-primary: #ffffff;
            --bg-secondary: #f7fafc;
            --border-color: #e2e8f0;
            --shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        .theme-dark {
            --text-primary: #f7fafc;
            --text-secondary: #e2e8f0;
            --bg-primary: #1a202c;
            --bg-secondary: #2d3748;
            --border-color: #4a5568;
            --shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }
        @media (prefers-color-scheme: dark) {
            .theme-auto {
                --text-primary: #f7fafc;
                --text-secondary: #e2e8f0;
                --bg-primary: #1a202c;
                --bg-secondary: #2d3748;
                --border-color: #4a5568;
                --shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
            padding: 20px; color: var(--text-primary);
        }
        .container {
            background: var(--bg-primary); border-radius: 20px; padding: 40px;
            max-width: 600px; width: 100%; box-shadow: var(--shadow);
            text-align: center; position: relative; overflow: hidden;
        }
        .container::before {
            content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
            background: linear-gradient(90deg, var(--primary-color), var(--accent-color), var(--secondary-color));
        }
        .logo {
            width: 80px; height: 80px; margin: 0 auto 20px;
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            font-size: 32px; font-weight: bold; color: white; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .error-code {
            font-size: 120px; font-weight: 900;
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text; line-height: 1; margin-bottom: 20px;
        }
        h1 { font-size: 28px; margin-bottom: 15px; color: var(--text-primary); }
        .message { font-size: 18px; color: var(--text-secondary); margin-bottom: 30px; line-height: 1.6; }
        .requested-path {
            background: var(--bg-secondary); padding: 15px; border-radius: 10px; margin: 20px 0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 14px;
            color: var(--text-secondary); border: 1px solid var(--border-color);
        }
        .suggestions { text-align: left; margin: 30px 0; }
        .suggestions h3 { color: var(--text-primary); margin-bottom: 15px; font-size: 18px; }
        .suggestions ul { list-style: none; }
        .suggestions li { padding: 8px 0; color: var(--text-secondary); }
        .suggestions a { color: var(--primary-color); text-decoration: none; font-weight: 500; }
        .suggestions a:hover { text-decoration: underline; }
        .actions { display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin: 30px 0; }
        .btn {
            padding: 12px 24px; border: none; border-radius: 10px; font-size: 16px; font-weight: 600;
            cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
            gap: 8px; transition: all 0.3s ease;
        }
        .btn-primary {
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            color: white;
        }
        .btn-secondary {
            background: var(--bg-secondary); color: var(--text-primary);
            border: 1px solid var(--border-color);
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2); }
        .redirect-notice {
            background: var(--bg-secondary); padding: 15px; border-radius: 10px;
            margin: 20px 0; border: 1px solid var(--border-color);
        }
        .contact-info {
            margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border-color);
            font-size: 14px; color: var(--text-secondary);
        }
        .contact-info a { color: var(--primary-color); text-decoration: none; }
        .branding {
            margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border-color);
            font-size: 12px; color: var(--text-secondary); opacity: 0.8;
        }
        .branding a { color: var(--primary-color); text-decoration: none; font-weight: 600; }
        @media (max-width: 480px) {
            .container { padding: 30px 20px; }
            .error-code { font-size: 80px; }
            h1 { font-size: 24px; }
            .actions { flex-direction: column; }
        }
        ${data.customCSS}
    </style>
</head>
<body>
    <div class="container">
        ${data.logoSection}
        <div class="error-code">404</div>
        <h1>Oops! Page Not Found</h1>
        <p class="message">${data.message}</p>
        <div class="requested-path">
            <strong>Requested:</strong> ${data.requestedPath}
        </div>
        ${data.suggestionsSection}
        ${data.redirectSection}
        <div class="actions">
            <a href="${data.redirectTo}" class="btn btn-primary">🏠 Go Home</a>
            ${data.backButtonSection}
        </div>
        ${data.customContentSection}
        ${data.contactSection}
        <div class="branding">
            Powered by <a href="https://nehonix.space" target="_blank">Nehonix</a> • 
            Built with <a href="https://github.com/Nehonix-Team/XyPriss" target="_blank">XyPriss</a>
        </div>
    </div>
    ${data.redirectScript}
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const container = document.querySelector('.container');
            container.style.opacity = '0';
            container.style.transform = 'translateY(20px)';
            setTimeout(() => {
                container.style.transition = 'all 0.6s ease';
                container.style.opacity = '1';
                container.style.transform = 'translateY(0)';
            }, 100);
        });
    </script>
</body>
</html>`;
};

