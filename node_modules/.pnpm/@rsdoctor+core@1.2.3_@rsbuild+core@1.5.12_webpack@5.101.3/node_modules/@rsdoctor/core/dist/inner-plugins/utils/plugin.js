"use strict";
var __webpack_require__ = {};
(()=>{
    __webpack_require__.d = (exports1, definition)=>{
        for(var key in definition)if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports1, key)) Object.defineProperty(exports1, key, {
            enumerable: true,
            get: definition[key]
        });
    };
})();
(()=>{
    __webpack_require__.o = (obj, prop)=>Object.prototype.hasOwnProperty.call(obj, prop);
})();
(()=>{
    __webpack_require__.r = (exports1)=>{
        if ('undefined' != typeof Symbol && Symbol.toStringTag) Object.defineProperty(exports1, Symbol.toStringTag, {
            value: 'Module'
        });
        Object.defineProperty(exports1, '__esModule', {
            value: true
        });
    };
})();
var __webpack_exports__ = {};
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
    reportPluginData: ()=>reportPluginData,
    interceptPluginHook: ()=>interceptPluginHook
});
const error_namespaceObject = require("@rsdoctor/utils/error");
function reportPluginData(sdk, hook, tapName, start, type, _res, err) {
    const end = Date.now();
    sdk.reportPlugin({
        [hook]: [
            {
                tapName,
                costs: end - start,
                startAt: start,
                endAt: end,
                type,
                result: null,
                error: err ? [
                    new error_namespaceObject.DevToolError(`${tapName} ${hook} Error`, err.message, {
                        controller: {
                            noStack: false,
                            noColor: true
                        },
                        stack: err.stack
                    })
                ] : []
            }
        ]
    });
}
function interceptPluginHook(sdk, name, hook) {
    if (!(null == hook ? void 0 : hook.intercept)) return;
    hook.intercept({
        register (tap) {
            const o = tap.fn;
            if ('sync' === tap.type) tap.fn = function() {
                const start = Date.now();
                try {
                    const res = o.apply(this, arguments);
                    reportPluginData(sdk, name, tap.name, start, tap.type, res);
                    return res;
                } catch (error) {
                    reportPluginData(sdk, name, tap.name, start, tap.type, null, error);
                    throw error;
                }
            };
            else if ('async' === tap.type) tap.fn = async function() {
                const start = Date.now();
                try {
                    const res = await o.apply(this, arguments);
                    reportPluginData(sdk, name, tap.name, start, tap.type, res);
                    return res;
                } catch (error) {
                    reportPluginData(sdk, name, tap.name, start, tap.type, null, error);
                    throw error;
                }
            };
            else if ('promise' === tap.type) tap.fn = function() {
                var _arguments__compiler, _arguments_, _arguments;
                const start = Date.now();
                const isChild = null == (_arguments = arguments) ? void 0 : null == (_arguments_ = _arguments[0]) ? void 0 : null == (_arguments__compiler = _arguments_.compiler) ? void 0 : _arguments__compiler.isChild();
                return o.apply(this, arguments).then((res)=>{
                    if (isChild) return res;
                    reportPluginData(sdk, name, tap.name, start, tap.type, res);
                    return res;
                }).catch((error)=>{
                    reportPluginData(sdk, name, tap.name, start, tap.type, null, error);
                    throw error;
                });
            };
            return tap;
        }
    });
}
exports.interceptPluginHook = __webpack_exports__.interceptPluginHook;
exports.reportPluginData = __webpack_exports__.reportPluginData;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "interceptPluginHook",
    "reportPluginData"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
