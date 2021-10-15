import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
import { Scope, Quadruple, TmpScope, Address } from './lib.js'

let grammar: Grammar = {
    userCode: `import { Scope, Quadruple, TmpScope, Address } from './lib.js'`,//让自动生成的代码包含import语句
    tokens: ['var', ';', 'id', 'number', '+', '(', ')'],
    association: [
        { 'right': ['='] },
        { 'left': ['==', '!='] },
        { 'left': ['||'] },
        { 'left': ['&&'] },
        { 'left': ['!'] },
        { 'left': ['>', '<', '<=', '>='] },
        { 'left': ['+', '-'] },
        { 'left': ['*', '/'] },
    ],
    BNF: [
        //当一个继承属性需要往下传递的时候，创建一个临时非终结符保存这个属性
        {
            "program:program_W0 units": {//program.scope=new scope();units.scope=program.scope
                action: function (args, stack) {
                }
            }
        },
        { "units:unit W2 units": {} },//unit.scope=units.scope;units1.scope=units.scope
        { "units:": {} },
        { "unit:declare": {} },//declare.scope=unit.scope
        {
            "declare:var id ;": {//declare.scope.addSym(id.name)
                action: function (args, stack) {
                    let head = stack.slice(-1)[0];
                    head.scope.addSym(args[1].name);
                }
            }
        },
        {
            "unit:stmt_W1 stmt": {//stmt.scope=unit.scope,stmt.tmpScope=new scope
                action: function (args, stack) {
                }
            }
        },
        {
            "stmt:object ;": {//object.scope=stmt.scope
                action: function (args, stack) {
                    if (args[0].code != undefined) {
                        for (let p of args[0].code) {
                            console.log(`${p}`);
                        }
                    }
                }
            }
        },
        {
            "object:id": {
                action: function (args, stack) {
                    let head = stack.slice(-1)[0];
                    let name = args[0].name;
                    let address = head.scope.getSym(name);
                    return { type: `number`, address: new Address('varible', address) };
                }
            }
        },
        {
            "object:number": {
                action: function (args, stack) {
                    return { type: `number`, address: new Address('constant', args[0]) };
                }
            }
        },
        {
            "object:( W2 object )": {
                action: function (args, stack) {
                    return args[2];
                }
            }
        },
        {
            "object:object + W3 object": {
                action: function (args, stack) {
                    let head = stack.slice(-1)[0];
                    let resultAddress = new Address('temporary', head.tmpScope.addSym());
                    let A = args[0];
                    let B = args[3];
                    let code = new Array<Quadruple>();
                    if (A.code != undefined) {
                        code = code.concat(A.code);
                    }
                    if (B.code != undefined) {
                        code = code.concat(B.code);
                    }
                    code.push(new Quadruple('+', A.address, B.address, resultAddress));
                    return { type: 'number', address: resultAddress, code: code }
                }
            }
        },
        { "object:object - W3 object": {} },
        { "object:object * W3 object": {} },
        { "object:object / W3 object": {} },
        { "object:object > W3 object": {} },
        { "object:object == W3 object": {} },
        { "object:object != W3 object": {} },
        { "object:object >= W3 object": {} },
        { "object:object < W3 object": {} },
        { "object:object <= W3 object": {} },
        { "object:object && W3 object": {} },
        { "object:object || W3 object": {} },
        { "object:! W2 object": {} },
        {
            "object:object = W3 object": {
                action: function (args, stack) {
                    let result = args[0];
                    let A = args[3];
                    if(result.address.location!='varible'){
                        throw `赋值语句的左侧必须是左值`;
                    }
                    let code = new Array<Quadruple>();
                    if (A.code != undefined) {
                        code = code.concat(A.code);
                    }
                    code.push(new Quadruple('=', A.address, null, result.address));
                    return { type: 'number', address: result.address, code: code };
                }
            }
        },
        {
            "program_W0:": {
                action: function () {
                    return { scope: new Scope() };
                }
            }
        },
        {
            "stmt_W1:": {
                action: function (args, stack) {
                    let head = stack.slice(-1)[0];
                    head.tmpScope = new TmpScope();
                    return head;
                }
            }
        },
        {
            "W2:": {
                action: function (args, stack) {
                    let head = stack.slice(-2)[0];
                    return head;
                }
            }
        },
        {
            "W3:": {
                action: function (args, stack) {
                    let head = stack.slice(-3)[0];
                    return head;
                }
            }
        }
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
