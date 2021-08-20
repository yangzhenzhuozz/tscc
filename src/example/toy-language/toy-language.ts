import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
let grammar: Grammar = {
    tokens: ['import', 'as', 'integrate_type', 'val', 'var', 'id', ':', ';', '.', ',', 'class', 'function', '!', '{', '}', '(', ')', 'if', 'else', 'while', 'do', 'for', '=', '[', ']', 'new', 'const_val', 'break', 'continue', 'get', 'set', 'return', 'extend', 'switch', 'case', 'default', 'operator','?'],
    association: [
        { "nonassoc": ['low_priority'] },//低优先级的一个临时符号
        { "right": ['else'] },
        { "right": ["="] },
        { "left": ["=="] },
        { "left": ["||"] },
        { "left": ["&&"] },
        { "nonassoc": [">", "<", ">=", "<="] },
        { "left": ["+", "-"] },
        { "left": ["*", "/"] },
        { "nonassoc": ["uminus"] },//一元减法,取反
        { "left": ["!"] },
        { "right": ['['] },//取下标
        { "right": ['.'] },//.运算符有很高的优先级,a+c.d可以解释成 a + (c.d)或者(a+c).d 出现二义性，所以需要定义优先级
    ],
    BNF: [
        { "program:import_or_emptys units": {} },//units.space=root
        { "import_or_emptys:": {} },
        { "import_or_emptys:imports": {} },
        { "imports:imports import_line": {} },
        { "imports:import_line": {} },
        { "import_line:import path as id ;": {} },
        { "path:id": {} },
        { "path:path . id": {} },
        { "units:units unit": {} },//$1.space=$.space,$2.space=$.space
        { "units:": {} },//最外层的代码单元分别为声明和代码
        { "unit:declare ;": {} },//变量声明,unit.delcare.add(declare),declare.spacce=unit.space
        { "unit:class_def": {} },//class
        { "unit:function_def": {} },//function
        { "unit:operator_overload": {} },//操作符重载
        { "unit:statement": {} },//语句
        { "declare:val id : type = object ": {} },//declare为var和val
        { "declare:val id = object ": {} },
        { "declare:var id : type = object": {} },//var类型相比val多了一个不赋值的定义
        { "declare:var id : type": {} },
        { "declare:var id = object": {} },
        { "declare:val id : type { getter }": {} },
        { "declare:var id : type { getter setter }": {} },
        { "getter:get block": {} },
        { "setter:set block": {} },
        { "class_def: class id extend_or_empty { units }": {} },
        { "class_def: class val id extend_or_empty { units }": {} },//值类型的class
        { "extend_or_empty:": {} },
        { "extend_or_empty:extend : integrateTypes": {} },
        { "integrateTypes:integrate_type , integrateTypes": {} },
        { "integrateTypes:integrate_type": {} },
        { "function_def:function id ( parameters_or_empty ) : type block": {} },//语法糖,与函数对象定义功能一致
        { "parameters_or_empty:": {} },
        { "parameters_or_empty:parameters": {} },
        { "parameters:parameters , id : type": {} },
        { "parameters:id : type": {} },
        { "block:{ units }": {} },
        { "statement:object ;": {} },
        { "statement:if ( object ) statement": { priority: "low_priority" } },//让if语句优先级低于if-else
        { "statement:if ( object ) statement else statement": {} },
        { "statement:loop_flag while ( object ) statement": {} },
        { "statement:loop_flag do statement while ( object ) ;": {} },
        { "statement:loop_flag for ( for_initiate ; for_condition ; for_step  ) statement": {} },
        { "loop_flag:": {} },
        { "loop_flag:id :": {} },
        { "statement:break ;": {} },
        { "statement:break id ;": {} },
        { "statement:continue ;": {} },
        { "statement:continue id ;": {} },
        { "statement:return ;": {} },
        { "statement:return object ;": {} },
        { "statement:block": {} },
        { "statement:switch_case": {} },
        { "for_initiate:": {} },
        { "for_initiate:declare": {} },
        { "for_initiate:assignment": {} },
        { "for_condition:": {} },
        { "for_condition:object": {} },
        { "for_step:": {} },
        { "for_step:object": {} },
        { "switch_case:switch ( object ) { switch_bodys_or_empty }": {} },
        { "switch_bodys_or_empty:": {} },
        { "switch_bodys_or_empty:switch_bodys": {} },
        { "switch_bodys:switch_bodys switch_body": {} },
        { "switch_bodys:switch_body": {} },
        { "switch_body:case object : statement": {} },
        { "switch_body:default : statement": {} },
        { "assignment:object = object": {} },//赋值语句
        { "assignment:object = array_init": {} },//赋值语句
        { "object:id": {} },//一切皆对象,没有表达式这个概念了,所有操作得到的都是一个对象
        { "object:object . id": {} },//取成员
        { "object:object . id ( arguments_or_empty )": {} },//调用成员函数
        { "object:const_val": {} },
        { "object:function ( parameters_or_empty ) : type block": {} },//定义一个函数对象
        { "object:new type ( )": {} },//调用构造函数
        { "object:type ( )": {} },//值类型不需要用new就可以调用构造函数
        { "object:id ( arguments_or_empty )": {} },//函数调用
        { "object:( object )": {} },
        { "object:assignment": {} },
        { "object:object + object": {} },
        { "object:object - object": {} },
        { "object:object * object": {} },
        { "object:object / object": {} },
        { "object:object < object": {} },
        { "object:object <= object": {} },
        { "object:object > object": {} },
        { "object:object >= object": {} },
        { "object:object || object": {} },
        { "object:object && object": {} },
        { "object:! object": {} },
        { "object:object [ id ]": {} },
        { "arguments_or_empty:": {} },
        { "arguments_or_empty:arguments": {} },
        { "arguments:arguments , object": {} },
        { "arguments:object": {} },
        { "type:integrate_type": {priority:'low_priority'} },//由词法分析器提供的类型
        { "type:integrate_type ?": {} },//由词法分析器提供的类型，变为引用
        { "type:function_type": {priority:'low_priority'} },//函数类型
        { "type:array_type": {} },//数组类型
        { "type:( type )": {} },
        { "function_type:function ( parameters_or_empty ) : type": {} },//函数类型
        { "array_type:integrate_type array_define_list": {priority:'low_priority'} },//基础类型数组
        { "array_type:function_type array_define_list": {priority:'low_priority'} },//函数数组,因为函数数组会出现二义性:function():int[]  [][],后面的两个括号到底是和int关联还是和函数类型关联，所以函数数组定义时需要加括号
        { "array_define_list:array_define_list [ ]": {} },//数组方括号列表
        { "array_define_list:[ ]": {} },
        { "array_init:integrate_type array_argument array_define_list": {priority:'low_priority'} },//创建数组
        { "array_argument:[ object ]": {} },
        { "array_argument:array_argument [ object ]": {} },
        { "operator_overload:operator + ( id : type ) : type block": {} },//操作符重载+
        { "operator_overload:operator - ( id : type ) : type block": {} },//操作符重载-
        { "operator_overload:operator * ( id : type ) : type block": {} },//操作符重载*
        { "operator_overload:operator / ( id : type ) : type block": {} },//操作符重载/
        { "operator_overload:operator < ( id : type ) : type block": {} },//操作符重载<
        { "operator_overload:operator > ( id : type ) : type block": {} },//操作符重载>
        { "operator_overload:operator <= ( id : type ) : type block": {} },//操作符重载<=
        { "operator_overload:operator >= ( id : type ) : type block": {} },//操作符重载>=
        { "operator_overload:operator || ( id : type ) : type block": {} },//操作符重载||
        { "operator_overload:operator && ( id : type ) : type block": {} },//操作符重载&&
        { "operator_overload:operator ! ( ) : type block": {} },//操作符重载!
        { "operator_overload:operator [ ] ( id : type ) : type block": {} },//操作符重载[]
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
