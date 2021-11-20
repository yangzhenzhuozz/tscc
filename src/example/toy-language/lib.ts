type locationType = "global" | "function" | "class" | "block" | "stmt" | "constant_val";//定义寻址模式,global在data区寻址,stack在栈中寻址,class则通过this指针寻址
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
}
abstract class Scope {
    public location: locationType;
    protected addressMap: Map<string, Address> = new Map();//地址空间
    public parentScope: Scope | undefined;//父空间
    protected allocated: number = 0;//当前可以使用的地址
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
    public linkParentScope(scope: Scope) {
        this.parentScope = scope;
    }
    /**
     * 
     * @param name 
     * @param type 
     * @param addTodeclareScope 是否对子空间的变量声明造成影响
     */
    public createVariable(name: string, type: Type): boolean {
        if (this.checkRedeclaration(name)) {
            this.errorMSG = `重复定义:${name}`;
            return false;
        } else {
            this.addressMap.set(name, new Address(this.location, this.allocated++, type));
            return true;
        }
    }
    private checkRedeclaration(name: string): boolean {
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
}
class FunctionScope extends Scope {
    public returnType: Type;
    constructor(retType: Type) {
        super("function", false);
        this.returnType = retType;
    }
    public removeVariableForBlockEnd(name: string) {//因为只有临时空间结束的时候才会销毁变量作用域,经过一系列的销毁，可以保证最后的allocated平衡
        let latestAddre = this.addressMap.get(name)!.value;
        this.allocated = latestAddre;
        if (!this.addressMap.delete(name)) {
            throw `理论上不可能出现的错误却出现了`;
        }
    }
}
class ClassScope extends Scope {
    constructor() {
        super("class", false);
    }
}
class StmtScope extends Scope {
    constructor() {
        super("stmt", false);
    }
    public createTmp(type: Type): Address {
        this.addressMap.set(`${this.allocated}`, new Address(this.location, this.allocated++, type));
        return new Address(this.location, this.allocated, type);
    }
}

class BlockScope extends Scope {
    public variables: Set<string> = new Set();//创建的临时遍历列表
    constructor() {
        super("block", false);
    }
}

class SemanticException extends Error {
    constructor(msg: string) {
        super(msg);
        super.name = 'SemanticException';
    }
}
class StmtDescriptor {
    public quadruples: Quadruple[] = [];
    public hasReturn: boolean = false;
}
class ObjectDescriptor {
    public address: Address;
    public quadruples: Quadruple[] = [];
    public backPatch: boolean = false;//是否需要回填
    public trueList: number[] = [];
    public falseList: number[] = [];
    constructor(add: Address) {
        this.address = add;
    }
}
class Quadruple {
    public op: string;
    public arg1: Address;
    public arg2: Address
    public result: Address;
    constructor(op: string, arg1: Address, arg2: Address, ret: Address) {
        this.op = op;
        this.arg1 = arg1;
        this.arg2 = arg2;
        this.result = ret;
    }
}
export { Scope, Address, SemanticException, Type, GlobalScope, FunctionScope, ClassScope, StmtScope, StmtDescriptor, ObjectDescriptor, BlockScope, Quadruple }