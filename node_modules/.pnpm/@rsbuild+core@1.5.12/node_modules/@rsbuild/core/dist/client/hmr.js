const config = RSBUILD_CLIENT_CONFIG;
const serverHost = RSBUILD_SERVER_HOST;
const serverPort = RSBUILD_SERVER_PORT;
function formatURL(fallback) {
    const { location } = self;
    const hostname = (fallback ? serverHost : config.host) || location.hostname;
    const port = (fallback ? serverPort : config.port) || location.port;
    const protocol = config.protocol || ('https:' === location.protocol ? 'wss' : 'ws');
    const pathname = config.path;
    if ('undefined' != typeof URL) {
        const url = new URL('http://localhost');
        url.port = String(port);
        url.hostname = hostname;
        url.protocol = protocol;
        url.pathname = pathname;
        url.searchParams.append('token', RSBUILD_WEB_SOCKET_TOKEN);
        return url.toString();
    }
    const colon = -1 === protocol.indexOf(':') ? ':' : '';
    return `${protocol}${colon}//${hostname}:${port}${pathname}?token=${RSBUILD_WEB_SOCKET_TOKEN}`;
}
let lastCompilationHash;
let hasCompileErrors = false;
function clearOutdatedErrors() {
    if (console.clear && hasCompileErrors) console.clear();
}
let createOverlay;
let clearOverlay;
const registerOverlay = (createFn, clearFn)=>{
    createOverlay = createFn;
    clearOverlay = clearFn;
};
function handleSuccess() {
    clearOutdatedErrors();
    hasCompileErrors = false;
    tryApplyUpdates();
}
function handleWarnings(param) {
    let { text } = param;
    clearOutdatedErrors();
    hasCompileErrors = false;
    for(let i = 0; i < text.length; i++){
        if (5 === i) {
            console.warn('[rsbuild] Additional warnings detected. View complete log in terminal for details.');
            break;
        }
        console.warn(text[i]);
    }
    tryApplyUpdates();
}
function handleErrors(param) {
    let { text, html } = param;
    clearOutdatedErrors();
    hasCompileErrors = true;
    for (const error of text)console.error(error);
    if (createOverlay) createOverlay(html);
}
const isUpdateAvailable = ()=>lastCompilationHash !== __webpack_hash__;
const handleApplyUpdates = (err, updatedModules)=>{
    const forcedReload = err || !updatedModules;
    if (forcedReload) {
        if (err) console.error('[rsbuild] HMR update failed, performing full reload: ', err);
        reloadPage();
        return;
    }
    tryApplyUpdates();
};
function tryApplyUpdates() {
    if (!isUpdateAvailable()) return;
    if (import.meta.webpackHot) {
        if ('idle' !== import.meta.webpackHot.status()) return;
        import.meta.webpackHot.check(true).then((updatedModules)=>{
            handleApplyUpdates(null, updatedModules);
        }, (err)=>{
            handleApplyUpdates(err, null);
        });
        return;
    }
    reloadPage();
}
let socket = null;
let reconnectCount = 0;
let pingIntervalId;
function onOpen() {
    console.info('[rsbuild] WebSocket connected.');
    reconnectCount = 0;
    pingIntervalId = setInterval(()=>{
        if (socket && socket.readyState === socket.OPEN) socket.send(JSON.stringify({
            type: 'ping'
        }));
    }, 30000);
}
function onMessage(e) {
    const message = JSON.parse(e.data);
    switch(message.type){
        case 'hash':
            lastCompilationHash = message.data;
            if (clearOverlay && isUpdateAvailable()) clearOverlay();
            break;
        case 'ok':
            handleSuccess();
            break;
        case 'static-changed':
        case 'content-changed':
            reloadPage();
            break;
        case 'warnings':
            handleWarnings(message.data);
            break;
        case 'errors':
            handleErrors(message.data);
            break;
    }
}
function onClose() {
    if (reconnectCount >= config.reconnect) {
        if (config.reconnect > 0) console.warn('[rsbuild] WebSocket connection failed after maximum retry attempts.');
        return;
    }
    if (0 === reconnectCount) console.info('[rsbuild] WebSocket connection lost. Reconnecting...');
    removeListeners();
    socket = null;
    reconnectCount++;
    setTimeout(connect, 1000 * 1.5 ** reconnectCount);
}
function onError() {
    if (formatURL() !== formatURL(true)) {
        console.error('[rsbuild] WebSocket connection failed. Trying direct connection fallback.');
        removeListeners();
        socket = null;
        connect(true);
    }
}
function connect() {
    let fallback = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : false;
    if (0 === reconnectCount) console.info('[rsbuild] WebSocket connecting...');
    const socketUrl = formatURL(fallback);
    socket = new WebSocket(socketUrl);
    socket.addEventListener('open', onOpen);
    socket.addEventListener('close', onClose);
    socket.addEventListener('message', onMessage);
    if (!fallback) socket.addEventListener('error', onError);
}
function removeListeners() {
    clearInterval(pingIntervalId);
    if (socket) {
        socket.removeEventListener('open', onOpen);
        socket.removeEventListener('close', onClose);
        socket.removeEventListener('message', onMessage);
        socket.removeEventListener('error', onError);
    }
}
function reloadPage() {
    if (RSBUILD_DEV_LIVE_RELOAD) window.location.reload();
}
connect();
export { registerOverlay };
