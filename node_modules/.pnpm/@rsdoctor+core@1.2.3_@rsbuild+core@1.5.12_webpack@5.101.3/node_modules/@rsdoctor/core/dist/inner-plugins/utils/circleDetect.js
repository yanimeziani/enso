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
    checkCirclePath: ()=>checkCirclePath
});
const checkCirclePath = (obj, record, res, level, maxLevel = 3)=>{
    const idx = record.slice(0, record.length - 1).findIndex((v)=>v.ref === obj);
    if (-1 !== idx) {
        const key = record.map((v)=>v.prop);
        if (res.indexOf(key) < 0) return void res.push(key);
    }
    if ('object' == typeof obj && null !== obj && level < maxLevel) for (const [k, v] of Object.entries(obj))checkCirclePath(v, [
        ...record,
        {
            prop: k,
            ref: v
        }
    ], res, level + 1);
};
exports.checkCirclePath = __webpack_exports__.checkCirclePath;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "checkCirclePath"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
