import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
import { scope } from './scope.js'

let grammar: Grammar = {
    userCode: `import {scope} from './scope.js'`,//让自动生成的代码包含import语句
    tokens: ['var', ';', 'id'],
    association: [],
    BNF: [
        //当一个继承属性需要往下传递的时候，创建一个临时非终结符保存这个属性
        { "program:W1 units": {} },//program.scope=new scope();units.scope=program.scope
        {
            "W1:": {
                action: function () {
                    return { scope: new scope() };
                }
            }
        },
        { "units:W2 unit W3 units": {} },//unit.scope=units.scope;units1.scope=units.scope
        {
            "W2:": {
                action: function (args, stack) {
                    let stacks = stack.slice(-1);//取栈中最后1个符号
                    return stacks[0];//把属性复制一份
                }
            }
        },
        {
            "W3:": {
                action: function (args, stack) {
                    let stacks = stack.slice(-3);//取栈中最后3个符号
                    return stacks[0];//把属性复制一份
                }
            }
        },
        { "units:": {} },
        { "unit:W4 declare": {} },//declare.scope=unit.scope
        {
            "W4:": {
                action: function (args, stack) {
                    let stacks = stack.slice(-1);//取栈中最后1个符号
                    return stacks[0];//把属性复制一份
                }
            }
        },
        {
            "declare:var id ;": {//declare.scope.addSym(id)
                action: function (args, stack) {
                    let stacks = stack.slice(-1);//取栈中最后1个符号
                    stacks[0].scope.addSym(args[1].name);
                }
            }
        },
    ]
};
let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();//构造编译器代码
if (str != null) {//如果构造成功,往代码中添加调用代码
    console.log(`成功`);
    fs.writeFileSync('./src/example/toy-language/parser.ts', str);
} else {
    console.log(`失败`);
}