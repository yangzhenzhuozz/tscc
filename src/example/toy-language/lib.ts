type locationType = "global" | "stack" | "class";//定义寻址模式,global在data区寻址,stack在栈中寻址,class则通过this指针寻址
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
class Scope {
    public location: locationType;
    private addressMap: Map<string, Address> = new Map();//地址空间
    private parentScope: Scope | undefined;//父空间
    private allocated: number = 0;//当前可以使用的地址
    private ConflictWithParent: boolean;//声明空间是否和父空间冲突,即判断重复定义的时候需不需要搜索父空间
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
            if (this.ConflictWithParent && this.parentScope != undefined) {//如果本scope和父scope声明可能会冲突，则搜索父空间
                return this.parentScope?.getVariable(name);
            }
            else {
                return undefined;
            }
        }
    }
}
class SemanticException extends Error {
    constructor(msg: string) {
        super(msg);
        super.name = 'SemanticException';
    }
}
class FunctionDescriptor {
    public scope: Scope;
    public returnType: Type;
    constructor(scope: Scope, retType: Type) {
        this.scope = scope;
        this.returnType = retType;
    }
}
class StmtDescriptor {
    public hasReturn:boolean=false;
    public quadrupleCodes:string='';
}
export { Scope, Address, SemanticException, Type, FunctionDescriptor, StmtDescriptor }