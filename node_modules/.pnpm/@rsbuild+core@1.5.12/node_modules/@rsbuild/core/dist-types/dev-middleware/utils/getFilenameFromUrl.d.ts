import type { Stats } from 'node:fs';
import type { FilledContext } from '../index';
export type Extra = {
    stats?: Stats;
    errorCode?: number;
};
export declare function getFilenameFromUrl(context: FilledContext, url: string, extra?: Extra): string | undefined;
