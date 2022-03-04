import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
let grammar: Grammar = {
<<<<<<< HEAD
    tokens: ['var', '...', ';', 'id', 'immediate_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'this', 'return', 'get', 'set', 'sealed', 'try', 'catch', 'basic_type'],
=======
    tokens: ['var', '...', ';', 'id', 'immediate_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'this', 'return', 'get', 'set', 'sealed', 'try', 'catch','template_name'],
>>>>>>> 045cd2891a9c0e1d322e23c35449253e690a86c9
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
        { "program:import_stmts program_units": {} },
        { "import_stmts:": {} },
        { "import_stmts:import_stmts import_stmt": {} },
        { "import_stmt:import id as id ;": {} },
        { "program_units:program_units program_unit": {} },
        { "program_units:": {} },
        { "program_unit:declare ;": {} },
        { "program_unit:class_definition": {} },
        { "class_definition:modifier class id template_declare extends_declare { class_units }": {} },
        { "template_declare:": {} },
        { "template_declare:< template_declare_list >": {} },
        { "template_declare_list:template_declare_list , id": {} },
        { "template_declare_list:id": {} },
        { "modifier:": {} },
        { "modifier:valuetype": {} },
        { "modifier:sealed": {} },
        { "extends_declare:extends basic_type": {} },
        { "extends_declare:": {} },
        { "class_units:class_units class_unit": {} },
        { "class_units:": {} },
        { "class_unit:declare ;": {} },
        { "class_unit:constructor": {} },
        { "constructor:id ( parameters ) { statements } ;": {} },
        { "class_unit:operator_overload": {} },
        { "class_unit:get id ( ) : type { statements }": {} },
        { "class_unit:set id ( id : type ) { statements }": {} },
        { "operator_overload:operator + ( parameter ) : type { statements }": {} },
        { "declare:var id = object": {} },
        { "declare:var id : type = object": {} },
        { "declare:var id : type": {} },
        { "declare:function_definition": {} },
        { "type:basic_type arr_definition": {} },
        { "type:template_type": {} },
        { "type:( function_parameter_types ) => type": {} },
        { "type:( empty_parameters_or_lambda_arguments ) => type": {} },
        { "empty_parameters_or_lambda_arguments:": {} },
        { "template_type:basic_type template_instance": {} },
        { "template_instance:< template_instanc_list >": {} },
        { "template_instanc_list:type": {} },
        { "template_instanc_list:template_instanc_list , type": {} },
        { "arr_definition:arr_definition [ ]": {} },
        { "arr_definition:": {} },
        { "function_parameter_types:function_parameter_type_list": {} },
        { "function_parameter_type_list:function_parameter_type_list , type": {} },
        { "function_parameter_type_list:type": {} },
        { "function_definition:function id template_declare ( parameters ) : type { statements }": {} },
        { "parameters:parameter_list": {} },
        { "parameters:varible_argument": {} },
        { "parameters:parameter_list , varible_argument": {} },
        { "parameters:": {} },
        { "parameter_list:parameter_list , parameter": {} },
        { "parameter_list:parameter": {} },
        { "parameter:id : type": {} },
        { "varible_argument: ... id : type": {} },
        { "statement:declare ;": {} },
        { "statement:try { statement } catch ( id : type ) { statement }": {} },
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
<<<<<<< HEAD
        { "object:object ( arguments )": {} },//函数调用
        { "object:object template_instance ( arguments )": {} },//函数调用
=======
        { "object:object ( arguments )": {} },//普通函数调用
        { "object:template_name template ( arguments )": {} },//模板函数调用,检测到模板定义之后,lexer会自动将id换成终结符template_name
>>>>>>> 045cd2891a9c0e1d322e23c35449253e690a86c9
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
<<<<<<< HEAD
        { "object:new basic_type ( arguments )": {} },//new 对象，调用构造函数
        { "object:new basic_type array_init_list": {} },//new 数组
        { "object:new basic_type template_instance ( arguments )": {} },//new 对象，调用构造函数
        { "object:new basic_type template_instance array_init_list": {} },//new 数组
=======
        { "object:new basic_type template ( arguments )": {} },
        { "object:new basic_type array_init_list": {} },
>>>>>>> 045cd2891a9c0e1d322e23c35449253e690a86c9
        { "object:( lambda_arguments ) => { statements }": {} },//lambda
        { "object:( empty_parameters_or_lambda_arguments ) => { statements }": {} },//lambda
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
        { "lambda_arguments:lambda_argument_list": {} },
        { "lambda_argument_list:lambda_argument_list , id : type": {} },
        { "lambda_argument_list:id : type": {} },
    ]
}
let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();//构造编译器代码
if (str != null) {//如果构造成功则生成编编译器代码
    console.log(`成功`);
    fs.writeFileSync('./src/example/toy-language-3/parser-base.ts', str);
} else {
    console.log(`失败`);
}