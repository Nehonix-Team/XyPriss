import { Interface, Make, Mod, Docs } from "reliant-type";

const schm = Interface({
    /**
     * The title displayed in the browser tab and as the primary heading of the error page.
     */
    title: "string",

    /**
     * The descriptive message explaining the error to the user.
     */
    message: "string",

    /**
     * The original URL path that resulted in the 404 Not Found error.
     */
    requestedPath: "string",

    /**
     * The CSS class name applied to the body or container to define the visual theme (e.g., 'theme-dark').
     */
    themeClass: "auto|light|dark",

    /**
     * A string containing raw CSS rules to be injected directly into the page for custom styling overrides.
     */
    customCSS: "string",

    /**
     * The absolute or relative URL of the favicon to be displayed in the browser's address bar or tabs.
     */
    faviconUrl: "string",

    /**
     * The HTTP method (e.g., GET, POST) used for the request that triggered the error.
     */
    requestedMethod: "string",

    /**
     * The name of the application or server instance, typically used for branding in headers or footers.
     */
    appName: "string",

    /**
     * The target URL for automatic or manual redirection from the error page.
     */
    redirectTo: "string",

    /**
     * The human-readable text for the redirection link or button.
     */
    redirectText: "string",

    /**
     * A client-side function executed to handle the redirection logic or countdown behavior.
     */
    // @fortify-ignore
    redirectScript: "fn(...args: any[]) => void)?",

    /**
     * Contact information, an email address, for user assistance.
     */
    contactEmail: "string?",
});

export type NotFoundTemplateData = typeof schm.types;

interface ntf {
    /**
     * Indicates whether the custom 404 template is active and should be rendered.
     */
    enabled?: boolean;
}

export type NotFoundConfig = Partial<
    Omit<NotFoundTemplateData, "requestedMethod" | "requestedPath">
> &
    ntf;

export const validate404Cfg = (cfg: NotFoundConfig) => {
    const modSchm = Mod.omit(Mod.deepPartial(schm), [
        "requestedMethod",
        "requestedPath",
    ]);
    try {
        const rs = modSchm.safeParse(cfg);
        if (!rs.success) {
            console.error(
                "error: ",
                rs.errors.map((e) => e.message).join("\n")
            );
            throw new Error(rs.errors.map((e) => e.message).join("\n"));
        }
        return rs.data;
    } catch (error: any) {
        console.error("error: ", error);
        throw error.message;
    }
};

// validate404Cfg({
//     enabled: true,
//     title: "Page Not Found - XyPriss",
//     message: "The page you're looking for doesn't exist.",
//     redirectTo: "/",
//     redirectScript: () => {
//         console.log("redirecting...");
//         return {}
//     },

// })



