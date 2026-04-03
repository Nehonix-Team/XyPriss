import "xypriss";

export function getSwaggerUIHtml(specUrl: string, title: string): string {
    const templatePath = __sys__.fs.join(
        __sys__.__root__,
        "dist",
        "template",
        "ui.html",
    );

    try {
        let html = __sys__.fs.readFileSync(templatePath, "utf-8");

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

