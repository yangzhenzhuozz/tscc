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
    property: { [key: string]: VariableDescriptor };
}
interface FunctionType {
    arument: { [key: string]: VariableDescriptor };
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
    property: { [key: string]: VariableDescriptor };
}
interface VariableDescriptor {
    type?: string;//需要类型推导的变量可以先不设置Type
    initAST?: ASTNode;//当type为undefined的时候,initAST必须存在,否则无法确定类型
    templateSpecialization?: string[];//模板特化
}
interface Value {
    value: unknown;//不允许为undefined
}
//一条语句就是一个Noe
interface ASTNode {
    op: 'def' | 'load' | '+';
    leftChild: ASTNode | undefined;
    rightChild: ASTNode | undefined;
}
//仔细考虑一下Value和Node的设计，对于def和load怎么才优雅
//scope留到解析语法树的时候做
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