import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
let grammar: Grammar = {
    userCode: ``,//让自动生成的代码包含import语句
    tokens: ['var', '...', ';', 'id', 'constant_val', '+', '-', '++', '--', '(', ')', '{', '}', '[', ']', ',', ':', 'base_type', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'lambda', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as'],
    association: [
        { 'right': ['='] },
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
        { "program:program_units": {} },
        { "program_units:program_units program_unit": {} },
        { "program_units:": {} },
        { "program_unit:import id as id ;": {} },
        { "program_unit:declare": {} },
        { "program_unit:cass_definition": {} },

        { "cass_definition:modifier class id extends_declare { class_units }": {} },
        { "modifier:": {} },
        { "modifier:valuetype": {} },
        { "extends_declare:extends extend_list": {} },
        { "extends_declare:": {} },
        { "extend_list:extend_list , base_type": {} },
        { "extend_list:base_type": {} },
        { "class_units:class_units class_unit": {} },
        { "class_units:": {} },
        { "class_unit:cass_definition": {} },
        { "class_unit:declare": {} },
        { "class_unit:operator_overload": {} },
        { "operator_overload:operator + ( parameter ) : type { function_units }": {} },

        { "declare:var id : type ;": {} },
        { "declare:function_definition": {} },

        { "type:base_type arr_definition": {} },
        { "type:( ) => type": {} },
        { "arr_definition:arr_definition [ ]": {} },
        { "arr_definition:": {} },

        { "function_definition:function id ( parameters ) : type { function_units }": {} },
        { "parameters:parameter_list": {} },
        { "parameters:varible_argument": {} },
        { "parameters:parameter_list , varible_argument": {} },
        { "parameters:": {} },
        { "parameter_list:parameter_list , parameter": {} },
        { "parameter_list:parameter": {} },
        { "parameter:id : type": {} },
        { "varible_argument:id : type ...": {} },
        { "function_units:function_units function_unit": {} },
        { "function_units:": {} },
        { "function_unit:declare": {} },
        { "function_unit:statement": {} },

        { "statement:object ;": {} },
        { "statement:if ( object ) statement": { priority: "low_priority_for_if_stmt" } },
        { "statement:if ( object ) statement else statement": {} },
        { "statement:do statement while ( object )": {} },
        { "statement:while ( object ) statement": {} },
        { "statement:for ( for_init ; for_condition ; for_step ) statement": {} },
        { "statement:block": {} },
        { "statement:switch ( object ) { switch_bodys }": {} },
        { "switch_bodys:": {} },
        { "switch_bodys:switch_bodys switch_body": {} },
        { "switch_body:case constant_val : statement": {} },
        { "switch_body:default : statement": {} },
        { "block:{ statement }": {} },

        { "for_init:": {} },
        { "for_init:declare": {} },
        { "for_init:object": {} },
        { "for_condition:": {} },
        { "for_condition:object": {} },
        { "for_step:": {} },
        { "for_step:object": {} },

        { "object:id": {} },
        { "object:constant_val": {} },
        { "object:object ( arguments )": {} },
        { "object:lambda ( arguments ) => { function_units }": {} },//lambda
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
        { "object:object ++": {} },
        { "object:object --": {} },
        { "object:new { anonymous_stmts }": {} },//匿名类，类似C#而不是java
        { "object:new base_type ( arguments )": {} },
        { "object:new base_type array_init_list": {} },
        { "object:object [ object ]": {} },
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
if (str != null) {//如果构造成功,往代码中添加调用代码
    console.log(`成功`);
    fs.writeFileSync('./src/example/toy-language/parser.ts', str);
} else {
    console.log(`失败`);
}
