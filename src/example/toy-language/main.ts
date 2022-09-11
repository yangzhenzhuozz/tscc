import Parser from "./parser.js";
import lexer from './lexrule.js';
import pre_process from './pre-process.js'
import fs from 'fs';
import { userTypeDictionary } from './lexrule.js';
userTypeDictionary.add('int');//注册系统类型
userTypeDictionary.add('double');
userTypeDictionary.add('void');
let source = fs.readFileSync("./src/example/toy-language/test_2.ty", 'utf-8').toString();
lexer.setSource(source);
try {
    lexer.compile();
    console.time("解析源码耗时");
    let parser = new Parser();
    pre_process(source);
    let ret = parser.parse(lexer);
    console.timeEnd("解析源码耗时");
    fs.writeFileSync(`./src/example/toy-language/output/stage-1.json`, JSON.stringify(ret, null, 4));
} catch (e: unknown) {
    if (e instanceof Error) {
        console.error(e.stack);
    }
    console.error(`${e}`);
}