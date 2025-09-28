import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { DevConfig, EnvironmentContext, Rspack } from '../types';
export type SocketMessageStaticChanged = {
    type: 'static-changed' | 'content-changed';
};
export type SocketMessageHash = {
    type: 'hash';
    data: string;
};
export type SocketMessageOk = {
    type: 'ok';
};
export type SocketMessageWarnings = {
    type: 'warnings';
    data: {
        text: string[];
    };
};
export type SocketMessageErrors = {
    type: 'errors';
    data: {
        text: string[];
        html: string;
    };
};
export type SocketMessage = SocketMessageOk | SocketMessageStaticChanged | SocketMessageHash | SocketMessageWarnings | SocketMessageErrors;
export declare class SocketServer {
    private wsServer;
    private readonly socketsMap;
    private readonly options;
    private stats;
    private initialChunks;
    private heartbeatTimer;
    private environments;
    constructor(options: DevConfig, environments: Record<string, EnvironmentContext>);
    upgrade: (req: IncomingMessage, socket: Socket, head: Buffer) => void;
    private checkSockets;
    private clearHeartbeatTimer;
    prepare(): Promise<void>;
    updateStats(stats: Rspack.Stats, token: string): void;
    /**
     * Write message to each socket
     * @param message - The message to send
     * @param token - The token of the socket to send the message to,
     * if not provided, the message will be sent to all sockets
     */
    sockWrite(message: SocketMessage, token?: string): void;
    close(): Promise<void>;
    private onConnect;
    private getStats;
    private sendStats;
    private send;
}
