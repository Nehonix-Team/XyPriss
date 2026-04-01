export function getSwaggerUIHtml(specUrl: string, title: string): string {
    const templatePath = require("path").join(
        __dirname,
        "..",
        "src",
        "template",
        "ui.html",
    );

    try {
        let html = require("fs").readFileSync(templatePath, "utf-8");

        // Simple template engine using {{}} syntax
        html = html.replace(/\{\{title\}\}/g, title);
        html = html.replace(/\{\{specUrl\}\}/g, specUrl);

        return html;
    } catch (error) {
        console.error(
            `[SWAGGER] Error reading UI template at ${templatePath}:`,
            error,
        );
        return `<h1>Error loading Swagger UI</h1><p>${String(error)}</p>`;
    }
}

