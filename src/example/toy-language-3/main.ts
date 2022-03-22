import Parser1 from "./parser-1.js";
import lexer from './lexrule.js';
import pre_process from './pre-process.js'
import fs from 'fs';
let parser1 = new Parser1();
let source = fs.readFileSync("./src/example/toy-language-3/test.ty", 'utf-8').toString();
lexer.setSource(source);
try {
    lexer.compile();
    console.time("解析源码");
    console.log('预处理源码');
    pre_process(source);
    parser1.parse(lexer);
    console.timeEnd("解析源码");
} catch (e: unknown) {
    console.error(`${e}`);
}