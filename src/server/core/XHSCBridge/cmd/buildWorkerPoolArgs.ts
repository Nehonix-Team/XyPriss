export function buildWorkerPoolArgs(wpconf: ServerOptions["workerPool"]): string[] {
    if (!wpconf?.enabled) return [];

    const args: string[] = ["--worker-pool"];
    const cfg = wpconf.config;

    if (cfg?.maxConcurrentTasks !== undefined) {
        const val = cfg.maxConcurrentTasks === "auto" ? "-1" : cfg.maxConcurrentTasks.toString();
        args.push("--worker-pool-max-tasks", val);
    }
    if (cfg?.cpu?.min !== undefined) {
        const val = cfg.cpu.min === "auto" ? "-1" : cfg.cpu.min.toString();
        args.push("--worker-pool-cpu-min", val);
    }
    if (cfg?.cpu?.max !== undefined) {
        const val = cfg.cpu.max === "auto" ? "-1" : cfg.cpu.max.toString();
        args.push("--worker-pool-cpu-max", val);
    }
    if (cfg?.io?.min !== undefined) {
        const val = cfg.io.min === "auto" ? "-1" : cfg.io.min.toString();
        args.push("--worker-pool-io-min", val);
    }
    if (cfg?.io?.max !== undefined) {
        const val = cfg.io.max === "auto" ? "-1" : cfg.io.max.toString();
        args.push("--worker-pool-io-max", val);
    }

    return args;
}
