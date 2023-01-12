import Parser from "./parser.js";
import lexer from './lexrule.js';
import fs from 'fs';
import { userTypeDictionary } from './lexrule.js';
import semanticCheck from './semanticCheck.js'
import codeGen from './codeGen.js'
import { setProgram } from "./ir.js";
function basic_typeScan(source: string) {
    //把所有用户定义的class设置为basic_type
    let regularExpression: RegExp = /class\s+([a-zA-Z_][a-zA-Z_0-9]*)/g;
    for (let group: RegExpExecArray | null; (group = regularExpression.exec(source)) != null;) {
        let str = group[1]!;
        userTypeDictionary.add(str);
    }
}
function main() {
    //注册系统类型
    userTypeDictionary.add('int');
    userTypeDictionary.add('double');
    userTypeDictionary.add('bool');
    userTypeDictionary.add('void');
    let source = fs.readFileSync("./src/example/toy-language/test.ty", 'utf-8').toString();
    lexer.setSource(source);
    try {
        lexer.compile();
        console.time("解析源码耗时");
        basic_typeScan(source);
        let program = Parser(lexer);
        setProgram(program);
        console.timeEnd("解析源码耗时");
        fs.writeFileSync(`./src/example/toy-language/output/stage-1.json`, JSON.stringify(program, null, 4));
        console.time(`阶段二耗时`);
        semanticCheck();
        console.timeEnd(`阶段二耗时`);
        fs.writeFileSync(`./src/example/toy-language/output/stage-2.json`, JSON.stringify(program, null, 4));
        console.time(`阶段三耗时`);
        codeGen();
        console.timeEnd(`阶段三耗时`);
    } catch (e: unknown) {
        if (e instanceof Error) {
            console.error(e.stack);
        }
        console.error(`${e}`);
    }
}
main();