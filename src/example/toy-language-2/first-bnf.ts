import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
import * as auxiliary from "./auxiliary.js";
/**
 * 这是第一次扫描用的BNF，和第二次扫描几乎没有多大区别
 * 因为解析器是从左往右扫描的，在解析某个片段时可能会依赖后续输入，所以第一次扫描有两个任务
 * 1.得到class的Type信息
 * class A{
 * function fun():int{
 * return a+a;
 * }
 * var a:int;
 * }
 * 在解析到return a+a的时候，还不知道a的信息，所以记录类型信息，得到
 * class A{
 * var a:int;
 * var fun():int;
 * }
 * 2.记录closure需要捕获的变量
 * function outer():int{
 * var a:int;
 * a=a*2;
 * function inner():int{
 * a=a+1;
 * return a;
 * }
 * }
 * 因为在解析到a=a*2的时候，还不知道变量a是需要被closure捕获，所以无法生成正确的代码
 */
let grammar: Grammar = {
    userCode: `
    import * as auxiliary from "./auxiliary.js";
    `,
    tokens: ['var', '...', ';', 'id', 'constant_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'sealed', 'this', 'return'],
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
        { 'right': ['=>'] },
        { 'nonassoc': ['low_priority_for_array_placeholder'] },
        { 'right': ['['] },
        { 'nonassoc': ['('] },
        { 'left': ['.'] },
        { 'nonassoc': ['low_priority_for_if_stmt'] },//这个符号的优先级小于else
        { 'nonassoc': ['else'] },
    ],
    BNF: [
        {
            "program:import_stmts createProgramScope program_units": {
                action: function ($, s) {
                    let programScope = $[1] as auxiliary.ProgramScope;
                    if (programScope.unregisteredTypes.size != 0) {
                        let msg = `存在未定义的类型:${[...programScope.unregisteredTypes].reduce((p, c) => `${p},${c}`)}`;
                        throw new auxiliary.SemanticException(msg);
                    }
                    programScope.scopeFinished();
                    console.log('检查类型注册是否完整');
                    console.log(programScope);
                    debugger
                }
            }
        },
        {
            "createProgramScope:": {
                action: function (): auxiliary.ProgramScope {
                    let ret = new auxiliary.ProgramScope();
                    return ret;
                }
            }
        },
        { "program_units:program_units W2_0 program_unit": {} },
        { "program_units:": {} },
        { "program_unit:declare ;": {} },
        { "program_unit:cLass_definition": {} },
        { "import_stmts:": {} },
        { "import_stmts:import_stmts import_stmt": {} },
        { "import_stmt:import id as id ;": {} },
        {
            "cLass_definition:modifier class id extends_declare { createClassScope class_units }": {
                action: function ($, s) {
                    let classScope = $[5] as auxiliary.ClassScope;
                    let id = $[2] as string;
                    let modifier = $[0] as "valuetype" | "sealed" | undefined;
                    let type = new auxiliary.Type(id, modifier);
                    if (modifier != undefined) {
                        type.modifier = modifier;
                    }
                    classScope.programScope.registerType(id, type);
                    for (let [k, v] of classScope.fields) {
                        type.registerField(k, v);
                    }
                    for (let [k, v] of classScope.operatorOverload) {
                        type.registerOperatorOverload(k, v);
                    }
                }
            }
        },
        {
            "createClassScope:": {
                action: function ($, s): auxiliary.ClassScope {
                    let head = s.slice(-6)[0] as auxiliary.ProgramScope;
                    let ret = new auxiliary.ClassScope(head);
                    return ret;
                }
            }
        },
        { "modifier:": {} },
        {
            "modifier:valuetype": {
                action: function ($, s): string {
                    return "valuetype";
                }
            }
        },
        {
            "modifier:sealed": {
                action: function ($, s): string {
                    return "sealed";
                }
            }
        },
        { "extends_declare:extends basic_type": {} },
        { "extends_declare:": {} },
        { "class_units:class_units W2_0 class_unit": {} },
        { "class_units:": {} },
        { "class_unit:declare ;": {} },
        { "class_unit:operator_overload": {} },
        {
            "operator_overload:operator + ( W4_0 parameter ) : W8_0 type { createFunctionScope_operator_overload statements }": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as auxiliary.ClassScope;
                    let functionScope = $[9] as auxiliary.FunctionScope;
                    head.operatorOverload.set('+', { type: functionScope.type, functionIndexOfProgram: functionScope.functionIndexOfProgram });
                }
            }
        },
        {
            "createFunctionScope_operator_overload:": {
                action: function ($, s) {
                    let head = s.slice(-11)[0] as auxiliary.ClassScope;
                    let ret_type = s.slice(-2)[0] as auxiliary.Type;
                    let functionType = new auxiliary.FunctionType(ret_type);
                    let parameter = s.slice(-6)[0] as { name: string, type: auxiliary.Type };
                    functionType.registerParameter(parameter.name, parameter.type);
                    let ret: auxiliary.FunctionScope;
                    ret = new auxiliary.FunctionScope(head.programScope, head, undefined, functionType);
                    return ret;
                }
            }
        },
        {
            "declare:var id : W4_0 type": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as auxiliary.Scope;
                    let id = $[1] as string;
                    let type = $[4] as auxiliary.Type;
                    head.registerField(id, type);
                }
            }
        },
        { "declare:function_definition": {} },
        {
            "type:basic_type arr_definition": {
                action: function ($, s): auxiliary.Type {
                    //已经把basic_type的属性继承到arr_definition去了
                    let arr_definition = $[1] as auxiliary.Type;
                    return arr_definition;
                }
            }
        },
        {
            "arr_definition:arr_definition [ ]": {
                action: function ($, s): auxiliary.Type {
                    let arr_definition = $[0] as auxiliary.Type;
                    let ret = new auxiliary.ArrayType(arr_definition);
                    return ret;
                }
            }
        },
        {
            "arr_definition:": {
                action: function ($, s): auxiliary.Type {
                    let basic_type = s.slice(-1)[0] as auxiliary.Type;//从basic_type中得到继承属性
                    return basic_type;
                }
            }
        },
        {
            "basic_type:id": {
                action: function ($, s): auxiliary.Type {
                    let id = $[0] as string;
                    let head = s.slice(-1)[0] as auxiliary.ProgramScope | auxiliary.ClassScope | auxiliary.FunctionScope | auxiliary.BlockScope;
                    if (head instanceof auxiliary.ProgramScope) {
                        return head.getRegisteredType(id);
                    } else if (head instanceof auxiliary.ClassScope) {
                        return head.programScope.getRegisteredType(id);
                    } else if (head instanceof auxiliary.FunctionScope) {
                        return head.programScope.getRegisteredType(id);
                    } else {
                        return head.parentFunctionScope.programScope.getRegisteredType(id);
                    }
                }
            }
        },
        {
            "type:( W2_0 function_parameter_types ) => W6_0 type": {
                action: function ($, s): auxiliary.Type {
                    let function_parameter_types = $[2] as auxiliary.Type[];
                    let ret_type = $[6] as auxiliary.Type;
                    let ret = new auxiliary.FunctionType(ret_type);
                    let index = 0;
                    for (let type of function_parameter_types) {
                        ret.registerParameter(`$${index++}`, type);
                    }
                    return ret;
                }
            }
        },
        {
            "function_parameter_types:": {
                action: function ($, s): auxiliary.Type[] {
                    return [];//返回一个空数组，没有任何参数声明
                }
            }
        },
        {
            "function_parameter_types:function_parameter_type_list": {
                action: function ($, s): auxiliary.Type[] {
                    return $[0] as auxiliary.Type[];
                }
            }
        },
        {
            "function_parameter_type_list:function_parameter_type_list , W3_0 type": {
                action: function ($, s): auxiliary.Type[] {
                    let function_parameter_type_list_0 = $[0] as auxiliary.Type[];
                    let type = $[3] as auxiliary.Type;
                    function_parameter_type_list_0.push(type);
                    return function_parameter_type_list_0;
                }
            }
        },
        {
            "function_parameter_type_list:type": {
                action: function ($, s): auxiliary.Type[] {
                    return [$[0] as auxiliary.Type];
                }
            }
        },
        //函数在class中的注册已经由createFunctionScope完成
        {
            "function_definition:function id ( W4_0 parameters ) : W8_0 type { createFunctionScope statements }": {
                action: function ($, s) {
                    let functionScope = $[10] as auxiliary.FunctionScope;
                    if (functionScope.closureScope != undefined) {//如果变量被捕获，则注册闭包类
                        let programScope = functionScope.programScope;
                        let name = programScope.getClosureClassNameAutomatic();
                        let type = new auxiliary.Type(name, "referentialType");
                        functionScope.closureClass = name;
                        functionScope.programScope.registerType(name, type);
                        for (let [k, v] of functionScope.closureScope.fields) {
                            type.registerField(k, v);
                        }
                    }
                }
            }
        },
        {
            "createFunctionScope:": {
                action: function ($, s): auxiliary.FunctionScope {
                    let head = s.slice(-11)[0] as auxiliary.ProgramScope | auxiliary.ClassScope | auxiliary.FunctionScope | auxiliary.BlockScope;
                    let id = s.slice(-9)[0] as string;
                    let ret_type = s.slice(-2)[0] as auxiliary.Type;
                    let parameters = s.slice(-6)[0] as { name: string, type: auxiliary.Type }[];
                    let functionType = new auxiliary.FunctionType(ret_type);
                    for (let parameter of parameters) {
                        functionType.registerParameter(parameter.name, parameter.type);
                    }
                    head.registerField(id, functionType);//注册变量
                    let ret: auxiliary.FunctionScope;
                    if (head instanceof auxiliary.ProgramScope) {
                        ret = new auxiliary.FunctionScope(head, undefined, undefined, functionType);
                    } else if (head instanceof auxiliary.ClassScope) {
                        ret = new auxiliary.FunctionScope(head.programScope, head, undefined, functionType);
                    } else if (head instanceof auxiliary.FunctionScope) {
                        ret = new auxiliary.FunctionScope(head.programScope, head.classScope, head, functionType);
                    } else {//head instanceof auxiliary.BlockScope
                        ret = new auxiliary.FunctionScope(head.parentFunctionScope.programScope, head.parentFunctionScope.classScope, head, functionType);
                    }
                    return ret;
                }
            }
        },
        {
            "parameters:parameter_list": {
                action: function ($, s): { name: string, type: auxiliary.Type }[] {
                    return $[0] as { name: string, type: auxiliary.Type }[];
                }
            }
        },
        {
            "parameters:varible_argument": {
                action: function ($, s): { name: string, type: auxiliary.Type }[] {
                    return $[0] as { name: string, type: auxiliary.Type }[];
                }
            }
        },
        {
            "parameters:parameter_list , W3_0 varible_argument": {
                action: function ($, s): { name: string, type: auxiliary.Type }[] {
                    let parameter_list = $[0] as { name: string, type: auxiliary.Type }[];
                    let varible_argument = $[3] as { name: string, type: auxiliary.Type }[];
                    return parameter_list.concat(varible_argument);
                }
            }
        },
        {
            "parameters:": {
                action: function ($, s): { name: string, type: auxiliary.Type }[] {
                    return [];
                }
            }
        },
        {
            "parameter_list:parameter_list , W3_0 parameter": {
                action: function ($, s): { name: string, type: auxiliary.Type }[] {
                    let parameter_list = $[0] as { name: string, type: auxiliary.Type }[];
                    let parameter = $[3] as { name: string, type: auxiliary.Type };
                    parameter_list.push(parameter);
                    return parameter_list;
                }
            }
        },
        {
            "parameter_list:parameter": {
                action: function ($, s): { name: string, type: auxiliary.Type }[] {
                    return [$[0] as { name: string, type: auxiliary.Type }];
                }
            }
        },
        {
            "parameter:id : W3_0 type": {
                action: function ($, s): { name: string, type: auxiliary.Type } {
                    let id = $[0] as string;
                    let type = $[3] as auxiliary.Type;
                    return { name: id, type: type };
                }
            }
        },
        {
            "varible_argument: ... id : W4_0 type": {
                action: function ($, s): { name: string, type: auxiliary.Type }[] {
                    let id = $[1] as string;
                    let type = $[4] as auxiliary.Type;
                    let ret_type = new auxiliary.ArrayType(type);
                    return [{ name: id, type: ret_type }];
                }
            }
        },
        { "statement:declare ;": {} },
        { "statement:return W2_0 object ;": {} },
        { "statement:return ;": {} },
        { "statement:if ( W3_0 object ) W6_0 statement": { priority: "low_priority_for_if_stmt" } },
        { "statement:if ( W3_0 object ) W6_0 statement else W9_0 statement": {} },
        { "statement:lable_def do W3_0 statement while ( W6_0 object ) ;": {} },
        { "statement:lable_def while ( W4_0 object ) W7_0 statement": {} },
        { "statement:lable_def for ( W4_0 for_init ; W7_0 for_condition ; W10_0 for_step ) W12_0 statement": {} },
        { "for_init:": {} },
        { "for_init:declare": {} },
        { "for_init:object": {} },
        { "for_condition:": {} },
        { "for_condition:object": {} },
        { "for_step:": {} },
        { "for_step:object": {} },
        { "statement:block": { action: ($, s) => $[0] } },
        { "statement:break lable_use ;": {} },
        { "statement:continue lable_use ;": {} },
        { "statement:switch ( W3_0 object ) { switch_bodys }": {} },
        { "statement:object ;": {} },
        { "lable_use:": {} },
        { "lable_use:id": {} },
        { "lable_def:": {} },
        { "lable_def:id :": {} },
        { "switch_bodys:": {} },
        { "switch_bodys:switch_bodys switch_body": {} },
        { "switch_body:case constant_val : W4_0 statement": {} },
        { "switch_body:default : W3_0 statement": {} },
        { "block:{ createBlockScope W3_0 statements }": {} },
        {
            "createBlockScope:": {
                action: function ($, s): auxiliary.BlockScope {
                    let head = s.slice(-2)[0] as auxiliary.FunctionScope | auxiliary.BlockScope;
                    let ret: auxiliary.BlockScope;
                    if (head instanceof auxiliary.FunctionScope) {
                        ret = new auxiliary.BlockScope(head, head);
                    } else {
                        ret = new auxiliary.BlockScope(head.parentFunctionScope, head.parentFunctionScope);
                    }
                    return ret;
                }
            }
        },
        { "statements:": {} },
        { "statements:statements W2_0 statement": {} },
        {
            "object:id": {
                //函数能且仅能在这里取变量
                action: function ($, s) {
                    let head = s.slice(-1)[0] as auxiliary.FunctionScope | auxiliary.BlockScope;
                    let id = $[0] as string;
                    head.closureCheck(id);//闭包变量检查
                }
            }
        },
        { "object:constant_val": {} },
        { "object:object ( arguments )": {} },
        { "object:object => { createFunctionScope_lambda_W4_0 statements }": {} },//lambda,单个参数可以不加括号，即使有括号也会被解析成 (object)====>object
        {
            "createFunctionScope_lambda_W4_0:": {
                action: function ($, s) {
                    console.error('暂时无法完成，需要将所有的object都解析成Type类型,一共有27个');
                    console.error('需要解决lambda返回自身的问题');
                }
            }
        },
        { "object:( W2_0 lambda_arguments ) : type => { W7_0 statements }": {} },//参数必须为0个或者两个及以上
        { "object:( W2_0 object )": {} },
        { "object:object . id": {} },
        { "object:object = W3_0 object": {} },
        { "object:object + W3_0 object": {} },
        { "object:object - W3_0 object": {} },
        { "object:object * W3_0 object": {} },
        { "object:object / W3_0 object": {} },
        { "object:object < W3_0 object": {} },
        { "object:object <= W3_0 object": {} },
        { "object:object > W3_0 object": {} },
        { "object:object >= W3_0 object": {} },
        { "object:object == W3_0 object": {} },
        { "object:object || W3_0 object": {} },
        { "object:object && W3_0 object": {} },
        { "object:object ? W3_0 object : W6_0 object": { priority: "?" } },
        { "object:object ++": {} },
        { "object:object --": {} },
        { "object:new { W3_0 anonymous_stmts }": {} },//匿名类，类似C#而不是java
        { "object:new basic_type ( W4_0 arguments )": {} },
        { "object:new basic_type W3_0 array_init_list": {} },
        { "object:object [ W3_0 object ]": {} },
        { "object:this": {} },
        { "array_init_list:array_inits array_placeholder": {} },
        { "array_inits:array_inits [ W3_0 object ]": {} },
        { "array_inits:[ W2_0 object ]": {} },
        { "array_placeholder:array_placeholder_list": { priority: "low_priority_for_array_placeholder" } },//遇到方括号一律选择移入
        { "array_placeholder:": { priority: "low_priority_for_array_placeholder" } },
        { "array_placeholder_list:array_placeholder_list [ ]": {} },
        { "array_placeholder_list:[ ]": { priority: "low_priority_for_array_placeholder" } },
        { "anonymous_stmts:anonymous_stmts anonymous_stmt": {} },
        { "anonymous_stmts:": {} },
        { "anonymous_stmt:id = W3_0 object ;": {} },
        { "arguments:argument_list": {} },
        { "arguments:": {} },
        { "argument_list:object": {} },
        { "argument_list:argument_list , W3_0 object": {} },
        { "lambda_arguments:": {} },
        { "lambda_arguments:lambda_argument_list": {} },
        { "lambda_argument_list:lambda_argument_list , W3_0 object": {} },
        { "lambda_argument_list:object , W3_0 object": {} },
        {
            "W2_0:": {
                action: function ($, s) {
                    return s.slice(-2)[0];
                }
            }
        },
        {
            "W3_0:": {
                action: function ($, s) {
                    return s.slice(-3)[0];
                }
            }
        },
        {
            "W4_0:": {
                action: function ($, s) {
                    return s.slice(-4)[0];
                }
            }
        },
        {
            "W6_0:": {
                action: function ($, s) {
                    return s.slice(-6)[0];
                }
            }
        },
        {
            "W7_0:": {
                action: function ($, s) {
                    return s.slice(-7)[0];
                }
            }
        },
        {
            "W8_0:": {
                action: function ($, s) {
                    return s.slice(-8)[0];
                }
            }
        },
        {
            "W9_0:": {
                action: function ($, s) {
                    return s.slice(-9)[0];
                }
            }
        },
        {
            "W10_0:": {
                action: function ($, s) {
                    return s.slice(-10)[0];
                }
            }
        },
        {
            "W12_0:": {
                action: function ($, s) {
                    return s.slice(-12)[0];
                }
            }
        }
    ]
};
let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();//构造编译器代码
if (str != null) {//如果构造成功则生成编编译器代码
    console.log(`成功`);
    fs.writeFileSync('./src/example/toy-language-2/parser-1.ts', str);
} else {
    console.log(`失败`);
}