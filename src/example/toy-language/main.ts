import Parser from "./parser.js";
import lexer from './lexrule.js';
import pre_process from './pre-process.js'
import fs from 'fs';
import { userTypeDictionary } from './lexrule.js';
userTypeDictionary.add('int');//注册系统类型
userTypeDictionary.add('double');
let source = fs.readFileSync("./src/example/toy-language/test.ty", 'utf-8').toString();
lexer.setSource(source);
try {
    lexer.compile();
    console.time("解析源码耗时");
    let parser = new Parser();
    pre_process(source);
    parser.parse(lexer);
    console.timeEnd("解析源码耗时");
} catch (e: unknown) {
    console.error(`${e}`);
}