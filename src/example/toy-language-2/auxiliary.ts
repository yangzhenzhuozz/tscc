class Type {
    public fields: Map<string, Type> = new Map();//属性列表
}
class ArrayType extends Type {
    public innerType: Type;//数组的基本类型
    constructor(inner_type: Type) {
        super();
        this.innerType = inner_type;
    }
}
class FunctionType extends Type {
    public parameters: Map<string, Type>;//参数名字和类型列表
    public returnType: Type;//返回值类型
    constructor(ret_type: Type) {
        super();
        this.parameters = new Map();
        this.returnType = ret_type;
    }
}
type location = "constant" | "program" | "class" | "function";//值存放的位置，分别为立即数、全局空间、class空间、函数空间
class Address {
    public localtion:location;
    public value:Number;
    public type:Type;
    constructor(loc: location, val: Number, type: Type) {
        this.localtion=loc;
        this.value=val;
        this.type=type;
    }
}
abstract class Scope {
    constructor() {

    }
}
class ProgramScope extends Scope {

}
export { Type, FunctionType, ArrayType, Address, Scope, ProgramScope };