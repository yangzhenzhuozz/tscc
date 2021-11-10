import Lexer from './lib.js'
function main() {
    let lexer = new Lexer();
    lexer.addRule(["( |\t|\r|\n)*",undefined]);
    lexer.addRule(["(0|1|2|3|4|5|6|7|8|9)(0|1|2|3|4|5|6|7|8|9)*", (arg) => { arg.value = Number(arg.yytext); return "Number"; }]);
    lexer.addRule(["(a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z)(a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z|0|1|2|3|4|5|6|7|8|9)(0|1|2|3|4|5|6|7|8|9)*", () => "id"]);
    lexer.compile();
    lexer.setSource('123ab112312 123');
    for (; ;) {
        let r = lexer.lex();
        console.log(`${r.type}\t${r.yytext}\t${r.value}`);
        if (r.type == '$') {
            break;
        }
    }
}
main();