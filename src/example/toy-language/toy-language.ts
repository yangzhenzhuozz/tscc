import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
import lexer from "./lexrule.js";
import { Scope, Address, SemanticException, Type, GlobalScope, FunctionScope, ClassScope, StmtScope, StmtDescriptor, ObjectDescriptor, BlockScope, Quadruple } from './lib.js'
let grammar: Grammar = {
    userCode: `import { Scope, Address, SemanticException, Type, GlobalScope, FunctionScope, ClassScope, StmtScope, StmtDescriptor, ObjectDescriptor, BlockScope, Quadruple } from './lib.js'`,//让自动生成的代码包含import语句
    tokens: ['var', '...', ';', 'id', 'constant_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'basic_type', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'sealed', 'this', 'return'],
    association: [
        { 'right': ['='] },
        { 'right': ['?'] },
        { 'left': ['==', '!='] },
        { 'left': ['||'] },
        { 'left': ['&&'] },
        { 'left': ['!'] },
        { 'nonassoc': ['>', '<', '<=', '>='] },
        { 'left': ['+', '-'] },
        { 'left': ['*', '/'] },
        { 'left': ['++', '--'] },
        { 'nonassoc': ['low_priority_for_array_placeholder'] },
        { 'right': ['['] },
        { 'nonassoc': ['('] },
        { 'left': ['.'] },
        { 'nonassoc': ['low_priority_for_if_stmt'] },//这个符号的优先级小于else
        { 'nonassoc': ['else'] },
    ],
    BNF: [
        { "program:createScopeForProgram import_stmts W3_1 program_units": {} },
        {
            "createScopeForProgram:": {
                action: function ($, s): Scope {
                    return new GlobalScope();
                }
            }
        },
        {
            "W3_1:": {
                action: function ($, s) {
                    return s.slice(-3)[1];
                }
            }
        },
        { "program_units:program_units W2_0 program_unit": {} },
        { "program_units:": {} },
        { "program_unit:declare": {} },
        { "program_unit:cass_definition": {} },
        { "import_stmts:": {} },
        { "import_stmts:import_stmts import_stmt": {} },
        { "import_stmt:import id as id ;": {} },

        { "cass_definition:modifier class id extends_declare { class_units }": {} },
        { "modifier:": {} },
        { "modifier:valuetype": {} },
        { "modifier:sealed": {} },
        { "extends_declare:extends basic_type": {} },
        { "extends_declare:": {} },
        { "class_units:class_units class_unit": {} },
        { "class_units:": {} },
        { "class_unit:cass_definition": {} },
        { "class_unit:declare": {} },
        { "class_unit:operator_overload": {} },
        { "operator_overload:operator + ( parameter ) : type { statements }": {} },

        {
            "declare:var id : type ;": {
                action: function ($, s) {
                    let id = $[1] as string;
                    let type = $[3] as Type;
                    let head = s.slice(-1)[0] as Scope;
                    let headTmp = head;
                    for (; (headTmp instanceof StmtScope) || (headTmp instanceof BlockScope);) {
                        headTmp = headTmp.parentScope!;
                    }
                    if (!headTmp.createVariable(id, type)) {
                        throw new SemanticException(headTmp.errorMSG);//并且终止解析
                    }
                    if (head.parentScope instanceof BlockScope) {//如果是blockScope内部的声明,则记录
                        head.parentScope.variables.add(id);
                    }
                    return new StmtDescriptor();
                }
            }
        },
        { "declare:function_definition": {} },

        {
            "type:basic_type arr_definition": {
                action: function ($, s) {
                    return $[1];//basic_type的属性已经被继承到arr_definition中了
                }
            }
        },
        { "type:( lambda_parameter_types ) => type": { action: ($, s) => `(${$[1]})=>${$[4]}` } },
        {
            "lambda_parameter_types:": {
                action: () => ""
            }
        },
        { "lambda_parameter_types:lambda_parameter_type_list": { action: ($, s) => $[0] } },
        { "lambda_parameter_type_list:lambda_parameter_type_list , type": { action: ($, s) => `${$[0]},${$[2]}` } },
        { "lambda_parameter_type_list:type": { action: ($, s) => $[0] } },
        {
            "arr_definition:arr_definition [ ]": {
                action: function ($, s) {
                    let arr_definition = $[0] as Type;
                    return Type.ConstructArray(arr_definition);
                }
            }
        },
        {
            "arr_definition:": {
                action: function ($, s) {
                    return s.slice(-1)[0];//从basic_type中得到属性
                }
            }
        },

        {
            "function_definition:function id ( parameters ) : type { createFunctionScope statements }": {
                action: function ($, s) {
                    let createFunctionDescriptor = $[8] as FunctionScope;
                    let statements = $[9] as StmtDescriptor;
                    if (createFunctionDescriptor.returnType.type != "base_type" || createFunctionDescriptor.returnType.basic_type != "void") {
                        if (!statements.hasReturn) {
                            throw new SemanticException("函数必须有返回值");
                        }
                    }
                }
            }
        },
        {
            "createFunctionScope:": {
                action: function ($, s): FunctionScope {
                    let stacks = s.slice(-9);
                    let parameters = stacks[4] as [string, Type][];
                    let id = stacks[2] as string;
                    let returnType = stacks[7] as Type;
                    let head = stacks[0] as Scope;
                    let parameterTypes: Type[] = [];
                    for (let p of parameters) {
                        parameterTypes.push(p[1]);
                    }
                    if (!head.createVariable(id, Type.ConstructFunction(parameterTypes, returnType))) {
                        throw new SemanticException(head.errorMSG);//并且终止解析
                    }
                    //创建函数空间
                    let functionScope = new FunctionScope(returnType);
                    functionScope.linkParentScope(head);
                    for (let p of parameters) {//在函数空间中定义变量
                        if (!functionScope.createVariable(p[0], p[1])) {
                            throw new SemanticException(head.errorMSG);//并且终止解析
                        }
                    }
                    return functionScope;
                }
            }
        },
        { "parameters:parameter_list": { action: ($) => $[0] } },
        { "parameters:varible_argument": { action: ($) => $[0] } },
        {
            "parameters:parameter_list , varible_argument": {
                action: ($, s): [string, Type][] => {
                    let parameter_list = $[0] as [string, Type][];
                    let varible_argument = $[2] as [string, Type];
                    parameter_list.push(varible_argument);
                    return parameter_list;
                }
            }
        },
        { "parameters:": { action: () => [] } },
        {
            "parameter_list:parameter_list , parameter": {
                action: function ($, s): [string, Type][] {
                    let parameter_list = $[0] as [string, Type][];
                    let parameter = $[2] as [string, Type];
                    parameter_list.push(parameter);
                    return parameter_list;
                }
            }
        },
        {
            "parameter_list:parameter": {
                action: function ($, s): [string, Type][] {
                    let parameter = $[0] as [string, Type];
                    return [parameter];
                }
            }
        },
        {
            "parameter:id : type": {
                action: function ($, s): [string, Type] {
                    let id = $[0] as string;
                    let type = $[2] as Type;
                    return [id, type];
                }
            }
        },
        {
            "varible_argument: ... id : type": {
                action: function ($, s): [string, Type] {
                    let id = $[1] as string;
                    let type = $[3] as Type;
                    return [id, Type.ConstructArray(type)];
                }
            }
        },
        { "statement:declare": { action: ($, s) => $[0] } },
        {
            "statement:return W2_0 object ;": {
                action: function ($, s): StmtDescriptor {
                    let ret = new StmtDescriptor();
                    ret.hasReturn = true;
                    return ret;
                }
            }
        },
        {
            "statement:return ;": {
                action: function ($, s): StmtDescriptor {
                    let ret = new StmtDescriptor();
                    ret.hasReturn = true;
                    return ret;
                }
            }
        },
        {
            "statement:if ( W3_0 object ) W6_0 statement": {
                action: function ($, s): StmtDescriptor {
                    let obj = $[3] as ObjectDescriptor;
                    debugger
                    if (obj.backPatch) {//需要回填
                    } else {//处理obj的address
                        //收集
                    }
                    return new StmtDescriptor();
                }, priority: "low_priority_for_if_stmt"
            }
        },
        {
            "statement:if ( W3_0 object ) W6_0 statement else W9_0 statement": {
                action: function ($, s) {
                    let stmt1 = $[6] as StmtDescriptor;
                    let stmt2 = $[9] as StmtDescriptor;
                    let ret = new StmtDescriptor();
                    ret.hasReturn = stmt1.hasReturn && stmt2.hasReturn;
                    "判断object是值类型的还是需要回填的那种，比如if(a) xxx 这种则直接对a进行判断，如果是 if(xx||xx) xxx 这种，则进行回填";
                    return ret;
                }
            }
        },
        { "statement:lable_def do statement while ( object ) ;": {} },
        { "statement:lable_def while ( object ) statement": {} },
        { "statement:lable_def for ( for_init ; for_condition ; for_step ) statement": {} },
        { "statement:block": { action: ($, s) => $[0] } },
        { "statement:break lable_use ;": {} },
        { "statement:continue lable_use ;": {} },
        { "statement:switch ( object ) { switch_bodys }": {} },
        {
            "statement:object ;": {
                action: function ($, s): StmtDescriptor {
                    return new StmtDescriptor();
                }
            }
        },
        { "lable_use:": {} },
        { "lable_use:id": {} },
        { "lable_def:": {} },
        { "lable_def:id :": {} },
        { "switch_bodys:": {} },
        { "switch_bodys:switch_bodys switch_body": {} },
        { "switch_body:case constant_val : statement": {} },
        { "switch_body:default : statement": {} },
        {
            "block:{ createBlockScope statements }": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as Scope;
                    let headTmp = head;//向上搜索，直到找到functionScope
                    for (; (headTmp instanceof StmtScope);) {//因为目前BlockScope的父空间只能是StmtScope
                        headTmp = headTmp.parentScope!;
                    }
                    let blockScope = $[1] as BlockScope;
                    for (let v of blockScope.variables.values()) {
                        (headTmp as FunctionScope).removeVariableForBlockEnd(v);//销毁作用域内的变量
                    }
                    return $[2];
                }
            }
        },
        {
            "createBlockScope:": {
                action: function ($, s): BlockScope {
                    let head = s.slice(-2)[0] as Scope;
                    let ret = new BlockScope();
                    ret.linkParentScope(head);
                    return ret;
                }
            }
        },
        { "statements:": { action: () => new StmtDescriptor() } },
        {
            "statements:statements reachableCheckAndInherit statement": {
                action: function ($, s) {
                    let statements = $[0] as StmtDescriptor;
                    let statement = $[2] as StmtDescriptor;
                    //此处应该把statements和statement的代码连接起来
                    let ret = new StmtDescriptor();
                    ret.hasReturn = statement.hasReturn;
                    return statement;
                }
            }
        },
        {
            "reachableCheckAndInherit:": {
                action: function ($, s): Scope {
                    let stack = s.slice(-2);
                    let head = stack[0] as Scope;
                    let statements = stack[1] as StmtDescriptor;
                    if (statements.hasReturn) {
                        throw new SemanticException("return 之后不能有语句");
                    }
                    let ret = new StmtScope();
                    ret.linkParentScope(head);
                    return ret;
                }
            }
        },

        { "for_init:": {} },
        { "for_init:declare": {} },
        { "for_init:object": {} },
        { "for_condition:": {} },
        { "for_condition:object": {} },
        { "for_step:": {} },
        { "for_step:object": {} },

        {
            "object:id": {
                action: function ($, s): ObjectDescriptor {
                    let head = s.slice(-1)[0] as StmtScope;
                    let id = $[0];
                    let add = head.getVariable(id);
                    if (add == undefined) {
                        throw new SemanticException(`未定义的符号:${id}`);
                    }
                    return new ObjectDescriptor(add);
                }
            }
        },
        { "object:constant_val": { action: ($, s) => new ObjectDescriptor($[0]) } },
        { "object:object ( arguments )": {} },
        { "object:( parameters ) => { statements }": {} },//lambda
        { "object:( object )": {} },
        { "object:object . id": {} },
        { "object:object = object": {} },
        {
            "object:object + W3_0 object": {
                action: function ($, s): ObjectDescriptor {
                    let a = $[0] as ObjectDescriptor;
                    let b = $[3] as ObjectDescriptor;
                    let head = s.slice(-1)[0] as StmtScope;
                    if ((a.address.type.type == "base_type" && a.address.type.basic_type == "int") && (b.address.type.type == "base_type" && b.address.type.basic_type == "int")) {
                        let add = head.createTmp(Type.ConstructBase("int"));
                        let ret = new ObjectDescriptor(add);
                        let result = head.createTmp(Type.ConstructBase('int'));
                        ret.quadruples = a.quadruples.concat(b.quadruples);
                        ret.quadruples.push(new Quadruple("+", a.address, b.address, result));
                        return ret;
                    } else {
                        throw new SemanticException(`暂时只支持int类型的+运算符`);
                    }
                }
            }
        },
        { "object:object - W3_0 object": {} },
        { "object:object * W3_0 object": {} },
        { "object:object / W3_0 object": {} },
        {
            "object:object < W3_0 object": {
                action: function ($, s): ObjectDescriptor {
                    let a = $[0] as ObjectDescriptor;
                    let b = $[3] as ObjectDescriptor;
                    let head = s.slice(-1)[0] as StmtScope;
                    //判断需不需要重载，如果是函数重载，则不能回填
                    //否则返回一个需要回填的objectDescriptor
                    //在object:object=object
                    //stmt:object
                    //if (object) xxx
                    //if (object) xxx else xx
                    //这四个地方回填(使用到object的地方回填)
                    debugger
                    if ((a.address.type.type == "base_type" && a.address.type.basic_type == "int") && (b.address.type.type == "base_type" && b.address.type.basic_type == "int")) {
                        let falseInstruction = new Address("stmt", 0, Type.ConstructBase("PC"));
                        let q1 = new Quadruple("ifelse <", a.address, b.address, falseInstruction);
                        let ret = new ObjectDescriptor(falseInstruction);
                        ret.quadruples = a.quadruples.concat(b.quadruples);
                        ret.quadruples.push(q1);
                        ret.backPatch = true;
                        ret.falseList.push(falseInstruction);
                        return ret;
                    } else {
                        throw new SemanticException(`暂时只支持int类型的<运算符`);
                    }
                }
            }
        },
        { "object:object <= W3_0 object": {} },
        { "object:object > W3_0 object": {} },
        { "object:object >= W3_0 object": {} },
        { "object:object == W3_0 object": {} },
        { "object:object ? object : object": { priority: "?" } },
        { "object:object ++": {} },
        { "object:object --": {} },
        { "object:new { anonymous_stmts }": {} },//匿名类，类似C#而不是java
        { "object:new basic_type ( arguments )": {} },
        { "object:new basic_type array_init_list": {} },
        { "object:object [ object ]": {} },
        { "object:this": {} },
        { "array_init_list:array_inits array_placeholder": {} },
        { "array_inits:array_inits [ object ]": {} },
        { "array_inits:[ object ]": {} },
        { "array_placeholder:array_placeholder_list": { priority: "low_priority_for_array_placeholder" } },//遇到方括号一律选择移入
        { "array_placeholder:": { priority: "low_priority_for_array_placeholder" } },
        { "array_placeholder_list:array_placeholder_list [ ]": {} },
        { "array_placeholder_list:[ ]": { priority: "low_priority_for_array_placeholder" } },

        { "anonymous_stmts:anonymous_stmts anonymous_stmt": {} },
        { "anonymous_stmts:": {} },
        { "anonymous_stmt:id = object ;": {} },

        { "arguments:argument_list": {} },
        { "arguments:": {} },
        { "argument_list:argument": {} },
        { "argument_list:argument_list , argument": {} },
        { "argument:object": {} },

        { "W2_0:": { action: ($, s) => s.slice(-2)[0] } },
        { "W3_0:": { action: ($, s) => s.slice(-3)[0] } },
        { "W6_0:": { action: ($, s) => s.slice(-6)[0] } },
        { "W9_0:": { action: ($, s) => s.slice(-9)[0] } },
    ]
};
let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();//构造编译器代码
if (str != null) {//如果构造成功则生成编编译器代码
    console.log(`成功`);
    fs.writeFileSync('./src/example/toy-language/parser.ts', str);
} else {
    console.log(`失败`);
}
