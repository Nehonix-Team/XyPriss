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
