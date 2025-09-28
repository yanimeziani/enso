import type { EnvironmentContext, NormalizedConfig, Rspack } from '../types';
import { type CompilationMiddleware } from './compilationMiddleware';
import { SocketServer } from './socketServer';
type Options = {
    config: NormalizedConfig;
    compiler: Rspack.Compiler | Rspack.MultiCompiler;
    publicPaths: string[];
    resolvedPort: number;
    environments: Record<string, EnvironmentContext>;
};
/**
 * Setup compiler-related logic:
 * 1. setup rsbuild-dev-middleware
 * 2. establish webSocket connect
 */
export declare class CompilationManager {
    middleware: CompilationMiddleware;
    outputFileSystem: Rspack.OutputFileSystem;
    private config;
    compiler: Rspack.Compiler | Rspack.MultiCompiler;
    private environments;
    private publicPaths;
    socketServer: SocketServer;
    private resolvedPort;
    constructor({ config, compiler, publicPaths, resolvedPort, environments, }: Options);
    init(): Promise<void>;
    /**
     * Call `compiler.watch()` to start compiling.
     */
    watch(): void;
    close(): Promise<void>;
    readFileSync: (fileName: string) => string;
    private setupCompilationMiddleware;
}
export {};
