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
    importDeclarationToString: ()=>importDeclarationToString,
    getSourceRangeFromTransformedOffset: ()=>getSourceRangeFromTransformedOffset,
    hasSameLeftInAssignStatement: ()=>hasSameLeftInAssignStatement,
    getFixData: ()=>getFixData,
    getDefaultImportByRequest: ()=>getDefaultImportByRequest
});
const ruleUtils_namespaceObject = require("@rsdoctor/utils/ruleUtils");
const common_namespaceObject = require("@rsdoctor/utils/common");
function getDefaultImportByRequest(node, request) {
    return ruleUtils_namespaceObject.parser.utils.getDefaultImports(node).find((decl)=>decl.source.value === request);
}
function hasSameLeftInAssignStatement(node, compare) {
    return node.body.filter(ruleUtils_namespaceObject.parser.asserts.isExpressionStatement).map((node)=>node.expression).filter(ruleUtils_namespaceObject.parser.asserts.isAssignmentExpression).map((node)=>node.left).find((node)=>compare.some((item)=>ruleUtils_namespaceObject.parser.utils.isSameSemantics(node, item)));
}
function importDeclarationToString(node) {
    const defaultSpecifier = node.specifiers[0];
    const rawRequest = (node.source.raw ?? '').trim();
    return `import * as ${defaultSpecifier.local.name} from ${rawRequest}`;
}
function getFixData(module, node, originalRange) {
    const { source, transformed } = module.getSource();
    const document = (0, ruleUtils_namespaceObject.getDocument)(source);
    const newImportText = importDeclarationToString(node);
    const oldText = transformed.substring(node.start, node.end);
    const hasLastSemi = ';' === oldText[oldText.length - 1];
    return {
        start: document.offsetAt(originalRange.start),
        end: document.offsetAt(originalRange.end),
        newText: hasLastSemi ? `${newImportText};` : newImportText
    };
}
function getSourceRangeFromTransformedOffset(module, node) {
    var _sourceRange_end, _sourceRange_end1;
    const source = module.getSource();
    const sourceMap = module.getSourceMap();
    const transformedStart = node.loc.start;
    const transformedEnd = node.loc.end;
    if (!transformedStart || !transformedEnd) return;
    const transformedReport = {
        path: module.path,
        content: source.transformed,
        isTransformed: true,
        range: {
            start: transformedStart,
            end: transformedEnd
        }
    };
    if (!sourceMap) return transformedReport;
    const sourceRange = module.getSourceRange(node.loc);
    if (common_namespaceObject.Lodash.isUndefined(null == sourceRange ? void 0 : sourceRange.start.line) || common_namespaceObject.Lodash.isUndefined(null == sourceRange ? void 0 : sourceRange.start.column) || common_namespaceObject.Lodash.isUndefined(null == sourceRange ? void 0 : null == (_sourceRange_end = sourceRange.end) ? void 0 : _sourceRange_end.line) || common_namespaceObject.Lodash.isUndefined(null == sourceRange ? void 0 : null == (_sourceRange_end1 = sourceRange.end) ? void 0 : _sourceRange_end1.column)) return transformedReport;
    return {
        path: module.path,
        isTransformed: false,
        content: source.source,
        range: sourceRange
    };
}
exports.getDefaultImportByRequest = __webpack_exports__.getDefaultImportByRequest;
exports.getFixData = __webpack_exports__.getFixData;
exports.getSourceRangeFromTransformedOffset = __webpack_exports__.getSourceRangeFromTransformedOffset;
exports.hasSameLeftInAssignStatement = __webpack_exports__.hasSameLeftInAssignStatement;
exports.importDeclarationToString = __webpack_exports__.importDeclarationToString;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "getDefaultImportByRequest",
    "getFixData",
    "getSourceRangeFromTransformedOffset",
    "hasSameLeftInAssignStatement",
    "importDeclarationToString"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
