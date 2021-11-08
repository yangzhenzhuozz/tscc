import { State, Automaton } from './lib.js'
interface Token {
    type: string;
    value: any;
}
interface YYTOKEN extends Token{
    yytext:string;
}
interface Lex {
    lex(): YYTOKEN
}
class Parser {
    public parse(lexer: Lex):any {
        let state: { [key: string]: string | undefined }[] = JSON.parse(`[{"exp":"s1","normal_ch":"s2"},{"$":"r0","exp":"s3","|":"s4","*":"s5","normal_ch":"s2"},{"*":"r4","|":"r4","$":"r4","normal_ch":"r4"},{"exp":"s3","|":"r2","*":"r2","$":"r2","normal_ch":"r2"},{"exp":"s6","normal_ch":"s2"},{"*":"r3","|":"r3","$":"r3","normal_ch":"r3"},{"exp":"s3","|":"r1","*":"s5","$":"r1","normal_ch":"r1"}]`);
        let syntaxHead: string[] = [`exp'`,`exp`,`exp`,`exp`,`exp`];//每个产生式的头部,规约的时候使用
        let syntaxLength = [1,3,2,2,1];
        let functionArray:(((args:any[],stack:any[])=>any)|undefined)[]=[
            ($) => {
        return $[0];
    },function ($, stack) {
                    let s = new State();
                    let e = new State();
                    let exp1 = $[0];
                    let exp2 = $[2];
                    s.addEdge("", exp1.start);
                    s.addEdge("", exp2.start);
                    exp1.end.addEdge("", e);
                    exp2.end.addEdge("", e);
                    return new Automaton(s, e);
                },function ($, stack) {
                    let exp1 = $[0];
                    let exp2 = $[1];
                    exp1.end.addEdge("", exp2.start);
                    return new Automaton(exp1.start, exp2.end);
                },function ($, stack) {
                    let s = new State();
                    let e = new State();
                    let exp1 = $[0];
                    exp1.end.addEdge("", e);
                    exp1.end.addEdge("", exp1.start);
                    s.addEdge("", exp1.start);
                    s.addEdge("", e);
                    return new Automaton(s, e);
                },function ($, stack) {
                    let ch = $[0];
                    let s = new State();
                    let e = new State();
                    s.addEdge(ch, e);
                    return new Automaton(s, e);
                }];
        let result;//最终规约之后的返回值,由accept动作提供
        let yytoken:YYTOKEN | undefined;
        let errorRollback = false;//是否处于错误恢复模式
        let hasError=false;//是否曾经出现过错误
        let symbolStack: Token[] = [];//符号栈
        let symbolValStack:any[]=[];//符号值栈，是symbolStack的value构成的栈，用于插入动作
        let stateStack: number[] = [0];//状态栈
        let reduceToken: Token | null = null;
        let lexBuffer: Token | null = null;//lex输入缓冲,如果遇到规约,则上次从lex读取到的数据还没有被使用
        L0:
        for (; ;) {
            let nowState = stateStack[stateStack.length - 1];
            let sym: Token;
            /**
             * 如果没有规约出来的符号,则使用lex读取输入,因为不可能出现连写的规约,所以用一个变量reduceToken保存规约而 成的符号就够了
             * 对于LR(1)分析器来说,规约要求输入符号必须是一个终结符,而规约必定是得到一个非终结符,所以不可能出现不读取输入而连续多次规约的情况
             */
            if (reduceToken == null) {
                if (lexBuffer == null) {
                    yytoken = lexer.lex();
                    lexBuffer = yytoken;
                }
                sym = lexBuffer;
                lexBuffer = null;
            } else {
                sym = reduceToken;
                reduceToken = null;
            }
            let actionString = state[nowState][sym.type];
            if (actionString != undefined&&actionString != 'err') {
                if (sym.type != `error`) {//不是因为error符号产生的移入则解除错误回滚标志
                    errorRollback = false;
                }
                let action = actionString.substring(0, 1);
                let target = Number(actionString.substring(1, actionString.length));
                if (action == "s") {//移入
                    symbolStack.push(sym);
                    symbolValStack.push(sym.value);//保持和stateStack一致
                    stateStack.push(target);
                } else {//规约
                    let args: any[] = [];
                    for (let i = 0; i < syntaxLength[target]; i++) {
                        args.unshift(symbolStack.pop()!.value);
                        symbolValStack.pop();//保持和stateStack一致
                        stateStack.pop();
                    }
                    reduceToken = {
                        type: syntaxHead[target],
                        value: undefined//调用bnf动作
                    };
                    if(functionArray[target]!=undefined){
                        reduceToken.value=functionArray[target]!(args,symbolValStack);//调用bnf动作
                    }
                    if (target == 0) {
                        result=reduceToken.value;//增广文法的返回值
                        break;//文法分析结束
                    }
                    lexBuffer = sym;//把读取到的符号暂时退回去
                }
            } else {
                hasError=true;
                if (errorRollback) { //已经在错误处理状态中了
                    //什么都不用做,消耗lex中的token就行了
                    if (sym.type == `$`) {//因为EOF导致的错误,不需要回溯了
                        break;
                    }
                }
                else {//如果不处于错误恢复状态,则进行一些操作
                    this.yyerror(sym,yytoken!);
                    if (sym.type == `$`) {//因为EOF导致的错误,不需要回溯了
                        break;
                    }
                    errorRollback = true;
                    //状态栈中默认包含一个状态0,如果回溯到这个位置还不能移入error,则放弃回溯
                    for (; stateStack.length > 0;) {//尝试回退栈中状态,直到状态包含一个形如 A->.error any,any的项,简单来说就是这个状态可以接收error
                        if (state[stateStack[stateStack.length-1]][`error`] != undefined) {
                            reduceToken = {
                                type: `error`,
                                value: undefined
                            };
                            lexBuffer = sym;//把读取到的符号暂时退回去
                            continue L0;//假装已经把所有的错误符号规约成了error,进行下一轮操作
                        } else {
                            stateStack.pop();
                            symbolValStack.pop();//保持和stateStack一致
                            symbolStack.pop();
                        }
                    }
                    return false;//弹出栈中的所有符号都不能处理错误,结束语法分析,并返回错误
                }
            }
        }
        if(hasError){
            throw `解析错误`;
        }else{
            return result;
        }
    }
    public yyerror(token: Token,yytoken:YYTOKEN) {
        console.error(`语法错误:此处不能接受${token.type}`);
        console.error(`yytext is ${yytoken.yytext}`);
    }
}
export default Parser