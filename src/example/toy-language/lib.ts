type locationType = "global" | "stack" | "class" | "constant_val";//定义寻址模式,global在data区寻址,stack在栈中寻址,class则通过this指针寻址
class Type {
    public type: "base_type" | "function" | "array" | undefined;
    public basic_type: string | undefined;
    public innerType: Type | undefined;
    public argumentTypes: Type[] | undefined;
    public returnType: Type | undefined;
    public static ConstructBase(name: string) {
        let result = new Type();
        result.type = "base_type";
        result.basic_type = name;
        return result;
    }
    public static ConstructArray(innerType: Type) {
        let result = new Type();
        result.type = "array";
        result.innerType = innerType;
        return result;
    }
    public static ConstructFunction(argumentTypes: Type[], returnType: Type) {
        let result = new Type();
        result.type = "function";
        result.argumentTypes = argumentTypes;
        result.returnType = returnType;
        return result;
    }
    //禁用构造器，只允许使用工厂方法构造
    private constructor() {

    }
    public setBasicType(name: string) {
        this.basic_type = name;
    }
    public setArgument(...types: Type[]) {
        this.argumentTypes = types;
    }
    public setReturnType(type: Type) {
        this.returnType = type;
    }
    public toString() {
        if (this.type == "base_type") {
            return this.basic_type;
        } else if (this.type == "array") {
            return `Array<${this.innerType}>`;
        } else if (this.type == "function") {
            return `(${[...this.argumentTypes!]})=>${this.returnType}`;
        }
    }
}
class Address {
    public location: locationType;
    public value: number;
    public type: Type;
    constructor(location: locationType, value: number, type: Type) {
        this.location = location;
        this.value = value;
        this.type = type;
    }
    public toString(): string {
        switch (this.location) {
            case "class": return `class.[${this.value}]`;
            case "constant_val": return `${this.value}`;
            case "global": return `global.[${this.value}]`;
            case "stack": return `stack.[${this.value}]`;
        }
    }
}
abstract class Scope {
    public location: locationType;
    public addressMap: Map<string, Address> = new Map();//地址空间
    public parentScope: Scope | undefined;//父空间
    public allocated: number = 0;//当前可以使用的地址
    protected ConflictWithParent: boolean;//声明空间是否和父空间冲突,即判断重复定义的时候需不需要搜索父空间
    public errorMSG = '';//用于错误提示的字符串

    /**
     * 
     * @param location 变量存放位置
     * @param conflictWithParent 定义变量时是否会和父空间冲突
     */
    constructor(location: locationType, conflictWithParent: boolean) {
        this.location = location;
        this.ConflictWithParent = conflictWithParent;
    }
    abstract createVariable(name: string, type: Type): boolean;
    public linkParentScope(scope: Scope) {
        this.parentScope = scope;
    }

    protected checkRedeclaration(name: string): boolean {
        if (this.addressMap.has(name)) {
            return true;
        } else {
            if (this.ConflictWithParent && this.parentScope != undefined) {//如果本scope和父scope声明可能会冲突，则搜索父空间
                return this.parentScope.checkRedeclaration(name);
            }
            else {
                return false;
            }
        }
    }
    public getVariable(name: string): Address | undefined {
        let result = this.addressMap.get(name);
        if (result != undefined) {
            return result;
        }
        else {
            if (this.parentScope != undefined) {//如果本scope和父scope声明可能会冲突，则搜索父空间
                return this.parentScope?.getVariable(name);
            }
            else {
                return undefined;
            }
        }
    }
}
class GlobalScope extends Scope {
    constructor() {
        super("global", false);
    }
    public createVariable(name: string, type: Type): boolean {
        if (this.checkRedeclaration(name)) {
            this.errorMSG = `重复定义:${name}`;
            return false;
        } else {
            this.addressMap.set(name, new Address(this.location, this.allocated++, type));
            return true;
        }
    }
}
class FunctionScope extends Scope {
    public returnType: Type;
    constructor(retType: Type) {
        super("stack", false);
        this.returnType = retType;
    }
    public createVariable(name: string, type: Type): boolean {
        if (this.checkRedeclaration(name)) {
            this.errorMSG = `重复定义:${name}`;
            return false;
        } else {
            this.addressMap.set(name, new Address(this.location, this.allocated++, type));
            return true;
        }
    }
}
class ClassScope extends Scope {
    constructor() {
        super("class", false);
    }
    public createVariable(name: string, type: Type): boolean {
        if (this.checkRedeclaration(name)) {
            this.errorMSG = `重复定义:${name}`;
            return false;
        } else {
            this.addressMap.set(name, new Address(this.location, this.allocated++, type));
            return true;
        }
    }
}
class StmtScope extends Scope {
    private numOfVariable = 0;//本次stmt所申请的变量数量
    constructor() {
        super("stack", false);
    }
    public createTmp(type: Type): Address {
        let parentFunctionScope: Scope | undefined = this;
        for (; !(parentFunctionScope instanceof FunctionScope) && (parentFunctionScope != undefined);) {
            parentFunctionScope = parentFunctionScope.parentScope;
        }
        if (parentFunctionScope == undefined) {
            throw `stmtScope必然是挂在某个functionScope下面的`;
        }
        this.numOfVariable++;
        return new Address(parentFunctionScope.location, parentFunctionScope.allocated++, type);
    }
    //如果是由stmt->declare得到的声明，则head是一个stmtScope，此时要把变量注册到functionScope中
    public createVariable(name: string, type: Type): boolean {
        let parentFunctionScope: Scope | undefined = this;
        //向上搜索出层级最近的BlockScope或者FunctionScope
        for (; !((parentFunctionScope instanceof FunctionScope) || (parentFunctionScope instanceof BlockScope)) && (parentFunctionScope != undefined);) {
            parentFunctionScope = parentFunctionScope.parentScope;
        }
        if (parentFunctionScope == undefined) {
            throw `stmtScope必然是挂在某个functionScope下面的`;
        }
        return parentFunctionScope.createVariable(name, type)
    }
    public removeTemporary() {
        let parentFunctionScope: Scope | undefined = this;
        for (; !(parentFunctionScope instanceof FunctionScope) && (parentFunctionScope != undefined);) {
            parentFunctionScope = parentFunctionScope.parentScope;
        }
        if (parentFunctionScope == undefined) {
            throw `stmtScope必然是挂在某个functionScope下面的`;
        }
        parentFunctionScope.allocated -= this.numOfVariable;
    }
}

