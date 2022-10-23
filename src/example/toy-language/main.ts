import Parser from "./parser.js";
import lexer from './lexrule.js';
import fs from 'fs';
import { userTypeDictionary } from './lexrule.js';
import { programScan } from './stage_1.js'
function basic_typeScan(source: string) {
    //把所有用户定义的class设置为basic_type
    let regularExpression: RegExp = /class\s+([a-zA-Z_][a-zA-Z_0-9]*)/g;
    for (let group: RegExpExecArray | null; (group = regularExpression.exec(source)) != null;) {
        let str = group[1]!;
        userTypeDictionary.add(str);
    }
}
function main() {
    userTypeDictionary.add('int');//注册系统类型
    userTypeDictionary.add('double');
    userTypeDictionary.add('void');
    let source = fs.readFileSync("./src/example/toy-language/test_2.ty", 'utf-8').toString();
    lexer.setSource(source);
    try {
        lexer.compile();
        console.time("解析源码耗时");
        basic_typeScan(source);
        let program = Parser(lexer);
        console.timeEnd("解析源码耗时");
        fs.writeFileSync(`./src/example/toy-language/output/stage-1.json`, JSON.stringify(program, null, 4));
        console.time(`阶段二耗时`);
        program = programScan(program);
        console.timeEnd(`阶段二耗时`);
        fs.writeFileSync(`./src/example/toy-language/output/stage-1.json`, JSON.stringify(program, null, 4));
    } catch (e: unknown) {
        if (e instanceof Error) {
            console.error(e.stack);
        }
        console.error(`${e}`);
    }
}
main();