type locationType = "global" | "stack";
class Address {
    public location: locationType;
    public value: number;
    public type: string;
    constructor(location: locationType, value: number, type: string) {
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
    constructor(location: locationType, cwp: boolean) {
        this.location = location;
        this.ConflictWithParent = cwp;
    }
    /**
     * 
     * @param name 
     * @param type 
     * @param addTodeclareScope 是否对子空间的变量声明造成影响
     */
    public createVariable(name: string, type: string): boolean {
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
        return this.addressMap.get(name);
    }
}
class SemanticException extends Error {
    constructor(msg: string) {
        super(msg);
        super.name = 'SemanticException';
    }
}
export { Scope, Address, SemanticException }