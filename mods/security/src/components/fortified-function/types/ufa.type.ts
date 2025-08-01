//  Worker pool for CPU-intensive tasks**
export interface WorkerTask {
    id: string;
    fn: string;
    args: any[];
    resolve: (value: any) => void;
    reject: (error: any) => void;
}

