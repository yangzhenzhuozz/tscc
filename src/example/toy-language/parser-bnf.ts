import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
import { userTypeDictionary } from './lexrule.js';
import { Type, ArrayType, FunctionType, Address, Scope, FunctionScope, BlockScope, SemanticException, ProgramScope, Node, AbstracSyntaxTree, program } from "./lib.js";
let grammar: Grammar = {
    userCode: `
import { userTypeDictionary } from './lexrule.js';
import { Type, ArrayType, FunctionType, Address, Scope, FunctionScope, BlockScope, SemanticException, ProgramScope, Node, AbstracSyntaxTree, program } from "./lib.js";
    `,
    tokens: ['var', 'val', '...', ';', 'id', 'immediate_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'this', 'return', 'get', 'set', 'sealed', 'try', 'catch', 'throw', 'super', 'basic_type', 'instanceof'],
    association: [
        { 'right': ['='] },
        { 'right': ['?'] },
        { 'nonassoc': ['instanceof'] },
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
        { "program:import_stmts getProgram program_units": {} },//整个程序由导入语句组和程序单元组构成
        {
            "getProgram:": {
                action: function ($, s): ProgramScope {
                    return program;
                }
            }
        },
        { "import_stmts:": {} },//导入语句组可以为空
        { "import_stmts:import_stmts W2_0 import_stmt": {} },//导入语句组由一条或者多条导入语句组成
        { "import_stmt:import id ;": {} },//导入语句语法
        { "program_units:": {} },//程序单元组可以为空
        { "program_units:program_units W2_0 program_unit": {} },//程序单元组由一个或者多个程序单元组成
        { "program_unit:declare ;": {} },//程序单元可以是一条声明语句
        { "program_unit:class_definition": {} },//程序单元可以是一个类定义语句
        {
            "declare:var id : type": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as ProgramScope | Type | undefined;
                    let id = $[1] as string;
                    let type = $[3] as Type;
                    if (head instanceof ProgramScope) {//在程序空间中声明的变量
                        head.type.registerField(id, { type: type, AST: undefined }, 'var');
                    } else if (head instanceof Type) {//在class中声明的变量
                        head.registerField(id, { type: type, AST: undefined }, 'var');
                    } else {//function中声明的变量暂时不管
                    }
                }
            }
        },//声明语句_1，声明一个变量id，其类型为type
        {
            "declare:var id : type = W6_0 object": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let id = $[1] as string;
                    let type = $[3] as Type;
                    if (head instanceof ProgramScope) {//在程序空间中声明的变量
                        head.type.registerField(id, { type: type, AST: undefined }, 'var');
                    } else if (head instanceof Type) {//在class中声明的变量
                        head.registerField(id, { type: type, AST: undefined }, 'var');
                    } else {//function中声明的变量暂时不管
                    }
                }
            }
        },//声明语句_2，声明一个变量id，并且将object设置为id的初始值，object的类型要和声明的类型一致
        {
            "declare:var id = W4_0 object": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as ProgramScope | Type | undefined;
                    let id = $[1] as string;
                    if (head instanceof ProgramScope) {//在程序空间中声明的变量
                        head.type.registerField(id, { type: undefined, AST: undefined }, 'var');
                    } else if (head instanceof Type) {//在class中声明的变量
                        head.registerField(id, { type: undefined, AST: undefined }, 'var');
                    } else {//function中声明的变量暂时不管
                    }
                }
            }
        },//声明语句_3，声明一个变量id，并且将object设置为id的初始值，类型自动推导
        {
            "declare:val id : type": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as ProgramScope | Type | undefined;
                    let id = $[1] as string;
                    let type = $[3] as Type;
                    if (head instanceof ProgramScope) {//在程序空间中声明的变量
                        head.type.registerField(id, { type: type, AST: undefined }, 'var');
                    } else if (head instanceof Type) {//在class中声明的变量
                        head.registerField(id, { type: type, AST: undefined }, 'var');
                    } else {//function中声明的变量暂时不管
                    }
                }
            }
        },//声明语句_4，声明一个变量id，其类型为type
        {
            "declare:val id : type = W6_0 object": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as ProgramScope | Type | undefined;
                    let id = $[1] as string;
                    let type = $[3] as Type;
                    if (head instanceof ProgramScope) {//在程序空间中声明的变量
                        head.type.registerField(id, { type: type, AST: undefined }, 'var');
                    } else if (head instanceof Type) {//在class中声明的变量
                        head.registerField(id, { type: type, AST: undefined }, 'var');
                    } else {//function中声明的变量暂时不管
                    }
                }
            }
        },//声明语句_5，声明一个变量id，并且将object设置为id的初始值，object的类型要和声明的类型一致
        {
            "declare:val id = W4_0 object": {
                action: function ($, s) {
                    let head = s.slice(-1)[0] as ProgramScope | Type | undefined;
                    let id = $[1] as string;
                    if (head instanceof ProgramScope) {//在程序空间中声明的变量
                        head.type.registerField(id, { type: undefined, AST: undefined }, 'val');
                    } else if (head instanceof Type) {//在class中声明的变量
                        head.registerField(id, { type: undefined, AST: undefined }, 'val');
                    } else {//function中声明的变量暂时不管
                    }
                }
            }
        },//声明语句_6，声明一个变量id，并且将object设置为id的初始值，类型自动推导
        { "declare:function_definition": {} },//声明语句_7，可以是一个函数定义语句
        {
            "class_definition:modifier class basic_type template_declare extends_declare { create_class_Type class_units }": {
                action: function ($, s) {
                    let template_declare = $[3] as string[] | undefined;
                    if (template_declare != undefined) {
                        for (let t of template_declare) {
                            program.unregisterType(t);
                            userTypeDictionary.delete(t);
                        }
                    }
                    let modifier: 'valuetype' | 'sealed' | 'referentialType' | undefined = $[0] as 'valuetype' | 'sealed' | undefined;
                    if (modifier == undefined) {
                        modifier = 'referentialType'
                    }
                    let basic_type = $[2] as Type;
                    let classType = $[6] as Type;
                    classType.genericParadigm = template_declare;

                }
            }
        },//class定义语句由修饰符等组成(太长了我就不一一列举)
        {
            "create_class_Type:": {
                action: function ($, s): Type {
                    let classType = s.slice(-4)[0] as Type;
                    let extends_declare = s.slice(-2)[0] as Type | undefined;
                    classType.parentType = extends_declare;
                    return classType;
                }
            }
        },
        { "extends_declare:": {} },//继承可以为空
        {
            "extends_declare:extends type": {
                action: function ($, s): Type {
                    return $[1] as Type;
                }
            }
        },//继承,虽然文法是允许继承任意类型,但是在语义分析的时候再具体决定该class能不能被继承
        {
            "function_definition:function id template_declare ( parameter_declare ) ret_type { W8_0 statements }": {
                action: function ($, s) {
                    let template_declare = $[2] as string[] | undefined;
                    if (template_declare != undefined) {
                        for (let t of template_declare) {
                            program.unregisterType(t);
                            userTypeDictionary.delete(t);
                        }
                    }
                    let head = s.slice(-1)[0] as ProgramScope | Type | undefined;
                    let id = $[1] as string;
                    let parameter_declare = $[4] as { name: string, type: Type }[] | undefined;
                    let ret_type = $[6] as Type | undefined;
                    let type = new FunctionType(parameter_declare, ret_type, template_declare);
                    if (head instanceof ProgramScope) {//在程序空间中声明的变量
                        head.type.registerField(id, { type: type, AST: undefined }, 'val');
                    } else if (head instanceof Type) {//在class中声明的变量
                        head.registerField(id, { type: type, AST: undefined }, 'val');
                    } else {//function中声明的变量暂时不管
                    }
                }
            }
        },//函数定义语句，同样太长，不列表
        { "ret_type:": {} },//返回值类型可以不声明，自动推导,lambda就不用写返回值声明
        {
            "ret_type: : type": {
                action: function ($, s): Type {
                    return $[1] as Type
                }
            }
        },//可以声明返回值类型,function fun() : int {codes}
        {
            "modifier:valuetype": {
                action: function ($, s): string {
                    return 'valuetype';
                }
            }
        },//modifier可以是"valuetype"
        {
            "modifier:sealed": {
                action: function ($, s): string {
                    return 'sealed';
                }
            }
        },//modifier可以是"sealed"
        { "modifier:": {} },//modifier可以为空
        { "template_declare:": {} },//模板声明可以为空
        {
            "template_declare:template_definition": {
                action: function ($, s): string[] {
                    return $[0] as string[];
                }
            }
        },//模板声明可以是一个模板定义
        {
            "template_definition:< template_definition_list >": {
                action: function ($, s): string[] {
                    for (let t of $[1] as string[]) {
                        program.registerType(t);
                        userTypeDictionary.add(t);
                    }
                    return $[1] as string[];
                }
            }
        },//模板定义由一对尖括号<>和内部的template_definition_list组成
        {
            "template_definition_list:id": {
                action: function ($, s): string[] {
                    return [$[0] as string];
                }
            }
        },//template_definition_list可以是一个id
        {
            "template_definition_list:template_definition_list , id": {
                action: function ($, s): string[] {
                    let template_definition_list = $[0] as string[];
                    let id = $[2] as string;
                    if (template_definition_list.indexOf(id) != -1) {
                        throw new SemanticException(`模板类型${id}已经存在`);
                    }
                    template_definition_list.push(id);
                    return template_definition_list;
                }
            }
        },//template_definition_list可以是一个template_definition_list后面接上 , id
        {
            "type:( W2_0 type )": {
                action: function ($, s): Type {
                    return $[2] as Type;
                }
            }
        },//type可以用圆括号包裹
        {
            "type:basic_type": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    return $[0] as Type;
                }
            }
        },//type可以是一个base_type
        {
            "type:basic_type template_instances": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    let basic_type = $[0] as Type;
                    let template_instances = $[1] as Type[];
                    basic_type.templateInstances = template_instances;
                    return basic_type;
                }
            }
        },//type可以是一个base_type template_instances
        {
            "type:template_definition ( parameter_declare ) => type": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    /**
                     * 形如var g:<K,V>(a:K,b:V)=><K,V>(a:K,b:V)=>V;这种输入是非法的
                     * 因为在第一个<K,V>之后的K、V都被处理成了type,第二个<K,V>应该选用不同的名字,比如下面这种输入
                     * var g:<K,V>(a:K,b:V)=><M,N>(a:K,b:V)=>M
                     */
                    let template_definition = $[0] as string[];
                    for (let t of template_definition) {
                        program.unregisterType(t);
                        userTypeDictionary.delete(t);
                    }
                    let parameter_declare = $[2] as { name: string, type: Type }[];
                    let ret_type = $[5] as Type;
                    let ret = new FunctionType(parameter_declare, ret_type, template_definition);
                    return ret;
                }
            }
        },//泛型函数类型
        {
            "type:( W2_0 parameter_declare ) => type": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    let parameter_declare = $[2] as { name: string, type: Type }[];
                    let ret_type = $[5] as Type;
                    let ret = new FunctionType(parameter_declare, ret_type, undefined);
                    return ret;
                }
            }
        },//函数类型
        {
            "type:type array_type_list": {
                priority: "low_priority_for_[",
                action: function ($, s): Type {
                    let array_type_list = $[1] as number;
                    let innerType = $[0] as Type;
                    let tmp = innerType;
                    for (let i = 0; i < array_type_list; i++) {
                        tmp = new ArrayType(tmp);
                    }
                    return tmp;
                }
            }
        },//array_type由basic_type后面接上一堆方括号组成(基本数组)
        {
            "array_type_list:[ ]": {
                action: function ($, s): number {
                    return 1;
                }
            }
        },//array_type_list可以是一对方括号
        {
            "array_type_list:array_type_list [ ]": {
                action: function ($, s): number {
                    let array_type_list = $[0] as number;
                    return array_type_list + 1;
                }
            }
        },//array_type_list可以是array_type_list后面再接一对方括号
        {
            "parameter_declare:parameter_list": {
                action: function ($, s) {
                    return $[0];
                }
            }
        },//parameter_declare可以由parameter_list组成
        { "parameter_declare:": {} },//parameter_declare可以为空
        {
            "parameter_list:id : type": {
                action: function ($, s): { name: string, type: Type }[] {
                    let id = $[0] as string;
                    let type = $[2] as Type;
                    return [{ name: id, type: type }];
                }
            }
        },//parameter_list可以是一个 id : type
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
        },//parameter_list可以是一个parameter_list接上 , id : type

        { "class_units:class_units W2_0 class_unit": {} },//class_units可以由多个class_unit组成
        { "class_units:": {} },//class_units可以为空
        { "class_unit:declare ;": {} },//class_unit可以是一个声明语句
        { "class_unit:operator_overload": {} },//class_unit可以是一个运算符重载
        { "class_unit:get id ( ) : type { statements }": {} },//get
        { "class_unit:set id ( id : type ) { statements }": {} },//set
        { "class_unit:basic_type ( parameter_declare )  { statements }": {} },//构造函数
        { "class_unit:default ( )  { statements }": {} },//default函数,用于初始化值类型
        { "operator_overload:operator + ( parameter_declare ) : type { statements }": {} },//运算符重载,运算符重载实在是懒得做泛型了,以后要是有需求再讲,比起C#和java的残废泛型，已经很好了
        { "statements:statements statement": {} },//statements可以由多个statement组成
        { "statements:": {} },//statements可以为空
        { "statement:declare ;": {} },//statement可以是一条声明语句
        { "statement:try { statement } catch ( id : type ) { statement }": {} },//try catch语句，允许捕获任意类型的异常
        { "statement:throw object ;": {} },//抛异常语句
        { "statement:return object ;": {} },//带返回值的返回语句
        { "statement:return ;": {} },//不带返回值的语句
        { "statement:if ( object ) statement": { priority: "low_priority_for_if_stmt" } },//if语句
        { "statement:if ( object ) statement else statement": {} },//if else语句
        { "statement:lable_def do statement while ( object ) ;": {} },//do-while语句，其实我是想删除while语句的，我觉得for_loop可以完全替代while,一句话,为了看起来没这么怪
        { "statement:lable_def while ( object ) statement": {} },//while语句
        { "statement:lable_def for ( for_init ; for_condition ; for_step ) statement": {} },//for_loop
        { "statement:block": { action: ($, s) => $[0] } },//代码块
        { "statement:break lable_use ;": {} },//break语句
        { "statement:continue lable_use ;": {} },//continue语句
        { "statement:switch ( object ) { switch_bodys }": {} },//switch语句,因为switch在C/C++等语言中可以用跳转表处理,gcc在处理switch语句时,如果各个case的值连续,也会生成一个jum_table,所以我也考虑过移除switch语句,还是为了让其他语言的使用者感觉没那么怪
        { "statement:object ;": {} },//类似C/C++中的   1; 这种语句,java好像不支持这种写法
        { "lable_def:": {} },//lable_def可以为空
        { "lable_def:id :": {} },//label_def为 id : 组成
        { "for_init:": {} },//for_loop的init可以为空
        { "for_init:declare": {} },//init可以是一个声明
        { "for_init:object": {} },//也可以是一个对象
        { "for_condition:": {} },//condition可以为空
        { "for_condition:object": {} },//condition可以是一个对象(必须是bool对象)
        { "for_step:": {} },//step可以为空
        { "for_step:object": {} },//step可以是一个对象
        { "block:{ statements }": {} },//代码块是一对花括号中间包裹着statements
        { "lable_use:": {} },//在break和continue中被使用
        { "lable_use:id": {} },//在break和continue中被使用
        { "switch_bodys:": {} },//switch_bodys可为空
        { "switch_bodys:switch_bodys switch_body": {} },//switch_bodys可以由多个switch_body组成
        { "switch_body:case immediate_val : statement": {} },//case 语句
        { "switch_body:default : statement": {} },//default语句
        {
            "object:( W2_0 object )": {
                action: function ($, s): AbstracSyntaxTree {
                    return $[2] as AbstracSyntaxTree;
                }
            }
        },//括号括住的object还是一个object
        {
            "object:object . id": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let obj = $[0] as AbstracSyntaxTree;
                    let id = $[2] as string;
                    let node = new Node('field');
                    node.tag = id;
                    node.children.push(obj.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//取成员
        {
            "object:object  ( arguments )": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let obj = $[0] as AbstracSyntaxTree;
                    let _arguments = $[2] as AbstracSyntaxTree[] | undefined;
                    let node = new Node('call');
                    node.children.push(obj.root.index);
                    if (_arguments != undefined) {
                        for (let a of _arguments) {
                            node.children.push(a.root.index);
                        }
                    }
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//函数调用
        {
            "object:object < W3_0 template_instance_list > ( arguments )": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let obj = $[0] as AbstracSyntaxTree;
                    let template_instance_list = $[3] as Type[];
                    let _arguments = $[6] as AbstracSyntaxTree[] | undefined;
                    let node = new Node('call');
                    node.children.push(obj.root.index);
                    if (_arguments != undefined) {
                        for (let a of _arguments) {
                            node.children.push(a.root.index);
                        }
                    }
                    node.tag = template_instance_list;
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//模板函数调用
        {
            "object:object = W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('=');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object + W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('+');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object - W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('-');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object * W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('*');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object / W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('/');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object < W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('<');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object <= W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('<=');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object > W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('>');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object >= W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('>=');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object == W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('==');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object || W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('||');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object && W3_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let left = $[0] as AbstracSyntaxTree;
                    let right = $[3] as AbstracSyntaxTree;
                    let node = new Node('&&');
                    node.children.push(left.root.index);
                    node.children.push(right.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:object instanceof type": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let obj = $[0] as AbstracSyntaxTree;
                    let type = $[2] as Type;
                    let node = new Node('instanceof');
                    node.tag = type;
                    node.children.push(obj.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },
        {
            "object:! W2_0 object": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let obj = $[2] as AbstracSyntaxTree;
                    let node = new Node('!');
                    node.children.push(obj.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//单目运算符-非
        {
            "object:object ++": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let obj = $[0] as AbstracSyntaxTree;
                    let node = new Node('++');
                    node.children.push(obj.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//单目运算符++
        {
            "object:object --": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let obj = $[0] as AbstracSyntaxTree;
                    let node = new Node('--');
                    node.children.push(obj.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//单目运算符--
        {
            "object:object [ W3_0 object ]": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let obj = $[0] as AbstracSyntaxTree;
                    let index = $[2] as AbstracSyntaxTree;
                    let node = new Node('index');
                    node.children.push(obj.root.index);
                    node.children.push(index.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//[]运算符
        {
            "object:object ? W3_0 object : W6_0 object": {
                priority: "?",
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let obj0 = $[0] as AbstracSyntaxTree;
                    let obj1 = $[2] as AbstracSyntaxTree;
                    let obj2 = $[4] as AbstracSyntaxTree;
                    let node = new Node('?');
                    node.children.push(obj0.root.index);
                    node.children.push(obj1.root.index);
                    node.children.push(obj2.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//三目运算
        {
            "object:id": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let id = $[0] as string;
                    let node = new Node('load');
                    node.value = id;
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//id是一个对象
        {
            "object:immediate_val": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let immediate_val = $[0] as { value: unknown, type: Type };
                    let node = new Node('immediate');
                    node.value = immediate_val.value;
                    node.type = immediate_val.type;
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//立即数是一个object
        {
            "object:super": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let node = new Node('super');
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//super是一个对象
        {
            "object:this": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let node = new Node('this');
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//this是一个object
        {
            "object:template_definition ( parameter_declare ) => { W7_0 statements }": {
                action: function ($, s): AbstracSyntaxTree {
                    let template_definition = $[0] as string[];
                    for (let t of template_definition) {
                        program.unregisterType(t);
                        userTypeDictionary.delete(t);
                    }
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let parameter_declare = $[2] as { name: string, type: Type }[] | undefined;
                    let type = new FunctionType(parameter_declare, undefined, template_definition);
                    let statements = $[7] as AbstracSyntaxTree[];
                    let node = new Node('immediate');
                    node.type = type;
                    for (let ast of statements) {
                        node.children.push(ast.root.index);
                    }
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//模板lambda
        {
            "object:( W2_0 parameter_declare ) => { W7_0 statements }": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let parameter_declare = $[2] as { name: string, type: Type }[] | undefined;
                    let type = new FunctionType(parameter_declare, undefined, undefined);
                    let statements = $[7] as AbstracSyntaxTree[];
                    let node = new Node('immediate');
                    node.type = type;
                    for (let ast of statements) {
                        node.children.push(ast.root.index);
                    }
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//lambda
        {
            "object:( W2_0 type ) object": {
                priority: "cast_priority",
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let type = $[2] as Type;
                    let obj = $[4] as AbstracSyntaxTree;
                    let node = new Node('cast');
                    node.tag = type;
                    node.children.push(obj.root.index);
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//强制转型
        {
            "object:new type  ( W4_0 arguments )": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let type = $[1] as Type;
                    let _arguments = $[4] as AbstracSyntaxTree[] | undefined;
                    let node = new Node('new');
                    node.tag = type;
                    if (_arguments != undefined) {
                        for (let arg of _arguments) {
                            node.children.push(arg.root.index);
                        }
                    }
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//new 对象
        {
            "object:new type array_init_list": {
                action: function ($, s): AbstracSyntaxTree {
                    let head = s.slice(-1)[0] as ProgramScope | Type | FunctionScope | BlockScope;
                    let type = $[1] as Type;
                    let array_init_list = $[2] as { initialize: AbstracSyntaxTree[], placeholder: number }
                    let node = new Node('new_array');
                    node.tag = { type: type, placeholder: array_init_list.placeholder };
                    for (let init of array_init_list.initialize) {
                        node.children.push(init.root.index);
                    }
                    return new AbstracSyntaxTree(node, head);
                }
            }
        },//创建数组
        {
            "array_init_list:array_inits array_placeholder": {
                action: function ($, s): { initialize: AbstracSyntaxTree[], placeholder: number } {
                    return { initialize: $[0] as AbstracSyntaxTree[], placeholder: $[1] as number };
                }
            }
        },//new 数组的时候是可以这样写的 new int [2][3][][],其中[2][3]对应了array_inits,后面的[][]对应了array_placeholder(数组占位符)
        {
            "array_inits:array_inits [ object ]": {
                action: function ($, s): AbstracSyntaxTree[] {
                    let array_inits = $[0] as AbstracSyntaxTree[];
                    let obj = $[2] as AbstracSyntaxTree;
                    array_inits.push(obj);
                    return array_inits;
                }
            }
        },//见array_init_list一条的解释
        {
            "array_inits:[ object ]": {
                action: function ($, s): AbstracSyntaxTree[] {
                    return [$[1] as AbstracSyntaxTree];
                }
            }
        },//见array_init_list一条的解释
        {
            "array_placeholder:array_placeholder_list": {
                priority: "low_priority_for_array_placeholder",
                action: function ($, s): number {
                    return $[0] as number;
                }
            }
        },//见array_init_list一条的解释
        {
            "array_placeholder:": {
                priority: "low_priority_for_array_placeholder",
                action: function ($, s): number {
                    return 0;
                }
            }
        },//array_placeholder可以为空
        {
            "array_placeholder_list:array_placeholder_list [ ]": {
                action: function ($, s): number {
                    return ($[0] as number)++;
                }
            }
        },//见array_init_list一条的解释
        {
            "array_placeholder_list:[ ]": {
                action: function ($, s): number {
                    return 1;
                }
            }
        },//见array_init_list一条的解释
        {
            "template_instances:< template_instance_list >": {
                action: function ($, s): Type[] {
                    return $[1] as Type[];
                }
            }
        },//模板实例化可以实例化为一个<template_instance_list>
        {
            "template_instance_list:type": {
                action: function ($, s): Type[] {
                    return [$[0] as Type];
                }
            }
        },//template_instance_list可以为一个type
        {
            "template_instance_list:template_instance_list , type": {
                action: function ($, s): Type[] {
                    let template_instance_list = $[0] as Type[];
                    let type = $[2] as Type;
                    template_instance_list.push(type);
                    return template_instance_list;
                }
            }
        },//template_instance_list可以为多个type
        { "arguments:": {} },//实参可以为空
        {
            "arguments:argument_list": {
                action: function ($, s): AbstracSyntaxTree[] {
                    return $[0] as AbstracSyntaxTree[];
                }
            }
        },//实参可以是argument_list
        {
            "argument_list:object": {
                action: function ($, s): AbstracSyntaxTree[] {
                    return [$[0] as AbstracSyntaxTree]
                }
            }
        },//参数列表可以是一个object
        {
            "argument_list:argument_list , object": {
                action: function ($, s): AbstracSyntaxTree[] {
                    let argument_list = $[0] as AbstracSyntaxTree[];
                    let obj = $[2] as AbstracSyntaxTree;
                    argument_list.push(obj);
                    return argument_list;
                }
            }
        },//参数列表可以是多个object
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
                    return s.slice(-7)[0];
                }
            }
        }
    ]
}
let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();
if (str != null) {
    fs.writeFileSync('./src/example/toy-language/parser.ts', str);
    console.log('成功');
} else {
    console.log('失败');
}
