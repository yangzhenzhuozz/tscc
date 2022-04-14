/**
 * 用于预处理源码,把所有 class xxx 后面的 xxx添加到lexer中的basic_type类型
 */
import { userTypeDictionary } from './lexrule.js';
function pre_process(source: string) {
    let regularExpression: RegExp = /class\s+([a-zA-Z_][a-zA-Z_0-9]+)/g;
    for (let group: RegExpExecArray | null; (group = regularExpression.exec(source)) != null;) {
        let str = group[1]!;
        userTypeDictionary.add(str);
    }
}
export default pre_process;