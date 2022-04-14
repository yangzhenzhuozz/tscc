/*
https://262.ecma-international.org/11.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
根据ES2015的标准，key也是有序的，不用数字做key即可
可以作为数组索引的 key 按照升序排列，例如 1、2、3。
是字符串不是 symbol 的 key，按照创建顺序排列。
symbol 类的 key 按照创建顺序排列。
Reflect.ownKeys({
  [Symbol('07akioni')]: '',
  18: '',
  star: '',
  4: '',
  kirby: '',
})
// ['4', '18', 'star', 'kirby', Symbol(07akioni)]
*/
//定义的类型
interface TypeDef {
    isNormalClass: boolean,
    templates?: string[];//模板列表
    operatorOverload?: {
        [key: string]: FunctionType
    };
    property: { [key: string]: Variable };
}
interface FunctionType {
    arument: { [key: string]: Variable };
    body: ASTNode[];
}
interface ArrayType {
    innerType: TypeDef | FunctionType | ArrayType;
}
interface Bulit_In_Class {
    [key: string]: TypeDef
}
interface Program {
    bulit_in_class: Bulit_In_Class;
    property: { [key: string]: Variable };
}
interface Variable {
    type?: string;//需要类型推导的变量可以先不设置Type
    initAST?: ASTNode;//当type为undefined的时候,initAST必须存在,否则无法确定类型
    templateSpecialization?: string[];//模板特化
}
//一条语句就是一个Noe
interface ASTNode {
    op: 'def' | 'load' | '+';
    leftChild: ASTNode | undefined;
    rightChild: ASTNode | undefined;
}
//scope留到解析语法树的时候做,好像思路越来越清晰了
//把test.y的手工生成一遍
let program: Program = {
    bulit_in_class: {
        int: {
            isNormalClass: true,
            property: {}
        },
        double: {
            isNormalClass: true,
            property: {}
        },
        test: {
            isNormalClass: true,
            property: { a: { type: "int" } },
            operatorOverload: {
                "+": {
                    arument: { a: { type: "int" }, b: { type: "int " } },
                    body: []
                }
            }
        }
    },
    property: {
        c: {
            type: "map",
            templateSpecialization: ["int", "int"]
        }
    }
};