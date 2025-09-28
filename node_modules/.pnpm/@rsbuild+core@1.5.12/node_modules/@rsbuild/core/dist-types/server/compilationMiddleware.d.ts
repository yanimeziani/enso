import type { Compiler, MultiCompiler, Stats } from '@rspack/core';
import type { Connect, EnvironmentContext, NormalizedConfig } from '../types';
export declare const isClientCompiler: (compiler: {
    options: {
        target?: Compiler["options"]["target"];
    };
}) => boolean;
export type ServerCallbacks = {
    onInvalid: (token: string, fileName?: string | null) => void;
    onDone: (token: string, stats: Stats) => void;
};
export declare const setupServerHooks: ({ compiler, token, callbacks: { onDone, onInvalid }, }: {
    compiler: Compiler;
    token: string;
    callbacks: ServerCallbacks;
}) => void;
export type CompilationMiddleware = Connect.NextHandleFunction & {
    close: (callback: (err: Error | null | undefined) => void) => any;
    watch: () => void;
};
/**
 * The CompilationMiddleware handles compiler setup for development:
 * - Call `compiler.watch` (handled by rsbuild-dev-middleware)
 * - Inject the HMR client path into page
 * - Notify server when compiler hooks are triggered
 */
export declare const getCompilationMiddleware: ({ config, compiler, callbacks, environments, resolvedPort, }: {
    config: NormalizedConfig;
    compiler: Compiler | MultiCompiler;
    /**
     * Should trigger when compiler hook called
     */
    callbacks: ServerCallbacks;
    environments: Record<string, EnvironmentContext>;
    resolvedPort: number;
}) => Promise<CompilationMiddleware>;
