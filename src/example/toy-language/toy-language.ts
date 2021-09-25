import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
import { scope } from './scope.js'

let grammar: Grammar = {
    userCode: `import {scope} from './scope.js'`,//让自动生成的代码包含import语句
    tokens: ['var', ';', 'id', 'number', '+'],
    association: [
        { 'left': ['+'] },
        { 'right': ['='] }
    ],
    BNF: [
        //当一个继承属性需要往下传递的时候，创建一个临时非终结符保存这个属性
        {
            "program:W0 units": {//program.scope=new scope();units.scope=program.scope
                action:function(args,stack){
                    console.table(args[0].scope.symTable);
                }
            }
        },
        {
            "W0:": {
                action: function () {
                    return { scope: new scope() };
                }
            }
        },
        { "units:unit W2 units": {} },//unit.scope=units.scope;units1.scope=units.scope
        {
            "W2:": {
                action: function (args, stack) {
                    let sym = stack.slice(-2);
                    return { scope: sym[0].scope };
                }
            }
        },
        { "units:": {} },
        { "unit:declare": {} },//declare.scope=unit.scope
        {
            "declare:var id ;": {//declare.scope.addSym(id.name)
                action: function (args, stack) {
                    let sym = stack.slice(-1);
                    sym[0].scope.addSym(args[1].name);
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