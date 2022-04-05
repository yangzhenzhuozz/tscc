class Type {
    public fields: Map<string, Address> = new Map();//属性列表
    public getFields: Map<string, FunctionType> = new Map();//get列表
    public setFields: Map<string, FunctionType> = new Map();//get列表
    private allocated = 0;//分配的地址位置
    public operatorOverload: Map<string, FunctionType> = new Map();//操作符重载列表
    public modifier: "valuetype" | "sealed" | "referentialType";
    public parentType: Type | undefined;//父对象,为undefined表示这是object
    public genericParadigm: string[] | undefined;
    public templateInstances: Type[] | undefined;
    public name: string;
    public programScope: ProgramScope | undefined;
    constructor(name: string, modifier: "valuetype" | "sealed" | "referentialType", templateInstances: Type[] | undefined) {
        this.templateInstances = templateInstances;
        this.name = name;
        this.modifier = modifier;
    }
    public add_get(name: string, fun: FunctionType) {
        if (this.fields.has(name)) {
            throw new SemanticException(`属性${name}已经存在,不能设置get`);
        }
        if (this.getFields.has(name)) {
            throw new SemanticException(`get属性${name}已经存在,不能设置get`);
        }
        if (!fun.scope!.hasReturn) {
            throw new SemanticException(`get属性${name}必须拥有返回值`);
        }
        this.getFields.set(name, fun);
    }
    public add_set(name: string, fun: FunctionType) {
        if (this.fields.has(name)) {
            throw new SemanticException(`属性${name}已经存在,不能设置set`);
        }
        if (this.setFields.has(name)) {
            throw new SemanticException(`get属性${name}已经存在,不能设置set`);
        }
        this.getFields.set(name, fun);
    }
    public setOperatorOverload(op: '+', fun: FunctionType) {
        if (this.operatorOverload.has(op)) {
            throw new SemanticException(`重载操作符${op}重复定义`);
        }
        this.operatorOverload.set(op, fun);
    }
    public setParent(parentType: Type) {
        this.parentType = parentType;
    }
    public registerField(name: string, type: Type | undefined, initAST: Node | undefined, vari: 'var' | 'val') {
        if (this.fields.has(name)) {
            throw new SemanticException(`属性:${name}重复定义`);
        }
        this.fields.set(name, new Address(type, initAST, this.allocated++, vari));
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
            if (f.type != undefined) {
                type = f.type;
            } else {
                throw new SemanticException(`类型推导未推导完成的类型不能检测值类型循环`);
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
    public scope: Scope | undefined;
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
    public type: Type | undefined;
    public initAST: Node | undefined;
    public add: number;//地址
    constructor(type: Type | undefined, initAST: Node | undefined, add: number, vari: 'var' | 'val') {
        this.type = type;
        this.initAST = initAST;
        this.add = add;
        this.variable = vari;
    }
}
class SemanticException extends Error {
    constructor(msg: string) {
        super(msg);
        super.name = 'SemanticException';
    }
}
//functionScope或者blockScope
class Scope {
    public instruction: (Node | Scope)[] = [];//语法树序列
    public parent: Scope | undefined;//父scope
    public get hasReturn(): boolean {
        return this.instruction.slice(-1)[0].hasReturn;
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
type operator = '+' | '-' | '*' | '/' | '=' | '<' | '>' | '<=' | '>=' | '&&' | '==' | '||' | '!'
    | '++' | '--' | 'index' | '?' | 'immediate' | 'load' | 'super' | 'this' | 'field' | 'call'
    | 'instanceof' | 'cast' | 'new' | 'new_array' | 'return' | 'register_local_variable' | 'register_local_value' | 'if-else';
class Node {
    public op: operator;
    public tag: any;
    public tag2: any;
    public tag3: any;
    public leftChild: Node | Scope | undefined;
    public rightChild: Node | Scope | undefined;
    public additionalChild: Node | Scope | undefined;
    public type: Type | undefined;
    public value: unknown;
    public isleft = false;//是否为左值
    constructor(op: operator) {
        this.op = op;
    }
    public get hasReturn(): boolean {
        if (this.op == "return") {
            return true;
        } else if (this.op == 'if-else') {
            return this.leftChild!.hasReturn && this.rightChild!.hasReturn;//if分支和else分支都return才算是return;
        }
        return false;
    }
    postorderTraversal() {
        switch (this.op) {
            case 'load':
                console.log(`load ${this.value}`);
                break;
            case 'field':
                (this.leftChild as Node).postorderTraversal();
                console.log(`get field ${this.tag}`);
                break;
            case 'call':
                (this.leftChild as Node).postorderTraversal();
                console.log(`call`);
                for (let i = 0; i < (this.tag as Node[]).length; i++) {
                    (this.tag as Node[])[i].postorderTraversal()
                }
                break;
            default: console.log(`还未实现打印的操作符${this.op}`);

        }
    }
}
const program = new ProgramScope();
export { Type, ArrayType, FunctionType, Address, Scope, SemanticException, ProgramScope, Node, program }
