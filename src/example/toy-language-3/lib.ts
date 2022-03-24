class Type {
    public fields: Map<string, Address> = new Map();//属性列表
    public operatorOverload: Map<string, Function> = new Map();//操作符重载列表
    public modifier: "valuetype" | "sealed" | "referentialType";
    public parentType: Type | undefined;//父对象,为undefined表示这是object
    public genericParadigm: string[] | undefined;
    public templateInstances: Type[] | undefined;
    public name: string;
    public programScope: ProgramScope | undefined;
    private allocated = 0;//分配的地址位置
    constructor(name: string, modifier: "valuetype" | "sealed" | "referentialType", templateInstances: Type[] | undefined) {
        this.templateInstances = templateInstances;
        this.name = name;
        this.modifier = modifier;
    }
    public setParent(parentType: Type) {
        this.parentType = parentType;
    }
    public registerField(name: string, type: { type: Type | undefined, AST: AbstracSyntaxTree | undefined }, vari: 'var' | 'val') {
        if (this.fields.has(name)) {
            throw new SemanticException(`属性:${name}重复定义`);
        }
        this.fields.set(name, new Address(type, this.allocated++, vari));
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
            let type: Type;;
            if (f.typeRef.type != undefined) {
                type = f.typeRef.type;
            } else {
                type = f.typeRef.AST!.type!;
            }
            if (type.modifier == "valuetype") {
                type.checkRecursiveValue(new Set(valueTypes));
            }
        }
    }
    public checkRecursive() {
        this.checkRecursiveExtend();
        this.checkRecursiveValue(new Set());
    }
    //也可以用作签名
    public toString() {
        let ret = `${this.genericParadigm != undefined ? `<${this.genericParadigm.reduce((p, c) => `${p},${c}`)}>` : ''}${this.name}${this.templateInstances != undefined ? `<${this.templateInstances.map((v) => `${v}`).reduce((p, c) => `${p},${c}`)}>` : ''}`;
        return ret;
    }
}
class ArrayType extends Type {
    public innerType: Type;//数组的基本类型
    constructor(inner_type: Type) {
        super(`$Array<${inner_type.name}>`, "referentialType", undefined);
        this.innerType = inner_type;
    }
}
class FunctionType extends Type {
    public parameters: Map<string, Type> = new Map();//参数名和类型列表,反射的时候可以直接得到参数的名字
    public returnType: Type | undefined;//返回值类型
    constructor(parameters: { name: string, type: Type }[] | undefined, ret_type: Type | undefined, genericParadigm: string[] | undefined) {
        super(`function`, "referentialType", undefined);
        super.genericParadigm = genericParadigm;
        if (parameters != undefined) {
            for (let parameter of parameters) {
                if (this.parameters.has(parameter.name)) {
                    throw new SemanticException(`参数${parameter.name}重复定义`);
                } else {
                    this.parameters.set(parameter.name, parameter.type);
                }
            }
        }
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
        let ret = `${this.genericParadigm != undefined ? `<${this.genericParadigm.reduce((p, c) => `${p},${c}`)}>` : ''}${this.name}(${parametersSign})=>${this.returnType != undefined ? `${this.returnType}` : '待推导返回类型'}`;
        return ret;
    }
}
class Address {
    public variable: 'var' | 'val';
    public typeRef: { type: Type | undefined, AST: AbstracSyntaxTree | undefined };//类型可以是一个Type或者由语法树推导得到的Type
    public value: number;//地址
    constructor(typeRef: { type: Type | undefined, AST: AbstracSyntaxTree | undefined }, value: number, vari: 'var' | 'val') {
        this.typeRef = typeRef;
        this.value = value;
        this.variable = vari;
    }
}
class SemanticException extends Error {
    constructor(msg: string) {
        super(msg);
        super.name = 'SemanticException';
    }
}
class Scope {
    private Field: Map<string, Address> = new Map();
    private allocated = 0;
    public registerField(name: string, type: { type: Type | undefined, AST: AbstracSyntaxTree | undefined }, variable: 'var' | 'val') {
        if (this.Field.has(name)) {
            throw new SemanticException(`变量 ${name} 重复定义`);
        } else {
            this.Field.set(name, new Address(type, this.allocated++, variable));
        }
    }
}

