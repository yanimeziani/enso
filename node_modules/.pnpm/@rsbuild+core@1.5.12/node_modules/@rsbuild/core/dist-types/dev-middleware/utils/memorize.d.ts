export declare function memorize<T>(fn: (...args: any[]) => T, { cache, }?: {
    cache?: Map<string, {
        data: T;
    }>;
}, callback?: (value: T) => T): (...args: [string, ...any[]]) => T;
