import Lexer from "../lexer/lexer.js";
let lexer=new Lexer();
lexer.addRule(['var', () => 'var']);
lexer.addRule(['val', () => 'val']);
lexer.compile();
lexer.setSource('varval');
console.log(lexer.yylex());
console.log(lexer.yylex());
lexer.setSource('varval');
lexer.removeRule('val');//测试规则移除功能
lexer.compile();
console.log(lexer.yylex());
console.log(lexer.yylex());