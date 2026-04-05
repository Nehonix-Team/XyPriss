import { Transform, TransformCallback, Readable } from "node:stream";
import "xypriss";
import { meta } from "./configs/meta";

/**
 * **Template Transform Stream**
 *
 * Safely replaces {{key}} placeholders in a stream of text.
 * Handles split placeholders across chunks by buffering the end of chunks.
 */
class TemplateTransform extends Transform {
    private remaining: string = "";
    private placeholders: Record<string, string>;

    constructor(placeholders: Record<string, string>) {
        super({ decodeStrings: false, encoding: "utf-8" });
        this.placeholders = placeholders;
    }

    _transform(
        chunk: any,
        _encoding: string,
        callback: TransformCallback,
    ): void {
        let content = this.remaining + chunk.toString();

        // Perform replacements
        for (const [key, value] of Object.entries(this.placeholders)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
            content = content.replace(regex, value);
        }

        /**
         * To handle split placeholders (e.g., "{{ti" at end of chunk),
         * we look for the last "{{" in the last few characters.
         * If we find one that doesn't have a matching "}}", we buffer it.
         */
        const lastOpening = content.lastIndexOf("{{");
        const lastClosing = content.lastIndexOf("}}");

        if (lastOpening > lastClosing && lastOpening > content.length - 20) {
            this.remaining = content.slice(lastOpening);
            this.push(content.slice(0, lastOpening));
        } else {
            this.remaining = "";
            this.push(content);
        }

        callback();
    }

    _flush(callback: TransformCallback): void {
        this.push(this.remaining);
        callback();
    }
}

/**
 * **Get Swagger UI Stream**
 *
 * Returns a readable stream for the Swagger UI HTML with template variables
 * injected via a Transform stream.
 */
export function getSwaggerUIStream(specUrl: string, title: string): Readable {
    const templatePath = __sys__.fs.join(
        __sys__.__root__,
        "dist",
        "template",
        "ui.html",
    );

    // native high-performance stream
    const source = __sys__.fs.createReadStream(templatePath);
    const transform = new TemplateTransform({
        specUrl,
        title,
        version: meta.version,
        year: new Date().getFullYear().toString(),
        nehonix_url: "https://nehonix.com",
    });

    return source.pipe(transform);
}

/**
 * @deprecated Use getSwaggerUIStream for better performance
 */
export function getSwaggerUIHtml(specUrl: string, title: string): string {
    const templatePath = __sys__.fs.join(
        __sys__.__root__,
        "dist",
        "template",
        "ui.html",
    );

    try {
        let html = __sys__.fs.readFileSync(templatePath, "utf-8");
        html = html.replace(/\{\{title\}\}/g, title);
        html = html.replace(/\{\{specUrl\}\}/g, specUrl);
        html = html.replace(/\{\{version\}\}/g, meta.version);
        html = html.replace(
            /\{\{year\}\}/g,
            new Date().getFullYear().toString(),
        );
        html = html.replace(/\{\{nehonix_url\}\}/g, "https://nehonix.com");
        return html;
    } catch (error) {
        return `<h1>Error loading Swagger UI</h1><p>${String(error)}</p>`;
    }
}

