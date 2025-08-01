/**
 * XyPriss Custom 404 Not Found Handler
 *
 * Customizable 404 error pages with XyPriss branding
 * and user configuration options.
 */

import { Request, Response } from "express";
import { ServerOptions } from "../ServerFactory";
import * as fs from "fs";
import * as path from "path";
import {
    notFoundTempHtml,
    NotFoundTemplateData,
} from "./templates/notFoundTemp";

export interface NotFoundConfig {
    enabled?: boolean;
    title?: string;
    message?: string;
    showSuggestions?: boolean;
    customCSS?: string;
    redirectAfter?: number;
    redirectTo?: string;
    showBackButton?: boolean;
    theme?: "light" | "dark" | "auto";
    logoUrl?: string;
    customContent?: string;
    contact?: {
        email?: string;
        website?: string;
        support?: string;
    };
}

export class NotFoundHandler {
    private config: NotFoundConfig;

    constructor(config: NotFoundConfig = {}) {
        this.config = {
            enabled: true,
            title: "Page Not Found - XyPriss",
            message: "The page you're looking for doesn't exist.",
            showSuggestions: true,
            showBackButton: true,
            theme: "auto",
            redirectTo: "/",
            ...config,
        };
    }

    /**
     * Generate beautiful 404 HTML page using template
     */
    private generateNotFoundHTML(req: Request): string {
        // Prepare template data
        const templateData = this.prepareTemplateData(req);

        // Try to load external template file first
        try {
            const templatePath = path.join(
                __dirname,
                "templates",
                "notFound.html"
            );
            if (fs.existsSync(templatePath)) {
                let template = fs.readFileSync(templatePath, "utf8");

                // Replace template variables
                Object.entries(templateData).forEach(([key, value]) => {
                    const placeholder = `\${${key}}`;
                    template = template.replace(
                        new RegExp(
                            placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                            "g"
                        ),
                        value
                    );
                });

                return template;
            }
        } catch (error) {
            // Fall back to inline template if file loading fails
            console.warn(
                "Failed to load 404 template file, using fallback:",
                error
            );
        }

        // Use fallback template function
        return notFoundTempHtml(templateData);
    }

    /**
     * Prepare template data for rendering
     */
    private prepareTemplateData(req: Request): NotFoundTemplateData {
        const requestedPath = req.path;

        // Determine theme based on user preference or system
        const themeClass =
            this.config.theme === "auto"
                ? "theme-auto"
                : `theme-${this.config.theme}`;

        // Generate suggestions based on the requested path
        const suggestions = this.config.showSuggestions
            ? this.generateSuggestions(requestedPath)
            : [];

        // Auto-redirect script
        const redirectScript = this.config.redirectAfter
            ? `
            <script>
                let countdown = ${Math.floor(this.config.redirectAfter / 1000)};
                const countdownEl = document.getElementById('countdown');
                const redirectTimer = setInterval(() => {
                    countdownEl.textContent = countdown;
                    countdown--;
                    if (countdown < 0) {
                        clearInterval(redirectTimer);
                        window.location.href = '${this.config.redirectTo}';
                    }
                }, 1000);
            </script>
        `
            : "";

        // Prepare template sections
        const logoSection = this.config.logoUrl
            ? `<img src="${this.config.logoUrl}" alt="Logo" class="logo">`
            : '<div class="logo">XP</div>';

        const suggestionsSection =
            suggestions.length > 0
                ? `
        <div class="suggestions">
            <h3>💡 Suggestions:</h3>
            <ul>
                ${suggestions
                    .map((suggestion) => `<li>${suggestion}</li>`)
                    .join("")}
            </ul>
        </div>
        `
                : "";

        const redirectSection = this.config.redirectAfter
            ? `
        <div class="redirect-notice">
            🔄 Redirecting to home page in <span id="countdown">${Math.floor(
                this.config.redirectAfter / 1000
            )}</span> seconds...
        </div>
        `
            : "";

        const backButtonSection = this.config.showBackButton
            ? `
            <button onclick="history.back()" class="btn btn-secondary">
                ← Go Back
            </button>
        `
            : "";

        const customContentSection = this.config.customContent || "";

        const contactSection = this.config.contact
            ? `
        <div class="contact-info">
            <h4>Need Help?</h4>
            ${
                this.config.contact.email
                    ? `<p>📧 <a href="mailto:${this.config.contact.email}">${this.config.contact.email}</a></p>`
                    : ""
            }
            ${
                this.config.contact.website
                    ? `<p>🌐 <a href="${this.config.contact.website}" target="_blank">${this.config.contact.website}</a></p>`
                    : ""
            }
            ${
                this.config.contact.support
                    ? `<p>💬 <a href="${this.config.contact.support}" target="_blank">Support</a></p>`
                    : ""
            }
        </div>
        `
            : "";

        return {
            title: this.config.title || "Page Not Found - XyPriss",
            message:
                this.config.message ||
                "The page you're looking for doesn't exist.",
            requestedPath,
            themeClass,
            customCSS: this.config.customCSS || "",
            logoSection,
            suggestionsSection,
            redirectSection,
            redirectTo: this.config.redirectTo || "/",
            backButtonSection,
            customContentSection,
            contactSection,
            redirectScript,
        };
    }

    /**
     * Generate helpful suggestions based on the requested path
     */
    private generateSuggestions(requestedPath: string): string[] {
        const suggestions: string[] = [];

        // Common suggestions
        suggestions.push("🔍 Check the URL for typos");
        suggestions.push('🏠 <a href="/">Visit our homepage</a>');

        // Path-based suggestions
        if (requestedPath.includes("/api/")) {
            suggestions.push(
                '📚 <a href="/api/docs">Check API documentation</a>'
            );
        }

        if (requestedPath.includes("/admin")) {
            suggestions.push(
                '🔐 <a href="/login">Login to access admin area</a>'
            );
        }

        if (
            requestedPath.includes("/user") ||
            requestedPath.includes("/profile")
        ) {
            suggestions.push(
                '👤 <a href="/login">Login to access your profile</a>'
            );
        }

        suggestions.push("📞 Contact support if you believe this is an error");

        return suggestions;
    }

    /**
     * Express middleware handler for 404 errors
     */
    public handler = (req: Request, res: Response): void => {
        if (!this.config.enabled) {
            // Fall back to Express default
            res.status(404).send(`Cannot ${req.method} ${req.path}`);
            return;
        }

        res.status(404);
        res.set("Content-Type", "text/html");
        res.send(this.generateNotFoundHTML(req));
    };

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<NotFoundConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
}

/**
 * Create NotFoundHandler from ServerOptions
 */
export function createNotFoundHandler(options: ServerOptions): NotFoundHandler {
    return new NotFoundHandler(options.notFound);
}

