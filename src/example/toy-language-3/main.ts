import Parser1 from "./parser-1.js";
import lexer from './lexrule.js';
import pre_process from './pre-process.js'
import fs from 'fs';
let parser1 = new Parser1();
let source = fs.readFileSync("./src/example/toy-language-3/test.ty", 'utf-8').toString();
lexer.setSource(source);
try {
    let oldT = new Date().getTime();
    console.log('预处理源码');
    pre_process(source);
    lexer.compile();
    parser1.parse(lexer);
    let newT = new Date().getTime();
    console.log(`解析源码耗时:${newT - oldT}ms`);
} catch (e: unknown) {
    console.error(`${e}`);
}