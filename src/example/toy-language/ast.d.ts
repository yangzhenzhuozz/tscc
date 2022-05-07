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
    modifier?: 'valuetype' | 'sealed';
    templates?: string[];//模板列表
    operatorOverload?: {//重载列表
        [key: string]: FunctionType
    };
    extends?: TypeUsed;//基类
    property: VariableDescriptor;//属性列表
    constructor?:FunctionType[];
}
//变量描述符，包含变量的名字、类型以及初始化使用的语法树
type VariableDescriptor = { [key: string]: VariableProperties };
//变量属性
interface VariableProperties {
    variable: 'var' | 'val' | 'g-set';
    type?: TypeUsed;//需要类型推导的变量可以先不设置Type
    initAST?: ASTNode;//当type为undefined的时候,initAST必须存在,否则无法确定类型
    getter?: FunctionType;//getter
    setter?: FunctionType;//setter
}
interface TypeUsed {
    SimpleType?: SimpleType;
    FunctionType?: FunctionType;
    ArrayType?: ArrayType;
}
interface SimpleType {
    name: string;//使用的类型
    templateSpecialization?: TypeUsed[];//实例化模板的类型
}
interface ArrayType {
    innerType?: TypeUsed;
}
interface FunctionType {
    argument: VariableDescriptor;
    body: block;//函数体
    retType?: TypeUsed;//返回类型，可选，如果为undefined则需要进行类型推导
    templates?: string[];//模板列表
}
type block = (ASTNode | block)[];
interface Program {
    definedType: {//已经定义了的类型
        [key: string]: TypeDef
    };
    property: VariableDescriptor;
}
//一条语句就是一个Noe
interface ASTNode {
    def?: VariableDescriptor;
    load?: string;
    "+"?: { rightChild: ASTNode; leftChild: ASTNode; };
    immediate?: immediateNode;
}
interface immediateNode {
    //immediate只可以是数字、字符串、函数,对应了 1、"string"、()=>{console.log("aaa")}这几种情况
    numberVal?: number;
    stringVal?: string;
    functionVal?: FunctionType;
}
//把ast设计得优雅一点，后续设计更方便
//scope留到解析语法树的时候做