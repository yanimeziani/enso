import { rspack } from './rspack';
import type { HtmlRspackPlugin } from './types';
/**
 * This method is used to override the Rsbuild default html-plugin (html-rspack-plugin).
 */
export declare const setHTMLPlugin: (plugin: typeof HtmlRspackPlugin) => void;
export declare const getHTMLPlugin: () => typeof HtmlRspackPlugin;
export declare const setCssExtractPlugin: (plugin: unknown) => void;
export declare const getCssExtractPlugin: () => typeof rspack.CssExtractRspackPlugin;
