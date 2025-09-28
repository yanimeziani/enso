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
    toSeverity: ()=>toSeverity,
    noop: ()=>noop
});
const types_namespaceObject = require("@rsdoctor/types");
function toSeverity(input, defaultLevel) {
    if ('off' === input) return types_namespaceObject.Linter.Severity.Ignore;
    if ('on' === input) return defaultLevel;
    const key = `${input[0].toUpperCase()}${input.slice(1)}`;
    return types_namespaceObject.Linter.Severity[key];
}
function noop() {}
exports.noop = __webpack_exports__.noop;
exports.toSeverity = __webpack_exports__.toSeverity;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "noop",
    "toSeverity"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
