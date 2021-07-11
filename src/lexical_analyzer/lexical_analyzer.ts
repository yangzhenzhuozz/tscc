interface Token {
    type: string;
    value: any;
}
interface YYTOKEN extends Token {
    yytext: string;
    yyindex: number
}
class Lexical {
    private lastIndex = 0;
    private buffer: string = '';
    private symbols: (string | RegExp | ((str: string) => any))[][];
    /**
     * 
     * @param input 输入的源码
     * @param symbols 二维数组，每一行line的元素数量可以为3、2、1，分别表示如下内容
     * [symbol:string,reg:RegExp,resolver:(str: string) => any]  //对应的符号、正则表达式、字符串处理函数
     * [symbol:string,reg:RegExp]  //对应的符号、正则表达式
     * [reg:RegExp]  //正则表达式，表示这个正则匹配的字符被抛弃
     * 所有的正则表达式都必须使用粘滞模式(sticky),即使用y标志
     */
    constructor(symbols: (string | RegExp | ((str: string) => any))[][]) {
        this.symbols = symbols;
        this.symbols.push(["$", /$/y]);//自动添加结束符
    }
    setSource(src: string) {
        this.buffer = src;
        this.lastIndex = 0;
    }
    lex(): YYTOKEN {
        for (let i = 0; i < this.symbols.length; i++) {
            let reg: RegExp;
            if (this.symbols[i].length > 1) {
                reg = this.symbols[i][1] as RegExp;
            } else {
                reg = this.symbols[i][0] as RegExp;
            }
            reg.lastIndex = this.lastIndex;
            let match = reg.exec(this.buffer);
            if (match != null) {
                this.lastIndex = reg.lastIndex;
                if (this.symbols[i].length != 1) {//不需要跳过
                    let val: any;
                    if (this.symbols[i].length == 3) {
                        val = (this.symbols[i][2] as (tr: string) => any)(match[0]);
                    } else {
                        val = undefined;
                    }
                    return {
                        type: this.symbols[i][0] as string,
                        value: val,
                        yytext: match[0],
                        yyindex: reg.lastIndex
                    };
                }
                else {//如果本符号没有定义动作,则跳过并读取下一个符号
                    i = -1;//重置循环,经过i++运算后,i被重置为0
                }
            }
        }
        throw `无法识别的符号:第${this.lastIndex}个字符\n${this.buffer.substring(this.lastIndex, this.lastIndex+10)}`;
    }
}
export default Lexical;
