import type { Context, WithOptional } from '../index';
declare module '@rspack/core' {
    interface Compiler {
        __hasRsbuildAssetEmittedCallback?: boolean;
    }
}
export declare function setupWriteToDisk(context: WithOptional<Context, 'watching' | 'outputFileSystem'>): void;
