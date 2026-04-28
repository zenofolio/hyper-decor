/**
 * Common signal type for locks that can be auto-extended.
 */
export interface LockAbortSignal extends AbortSignal {
    error?: Error;
}

/**
 * Interface representing a successfully acquired lock.
 */
export interface ILock {
    /**
     * The resources that are locked.
     */
    readonly resources: string[];
    /**
     * The unique value of this lock instance.
     */
    readonly value: string;
    /**
     * The timestamp (ms) when the lock will expire.
     */
    expiration: number;
    /**
     * Releases the lock.
     */
    release(): Promise<any>;
    /**
     * Extends the lock for an additional duration.
     */
    extend(duration: number): Promise<ILock>;
}

export interface LockOptions {
    /**
     * Maximum number of concurrent locks allowed for the resource(s).
     * Used primarily by semaphore-like stores.
     */
    limit?: number;
    /**
     * Threshold (ms) before expiration to trigger automatic extension.
     * Default: 500ms.
     */
    automaticExtensionThreshold?: number;
    /**
     * Additional implementation-specific settings.
     */
    [key: string]: unknown;
}

/**
 * Interface for a distributed lock manager.
 */
export interface ILockManager {
    /**
     * Acquires a lock on the specified resources.
     */
    acquire(resources: string[], duration: number, options?: LockOptions): Promise<ILock | null>;
    /**
     * Releases an existing lock.
     */
    release(lock: ILock, options?: LockOptions): Promise<any>;
    /**
     * Extends an existing lock.
     */
    extend(lock: ILock, duration: number, options?: LockOptions): Promise<ILock>;
    /**
     * Executes a routine with auto-extending lock protection.
     */
    using<T>(
        resources: string[],
        duration: number,
        routine: (signal: LockAbortSignal) => Promise<T>
    ): Promise<T>;

    using<T>(
        resources: string[],
        duration: number,
        settings: LockOptions,
        routine: (signal: LockAbortSignal) => Promise<T>
    ): Promise<T>;
}

/**
 * A helper function to implement the `using` pattern for any ILockManager.
 */
export async function runUsing<T>(
    manager: ILockManager,
    resources: string[],
    duration: number,
    settingsOrRoutine: LockOptions | ((signal: LockAbortSignal) => Promise<T>),
    optionalRoutine?: (signal: LockAbortSignal) => Promise<T>
): Promise<T> {
    const settings = typeof settingsOrRoutine === "function" ? {} : settingsOrRoutine;
    const routine = typeof settingsOrRoutine === "function" ? settingsOrRoutine : optionalRoutine;

    // Use a smaller threshold if the duration is very short (for tests)
    const automaticExtensionThreshold = settings.automaticExtensionThreshold || Math.min(500, Math.floor(duration / 2));

    if (automaticExtensionThreshold > duration - 50) {
        throw new Error(
            `A lock duration (${duration}ms) must be significantly greater than the extension threshold (${automaticExtensionThreshold}ms).`
        );
    }

    const controller = new AbortController();
    const signal = controller.signal as LockAbortSignal;

    let timeout: undefined | NodeJS.Timeout;
    let extension: undefined | Promise<void>;
    
    const lock = await manager.acquire(resources, duration, settings);
    if (!lock) {
        throw new Error("Lock limit reached");
    }

    const queue = (): void => {
        timeout = setTimeout(
            () => (extension = extend()),
            lock.expiration - Date.now() - automaticExtensionThreshold
        );
    };

    const extend = async (): Promise<void> => {
        timeout = undefined;

        try {
            const nextLock = await manager.extend(lock, duration, settings);
            lock.expiration = nextLock.expiration;
            queue();
        } catch (error) {
            if (!(error instanceof Error)) {
                throw new Error(`Unexpected thrown ${typeof error}: ${error}.`);
            }

            if (lock.expiration > Date.now()) {
                extension = extend();
                return;
            }

            signal.error = error;
            controller.abort();
        }
    };

    queue();

    try {
        return await routine!(signal);
    } finally {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }

        if (extension) {
            await extension.catch(() => { });
        }

        await manager.release(lock, settings);
    }
}
