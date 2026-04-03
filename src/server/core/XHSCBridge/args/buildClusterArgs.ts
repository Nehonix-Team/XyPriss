export function buildClusterArgs(clconf: any): string[] {
    if (!clconf?.enabled) return [];

    const args: string[] = ["--cluster"];

    const workers = clconf.workers === "auto" ? 0 : clconf.workers || 0;
    args.push("--cluster-workers", workers.toString());

    if (clconf.autoRespawn !== false) args.push("--cluster-respawn", "true");

    const entryPoint = clconf.entryPoint || process.argv[1];
    if (entryPoint) args.push("--entry-point", entryPoint);
    if (clconf.strategy) args.push("--cluster-strategy", clconf.strategy);

    // Memory
    const mem = clconf.resources?.maxMemory;
    if (mem) {
        let memMB = 0;
        if (typeof mem === "number") {
            memMB = mem;
        } else {
            const match = mem.match(/^(\d+)(MB|GB)?$/i);
            if (match) {
                memMB = parseInt(match[1]);
                if (match[2]?.toUpperCase() === "GB") memMB *= 1024;
            }
        }
        if (memMB > 0) args.push("--cluster-max-memory", memMB.toString());
    }

    const res = clconf.resources;
    if (res) {
        if (res.maxCpu) args.push("--cluster-max-cpu", res.maxCpu.toString());

        // Priority
        if (res.priority !== undefined) {
            const priorityMap: Record<string, number> = {
                low: 10,
                normal: 0,
                high: -10,
                critical: -19,
            };
            const priority =
                typeof res.priority === "number"
                    ? res.priority
                    : (priorityMap[res.priority] ?? 0);
            args.push("--cluster-priority", priority.toString());
        }

        if (res.fileDescriptorLimit)
            args.push(
                "--file-descriptor-limit",
                res.fileDescriptorLimit.toString(),
            );
        if (res.gcHint) args.push("--gc-hint");
        if (res.memoryManagement?.checkInterval)
            args.push(
                "--cluster-memory-check-interval",
                res.memoryManagement.checkInterval.toString(),
            );
        if (res.enforcement?.hardLimits !== undefined)
            args.push(
                "--cluster-enforce-hard-limits",
                res.enforcement.hardLimits.toString(),
            );
        if (res.intelligence?.enabled) args.push("--intelligence");
        if (res.intelligence?.preAllocate) args.push("--pre-allocate");
        if (res.intelligence?.rescueMode !== undefined)
            args.push("--rescue-mode", res.intelligence.rescueMode.toString());
    }

    return args;
}
