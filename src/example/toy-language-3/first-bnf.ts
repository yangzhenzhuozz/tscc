import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
import { Type, ArrayType, FunctionType, Address, ProgramScope, ClassScope, FunctionScope, BlockScope, SemanticException, Scope } from "./lib.js"
let grammar: Grammar = {
    userCode: `import { Type, ArrayType, FunctionType, Address, ProgramScope, ClassScope, FunctionScope, BlockScope, SemanticException, Scope } from "./lib.js"`,
    tokens: ['var', 'val', '...', ';', 'id', 'immediate_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'this', 'return', 'get', 'set', 'sealed', 'try', 'catch', 'basic_type', 'throw', 'super'],
    association: [
        { 'right': ['='] },
        { 'right': ['?'] },
        { 'left': ['==', '!='] },
        { 'left': ['||'] },
        { 'left': ['&&'] },
        { 'left': ['!'] },
        { 'left': ['>', '<', '<=', '>='] },
        { 'left': ['+', '-'] },
        { 'left': ['*', '/'] },
        { 'left': ['++', '--'] },
        { 'right': ['=>'] },
        { 'nonassoc': ['low_priority_for_array_placeholder'] },
        { 'nonassoc': ['low_priority_for_function_type'] },
        { 'nonassoc': ['cast_priority'] },
        { 'nonassoc': ["priority_for_template_instance"] },
        { 'nonassoc': ['['] },
        { 'nonassoc': ['('] },
        { 'nonassoc': ['.'] },
        { 'nonassoc': ['low_priority_for_if_stmt'] },
        { 'nonassoc': ['else'] },
    ],
    BNF: [
        { "program:import_stmts create_program_scope program_units": {} },
        {
            "create_program_scope:": {
                action: function ($, s): ProgramScope {
                    return new ProgramScope();
                }
            }
        },
        { "import_stmts:": {} },
        { "import_stmts:import_stmts import_stmt": {} },
        { "import_stmt:import id ;": {} },
        { "program_units:": {} },
        { "program_units:program_units W2_0 program_unit": {} },
        { "program_unit:declare ;": {} },
        { "program_unit:class_definition": {} },
        {
            "declare:var id : type": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as Scope;
                    let id = $[1] as string;
                    let type = $[3] as Type
                    head.registerField(id, type, 'var');
                }
            }
        },
        {
            "declare:var id : type = object": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as Scope;
                    let id = $[1] as string;
                    let type = $[3] as Type
                    head.registerField(id, type, 'var');
                }
            }
        },
        { "declare:var id = object": {} },
        {
            "declare:val id : type": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as Scope;
                    let id = $[1] as string;
                    let type = $[3] as Type
                    head.registerField(id, type, 'val');
                }
            }
        },
        {
            "declare:val id : type = object": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as Scope;
                    let id = $[1] as string;
                    let type = $[3] as Type
                    head.registerField(id, type, 'val');
                }
            }
        },
        { "declare:val id = object": {} },
        { "declare:function_definition": {} },
        { "class_definition:modifier class id template_declare extends_declare { create_class_scope class_units }": {} },
        {
            "create_class_scope:": {
                action: function ($, s): ClassScope {
                    let stack = s.slice(-7);
                    let head = stack[0] as ProgramScope;
                    let template_declare = stack[4] as string[] | undefined;
                    let extends_declare = stack[5] as string | undefined;
                    return new ClassScope(head, template_declare == undefined, extends_declare);
                }
            }
        },
        { "extends_declare:": {} },
        {
            "extends_declare:extends basic_type": {
                action: function ($, s): string {
                    return $[1] as string;
                }
            }
        },
        {
            "function_definition:function id template_declare ( parameter_declare ) : ret_type { statements }": {
                action: function ($, s) {
                    let ret_type = '';
                    //如果声明了返回类型则记录，否则这轮先不管
                    if (ret_type != undefined) {
                        //xxx
                    }
                }
            }
        },
        { "ret_type:": {} },
        { "ret_type:type": {} },
        { "modifier:valuetype": {} },
        { "modifier:sealed": {} },
        { "modifier:": {} },
        { "template_declare:": {} },
        { "template_declare:template_definition": {} },
        { "template_definition:< template_definition_list >": {} },
        { "template_definition_list:id": {} },
        { "template_definition_list:template_definition_list , id": {} },
        { "type:( type )": {} },
        { "type:basic_type template_instance": { priority: "low_priority_for_function_type" } },
        { "type:function_type": { priority: "low_priority_for_function_type" } },
        { "type:array_type": {} },
        { "function_type:( parameter_declare ) => type": {} },
        { "array_type:basic_type array_type_list": { priority: "low_priority_for_function_type" } },
        { "array_type:function_type array_type_list": { priority: "low_priority_for_function_type" } },
        { "array_type_list:[ ]": {} },
        { "array_type_list:array_type_list [ ]": {} },
        { "parameter_declare:parameter_list": {} },
        { "parameter_declare:": {} },
        { "parameter_list:id : type": {} },
        { "parameter_list:parameter_list , id : type": {} },
        { "class_units:class_units class_unit": {} },
        { "class_units:": {} },
        { "class_unit:declare ;": {} },
        { "class_unit:operator_overload": {} },
        { "class_unit:get id ( ) : type { statements }": {} },
        { "class_unit:set id ( id : type ) { statements }": {} },
        { "operator_overload:operator + ( parameter_declare ) : type { statements }": {} },
        { "statements:statements statement": {} },
        { "statements:": {} },
        { "statement:declare ;": {} },
        { "statement:try { statement } catch ( id : type ) { statement }": {} },
        { "statement:throw object ;": {} },
        { "statement:return object ;": {} },
        { "statement:return ;": {} },
        { "statement:if ( object ) statement": { priority: "low_priority_for_if_stmt" } },
        { "statement:if ( object ) statement else statement": {} },
        { "statement:lable_def do statement while ( object ) ;": {} },
        { "statement:lable_def while ( object ) statement": {} },
        { "statement:lable_def for ( for_init ; for_condition ; for_step ) statement": {} },
        { "statement:block": { action: ($, s) => $[0] } },
        { "statement:break lable_use ;": {} },
        { "statement:continue lable_use ;": {} },
        { "statement:switch ( object ) { switch_bodys }": {} },
        { "statement:object ;": {} },
        { "lable_def:": {} },
        { "lable_def:id :": {} },
        { "for_init:": {} },
        { "for_init:declare": {} },
        { "for_init:object": {} },
        { "for_condition:": {} },
        { "for_condition:object": {} },
        { "for_step:": {} },
        { "for_step:object": {} },
        { "block:{ statements }": {} },
        { "lable_use:": {} },
        { "lable_use:id": {} },
        { "switch_bodys:": {} },
        { "switch_bodys:switch_bodys switch_body": {} },
        { "switch_body:case immediate_val : statement": {} },
        { "switch_body:default : statement": {} },
        { "object:( object )": {} },
        { "object:object template_instance ( arguments )": {} },
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
        { "object:! object": {} },
        { "object:object ++": {} },
        { "object:object --": {} },
        { "object:object [ object ]": {} },
        { "object:object ? object : object": { priority: "?" } },
        { "object:id": {} },
        { "object:super": {} },
        { "object:immediate_val": {} },
        { "object:this": {} },
        { "object:( parameter_declare ) => { statements }": {} },
        { "object:( type ) object": { priority: "cast_priority" } },
        { "object:new type array_init_list": {} },
        { "array_init_list:array_inits array_placeholder": {} },
        { "array_inits:array_inits [ object ]": {} },
        { "array_inits:[ object ]": {} },
        { "array_placeholder:array_placeholder_list": { priority: "low_priority_for_array_placeholder" } },
        { "array_placeholder:": { priority: "low_priority_for_array_placeholder" } },
        { "array_placeholder_list:array_placeholder_list [ ]": {} },
        { "array_placeholder_list:[ ]": {} },
        { "template_instance:": { priority: "priority_for_template_instance" } },
        { "template_instance:< template_instance_list >": {} },
        { "template_instance_list:type": {} },
        { "template_instance_list:template_instance_list , type": {} },
        { "arguments:": {} },
        { "arguments:argument_list": {} },
        { "argument_list:object": {} },
        { "argument_list:argument_list , object": {} },
        {
            "W2_0:": {
                action: function ($, s) {
                    return s.slice(-2)[0];
                }
            }
        },
    ]
}
let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();
if (str != null) {
    console.log(`成功`);
    fs.writeFileSync('./src/example/toy-language-3/parser-1.ts', str);
} else {
    console.log(`失败`);
}