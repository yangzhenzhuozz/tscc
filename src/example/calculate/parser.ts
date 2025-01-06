//本文件生成于src/example/calculate/calculate.ts,无保存的必要
export interface Token {
    type: string;
    value: any;
}
export interface YYTOKEN extends Token{
    yytext:string;
}
export interface Lex {
    yylex(): YYTOKEN;
    yyerror(msg: string): any;
}
export class ParseException extends Error{
    constructor(msg:string){
        super(msg);
        super.name='ParseException';
    }
}
export default function Parse(lexer: Lex):any {
    let state: { [key: string]: string | undefined }[] = JSON.parse(`[{"stmts":"s1","$":"r2","error":"s2","number":"r2","-":"r2"},{"$":"r0","exp":"s3","number":"s4","-":"s5"},{";":"s6"},{";":"s7","+":"s8","-":"s9","*":"s10","/":"s11"},{"-":"r9",";":"r9","*":"r9","/":"r9","+":"r9"},{"exp":"s12","number":"s4","-":"s5"},{"-":"r3","$":"r3","number":"r3"},{"-":"r1","$":"r1","number":"r1"},{"insert":"s13","-":"r5","number":"r5"},{"exp":"s14","number":"s4","-":"s5"},{"exp":"s15","number":"s4","-":"s5"},{"exp":"s16","number":"s4","-":"s5"},{"+":"r10","-":"r10","*":"r10","/":"r10",";":"r10"},{"exp":"s17","number":"s4","-":"s5"},{"+":"r6","-":"r6",";":"r6","*":"s10","/":"s11"},{"+":"r7","-":"r7","*":"r7",";":"r7","/":"r7"},{"+":"r8","-":"r8","*":"r8","/":"r8",";":"r8"},{"+":"r4","-":"r4",";":"r4","*":"s10","/":"s11"}]`);
    let syntaxHead: string[] = [`stmts'`,`stmts`,`stmts`,`stmts`,`exp`,`insert`,`exp`,`exp`,`exp`,`exp`,`exp`];//每个产生式的头部,规约的时候使用
    let syntaxLength = [1,3,0,2,4,0,3,3,3,1,2];
    let functionArray:(((args:any[],stack:any[])=>any)|undefined)[]=[
        ($) => {
        console.log(`计算完成:最后一个算式的结果为 ${$[0]}`);
        return $[0];
    },function ($) {
                    console.log(`算式结果为:${$[1]}`);
                    return $[1];
                },,function () {
                    console.log(`错误恢复:读取下一个stmt`);
                },function ($) {
                    return $[0] + $[3];
                },function ($, stack) {
                    let s = stack.slice(-2);
                    console.log(`内联动作,加号的左侧计算结果为: ${s[0]} +`);
                },function ($) {
                    return $[0] - $[2];
                },function ($) {
                    return $[0] * $[2];
                },function ($) {
                    return $[0] / $[2];
                },function ($) {
                    return $[0];
                },function ($) {
                    return -$[1];
                }];
    let result;//最终规约之后的返回值,由accept动作提供
    let yytoken:YYTOKEN | undefined;
    let errorRollback = false;//是否处于错误恢复模式
    let hasError=false;//是否曾经出现过错误
    //如龙书所说:"S0(即分析器的开始状态)不代表任何文法符号，它只是作为栈底标记，同时也在语法分析过程中担负了重要的角色。"
    //自己标注的:用于规约成增广文法初始符号S'
    let symbolStack: Token[] = [{ type: syntaxHead[0], value: undefined }];//符号栈
    let symbolValStack: any[] = [undefined];//符号值栈，是symbolStack的value构成的栈，用于插入动作
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
                yytoken = lexer.yylex();
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
                    value: undefined//规约动作的返回值
                };
                if(functionArray[target]!=undefined){
                    reduceToken.value=functionArray[target]!(args,symbolValStack);//调用规约动作
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
                lexer.yyerror(`语法错误:此处不能接受${sym.type}`);
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
                break;//弹出栈中的所有符号都不能处理错误,结束语法分析,在函数末尾抛出异常
            }
        }
    }
    if(hasError){
        throw new ParseException(`源码不符合文法`);
    }else{
        return result;
    }
}
