import  fs  from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
let grammar: Grammar = {
    tokens: ["+", ",", "-", "*", "/", "=", "==", "||", "&&", ">", "<", ">=", "<=", "{", "}", "(", ")", ":", ";", ".", "func", "id", "var", "val", "type", "class", "struct", "if", "else", "do", "while", "for", "const_val"],
    association: [
        { "right": ["="] },
        { "left": ["=="] },
        { "left": ["||"] },
        { "left": ["&&"] },
        { "nonassoc": [">", "<", ">=", "<="] },//不允许这几个符号的连续出现
        { "left": ["+", "-"] },
        { "left": ["*", "/"] },
        { "nonassoc": ["uminus"] }//一元减法,取反
    ],
    BNF: [
        { "program:units": {} },
        { "units:units unit": {} },
        { "units:": {} },
        { "unit:function": {} },
        { "unit:_class": {} },
        { "function:func id ( args ) type_declare block": {} },//带返回值声明的函数定义
        { "args:arg_list": {} },//带参数
        { "args:": {} },//不带参数
        { "arg_list:arg_list , argument": {} },
        { "arg_list:argument": {} },
        { "argument: object": {} },
        { "block:{ code_units }": {} },
        { "code_units:code_units code_unit": {} },
        { "code_units:": {} },//代码单元
        { "code_unit:declare": {} },
        { "code_unit:statement": {} },
        { "declare:value": {} },
        { "declare:variable": {} },
        //val类型必须带initiator
        { "value:val id type_declare initiator ;": {} },
        { "value:val id initiator ;": {} },
        //var类型就可以略微自由一点
        { "variable:var id type_declare initiator ;": {} },
        { "variable:var id type_declare ;": {} },
        { "variable:var id initiator ;": {} },
        { "initiator:= object": {} },
        { "type_declare: : type ": {} },//普通类型
        { "type_declare: : func ( parameter_types ) ": {} },//函数类型
        { "parameter_types:parameter_type_list": {} },
        { "parameter_types:": {} },
        { "parameter_type_list:parameter_type_list , type": {} },//函数声明
        { "parameter_type_list:type": {} },
        { "_class:class id { class_units }": {} },
        { "_class:struct id { class_units }": {} },
        { "class_units:class_units class_unit": {} },
        { "class_units:": {} },
        { "class_unit:declare": {} },
        { "class_unit:function": {} },
        { "statement: object ;": {} },//单独一个对象也是一条语句
        { "statement: if ( object ) statement ;": {} },
        { "statement: if ( object ) statement else statement ;": {} },
        { "statement: while ( object ) statement ;": {} },
        { "statement: do statement while ( object ) ;": {} },
        { "statement: for ( object ; object ; object )": {} },
        { "statement: for ( declare ; object ; object )": {} },
        { "object: object + object": {} },
        { "object: object - object": {} },
        { "object: object * object": {} },
        { "object: object / object": {} },
        { "object: object == object": {} },
        { "object: object || object": {} },
        { "object: object && object": {} },
        { "object: object > object": {} },
        { "object: object < object": {} },
        { "object: object >= object": {} },
        { "object: object <= object": {} },
        { "object: ( object )": {} },
        { "object: - object": { priority: "uminus" } },//一元减法
        { "object: object = object": {} },//允许连续赋值
        { "object: const_val": {} },
        { "object: id": {} }
    ]
};

let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();//构造编译器代码
if (str != null) {//如果构造成功,往代码中添加调用代码
    console.log(`成功`);
    fs.writeFileSync('./src/example/toy-language/parser.ts',str);
} else {
    console.log(`失败`);
}
