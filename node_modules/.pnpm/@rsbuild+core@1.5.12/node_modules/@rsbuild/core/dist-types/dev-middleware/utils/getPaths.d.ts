import type { FilledContext } from '../index';
type PublicPathInfo = {
    outputPath: string;
    publicPath: string | undefined;
};
export declare function getPaths(context: FilledContext): PublicPathInfo[];
export {};
