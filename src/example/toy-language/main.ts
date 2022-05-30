import Parser from "./parser.js";
import lexer from './lexrule.js';
import pre_process from './pre-process.js'
import fs from 'fs';
import { userTypeDictionary } from './lexrule.js';
import generater from "code_generater.js"
userTypeDictionary.add('int');//注册系统类型
userTypeDictionary.add('double');
userTypeDictionary.add('void');
let source = fs.readFileSync("./src/example/toy-language/test_1.ty", 'utf-8').toString();
lexer.setSource(source);
try {
    lexer.compile();
    console.time("解析源码耗时");
    let parser = new Parser();
    pre_process(source);
    let ret = parser.parse(lexer);
    console.timeEnd("解析源码耗时");
    fs.writeFileSync(`./src/example/toy-language/output/class.json`, JSON.stringify(ret, null, 4));
    generater(JSON.stringify(ret));//开始生成二进制数据
} catch (e: unknown) {
    if (e instanceof Error) {
        console.error(e.stack);
    }
    console.error(`${e}`);
}