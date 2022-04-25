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
    templates?: string[];//模板列表
    operatorOverload?: {//重载列表
        [key: string]: FunctionType
    };
    property: VariableDescriptor;//属性列表
}
interface TypeUse {
    SimpleType?: SimpleType;
    FunctionType?: FunctionType;
    ArrayType?: ArrayType;
}
interface SimpleType {
    name: string;//使用的类型
    templateSpecialization?: TypeUse[];//实例化模板的类型
}
interface FunctionType {
    argument: VariableDescriptor;
    body?: block;//可以为空,也可以嵌套
}
type block = (ASTNode | block)[];//这个类型推导有点叼,真正的type gymnastics
interface ArrayType {
    innerType?: TypeUse;
}
interface Program {
    bulit_in_class: {
        [key: string]: TypeDef
    };
    property: VariableDescriptor;
}
//变量的描述属性
interface VariableProperties {
    type?: TypeUse;//需要类型推导的变量可以先不设置Type
    initAST?: ASTNode;//当type为undefined的时候,initAST必须存在,否则无法确定类型
}
//一条语句就是一个Noe
interface ASTNode {
    def?: VariableDescriptor;
    load?: string;
    "+"?: { rightChild: ASTNode; leftChild: ASTNode; };
    immediate?: immediateNode;
}
//定义变量的节点
interface VariableDescriptor {
    [key: string]: VariableProperties
}
interface immediateNode {
    value: unknown;
    type: TypeUse;
}
//把ast设计得优雅一点，后续设计更方便
//scope留到解析语法树的时候做