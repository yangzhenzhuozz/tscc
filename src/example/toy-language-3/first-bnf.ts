/**
 * 本次扫描把所有的用户自定义class设置为user_type
 */
import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
import { Type, ArrayType, FunctionType, Address, ProgramScope, programScope, ClassScope, FunctionScope, BlockScope, SemanticException, Scope } from "./lib.js"
let grammar: Grammar = {
    userCode: `
    import globalLexer from './lexrule.js';
    import { Type, ArrayType, FunctionType, Address, ProgramScope, programScope, ClassScope, FunctionScope, BlockScope, SemanticException, Scope } from "./lib.js";`,
    tokens: ['var', 'val', '...', ';', 'id', 'immediate_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'this', 'return', 'get', 'set', 'sealed', 'try', 'catch', 'throw', 'super', 'built_in_type', 'user_type'],
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
        { 'nonassoc': ['low_priority_for_['] },
        { 'nonassoc': ['cast_priority'] },
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
                    return programScope;
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
                    let type = $[3] as Type;
                    head.registerField(id, type, 'var');
                }
            }
        },
        {
            "declare:var id : type = object": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as Scope;
                    let id = $[1] as string;
                    let type = $[3] as Type;
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
                    let type = $[3] as Type;
                    head.registerField(id, type, 'val');
                }
            }
        },
        {
            "declare:val id : type = object": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as Scope;
                    let id = $[1] as string;
                    let type = $[3] as Type;
                    head.registerField(id, type, 'val');
                }
            }
        },
        { "declare:val id = object": {} },
        { "declare:function_definition": {} },
        {
            "class_definition:modifier class user_type template_declare extends_declare { create_class_scope class_units }": {
                action: function ($, s) {
                    let class_scope = $[6] as ClassScope;
                    console.error('在program中注册类');
                }
            }
        },
        {
            "create_class_scope:": {
                action: function ($, s): ClassScope {
                    let stack = s.slice(-7);
                    let head = stack[0] as ProgramScope;
                    let template_declare = stack[4] as string[] | undefined;
                    let extends_declare = stack[5] as Type | undefined;
                    return new ClassScope(head, template_declare, extends_declare);
                }
            }
        },
        { "extends_declare:": {} },
        {
            "extends_declare:extends type": {
                action: function ($, s): Type {
                    let type = $[1] as Type;
                    return type;
                }
            }
        },
        {
            "function_definition:function id template_declare ( parameter_declare ) ret_type { statements }": {
                action: function ($, s) {
                    let ret_type = $[6] as Type;
                    let id = $[1] as string;
                    let head = s.slice(-1)[0] as ProgramScope | ClassScope;
                    let template_declare = $[2] as string[] | undefined;
                    let parameter_declare = $[4] as { name: string, type: Type }[] | undefined;
                    if (ret_type != undefined) {
                        head.registerField(id, new FunctionType(parameter_declare, ret_type, template_declare, undefined), 'var');
                    }
                }
            }
        },
        { "ret_type:": {} },
        {
            "ret_type: : type": {
                action: function ($, s): Type {
                    let type = $[1] as Type;
                    return type;
                }
            }
        },
        {
            "modifier:valuetype": {
                action: function ($, s): string {
                    return 'valuetype';
                }
            }
        },
        {
            "modifier:sealed": {
                action: function ($, s): string {
                    return 'sealed';
                }
            }
        },
        { "modifier:": {} },
        { "template_declare:": {} },
        {
            "template_declare:template_definition": {
                action: function ($, s): string[] {
                    let template_definition_list = $[0] as string[];
                    return template_definition_list;
                }
            }
        },
        {
            "template_definition:< template_definition_list >": {
                action: function ($, s): string[] {
                    let template_definition_list = $[1] as string[];
                    return template_definition_list;
                }
            }
        },
        {
            "template_definition_list:id": {
                action: function ($, s): string[] {
                    let id = $[0] as string;
                    return [id];
                }
            }
        },
        {
            "template_definition_list:template_definition_list , id": {
                action: function ($, s): string[] {
                    let template_definition_list = $[0] as string[];
                    let id = $[2] as string;
                    template_definition_list.push(id);
                    return template_definition_list;
                }
            }
        },
        {
            "type:( type )": {
                action: function ($, s): Type {
                    let type = $[1] as Type;
                    return type;
                }
            }
        },
        {
            "type:not_array_type": {
                action: function ($, s): Type {
                    let not_array_type = $[0] as Type;
                    return not_array_type;
                }
            }
        },
        {
            "type:array_type": {
                action: function ($, s): Type {
                    let array_type = $[0] as Type;
                    return array_type;
                }
            }
        },
        {
            "not_array_type:basic_type": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    let basic_type = $[0] as Type;
                    return basic_type;
                }
            }
        },
        {
            /**
             * 这里加create_template_type是为了不和下面的
             * array_type:basic_type template_instances create_template_type array_type_list
             * 这条规则产生规约-规约冲突
             */
            "not_array_type:basic_type template_instances create_template_type": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    let create_template_type = $[2] as Type;
                    return create_template_type;
                }
            },
        },
        {
            "create_template_type:": {
                action: function ($, s): Type {
                    let stack = s.slice(-2);
                    let basic_type = stack[0] as Type;
                    let template_instances = stack[1] as Type[];
                    basic_type.templateInstances = template_instances;
                    return basic_type;
                }
            }
        },
        {
            "not_array_type:( parameter_declare ) => type": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    let parameter_declare = $[1] as { name: string, type: Type }[] | undefined;
                    let ret_type = $[4] as Type;
                    return new FunctionType(parameter_declare, ret_type, undefined, undefined);
                }
            }
        },
        {
            "not_array_type:template_instances ( parameter_declare ) => type": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    let parameter_declare = $[2] as { name: string, type: Type }[] | undefined;
                    let ret_type = $[5] as Type;
                    let template_instances = $[0] as Type[];
                    return new FunctionType(parameter_declare, ret_type, undefined, template_instances);
                }
            }
        },
        {
            "array_type:basic_type array_type_list": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    let array_type_list = $[1] as Type;
                    return array_type_list;
                }
            }
        },
        {
            "array_type:basic_type template_instances create_template_type array_type_list": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    let array_type_list = $[3] as Type;
                    return array_type_list;
                }
            }
        },
        {
            "array_type:( parameter_declare ) => type create_function_type array_type_list": {
                priority: "low_priority_for_[",
                action: function ($, s) {

                }
            }
        },
        { "array_type:template_instances ( parameter_declare ) => type array_type_list": { priority: "low_priority_for_[" } },
        { "create_function_type:": {} },
        {
            "array_type_list:[ ]": {
                action: function ($, s): Type {
                    let head = s.slice(-1)[0] as Type;
                    return new ArrayType(head)
                }
            }
        },
        {
            "array_type_list:array_type_list [ ]": {
                action: function ($, s): Type {
                    let head = $[0] as Type;
                    return new ArrayType(head)
                }
            }
        },
        {
            "basic_type:built_in_type": {
                action: function ($, s): Type {
                    let built_in_type = $[0] as string;
                    return programScope.getRegisteredType(built_in_type);
                }
            }
        },
        {
            "basic_type:user_type": {
                action: function ($, s): Type {
                    let user_type = $[0] as string;
                    return programScope.getRegisteredType(user_type);
                }
            }
        },
        {
            "parameter_declare:parameter_list": {
                action: function ($, s): { name: string, type: Type }[] {
                    let parameter_list = $[0] as { name: string, type: Type }[];
                    return parameter_list;
                }
            }
        },
        { "parameter_declare:": {} },
        {
            "parameter_list:id : type": {
                action: function ($, s): { name: string, type: Type }[] {
                    let id = $[0] as string;
                    let type = $[2] as Type;
                    return [{ name: id, type: type }];
                }
            }
        },
        {
            "parameter_list:parameter_list , id : type": {
                action: function ($, s): { name: string, type: Type }[] {
                    let parameter_list = $[0] as { name: string, type: Type }[];
                    let id = $[2] as string;
                    let type = $[4] as Type;
                    parameter_list.push({ name: id, type: type });
                    return parameter_list;
                }
            }
        },
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
        { "object:object  ( arguments )": {} },
        { "object:object template_instances ( arguments )": {} },
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
        { "object:new type  ( arguments )": {} },
        { "object:new not_array_type array_init_list": {} },
        { "array_init_list:array_inits array_placeholder": {} },
        { "array_inits:array_inits [ object ]": {} },
        { "array_inits:[ object ]": {} },
        { "array_placeholder:array_placeholder_list": { priority: "low_priority_for_array_placeholder" } },
        { "array_placeholder:": { priority: "low_priority_for_array_placeholder" } },
        { "array_placeholder_list:array_placeholder_list [ ]": {} },
        { "array_placeholder_list:[ ]": {} },
        {
            "template_instances:< template_instance_list >": {
                action: function ($, s): Type[] {
                    let template_instance_list = $[1] as Type[];
                    return template_instance_list;
                }
            }
        },
        {
            "template_instance_list:type": {
                action: function ($, s): Type[] {
                    let type = $[0] as Type;
                    return [type];
                }
            }
        },
        {
            "template_instance_list:template_instance_list , type": {
                action: function ($, s): Type[] {
                    let template_instance_list = $[0] as Type[];
                    let type = $[2] as Type;
                    template_instance_list.push(type);
                    return template_instance_list;
                }
            }
        },
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
        }
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