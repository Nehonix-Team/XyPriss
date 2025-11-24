// Simple HTML template function - no need for fortification for static content
const redirectTempHtml = ({
    customMessage,
    toPort,
}: {
    customMessage: string;
    toPort: number;
}) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Server Moved - Nehonix XyPrissJS</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; text-align: center; padding: 50px; margin: 0; min-height: 100vh;
                display: flex; align-items: center; justify-content: center; overflow-x: hidden;
                position: relative;
            }
            .container {
                max-width: 700px; margin: 0 auto; background: rgba(255,255,255,0.1);
                padding: 40px; border-radius: 20px; backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                animation: slideInUp 0.8s ease-out; position: relative; overflow: hidden;
            }
            @keyframes slideInUp {
                from { opacity: 0; transform: translateY(50px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .icon { font-size: 4rem; margin-bottom: 20px; animation: bounce 2s infinite; }
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-10px); }
                60% { transform: translateY(-5px); }
            }
            h1 {
                font-size: 2.5rem; margin-bottom: 20px; font-weight: 700;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                background: linear-gradient(45deg, #fff, #f0f0f0);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .message { font-size: 1.2rem; margin: 30px 0; line-height: 1.6; opacity: 0.95; font-weight: 300; }
            .new-url {
                background: rgba(255,255,255,0.2); padding: 20px; border-radius: 12px;
                font-family: 'Courier New', monospace; font-size: 1.1rem; margin: 30px 0;
                border: 1px solid rgba(255,255,255,0.3); backdrop-filter: blur(10px);
                word-break: break-all; transition: all 0.3s ease; cursor: pointer;
            }
            .new-url:hover {
                background: rgba(255,255,255,0.3); transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            }
            .button {
                display: inline-block; padding: 15px 35px;
                background: linear-gradient(45deg, #ff6b6b, #ee5a24);
                color: white; text-decoration: none; border-radius: 50px; margin: 20px 10px;
                font-weight: 600; font-size: 1.1rem; transition: all 0.3s ease;
                box-shadow: 0 10px 20px rgba(0,0,0,0.2); position: relative; overflow: hidden;
            }
            .button:hover {
                transform: translateY(-3px); box-shadow: 0 15px 30px rgba(0,0,0,0.3);
                background: linear-gradient(45deg, #ff5252, #d63031);
            }
            .footer {
                margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);
                font-size: 0.9rem; opacity: 0.8;
            }
            .footer a {
                color: #00d2d3; text-decoration: none; font-weight: 600; transition: all 0.3s ease;
            }
            .footer a:hover { color: #fff; text-shadow: 0 0 10px #00d2d3; }
            @media (max-width: 768px) {
                .container { margin: 20px; padding: 30px 20px; }
                h1 { font-size: 2rem; }
                .message { font-size: 1rem; }
                .new-url { font-size: 0.9rem; padding: 15px; }
                .button { padding: 12px 25px; font-size: 1rem; margin: 10px 5px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">🚀</div>
            <h1>Server Moved</h1>
            <div class="message">${customMessage}</div>
            <div class="new-url">http://localhost:${toPort}</div>
            <a href="http://localhost:${toPort}" class="button">🎯 Go to New Server</a>
            <div class="footer">
                Powered by <strong>Nehonix</strong> for
                <a href="https://lab.nehonix.com" target="_blank">XyPrissJS</a>
            </div>
        </div>
    </body>
    </html>
`;
};

export { redirectTempHtml };

