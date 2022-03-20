/**
 * 用于预处理源码,把所有 class xxx 后面的 xxx添加到lexer中的basic_type类型
 */
import lexer from './lexrule.js';
import { Type, ArrayType, FunctionType, Address, Scope, FunctionScope, BlockScope, SemanticException, ProgramScope, program } from "./lib.js"
function pre_process(source: string) {
    let regularExpression: RegExp = /class\s+([a-zA-Z_][a-zA-Z_0-9]+)/g;
    for (let group: RegExpExecArray | null; (group = regularExpression.exec(source)) != null;) {
        let str = group[1]!;
        program.registerType(str);
        lexer.addRule([str, (arg) => { arg.value = program.getType(str); return "basic_type"; }]);
    }
}
export default pre_process;