class FunctionScope extends Scope {
    public programWraper: Type;//函数所在的program空间
    public classWraper: Type | undefined;//class空间
    constructor(programWraper: Type, classWraper: Type | undefined, isGenericParadigm: boolean) {
        super();
        this.programWraper = programWraper;
        this.classWraper = classWraper;
    }
    public generateType(): FunctionType {
        throw '构造函数类型'
    }
}
class BlockScope extends Scope {
    public parentFunction: FunctionScope;
    public parent: FunctionScope | BlockScope;//是一个函数或者block
    constructor(parentFunction: FunctionScope, parent: FunctionScope | BlockScope) {
        super();
        this.parentFunction = parentFunction;
        this.parent = parent;
    }
}
class ProgramScope {
    public userTypes = new Map<string, Type>();
    public type = new Type('$program', 'referentialType', undefined);//program是一个引用类型
    constructor() {
        this.userTypes.set("int", new Type('int', 'valuetype', undefined));
    }
    public generateType(): Type {
        throw '构造一个Type'
    }
    //注册类型,刚刚注册的类型信息是不准确的，需要后续使用modifyType进行调整
    public registerType(name: string) {
        if (this.userTypes.has(name)) {
            throw new SemanticException(`用户类型${name}已存在`);
        } else {
            let userType = new Type(name, "referentialType", undefined);
            userType.programScope = this;
            this.userTypes.set(name, userType);
        }
    }
    public unregisterType(name: string) {
        if (!this.userTypes.has(name)) {
            throw new SemanticException(`试图释放不存在的类型${name}`);
        } else {
            this.userTypes.delete(name);
        }
    }
    //调整类型
    public modifyType(name: string, modifier: "valuetype" | "sealed" | "referentialType", genericParadigm: string[] | undefined, templateInstances: Type[] | undefined) {
        let type = this.userTypes.get(name);
        if (type != undefined) {
            type.modifier = modifier;
            type.genericParadigm = genericParadigm;
            type.templateInstances = templateInstances;
        } else {
            throw new SemanticException(`试图调整未注册的类型${name}`);
        }
    }
    public getType(name: string): Type {
        if (this.userTypes.has(name)) {
            return this.userTypes.get(name)!;
        } else {
            throw new SemanticException(`试获取不存在的类型${name}`);
        }
    }
};
//需要计算才能得到的节点
type operator = '+' | '-' | '*' | '/';
class CalculatedNode {
    public op: operator;
    public leftChild: CalculatedNode | SingleNode;
    public rightChild: CalculatedNode | SingleNode;
    public type: Type | undefined;
    constructor(op: operator, lc: CalculatedNode | SingleNode, rc: CalculatedNode | SingleNode) {
        this.op = op;
        this.leftChild = lc;
        this.rightChild = rc;
    }
}
//直接加载符号得到的节点
class SingleNode {
    public ref: string | undefined;//节点引用了某个变量
    public immediate: { value: unknown, type: Type } | undefined;//节点是一个立即数,如:1、1.0、"this is a string"
    public type: Type | undefined;
    constructor(ref: string | undefined, immediate: { value: unknown, type: Type } | undefined, type: Type | undefined) {
        if (ref == undefined && immediate == undefined) {
            throw new SemanticException(`ref和immediate不能同时为undefined`);
        }
        this.ref = ref;
        this.immediate = immediate;
        this.type = type;
    }
}
//为类型推导服务的抽象语法树
class AbstracSyntaxTree {
    public type: Type | undefined;
    public root: CalculatedNode | SingleNode;
    constructor(root: CalculatedNode | SingleNode) {
        this.root = root;
    }
}
const program = new ProgramScope();
export { Type, ArrayType, FunctionType, Address, Scope, FunctionScope, BlockScope, SemanticException, ProgramScope, CalculatedNode, SingleNode, AbstracSyntaxTree, program }
