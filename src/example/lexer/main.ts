import { Automaton } from "./lib.js";
import Parser from "./parser.js";
interface Token {
    type: string;
    value: any;
}
interface YYTOKEN extends Token {
    yytext: string;
}
//解析正则表达式的分析器
class LexForREG {
    private source: string = '';
    private char_index = 0;
    private keyWord = new Set<string>(['(', ')', '|', '*']);
    public setSource(src: string) {
        this.char_index = 0;
        this.source = src;
    }
    public lex(): YYTOKEN {
        if (this.char_index >= this.source.length) {
            return {
                type: "$",
                value: "",
                yytext: ""
            };
        }
        let ch = this.source.charAt(this.char_index++);
        if (this.keyWord.has(ch)) {
            return {
                type: ch,
                value: ch,
                yytext: ch
            };
        }
        else if (ch == '\\') {//遇到反斜杠，需要对后面字符进行转义
            if (this.char_index >= this.source.length - 1) {
                throw `反斜杠'\\'后面没有任何字符`;
            }
            ch = this.source.charAt(this.char_index++);//取后面一个字符
            return {
                type: "normal_ch",
                value: ch,
                yytext: ch
            };
        } else {
            return {
                type: "normal_ch",
                value: ch,
                yytext: ch
            };
        }
    }
}
function main() {
    let parser=new Parser();
    let lexer = new LexForREG();
    lexer.setSource("a|b");
    let automaton:Automaton=parser.parse(lexer)
    console.log(automaton);
}
main();