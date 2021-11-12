import Lexer from './lexer.js'
function main() {
    let lexer = new Lexer();
    lexer.addRule(["aa*",undefined]);
    lexer.compile();
    lexer.setSource('123ab112312 123');
    for (; ;) {
        let r = lexer.yylex();
        console.log(`${r.type}\t${r.yytext}\t${r.value}`);
        if (r.type == '$') {
            break;
        }
    }
}
main();