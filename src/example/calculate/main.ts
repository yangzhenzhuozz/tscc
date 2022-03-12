import Lexer from '../lexer/lexer.js'
import Parser from "./parser.js";
import { ParseException } from "./parser.js";
let parser = new Parser();
let lexer = new Lexer();
lexer.addRule(['(1|2|3|4|5|6|7|8|9|0)(1|2|3|4|5|6|7|8|9|0)*', (arg) => { arg.value = Number(arg.yytext); return "number"; }]);
lexer.addRule(['+', () => '+']);
lexer.addRule(['-', () => '-']);
lexer.addRule(['\\*', () => '*']);
lexer.addRule(['/', () => '/']);
lexer.addRule([';', () => ';']);
lexer.addRule(['( |\s|\t|\r|\n)( |\s|\t|\r|\n)*', undefined]);
//source第二行测试错误恢复
let source = `
11/2+2-3*4/5;
1+2-12 6;
6+7-8*9/10;
`;
lexer.setSource(source);
try {
    let r = parser.parse(lexer);//编译源码
    console.log(r);
} catch (e) {
    if (e instanceof ParseException) {
        console.error(e.toString());
    }
}