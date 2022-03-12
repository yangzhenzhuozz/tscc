import Parser1 from "./parser-1.js";
import Parser2 from "./parser-2.js";
import lexer from './lexrule.js';
import fs from 'fs';
let parser1 = new Parser1();
let parser2 = new Parser2();
lexer.setSource(fs.readFileSync("./src/example/toy-language-3/test.ty", 'utf-8').toString());
try {
    let oldT = new Date().getTime();
    console.log('第1次解析');
    lexer.compile();
    parser1.parse(lexer);
    lexer.reset();//重置词法分析器
    console.log('第2次解析');
    lexer.compile();
    parser2.parse(lexer);
    let newT = new Date().getTime();
    console.log(`解析源码耗时:${newT - oldT}ms`);
} catch (e: unknown) {
    console.error(`${e}`);
}