import type { InternalContext, NormalizedConfig, RequestHandler } from '../types';
import type { CompilationManager } from './compilationManager';
import type { RsbuildDevServer } from './devServer';
import type { UpgradeEvent } from './helper';
export type RsbuildDevMiddlewareOptions = {
    config: NormalizedConfig;
    context: InternalContext;
    compilationManager?: CompilationManager;
    devServerAPI: RsbuildDevServer;
    /**
     * Callbacks returned by the `onBeforeStartDevServer` hook.
     */
    postCallbacks: (() => void)[];
    pwd: string;
};
export type Middlewares = (RequestHandler | [string, RequestHandler])[];
export type GetDevMiddlewaresResult = {
    close: () => Promise<void>;
    onUpgrade: UpgradeEvent;
    middlewares: Middlewares;
};
export declare const getDevMiddlewares: (options: RsbuildDevMiddlewareOptions) => Promise<GetDevMiddlewaresResult>;
