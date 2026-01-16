export type SidebarNavItem = {
    title: string;
    href: string;
    items?: SidebarNavItem[];
};

export type DocsConfig = {
    sidebarNav: SidebarNavItem[];
};

export const docsConfig: DocsConfig = {
    sidebarNav: [
        {
            title: "Getting Started",
            href: "/docs/getting-started",
            items: [
                { title: "Introduction", href: "/docs/README" },
                { title: "Quick Start", href: "/docs/QUICK_START" },
                { title: "Installation", href: "/docs/getting-started" },
            ],
        },
        {
            title: "Core Concepts",
            href: "/docs/core",
            items: [
                { title: "Server Architecture", href: "/docs/SERVER_CORE_ARCHITECTURE" },
                { title: "Middleware", href: "/docs/MIDDLEWARE_ARCHITECTURE" },
                { title: "XHSC Core", href: "/docs/XHSC_CORE" },
                { title: "System Intelligence", href: "/docs/SYSTEM_INTELLIGENCE" },
            ],
        },
        {
            title: "Configuration",
            href: "/docs/config",
            items: [
                { title: "Configuration Guide", href: "/docs/CONFIGURATION" },
                { title: "Network Config", href: "/docs/NETWORK_CONFIG_GUIDE" },
                { title: "Configs API", href: "/docs/CONFIGS_API" },
                { title: "Meta Config", href: "/docs/META_CONFIG" },
            ],
        },
        {
            title: "Security",
            href: "/docs/security",
            items: [
                { title: "Security Overview", href: "/docs/SECURITY" },
                { title: "Route Security", href: "/docs/ROUTE_BASED_SECURITY" },
                { title: "CORS", href: "/docs/WILDCARD_CORS" },
                { title: "Trust Proxy", href: "/docs/TRUST_PROXY" },
                { title: "CSP", href: "/docs/enhanced-csp-configuration" },
            ],
        },
        {
            title: "Plugins",
            href: "/docs/plugins",
            items: [
                { title: "Plugin System", href: "/docs/PLUGIN_SYSTEM_GUIDE" },
                { title: "Development", href: "/docs/PLUGIN_DEVELOPMENT_GUIDE" },
                { title: "Management API", href: "/docs/PLUGIN_MANAGEMENT_API" },
                { title: "Hooks", href: "/docs/PLUGIN_CORE_HOOKS" },
            ],
        },
        {
            title: "Advanced Features",
            href: "/docs/advanced",
            items: [
                { title: "Multi Server", href: "/docs/MULTI_SERVER" },
                { title: "Clustering", href: "/docs/cluster-configuration-guide" },
                { title: "File Upload", href: "/docs/FILE_UPLOAD_GUIDE" },
                { title: "Memory Detection", href: "/docs/MEMORY_DETECTION" },
                { title: "Console Interception", href: "/docs/CONSOLE_INTERCEPTION_GUIDE" },
            ],
        },
        {
            title: "API Reference",
            href: "/docs/api",
            items: [
                { title: "Global APIs", href: "/docs/GLOBAL_APIS" },
                { title: "XJSON API", href: "/docs/XJSON_API" },
                { title: "Filesystem API", href: "/docs/filesystem-api" },
            ]
        }
    ],
};
