class Type {
    public fields: Map<string, Type> = new Map();//属性列表
    public name: string;
    constructor(name: string) {
        this.name = name;
    }
    //也可以用作签名
    public toString(){
        let ret=`${this.name}`;
        return ret;
    }
}
class ArrayType extends Type {
    public innerType: Type;//数组的基本类型
    constructor(inner_type: Type) {
        super(`Array<${inner_type.name}>`);
        this.innerType = inner_type;
    }
}
class FunctionType extends Type {
    public parameters: Map<string, Type> = new Map();//参数名和类型列表,反射的时候可以直接得到参数的名字
    public returnType: Type;//返回值类型
    constructor(ret_type: Type) {
        super(`function`);
        this.returnType = ret_type;
    }
    public registerParameter(name: string, type: Type) {
        if (this.parameters.has(name)) {
            throw new SemanticException(`变量`);
        }
        this.parameters.set(name, type);
    }
    public toString(){
        let parametersSign:string;//参数签名
        if(this.parameters.size!=0){
            parametersSign=`${[...this.parameters.values()].map((value)=>`${value}`).reduce((previous,current)=>`${previous},${current}`)}`;
        }else{
            parametersSign='';
        }
        let ret=`${this.name}(${parametersSign})`;
        return ret;
    }
}
type Location = "constant" | "program" | "class" | "function";//值存放的位置，分别为立即数、全局空间、class空间、函数空间
class Address {
    public localtion: Location;
    public value: Number;
    public type: Type;
    constructor(loc: Location, val: Number, type: Type) {
        this.localtion = loc;
        this.value = val;
        this.type = type;
    }
}
abstract class Scope {
    public Fields: Map<string, Address> = new Map();
    private allocatedAddress: number = 0;
    abstract register(name: string, type: Type): void;
    protected register_k(name: string, type: Type, loc: Location) {
        if (this.Fields.has(name)) {
            throw new SemanticException(`变量${name}重复声明`);
        }
        this.Fields.set(name, new Address(loc, -1, type));
    }
}
class ProgramScope extends Scope {
    public types: Map<string, Type> = new Map();//类型，用户自定义了class，则新增一个类型
    public registerType(name: string, type: Type) {
        if (this.types.has(name)) {
            throw new SemanticException(`类型${name}重复声明`);
        }
        this.types.set(name, type);
    }
    public register(name: string, type: Type) {
        super.register_k(name, type, "program")
    }
}
class ClassScope extends Scope {
    public descriptor: Type;//本class的描述符
    public parentScope: ProgramScope;
    constructor(parent: ProgramScope, descriptor: Type) {
        super();
        this.parentScope = parent;
        this.descriptor = descriptor;
    }
    public register(name: string, type: Type) {
        super.register_k(name, type, "class")
    }
}
class FunctionScope extends Scope {
    public descriptor: FunctionType;//本函数的描述符
    public parentScope: ProgramScope | ClassScope | FunctionScope;
    public BlockFields: Map<string, Address> = new Map();//用于给block声明变量
    constructor(parent: ProgramScope | ClassScope | FunctionScope, descriptor: FunctionType) {
        super();
        this.parentScope = parent;
        this.descriptor = descriptor;
    }
    public register(name: string, type: Type) {
        super.register_k(name, type, "function")
    }
    public register_tmp(name: string, type: Type) {
        throw new SemanticException(`register_tmp还未实现`);
    }
}
class SemanticException extends Error {
    constructor(msg: string) {
        super(msg);
    }
}
let baseType = new Set(['int', 'double', 'void', 'boolean']);//默认的基础类型
export { Type, FunctionType, ArrayType, Address, ProgramScope, ClassScope, FunctionScope, Scope, SemanticException, baseType };