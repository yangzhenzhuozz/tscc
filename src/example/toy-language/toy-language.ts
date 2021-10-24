import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
let grammar: Grammar = {
    userCode: ``,//让自动生成的代码包含import语句
    tokens: ['var', ';', 'id', 'number', '+', '(', ')', '{', '}', '[', ']', ',', ':', 'base_type', 'function', 'class', '=>', 'operator', 'new', '.', 'extends'],
    association: [
        { 'right': ['='] },
        { 'left': ['==', '!='] },
        { 'left': ['||'] },
        { 'left': ['&&'] },
        { 'left': ['!'] },
        { 'nonassoc': ['>', '<', '<=', '>='] },
        { 'left': ['+', '-'] },
        { 'left': ['*', '/'] },
        { 'nonassoc': ['('] },
        { 'left': ['.'] }
    ],
    BNF: [
        { "program:program_units": {} },
        { "program_units:program_units program_unit": {} },
        { "program_units:": {} },
        { "program_unit:declare": {} },
        { "program_unit:cass_definition": {} },

        { "cass_definition:class id extends_declare { class_units }": {} },
        { "extends_declare:extends extend_list": {} },
        { "extends_declare:": {} },
        { "extend_list:extend_list , base_type": {} },
        { "extend_list:base_type": {} },
        { "class_units:class_units class_unit": {} },
        { "class_units:": {} },
        { "class_unit:cass_definition": {} },
        { "class_unit:declare": {} },
        { "class_unit:operator_overload": {} },   

        { "declare:var id : type ;": {} },
        { "declare:function_definition": {} },

        { "type:base_type arr_definition": {} },
        { "type:( ) => type": {} },
        { "arr_definition:arr_definition [ ]": {} },
        { "arr_definition:": {} },

        { "function_definition:function id ( parameters ) : type { function_units }": {} },
        { "parameters:parameter_list": {} },
        { "parameters:": {} },
        { "parameter_list:parameter_list , parameter": {} },
        { "parameter_list:parameter": {} },
        { "parameter:id : type": {} },
        { "operator_overload:operator + ( parameter ) : type { function_units }": {} },
        { "function_units:function_units function_unit": {} },
        { "function_units:": {} },
        { "function_unit:declare": {} },
        { "function_unit:statement": {} },
        { "statement:object ;": {} },     

        { "object:id": {} },
        { "object:object . id": {} },
        { "object:object ( arguments )": {} },
        { "object:assignment": {} },
        { "object:( arguments ) => { function_units }": {} },//lambda
        { "assignment:object = object": {} },
        { "object:new { anonymous_stmts }": {} },//匿名类，类似C#而不是java

        { "anonymous_stmts:anonymous_stmts anonymous_stmt": {} },
        { "anonymous_stmts:": {} },
        { "anonymous_stmt:assignment ;": {} },

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
