class Type {
    public fields: Map<string, Address> = new Map();//属性列表
    public modifier: "valuetype" | "sealed" | "referentialType" | undefined;
    public name: string;
    constructor(name: string, modifier: "valuetype" | "sealed" | "referentialType" | undefined) {
        this.name = name;
        this.modifier = modifier;
    }
    public registerField(name: string, address: Address) {
        if (this.fields.has(name)) {
            throw new SemanticException(`属性:${name}重复定义`);
        }
        this.fields.set(name, address);
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
        super(`Array<${inner_type.name}>`, undefined);
        this.innerType = inner_type;
    }
}
class FunctionType extends Type {
    public parameters: Map<string, Type> = new Map();//参数名和类型列表,反射的时候可以直接得到参数的名字
    public returnType: Type;//返回值类型
    constructor(ret_type: Type) {
        super(`function`, undefined);
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
type Location = "constant" | "program" | "class" | "function";//值存放的位置，分别为立即数、全局空间、class空间、函数空间
class Address {
    public localtion: Location;
    public value: Number;
    public type: Type;
    public isClosure: boolean = false;//是否为闭包变量,默认为否
    constructor(loc: Location, val: Number, type: Type) {
        this.localtion = loc;
        this.value = val;
        this.type = type;
    }
}
abstract class Scope {
    public Fields: Map<string, Address> = new Map();
    private allocatedAddress: number = 0;
    abstract register(name: string, type: Type): Address;
    protected register_k(name: string, type: Type, loc: Location) {
        if (this.Fields.has(name)) {
            throw new SemanticException(`变量${name}重复声明`);
        }
        let add = new Address(loc, this.allocatedAddress++, type);
        this.Fields.set(name, add);
        return add;
    }
    abstract getVariable(name: string): Address;
}
class ProgramScope extends Scope {
    private automaticName = 0;//用于自动取名
    public registeredTypes: Map<string, Type> = new Map();//已经注册了的类型
    public FunctionScopeIndex: FunctionScope[] = [];//函数空间，因为函数是没有名字的，所以只能使用index作为索引
    constructor() {
        super();
        this.registeredTypes.set("int", new Type("int", "valuetype"));
        this.registeredTypes.set("double", new Type("double", "valuetype"));
        this.registeredTypes.set("void", new Type("void", "valuetype"));
        this.registeredTypes.set("boolean", new Type("boolean", "valuetype"));
    }
    public getClosureClassNameAutomatic(): string {
        return `closure_class_${this.automaticName++}`;
    }
    public registerType(name: string, type: Type) {
        if (this.registeredTypes.has(name)) {
            throw new SemanticException(`类型${name}重复声明`);
        }
        this.registeredTypes.set(name, type);
    }
    public register(name: string, type: Type) {
        return super.register_k(name, type, "program");
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
    public programScope: ProgramScope;
    constructor(programScope: ProgramScope) {
        super();
        this.programScope = programScope;
    }
    public register(name: string, type: Type) {
        return super.register_k(name, type, "class");
    }
    public getVariable(name: string): Address {
        let ret = this.Fields.get(name);
        if (ret == undefined) {//如果在class空间搜索不到，则去program空间搜索
            return this.programScope.getVariable(name);
        }
        return ret;
    }
}
class ClosureScope extends Scope {
    private automaticName = 0;//用于自动取名
    register(name: string, type: Type): Address {//注册闭包变量
        let ret = super.register_k(`closure_${this.automaticName}_${name}`, type, "class");
        ret.isClosure = true;
        return ret
    }
    getVariable(name: string): Address {
        throw new Error("Method not implemented.");
    }

}
class FunctionScope extends Scope {
    public descriptor: FunctionType;//本函数的描述符
    public programScope: ProgramScope;
    public classScope: ClassScope | undefined;
    public parent: FunctionScope | BlockScope | undefined;//父空间
    public closureScope: ClosureScope | undefined;//闭包空间，只有最外层的函数才有，即program或者class内部的第一层function
    public closureClass: string = '';//闭包类的类名
    public topFunctionScope: FunctionScope;//顶层函数空间
    constructor(programScope: ProgramScope, classScope: ClassScope | undefined, parent: FunctionScope | BlockScope | undefined, descriptor: FunctionType) {
        super();
        this.programScope = programScope;
        this.classScope = classScope;
        this.parent = parent;
        this.descriptor = descriptor;
        if (parent == undefined) {//如果没有传入父空间，则说明当前函数为顶层
            this.topFunctionScope = this;
        } else {
            this.topFunctionScope = parent.topFunctionScope;
        }
        this.programScope.FunctionScopeIndex.push(this);
    }
    public register(name: string, type: Type) {
        return super.register_k(name, type, "function");
    }
    public closureCheck(name: string) {
        let node: FunctionScope | BlockScope | undefined = this;
        let add: Address | undefined;
        let TopFunctionScope: FunctionScope;
        for (; node != undefined; node = node.parent) {
            if (node.Fields.has(name)) {
                add = node.Fields.get(name);
                break;
            }
        }
        if (add != undefined) {
            if (!add.isClosure) {//如果变量还没有被注册为闭包变量,则注册为闭包变量
                if (node instanceof FunctionScope) {
                    if (node != this) {
                        //闭包变量
                        if (node.topFunctionScope.closureScope == undefined) {
                            node.topFunctionScope.closureScope = new ClosureScope();
                        }
                        let tmp = node.topFunctionScope.closureScope.register(`${name}`, add!.type);
                        node.Fields.set(name, tmp);
                    }
                } else if (node instanceof BlockScope) {
                    if (node.parentFunctionScope != this) {
                        //闭包变量
                        if (node.topFunctionScope.closureScope == undefined) {
                            node.topFunctionScope.closureScope = new ClosureScope();
                        }
                        let tmp = node.topFunctionScope.closureScope.register(`${name}`, add!.type);
                        node.Fields.set(name, tmp);
                    }
                }
            }
        }
        else {
            //先在classScope搜索变量
            if (this.classScope != undefined) {
                if (!this.classScope.Fields.has(name)) {
                    throw new SemanticException(`未定义的变量:${name}`);
                }
            } else {//然后在Program搜索变量
                if (!this.programScope.Fields.has(name)) {
                    throw new SemanticException(`未定义的变量:${name}`);
                }
            }
        }
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
class BlockScope extends Scope {
    public topFunctionScope: FunctionScope;//顶层函数空间
    public parentFunctionScope: FunctionScope;//父函数空间,blockScope必定位于函数空间中
    public parent: FunctionScope | BlockScope;//父空间
    constructor(topFunctionScope: FunctionScope, parentFunctionScope: FunctionScope, parent: FunctionScope | BlockScope) {
        super();
        this.parentFunctionScope = parentFunctionScope;
        this.parent = parent;
        this.topFunctionScope = topFunctionScope;
    }
    public register(name: string, type: Type) {
        let node: FunctionScope | BlockScope | undefined = this;
        for (; node != undefined; node = node.parent) {
            if (node.Fields.has(name)) {
                throw new SemanticException(`变量${name}重复声明`);
            }
        }
        let add = new Address("function", -1, type);
        this.Fields.set(name, add);
        return add;
    }
    public getVariable(name: string): Address {
        throw new Error("Method not implemented.");
    }
    public closureCheck(name: string) {
        let node: FunctionScope | BlockScope | undefined = this;
        let add: Address | undefined;
        for (; node != undefined; node = node.parent) {
            if (node.Fields.has(name)) {
                add = node.Fields.get(name);
                break;
            }
        }
        if (add != undefined) {
            if (!add.isClosure) {//如果变量还没有被注册为闭包变量,则注册为闭包变量
                if (node instanceof FunctionScope) {
                    if (node != this.parentFunctionScope) {
                        //闭包变量
                        if (node.topFunctionScope.closureScope == undefined) {
                            node.topFunctionScope.closureScope = new ClosureScope();
                        }
                        let tmp = node.topFunctionScope.closureScope!.register(`${name}`, add!.type);
                        node.Fields.set(name, tmp);
                    }
                } else if (node instanceof BlockScope) {
                    if (node.parentFunctionScope != this.parentFunctionScope) {
                        //闭包变量
                        if (node.topFunctionScope.closureScope == undefined) {
                            node.topFunctionScope.closureScope = new ClosureScope();
                        }
                        let tmp = node.topFunctionScope.closureScope!.register(`${name}`, add!.type);
                        node.Fields.set(name, tmp);
                    }
                }
            }
        } else {
            //先在classScope搜索变量
            if (this.parentFunctionScope.classScope != undefined) {
                if (!this.parentFunctionScope.classScope.Fields.has(name)) {
                    throw new SemanticException(`未定义的变量:${name}`);
                }
            } else {//然后在Program搜索变量
                if (!this.parentFunctionScope.programScope.Fields.has(name)) {
                    throw new SemanticException(`未定义的变量:${name}`);
                }
            }
        }
    }
}
class SemanticException extends Error {
    constructor(msg: string) {
        super(msg);
    }
}
export { Type, FunctionType, ArrayType, Address, ProgramScope, ClassScope, FunctionScope, Scope, SemanticException, BlockScope };