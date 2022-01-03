import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
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
        { 'nonassoc': ['low_priority_for_array_placeholder'] },
        { 'right': ['['] },
        { 'nonassoc': ['('] },
        { 'left': ['.'] },
        { 'nonassoc': ['low_priority_for_if_stmt'] },//这个符号的优先级小于else
        { 'nonassoc': ['else'] },
    ],
    BNF: [
        { "program:import_stmts program_units": {} },
        { "program_units:program_units program_unit": {} },
        { "program_units:": {} },
        { "program_unit:declare ;": {} },
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
        { "class_unit:declare ;": {} },
        { "class_unit:operator_overload": {} },
        { "operator_overload:operator + ( parameter ) : type { statements }": {} },
        { "declare:var id : type": {} },
        { "declare:function_definition": {} },
        { "type:basic_type arr_definition": {} },
        { "basic_type:id": {} },
        { "type:( lambda_parameter_types ) => type": {} },
        { "lambda_parameter_types:": {} },
        { "lambda_parameter_types:lambda_parameter_type_list": {} },
        { "lambda_parameter_type_list:lambda_parameter_type_list , type": {} },
        { "lambda_parameter_type_list:type": {} },
        { "arr_definition:arr_definition [ ]": {} },
        { "arr_definition:": {} },
        { "function_definition:function id ( parameters ) : type { statements }": {} },
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
        { "statement:if ( object ) statement ELSE statement": {} },
        { "ELSE:else": {} },
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
        { "switch_body:case constant_val : statement": {} },
        { "switch_body:default : statement": {} },
        { "block:{ statements }": {} },
        { "statements:": {} },
        { "statements:statements statement": {} },
        { "object:id": {} },
        { "object:constant_val": {} },
        { "object:object ( arguments )": {} },
        { "object:( parameters ) => { statements }": {} },//lambda
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