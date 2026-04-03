export function buildWorkerPoolArgs(wpconf: any): string[] {
    if (!wpconf?.enabled) return [];

    const args: string[] = ["--worker-pool"];
    const cfg = wpconf.config;

    if (cfg?.maxConcurrentTasks !== undefined)
        args.push("--worker-pool-max-tasks", cfg.maxConcurrentTasks.toString());
    if (cfg?.cpu?.min !== undefined)
        args.push("--worker-pool-cpu-min", cfg.cpu.min.toString());
    if (cfg?.cpu?.max !== undefined)
        args.push("--worker-pool-cpu-max", cfg.cpu.max.toString());
    if (cfg?.io?.min !== undefined)
        args.push("--worker-pool-io-min", cfg.io.min.toString());
    if (cfg?.io?.max !== undefined)
        args.push("--worker-pool-io-max", cfg.io.max.toString());

    return args;
}
