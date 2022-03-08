import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
let grammar: Grammar = {
    tokens: ['var', '...', ';', 'id', 'immediate_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'this', 'return', 'get', 'set', 'sealed', 'try', 'catch', 'basic_type'],
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
        { 'nonassoc': ['low_priority_for_function_type'] },//见array_type:function_type array_type_list 这条产生式的解释
        { 'nonassoc': ['cast_priority'] },//强制转型比"("、"["、"."优先级低,比+ - * /优先级高,如(int)f()表示先执行函数调用再转型 (int) a+b表示先把a转型成int，然后+b
        { 'nonassoc': ['['] },
        { 'nonassoc': ['('] },
        { 'nonassoc': ['.'] },
        { 'nonassoc': ['low_priority_for_if_stmt'] },//这个符号的优先级小于else
        { 'nonassoc': ['else'] },
    ],
    BNF: [
        { "program:import_stmts program_units": {} },//整个程序由导入语句组和程序单元组构成
        { "import_stmts:": {} },//导入语句组可以为空
        { "import_stmts:import_stmts import_stmt": {} },//导入语句组由一条或者多条导入语句组成
        { "import_stmt:import id ;": {} },//导入语句语法
        { "program_units:": {} },//程序单元组可以为空
        { "program_units:program_units program_unit": {} },//程序单元组由一个或者多个程序单元组成
        { "program_unit:declare ;": {} },//程序单元可以是一条声明语句
        { "program_unit:class_definition": {} },//程序单元可以是一个类定义语句
        { "declare:var id : type": {} },//声明语句_1，声明一个变量id，其类型为type
        { "declare:var id : type = object": {} },//声明语句_2，声明一个变量id，并且将object设置为id的初始值，object的类型要和声明的类型一致
        { "declare:var id = object": {} },//声明语句_3，声明一个变量id，并且将object设置为id的初始值，类型自动推导
        { "declare:function_definition": {} },//声明语句_4，可以是一个函数定义语句
        { "class_definition:modifier class id template_declare extends_declare { class_units }": {} },//class定义语句由修饰符等组成(太长了我就不一一列举)
        { "extends_declare:extends basic_type template_declare": {} },//继承模板类
        { "function_definition:function id template_declare ( parameter_declare ) : type { statements }": {} },//函数定义语句，同样太长，不列表
        { "modifier:valuetype": {} },//modifier可以是"valuetype"
        { "modifier:sealed": {} },//modifier可以是"sealed"
        { "modifier:empty": {} },//modifier可以为空
        { "template_declare:empty": {} },//模板声明可以为空
        { "template_declare:template_definition": {} },//模板声明可以是一个模板定义
        { "template_definition:< template_definition_list >": {} },//模板定义由一对尖括号<>和内部的template_definition_list组成
        { "template_definition_list:id": {} },//template_definition_list可以是一个id
        { "template_definition_list:template_definition_list , id": {} },//template_definition_list可以是一个template_definition_list后面接上 , id
        { "type:( type )": {} },//type可以用圆括号包裹
        { "type:basic_type": { priority: "low_priority_for_function_type" } },//type可以是一个base_type
        { "type:function_type": { priority: "low_priority_for_function_type" } },//type可以是一个function_type
        { "type:array_type": {} },//type可以是一个array_type
        { "function_type:( parameter_declare ) => type": {} },//function_type的结构
        { "array_type:basic_type array_type_list": { priority: "low_priority_for_function_type" } },//array_type由basic_type后面接上一堆方括号组成
        /**
         * 本规则会有如下二义性:
         * 1. (a:int)=>int [] 可以解释为 ((a:int)=>int)[]或者(a:int)=>(int[])
         * 2. (a:int)=>int [][] 可以解释为 ((a:int)=>int[])[]或者(a:int)=>(int[][])
         * 以上两种情况，遇到方括号[]时通通选择移入，即采取二义性的后面一种解释
         * 使以下四条产生式的优先级低于'['即可解决冲突,因为冲突的原因都是因为follow(function_type)集合包含了符号'['
         * type:basic_type
         * type:function_type
         * array_type:basic_type array_type_list
         * array_type:function_type array_type_list
         */
        { "array_type:function_type array_type_list": { priority: "low_priority_for_function_type" } },//array_type由function_type后面接上一堆方括号组成
        { "array_type_list:[ ]": {} },//array_type_list可以是一对方括号
        { "array_type_list:array_type_list [ ]": {} },//array_type_list可以是array_type_list后面再接一对方括号
        { "parameter_declare:parameter_list": {} },//parameter_declare可以由parameter_list组成
        { "parameter_declare:empty": {} },//parameter_declare可以为空
        { "parameter_list:id : type": {} },//parameter_list可以是一个 id : type
        { "parameter_list:parameter_list , id : type": {} },//parameter_list可以是一个parameter_list接上 , id : type
        { "class_units:class_units class_unit": {} },//class_units可以由多个class_unit组成
        { "class_units:empty": {} },//class_units可以为空
        { "class_unit:object": {} },//测试用产生式
        { "statements:statements statement": {} },//statements可以由多个statement组成
        { "statements:empty": {} },//statements可以为空
        { "statement:object": {} },//测试用产生式
        { "object:( object )": {} },
        { "object:id": {} },
        { "empty:": {} },//空白非终结符
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