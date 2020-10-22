import {Worker} from "worker_threads";
import * as os from "os";

/**
 * 默认最大线程数，当线程数为cpu核数时性能最好
 */
const DEFAULT_MAX_THREADS = os.cpus().length;

/**
 * 线程池选项
 */
interface WorkerThreadPoolOption {
    /**
     * 初始线程数
     */
    size: number;
    /**
     * 最小线程数
     */
    min: number;
    /**
     * 最大线程数
     */
    max: number;
    /**
     * 等待队列长度
     */
    maxQueueSize: number;
    /**
     * 闲置超时
     */
    idleTimeout: number;
}

/**
 * 线程池内线程信息
 */
interface WorkerInfo {
    /**
     * 创建时间
     */
    createdAt: number;
    /**
     * 闲置时间
     */
    idleSince: number;
    /**
     * 工作线程
     */
    worker: Worker;
    /**
     * 可用标志
     */
    avaliable: boolean;
    /**
     * 线程id
     */
    threadId: number;
    /**
     * 回调
     */
    resolve: (res: [Error | null, any]) => void;
}

/**
 * 无可用线程错误
 */
class NoThreadAvaliableError extends Error {
    constructor(message = "no thread avaliable") {
        super(message);
    }
}

export class WorkerThreadPool {
    /**
     * 选项
     */
    private option: WorkerThreadPoolOption;
    /**
     * 线程池
     */
    private pool: WorkerInfo[];
    /**
     * 定时清理闲置线程
     */
    private interval: NodeJS.Timeout;
    private queue: { resolve: any, reject: any, script: string, argv: any[] }[];

    constructor({
                    size = 3,
                    min = 0,
                    max = DEFAULT_MAX_THREADS,
                    idleTimeout = 60e3,
                    maxQueueSize = DEFAULT_MAX_THREADS * 5,
                }: Partial<WorkerThreadPoolOption> = {}) {
        this.option = {size, min, max, idleTimeout, maxQueueSize: maxQueueSize};
        this.pool = Array.from({length: this.option.size}, () => this.createWorker());
        this.queue = [];

        this.interval = setInterval(() => {
            const timeout = Date.now() - this.option.idleTimeout;
            let min = this.option.min;
            this.pool = this.pool.filter(e => {
                if (e.idleSince > timeout) {
                    min--;
                    return true;
                } else {
                    return min-- > 0;
                }
            });
        }, 1e3);
    }

    close() {
        this.pool.forEach(e => {
            e.worker.removeAllListeners();
            e.worker.terminate();
        });
        clearInterval(this.interval);
    }

    private createWorker(): WorkerInfo {
        const worker = new Worker('./dist/worker.js');
        const now = Date.now();
        const w = {
            createdAt: now,
            idleSince: now,
            worker,
            avaliable: true,
            threadId: worker.threadId,
            resolve: (any) => {
            },
        };
        worker.on("error", (err) => {
            w.resolve([err, null]);
            this.dequeueOrfreeWorker(w);
        });
        worker.on("message", (res) => {
            w.resolve(res);
            this.dequeueOrfreeWorker(w);
        });
        worker.on("messageerror", (err) => {
            w.resolve([err, null]);
            this.dequeueOrfreeWorker(w);
        });
        return w;
    }

    private dequeueOrfreeWorker(w: WorkerInfo) {
        const next = this.queue.shift();
        if (next) {
            const {resolve, reject, script, argv} = next;
            this._exec(resolve, reject, w, script, argv);
        } else {
            w.avaliable = true;
            w.idleSince = Date.now();
        }
    }

    private getWorker() {
        let w = this.pool.find(e => e.avaliable);
        if (!w) {
            if (this.pool.length < this.option.max) {
                w = this.createWorker();
                this.pool.push(w);
            } else {
                return null;
            }
        }
        w.avaliable = false;
        return w;
    }

    private _exec(resolve: any, reject: any, w: WorkerInfo, script: string, argv: any[]) {
        w.resolve = resolve;
        w.worker.postMessage([script, argv]);
    }

    async exec([script, argv]: [string, any[]]): Promise<[Error | null, any]> {
        const w = this.getWorker();
        if (!w) {
            if (this.queue.length < this.option.maxQueueSize) {
                return new Promise((resolve, reject) => {
                    this.queue.push({
                        resolve,
                        reject,
                        script,
                        argv,
                    });
                });
            } else {
                return [new NoThreadAvaliableError(), null];
            }
        }
        return new Promise((resolve, reject) => {
            this._exec(resolve, reject, w, script, argv);
        });
    }
}