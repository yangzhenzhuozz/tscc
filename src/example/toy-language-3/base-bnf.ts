import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
let grammar: Grammar = {
    tokens: ['var', '...', ';', 'id', 'immediate_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'this', 'return', 'get', 'set', 'sealed', 'try', 'catch', 'basic_type', 'throw'],
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
        { 'nonassoc': ["priority_above_binary_operator"] },
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
    /**
     * 在编写过程中要处理所有的移入-规约冲突和规约-规约冲突
     */
    BNF: [
        { "program:import_stmts program_units": {} },//整个程序由导入语句组和程序单元组构成
        { "import_stmts:empty": {} },//导入语句组可以为空
        { "import_stmts:import_stmts import_stmt": {} },//导入语句组由一条或者多条导入语句组成
        { "import_stmt:import id ;": {} },//导入语句语法
        { "program_units:empty": {} },//程序单元组可以为空
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
         * 本规则会导致如下二义性:
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
        { "class_unit:declare ;": {} },//class_unit可以是一个声明语句
        { "class_unit:operator_overload": {} },//class_unit可以是一个运算符重载
        { "class_unit:get id ( ) : type { statements }": {} },//get
        { "class_unit:set id ( id : type ) { statements }": {} },//set
        { "operator_overload:operator + ( parameter_declare ) : type { statements }": {} },//运算符重载
        { "statements:statements statement": {} },//statements可以由多个statement组成
        { "statements:empty": {} },//statements可以为空
        { "statement:declare ;": {} },//statement可以是一条声明语句
        { "statement:try { statement } catch ( id : type ) { statement }": {} },//try catch语句，允许捕获任意类型的异常
        { "statement:throw object ;": {} },//抛异常语句
        { "statement:return object ;": {} },//带返回值的返回语句
        { "statement:return ;": {} },//不带返回值的语句
        { "statement:if ( object ) statement": { priority: "low_priority_for_if_stmt" } },//if语句
        /**
         * 本规则会导致如下二义性:
         * if(obj)      ---1
         *   if(obj)    ---2
         *      stmt
         *   else
         *      stmt
         * 可以得到如下两种abstract syntax tree
         * if(obj)
         * {
         *      if(obj)
         *      {
         *          stmt
         *      }
         * }
         * else
         * {
         *      stmt
         * }
         * 
         * if(obj)
         * {
         *      if(obj)
         *      {
         *          stmt
         *      }
         *      else
         *      {
         *          stmt
         *      }
         * }
         * 为了和大部分的现有编程语言兼容，采用第二种抽象语法树进行规约
         * 定义两个优先级规则low_priority_for_if_stmt和else,使else的优先级高于low_priority_for_if_stmt,在产生冲突时选择移入
         */
        { "statement:if ( object ) statement else statement": {} },//if else语句
        { "statement:lable_def do statement while ( object ) ;": {} },//do-while语句，其实我是想删除while语句的，我觉得for_loop可以完全替代while,一句话,为了看起来没这么怪
        { "statement:lable_def while ( object ) statement": {} },//while语句
        { "statement:lable_def for ( for_init ; for_condition ; for_step ) statement": {} },//for_loop
        { "statement:block": { action: ($, s) => $[0] } },//代码块
        { "statement:break lable_use ;": {} },//break语句
        { "statement:continue lable_use ;": {} },//continue语句
        { "statement:switch ( object ) { switch_bodys }": {} },//switch语句,因为switch在C/C++等语言中可以用跳转表处理,gcc在处理switch语句时,如果各个case的值连续,也会生成一个jum_table,所以我也考虑过移除switch语句,还是为了让其他语言的使用者感觉没那么怪
        { "statement:object ;": {} },//类似C/C++中的   1; 这种语句,java好像不支持这种写法
        { "lable_def:empty": {} },//lable_def可以为空
        { "lable_def:id :": {} },//label_def为 id : 组成
        { "for_init:empty": {} },//for_loop的init可以为空
        { "for_init:declare": {} },//init可以是一个声明
        { "for_init:object": {} },//也可以是一个对象
        { "for_condition:empty": {} },//condition可以为空
        { "for_condition:object": {} },//condition可以是一个对象(必须是bool对象)
        { "for_step:empty": {} },//step可以为空
        { "for_step:object": {} },//step可以是一个对象
        { "block:{ statements }": {} },//代码块是一对花括号中间包裹着statements
        { "lable_use:empty": {} },//在break和continue中被使用
        { "lable_use:id": {} },//在break和continue中被使用
        { "switch_bodys:empty": {} },//switch_bodys可为空
        { "switch_bodys:switch_bodys switch_body": {} },//switch_bodys可以由多个switch_body组成
        { "switch_body:case immediate_val : statement": {} },//case 语句
        { "switch_body:default : statement": {} },//default语句
        { "object:( object )": {} },//括号括住的object还是一个object
        /**
         * 函数调用二义性见template_instance:一条的说明
         */
        { "object:object template_instance ( arguments )": {} },//函数调用
        /**
         * 一系列的双目运算符
         */
        { "object:object + object": {} },
        { "object:object - object": {} },
        { "object:object * object": {} },
        { "object:object / object": {} },
        { "object:object && object": {} },
        { "object:object || object": {} },
        /**双目运算符结束 */
        { "object:! object": {} },//单目运算符-非
        /**
         * 三目运算符会导致如下文法二义性
         * 情况1:a+b?c:d
         * 1.1 a+(b?c:d)
         * 1.2 (a+b)?c:d
         * 情况2:a?b:c?d:e
         * 2.1 (a?b:c)?d:e
         * 2.2 a?b:(c?d:e)
         * 根据tscc的解析规则，产生object:object ? object : object 的优先级为未定义，因为优先级取决于产生式的最后一个终结符或者强制指定的符号,该产生式的最后一个终结符':'并没有定义优先级
         * 为了解决上述两种冲突,我们将产生式的优先级符号强制指定为?,并且令?的优先级低于双目运算符,结合性为right,则针对上述两种冲突最终解决方案如下:
         * 1.因为?的优先级低于所有双目运算符所对应的产生式,所以情况1会选择1.2这种语法树进行解析
         * 2.因为?为右结合,所以情况2会选择2.2这种语法树进行解析
         */
        { "object:object ? object : object": { priority: "?" } },//三目运算
        { "object:id": {} },
        /**
         * template_instance: 这条产生式会导致如下二义性
         * 当没有产生式 template_instance: ,且输入符号如下格局的时候:
         * obj_1 + obj_2  ( obj_3 )  ,中间的+可以换成 - * / < > || 等等双目运算符
         * 会出现如下二义性:
         * 1、 (obj_1 + obj_2)  ( object_3 ) ,先将obj_1和obj_2进行双目运算，然后再使用双目运算符的结果作为函数对象进行函数调用
         * 2、 obj_1 + ( obj_2  ( object_3 ) ) ,先将obj_2作为一个函数对象调用，然后再将obj_1 和函数调用的结果进行双目运算
         * 因为我们希望采取二义性的第二种解释进行语法分析,所以设置了 ( 优先级高于双目运算符(这些双目运算符是所在产生式的最后一个终结符，直接修改了对应产生式的优先级和结核性)
         * 通过这种设置本来是没问题的，但是现在加上 template_instance: 这条产生式之后，这种输入格局会导致二义性变成如下两种AST
         * 1、 (obj_1 + obj_2) template_instance<空>  ( object_3 ) ,先将obj_1和obj_2进行双目运算，然后再使用双目运算符的结果作为函数对象进行函数调用
         * 2、 obj_1 + ( obj_2 template_instance<空>  ( object_3 ) ) ,先将obj_2作为一个函数对象调用，然后再将obj_1 和函数调用的结果进行双目运算
         * 即二义性出现在如下情况
         * 1、先将 obj_1 + obj_2 规约成object再进行函数调用
         * 2、先使用template_instance<空>规约，然后进行函数调用之后再进行双目操作
         * 这也就是规约-规约冲突的来源
         * 我们当然希望采取第二种，所以让"template_instance:"这条产生式的优先级高于所有的双目运算符对应产生式的优先级即可
         * 
         * 测试如下两种输入是否能正确解析即可，其中'+'可以换成任意双目运算符
         * a+b<int>()
         * a+b()
         */
        { "template_instance:": { priority: "priority_above_binary_operator" } },//模板实例化可以为空
        { "template_instance:< template_instance_list >": {} },//模板实例化可以实例化为一个<template_instance_list>
        { "template_instance_list:type": {} },//template_instance_list可以为一个type
        { "template_instance_list:template_instance_list , type": {} },//template_instance_list可以为多个type
        { "arguments:empty": {} },//实参可以为空
        { "arguments:argument_list": {} },//实参可以是argument_list
        { "argument_list:object": {} },//参数列表可以是一个object
        { "argument_list:argument_list , object": {} },//参数列表可以是多个object
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