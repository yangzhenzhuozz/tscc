import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
import { Type, Address, ProgramScope } from "./lib.js"
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
    userCode: `import { Type, Address, ProgramScope } from "./lib.js"`,
    tokens: ['var', '...', ';', 'id', 'immediate_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'sealed', 'this', 'return', 'get', 'set', 'constructor'],
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
        { "program:create_program_scope import_stmts W2_0 program_units": {} },
        {
            "W2_0:": {
                action: function ($, s) {
                    return s.slice(-2)[0];
                }
            }
        },
        {
            "create_program_scope:": {
                action: function ($, s): ProgramScope {
                    return new ProgramScope();
                }
            }
        },
        { "import_stmts:": {} },
        { "import_stmts:import_stmts import_stmt": {} },
        { "import_stmt:import id as id ;": {} },
        { "program_units:program_units W2_0 program_unit": {} },
        { "program_units:": {} },
        { "program_unit:statement": {} },
        { "program_unit:class_definition": {} },
        { "class_definition:modifier class id extends_declare { class_units }": {} },
        { "modifier:": {} },
        { "modifier:valuetype": {} },
        { "modifier:sealed": {} },
        { "extends_declare:extends basic_type": {} },
        { "extends_declare:": {} },
        { "class_units:class_units class_unit": {} },
        { "class_units:": {} },
        { "class_unit:declare ;": {} },
        { "class_unit:_constructor": {} },
        { "class_unit:operator_overload": {} },
        { "class_unit:get id ( ) : type { statements }": {} },
        { "class_unit:set id ( id : type ) { statements }": {} },
        { "operator_overload:operator + ( parameter ) : type { statements }": {} },
        { "declare:var id = object": {} },
        { "declare:var id : type = object": {} },
        { "declare:var id : type": {} },
        { "declare:function_definition": {} },
        { "type:basic_type arr_definition": {} },
        { "arr_definition:arr_definition [ ]": {} },
        { "arr_definition:": {} },
        { "basic_type:id": {} },
        { "type:( function_parameter_types ) => type": {} },
        { "function_parameter_types:": {} },
        { "function_parameter_types:function_parameter_type_list": {} },
        { "function_parameter_type_list:function_parameter_type_list , type": {} },
        { "function_parameter_type_list:type": {} },
        { "function_definition:function id ( parameters ) : type { statements }": {} },
        { "_constructor:constructor ( parameters ) { statements }": {} },
        { "parameters:parameter_list": {} },
        { "parameters:varible_argument": {} },
        { "parameters:parameter_list , varible_argument": {} },
        { "parameters:": {} },
        { "parameter_list:parameter_list , parameter": {} },
        { "parameter_list:parameter": {} },
        { "parameter:id : type": {} },
        { "varible_argument: ... id : type": {} },
        { "statement:declare ;": {} },
        { "statement:return object ;": {} },
        { "statement:return ;": {} },
        { "statement:if ( object ) statement": { priority: "low_priority_for_if_stmt" } },
        { "statement:if ( object ) statement else statement": {} },
        { "statement:lable_def do statement while ( object ) ;": {} },
        { "statement:lable_def while ( object ) statement": {} },
        { "statement:lable_def for ( for_init ; for_condition ; for_step ) statement": {} },
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
        { "statement:switch ( object ) { switch_bodys }": {} },
        { "statement:object ;": {} },
        { "lable_use:": {} },
        { "lable_use:id": {} },
        { "lable_def:": {} },
        { "lable_def:id :": {} },
        { "switch_bodys:": {} },
        { "switch_bodys:switch_bodys switch_body": {} },
        { "switch_body:case immediate_val : statement": {} },
        { "switch_body:default : statement": {} },
        { "block:{ statements }": {} },
        { "statements:": {} },
        { "statements:statements statement": {} },
        { "object:object ( arguments )": {} },//函数调用
        { "object:( object )": {} },
        { "object:object . id": {} },
        { "object:object = object": {} },
        { "object:object + object": {} },
        { "object:object - object": {} },
        { "object:object * object": {} },
        { "object:object / object": {} },
        { "object:object < object": {} },
        { "object:object <= object": {} },
        { "object:object > object": {} },
        { "object:object >= object": {} },
        { "object:object == object": {} },
        { "object:object || object": {} },
        { "object:object && object": {} },
        { "object:object ? object : object": { priority: "?" } },
        { "object:object ++": {} },
        { "object:object --": {} },
        { "object:object [ object ]": {} },
        { "object:this": {} },
        { "object:id": {} },
        { "object:immediate_val": {} },
        { "object:new basic_type ( arguments )": {} },
        { "object:new basic_type array_init_list": {} },
        { "object:( lambda_arguments ) => { statements }": {} },//lambda
        { "array_init_list:array_inits array_placeholder": {} },
        { "array_inits:array_inits [ object ]": {} },
        { "array_inits:[ object ]": {} },
        { "array_placeholder:array_placeholder_list": { priority: "low_priority_for_array_placeholder" } },//遇到方括号一律选择移入,array_placeholder用于占位，如new int[1][][][],后面悬空的就是占位
        { "array_placeholder:": { priority: "low_priority_for_array_placeholder" } },
        { "array_placeholder_list:array_placeholder_list [ ]": {} },
        { "array_placeholder_list:[ ]": { priority: "low_priority_for_array_placeholder" } },
        { "arguments:argument_list": {} },
        { "arguments:": {} },
        { "argument_list:object": {} },
        { "argument_list:argument_list , object": {} },
        { "lambda_arguments:": {} },
        { "lambda_arguments:lambda_argument_list": {} },
        { "lambda_argument_list:lambda_argument_list , id : type": {} },
        { "lambda_argument_list:id : type": {} },
    ]
}
let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();//构造编译器代码
if (str != null) {//如果构造成功则生成编编译器代码
    console.log(`成功`);
    fs.writeFileSync('./src/example/toy-language-3/parser-1.ts', str);
} else {
    console.log(`失败`);
}