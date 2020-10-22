import {Worker} from "worker_threads";
import * as os from "os";

/**
 * default max thread pool size, normally when pool size equals cpu core number gains best performance
 */
const DEFAULT_MAX_THREADS = os.cpus().length;

/**
 * worker thread option
 */
interface WorkerThreadPoolOption {
    /**
     * init pool size
     */
    size: number;
    /**
     * min pool size
     */
    min: number;
    /**
     * max pool size
     */
    max: number;
    /**
     * max queue size, when all threads are busy, tasks can be queued in the internal pool queue.
     */
    maxQueueSize: number;
    /**
     * idle timeout, when worker idle for a reasonable time (in ms), it will be terminated.
     */
    idleTimeout: number;
}

/**
 * woker thread info
 */
interface WorkerInfo {
    /**
     * create timestamp
     */
    createdAt: number;
    /**
     * idle since timestamp
     */
    idleSince: number;
    /**
     * worker thread
     */
    worker: Worker;
    /**
     * is avaliable, means to accept new work
     */
    avaliable: boolean;
    /**
     * thread id
     */
    threadId: number;
    /**
     * call back, accept an optional error and result
     */
    resolve: (res: [Error | null, any]) => void;
}

/**
 * no thread avaliable error
 */
export class NoThreadAvaliableError extends Error {
    constructor(message = "no thread avaliable") {
        super(message);
    }
}

export class WorkerThreadPool {
    /**
     * option
     */
    private option: WorkerThreadPoolOption;
    /**
     * worker thread pool
     */
    private pool: WorkerInfo[];
    /**
     * interval to terminate idle thread
     */
    private interval: NodeJS.Timeout;
    /**
     * internal queue
     */
    private queue: { resolve: any, reject: any, script: string, argv: any[] }[];

    /**
     * constructor
     * @param size
     * @param min
     * @param max
     * @param idleTimeout
     * @param maxQueueSize
     */
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

    /**
     * close thread pool
     */
    close() {
        this.pool.forEach(e => {
            e.worker.removeAllListeners();
            e.worker.terminate();
        });
        clearInterval(this.interval);
    }

    /**
     * create thread pool
     */
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

    /**
     * get task from internal queue or free the thread
     * @param w
     */
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

    /**
     * get thread from pool
     */
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

    /**
     * run task in worker thread virtually
     * @param resolve
     * @param reject
     * @param w
     * @param script
     * @param argv
     * @private
     */
    private _exec(resolve: any, reject: any, w: WorkerInfo, script: string, argv: any[]) {
        w.resolve = resolve;
        w.worker.postMessage([script, argv]);
    }

    /**
     * run task in worker thread，
     * if no thread avaliable, task will be queued,
     * if queue is full, an error will be throwed.
     * @param script
     * @param argv
     */
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