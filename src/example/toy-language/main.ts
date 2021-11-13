import Parser from "./parser.js";
import lexer from './lexrule.js'
import fs from 'fs';

let parser = new Parser();
lexer.setSource(fs.readFileSync("./src/example/toy-language/test.ty",'utf-8').toString());
try {
    parser.parse(lexer)
    console.log(`成功`);
    console.log(new Date());
} catch (e) {
    console.error(e);
    console.error(`失败`);
}