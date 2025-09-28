import { type AcornParseError, type CheckSyntaxExclude, ECMASyntaxError } from './types.js';
export declare function displayCodePointer(code: string, pos: number): string;
export declare function generateError({ err, code, filepath, rootPath, exclude, }: {
    err: AcornParseError;
    code: string;
    filepath: string;
    rootPath: string;
    exclude?: CheckSyntaxExclude;
}): Promise<ECMASyntaxError | null>;
export declare function makeCodeFrame(lines: string[], highlightIndex: number): string;
