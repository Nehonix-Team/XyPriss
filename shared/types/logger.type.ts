const LOG_LEVELS = [
    "silent",
    "error",
    "warn",
    "info",
    "debug",
    "verbose",
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LOG_COMPONENTS = [
    "middleware",
    "server",
    "cache",
    "cluster",
    "performance",
    "fileWatcher",
    "plugins",
    "security",
    "monitoring",
    "routes",
    "userApp",
    "typescript",
    "console",
    "other",
    "router",
    "acpes",
    "ipc",
    "memory",
    "lifecycle",
    "routing",
] as const;

export type LogComponent = (typeof LOG_COMPONENTS)[number];

const LOG_TYPES = [
    "startup",
    "warnings",
    "errors",
    "performance",
    "debug",
    "hotReload",
    "portSwitching",
    "lifecycle",
] as const;

export type LogType = (typeof LOG_TYPES)[number];

