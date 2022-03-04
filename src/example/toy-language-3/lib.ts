class Type {
    private fields: Map<string, Address> = new Map();//属性列表
    private operatorOverload: Map<string, Function> = new Map();//操作符重载列表
    private modifier: "valuetype" | "sealed" | "referentialType";
    private parentType: Type | undefined;//父对象,为undefined表示这是object
    public name: string;
    constructor(name: string, modifier: "valuetype" | "sealed" | "referentialType") {
        this.name = name;
        this.modifier = modifier;
    }
    public setParent(parentType: Type) {
        this.parentType = parentType;
    }
    public registerField(name: string, address: Address) {
        if (this.fields.has(name)) {
            throw new SemanticException(`属性:${name}重复定义`);
        }
        this.fields.set(name, address);
    }
    public registerOperatorOverload(name: string, fun: Function) {
        if (this.operatorOverload.has(name)) {
            throw new SemanticException(`重载符号:${name}重复定义`);
        }
        this.operatorOverload.set(name, fun);
    }
    //检查循环继承
    private checkRecursiveExtend() {
        let extendList = new Set<string>();
        extendList.add(this.name);
        for (let node: Type | undefined = this.parentType; node != undefined; node = node.parentType) {
            if (extendList.has(node.name)) {
                throw new SemanticException(`类型${node}出现了循环继承`);
            }
            extendList.add(node.name)
        }
    }
    //检查值类型循环包含
    private checkRecursiveValue(valueTypes: Set<string>) {
        if (valueTypes.has(this.name)) {
            throw new SemanticException(`值类型${this.name}出现了循环布局`);
        }
        valueTypes.add(this.name);
        for (let [n, f] of this.fields) {
            if (f.type.modifier == "valuetype") {
                f.type.checkRecursiveValue(new Set(valueTypes));
            }
        }
    }
    public checkRecursive() {
        this.checkRecursiveExtend();
        this.checkRecursiveValue(new Set());
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
        super(`Array<${inner_type.name}>`, "referentialType");
        this.innerType = inner_type;
    }
}
class FunctionType extends Type {
    public parameters: Map<string, Type> = new Map();//参数名和类型列表,反射的时候可以直接得到参数的名字
    public returnType: Type;//返回值类型
    constructor(ret_type: Type) {
        super(`function`, "referentialType");
        this.returnType = ret_type;
    }
    public registerParameter(name: string, type: Type) {
        if (this.parameters.has(name)) {
            throw new SemanticException(`变量重复定义:${name}`);
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
class Address {
    public location: "immediate" | "program" | "class" | "stack" | "text";//值存放的位置，分别为立即数、全局空间、class空间、函数空间、代码段
    public type: Type;
    public value: number;//地址
    constructor(loc: "immediate" | "program" | "class" | "stack" | "text", type: Type, value: number) {
        this.location = loc;
        this.type = type;
        this.value = value;
    }
}
class SemanticException extends Error {
    constructor(msg: string) {
        super(msg);
    }
}
class ProgramScope {
    private registeredType: Map<string, Type>;
    constructor() {
        this.registeredType = new Map();
        this.registeredType.set('int', new Type('int', 'valuetype'));
        this.registeredType.set('bool', new Type('bool', 'valuetype'));
    }
    public getRegisteredType(name: string): Type {
        if (this.registeredType.has(name)) {
            return this.registeredType.get(name)!;
        } else {
            throw new SemanticException(`未知类型:${name}`);
        }
    }
}
class ClassScope {
    public programScope: ProgramScope;
    private Field: Map<string, Address> = new Map();
    private allocatedAddress = 0;
    constructor(programScope: ProgramScope) {
        this.programScope = programScope;
    }
    public registerField(name: string, type: Type) {
        if (this.Field.has(name)) {
            throw new SemanticException(`重复定义Filed:${name}`);
        } else {
            this.Field.set(name, new Address("class", type, this.allocatedAddress++));
        }
    }
}
class FunctionScope {
    public programScope: ProgramScope;
    constructor(programScope: ProgramScope) {
        this.programScope = programScope;
    }
}
class BlockScope {
    public parentScope: ProgramScope | FunctionScope;
    constructor(parentScope: ProgramScope | FunctionScope) {
        this.parentScope = parentScope;
    }
}
export { Type, ArrayType, FunctionType, Address, ProgramScope, ClassScope, FunctionScope, BlockScope, SemanticException }