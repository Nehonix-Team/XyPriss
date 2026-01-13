import { Logger } from "../../../shared/logger/Logger";
import { XHSCOrchestrationConfig } from "./types";
import * as cluster from "cluster";
import * as os from "os";

/**
 * XHSC Cluster Manager
 * Handles server orchestration, delegating to either Node.js native cluster
 * or the high-performance Rust XHSC engine.
 */
export class XhscClusterManager {
    private config: XHSCOrchestrationConfig;
    private logger: Logger;
    private workers: any[] = [];
    private isMaster: boolean;

    constructor(config: XHSCOrchestrationConfig, logger: Logger) {
        this.config = config;
        this.logger = logger;
        // @ts-ignore - Handle diff between node cluster types
        this.isMaster = cluster.isMaster || cluster.isPrimary;
    }

    /**
     * Initialize the cluster manager.
     */
    public async initialize(): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        const mode = this.config.mode || "xhsc";
        this.logger.info(
            "cluster",
            `Initializing orchestration in ${mode} mode`
        );

        if (mode === "node") {
            await this.initializeNodeCluster();
        } else if (mode === "xhsc") {
            await this.initializeXhscCluster();
        }
    }

    /**
     * Start the Node.js native cluster.
     */
    private async initializeNodeCluster(): Promise<void> {
        if (!this.isMaster) return;

        const numWorkers = this.getWorkerCount();
        this.logger.info(
            "cluster",
            `Starting ${numWorkers} Node.js workers...`
        );

        // @ts-ignore
        const fork = cluster.fork;

        for (let i = 0; i < numWorkers; i++) {
            const worker = fork();
            this.workers.push(worker);
        }

        // @ts-ignore
        cluster.on("exit", (worker, code, signal) => {
            this.logger.warn(
                "cluster",
                `Worker ${worker.process.pid} died. Restarting...`
            );
            const newWorker = fork();
            this.workers.push(newWorker);
        });
    }

    /**
     * Initialize the XHSC Rust-based cluster.
     * In this mode, the Rust engine is the parent process and spawns Node.js workers.
     * This method prepares the Node.js side to be managed not by 'cluster' module,
     * but by XHSC signals/IPC.
     */
    private async initializeXhscCluster(): Promise<void> {
        if (process.env.XHSC_MODE === "cluster_worker") {
            // We are a worker managed by XHSC
            // Nothing to do here, XHSCBridge takes over via StartupProcessor
            return;
        }

        // We are the master process initiating the XHSC Cluster
        this.logger.info("cluster", "Starting XHSC Native Cluster Engine...");

        // The actual spawning happens via XHSCBridge if configured in ServerFactory
        // But we need to ensure the options are passed correctly.
        // In the new architecture, StartupProcessor -> XHSCBridge will trigger the binary.
        // We just need to make sure the args --cluster and --workers N are passed.

        // NOTE: Since XHSCBridge reads configs from App, we rely on ServerFactory
        // to inject these args. However, for clarity, we log here.
    }

    /**
     * Determine the number of workers to use.
     */
    public getWorkerCount(): number {
        if (this.config.workers === "auto" || !this.config.workers) {
            return os.cpus().length;
        }
        return this.config.workers;
    }

    public getWorkers(): any[] {
        return this.workers;
    }
}

