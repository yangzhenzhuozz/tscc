import Parser, { YYTOKEN } from "./parser.js";
import { ParseException } from "./parser.js";
class Lexer {
  private source: string;
  private pos: number;
  private lastToken: string = "";
  constructor() {
    this.source = "";
    this.pos = 0;
  }
  setSource(source: string) {
    this.source = source;
    this.pos = 0;
  }
  yylex(): YYTOKEN {
    if (this.pos >= this.source.length) {
      return { type: "$", value: "", yytext: "" };
    }

    const c = this.source[this.pos];

    const isDigit = (char: string) => char >= "0" && char <= "9";
    const createToken = (type: string, value: string) => {
      this.pos++;
      this.lastToken = value;
      return { type, value, yytext: value };
    };

    if (isDigit(c)) {
      let num = 0;
      while (isDigit(this.source[this.pos])) {
        num = num * 10 + parseInt(this.source[this.pos]);
        this.pos++;
      }
      this.lastToken = num.toString();
      return { type: "number", value: num, yytext: num.toString() };
    }

    switch (c) {
      case "+":
      case "-":
      case "*":
      case "/":
      case ";":
        return createToken(c, c);
      case " ":
      case "\n":
        this.pos++;
        return this.yylex();
      default:
        throw new Error(`无法识别的字符:${c}`);
    }
  }
  yyerror(msg: string) {
    console.error(`${msg},"${this.lastToken}"附近有错误`);
  }
}
let lexer = new Lexer();
/*
let source = `
11/2+2-3*4/5;
1+2-12+6;
6+7-8*9/10;
`；
*/
//source第二三行用于演示错误恢复后的继续分析,如果改为上面的代码,则不会有错误发生
let source = `
11/2+2-3*4/5;
1+2-12 6;
6+7-8*9/10;
`;
lexer.setSource(source);
try {
  let r = Parser(lexer); //编译源码
  console.log(r);
} catch (e) {
  if (e instanceof ParseException) {
    console.error(e.toString());
  }
}
