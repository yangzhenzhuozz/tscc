import Parser from "./parser-base.js";
import lexer from './lexrule.js';
import fs from 'fs';
let parser = new Parser();
lexer.setSource(fs.readFileSync("./src/example/toy-language-2/test.ty", 'utf-8').toString());
try {
    let oldT = new Date().getTime();
    parser.parse(lexer)
    let newT = new Date().getTime();
    console.log(`解析源码耗时:${newT - oldT}ms`);
} catch (e: unknown) {
    console.error(`${e}`);
}