class BlockScope extends Scope {
    public variables: Set<string> = new Set();//创建的临时变量列表
    constructor() {
        super("stack", false);
    }
    public createVariable(name: string, type: Type): boolean {
        let parentFunctionScope: Scope | undefined = this;
        for (; !(parentFunctionScope instanceof FunctionScope) && (parentFunctionScope != undefined);) {
            parentFunctionScope = parentFunctionScope.parentScope;
        }
        if (parentFunctionScope == undefined) {
            throw `stmtScope必然是挂在某个functionScope下面的`;
        }
        if (parentFunctionScope.createVariable(name, type)) {
            this.variables.add(name);
            return true;
        } else {
            return false;
        }
    }
    public removeBlockVariable() {
        let parentFunctionScope: Scope | undefined = this;
        for (; !(parentFunctionScope instanceof FunctionScope) && (parentFunctionScope != undefined);) {
            parentFunctionScope = parentFunctionScope.parentScope;
        }
        if (parentFunctionScope == undefined) {
            throw `stmtScope必然是挂在某个functionScope下面的`;
        }
        for (let name of this.variables.values()) {
            parentFunctionScope.addressMap.delete(name);//销毁作用域内的变量
        }
        parentFunctionScope.allocated -= this.variables.size;
    }
}

class SemanticException extends Error {
    constructor(msg: string) {
        super(msg);
        super.name = 'SemanticException';
    }
}
class Descriptor {
    public quadruples: Quadruple[] = [];
    public toString(): string {
        let ret = '';
        for (let q of this.quadruples) {
            ret += `${q}`;
        }
        return ret;
    }
}
class StmtDescriptor extends Descriptor {
    public hasReturn: boolean = false;
}
class ObjectDescriptor extends Descriptor {
    public address: Address;//如果是需要回填的指令，则没有address
    public backPatch: boolean = false;//是否需要回填
    public trueList: Address[] = [];
    public falseList: Address[] = [];
    constructor(add: Address) {
        super();
        this.address = add;
    }
}
class Quadruple {
    private static PC = 0;
    public op: string;
    public arg1: Address | undefined;
    public arg2: Address | undefined;
    public result: Address | undefined;
    public pc = Quadruple.PC++;
    constructor(op: string, arg1: Address | undefined, arg2: Address | undefined, ret: Address | undefined) {
        this.op = op;
        this.arg1 = arg1;
        this.arg2 = arg2;
        this.result = ret;
    }
    public toString(): string {
        switch (this.op) {
            case "if": return `${this.pc}\t${this.op}\t${this.arg1}\tgoto\t${this.result}\n`;
            case "if <": return `${this.pc}\tif\t${this.arg1}<${this.arg2}\tgoto\t${this.result}\n`;
            case "if >": return `${this.pc}\tif\t${this.arg1}<${this.arg2}\tgoto\t${this.result}\n`;
            case "goto": return `${this.pc}\tgoto\t${this.result}\n`;
            default: return `${this.pc}\t${this.result}\t=\t${this.arg1}\t${this.op}\t${this.arg2}\n`;
        }
    }
}
class BackPatchTools {
    public static backpatch(addresses: Address[], value: number) {
        for (let address of addresses) {
            address.value = value;
        }
    }
    public static merge(a: Address[], b: Address[]) {
        return a.concat(b);
    }
}
export { BackPatchTools, Scope, Address, SemanticException, Type, GlobalScope, FunctionScope, ClassScope, StmtScope, StmtDescriptor, ObjectDescriptor, BlockScope, Quadruple, Descriptor }