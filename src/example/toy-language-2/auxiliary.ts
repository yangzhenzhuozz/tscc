class Type {
    public fields: Map<string, Type> = new Map();//属性列表
    public modifier:"valuetype"|"referentialType"="referentialType";//默认是引用类型
    public name: string;
    constructor(name: string) {
        this.name = name;
    }
    //也可以用作签名
    public toString() {
        let ret = `${this.name}`;
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
    public toString() {
        let parametersSign: string;//参数签名
        if (this.parameters.size != 0) {
            parametersSign = `${[...this.parameters.values()].map((value) => `${value}`).reduce((previous, current) => `${previous},${current}`)}`;
        } else {
            parametersSign = '';
        }
        let ret = `${this.name}(${parametersSign})`;
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
    abstract getVariable(name: string): Address;
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
    public getVariable(name: string): Address {
        let ret = this.Fields.get(name);
        if (ret == undefined) {
            throw new SemanticException(`未定义的变量:${name}`);
        }
        return ret;
    }
}
class ClassScope extends Scope {
    public descriptor: Type;//本class的描述符
    public programScope: ProgramScope;
    constructor(programScope: ProgramScope, descriptor: Type) {
        super();
        this.programScope = programScope;
        this.descriptor = descriptor;
    }
    public register(name: string, type: Type) {
        super.register_k(name, type, "class")
    }
    public getVariable(name: string): Address {
        let ret = this.Fields.get(name);
        if (ret == undefined) {//如果在class空间搜索不到，则去program空间搜索
            return this.programScope.getVariable(name);
        }
        return ret;
    }
}
class FunctionScope extends Scope {
    public descriptor: FunctionType;//本函数的描述符
    public programScope: ProgramScope;
    public classScope: ClassScope | undefined;
    public parentFunctionScope: FunctionScope | undefined;//父函数空间
    public BlockFields: Map<string, Address> = new Map();//用于给block声明变量
    public rootFunctionScope: FunctionScope;//最外层的函数空间，用于生成闭包类
    constructor(programScope: ProgramScope, classScope: ClassScope | undefined, parentFunctionScope: FunctionScope | undefined, descriptor: FunctionType) {
        super();
        this.programScope = programScope;
        this.classScope = classScope;
        this.parentFunctionScope = parentFunctionScope;
        this.descriptor = descriptor;
        if (parentFunctionScope == undefined) {
            this.rootFunctionScope = this;//如果外层不是函数空间，则说明本层就是最先出现的一个函数空间
        } else {
            this.rootFunctionScope = parentFunctionScope.rootFunctionScope;//否则记录最外层的函数空间
        }
    }
    public register(name: string, type: Type) {
        super.register_k(name, type, "function")
    }
    public register_tmp(name: string, type: Type) {
        throw new SemanticException(`register_tmp还未实现`);
    }
    public closureCheck(name:string){
        //只在父函数空间搜索变量
        //先在本空间搜索，如果搜索不到则向上一层函数空间搜索,如果搜索到了则标记为闭包变量,在program注册该变量，并且把对应的父函数空间所有对这个变量的引用指向Program空间
        throw new Error("Method not implemented.");
    }
    public getVariable(name: string): Address {
        throw new Error("Method not implemented.");
        //先在本空间搜索
        //然后在class空间搜索
        //在program空间搜索
        // let ret = this.Fields.get(name);
        // if (ret == undefined) {
        //     throw new SemanticException(`未定义的变量:${name}`);
        // }
        // return ret;
    }
}
class SemanticException extends Error {
    constructor(msg: string) {
        super(msg);
    }
}
let baseType = new Set(['int', 'double', 'void', 'boolean']);//默认的基础类型
export { Type, FunctionType, ArrayType, Address, ProgramScope, ClassScope, FunctionScope, Scope, SemanticException, baseType };