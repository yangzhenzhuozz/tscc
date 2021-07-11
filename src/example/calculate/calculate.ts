import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
let grammar: Grammar = {
    accept: ($: any[]) => {
        console.log(`AST处理完成`);//归约成功动作，显示计算结果
    },
    tokens: ['number', ';'],
    association: [
        { "left": ['+', '-'] },
        { "left": ['*', '/'] },
        { "right": [`uminus`] }//给取反符号"一元减法"最高优先级
    ],
    BNF: [
        { "stmts:stmts exp ;": { action: function ($) { console.log(`语句运算结果:${$[1]}`) } } },//每一个语句以分号结尾
        { "stmts:stmts ;": {} },//常用技巧,结合上面一个产生式使得语句可以重复出现
        { "stmts:": {} },//一个语句可以为空
        { "stmts:error ;": { action: function () { console.log(`错误恢复:读取下一个stmt`); } } },//错误处理,遇到错误会一直读到分号,然后重新开始分析
        { "exp:exp + insert exp": { action: function ($) { return $[0] + $[3]; } } },//加法
        {
            "insert:": {
                action: function ($, stack) {
                    let s=stack.slice(-2);
                    console.table(s);
                }
            }
        },//加法
        { "exp:exp - exp": { action: function ($) { return $[0] - $[2]; } } },//减法
        { "exp:exp * exp": { action: function ($) { return $[0] * $[2]; } } },//乘法
        { "exp:exp / exp": { action: function ($) { return $[0] / $[2]; } } },//除法
        { "exp:number": { action: function ($) { return $[0]; } } },//返回数字
        { "exp:- exp": { priority: "uminus", action: function ($) { return -$[1]; } } }//返回负$1
    ]
};
let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();//构造编译器代码
if (str != null) {//如果构造成功,往代码中添加调用代码
    fs.writeFileSync('./src/example/calculate/parser.ts', str);//输出typescript源码,然后用node运行即可
}
