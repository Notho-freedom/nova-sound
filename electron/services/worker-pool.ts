import { Worker } from "worker_threads";

interface PendingTask<TInput, TOutput> {
  id: number;
  payload: TInput;
  resolve: (value: TOutput) => void;
  reject: (reason?: unknown) => void;
}

export class WorkerPool<TInput, TOutput> {
  private readonly workers: Worker[] = [];
  private readonly idleWorkers: Worker[] = [];
  private readonly queue: PendingTask<TInput, TOutput>[] = [];
  private readonly pending = new Map<number, PendingTask<TInput, TOutput>>();
  private nextId = 1;

  constructor(private readonly workerUrl: URL, size: number) {
    for (let i = 0; i < size; i += 1) {
      const worker = new Worker(workerUrl);
      worker.on("message", (message: { id: number; result?: TOutput; error?: string }) => {
        const task = this.pending.get(message.id);
        if (!task) return;
        this.pending.delete(message.id);
        this.idleWorkers.push(worker);
        if (message.error) {
          task.reject(new Error(message.error));
        } else {
          task.resolve(message.result as TOutput);
        }
        this.dequeue();
      });
      worker.on("error", (error) => {
        this.idleWorkers.push(worker);
        console.error("Worker error:", error);
      });
      this.workers.push(worker);
      this.idleWorkers.push(worker);
    }
  }

  runTask(payload: TInput): Promise<TOutput> {
    const id = this.nextId++;
    return new Promise<TOutput>((resolve, reject) => {
      const task: PendingTask<TInput, TOutput> = { id, payload, resolve, reject };
      this.queue.push(task);
      this.dequeue();
    });
  }

  private dequeue() {
    if (this.queue.length === 0) return;
    if (this.idleWorkers.length === 0) return;

    const worker = this.idleWorkers.pop();
    const task = this.queue.shift();
    if (!worker || !task) return;

    this.pending.set(task.id, task);
    worker.postMessage({ id: task.id, payload: task.payload });
  }

  async destroy() {
    await Promise.all(this.workers.map((worker) => worker.terminate()));
    this.workers.length = 0;
    this.idleWorkers.length = 0;
    this.queue.length = 0;
    this.pending.clear();
  }
}
