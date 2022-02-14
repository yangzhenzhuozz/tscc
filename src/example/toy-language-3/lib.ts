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
class Address {
    public location: "immediate" | "program" | "class" | "function" | "text";//值存放的位置，分别为立即数、全局空间、class空间、函数空间、代码段
    public type: Type;
    public value: number;//地址
    constructor(loc: "immediate" | "program" | "class" | "function" | "text", type: Type, value: number) {
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
export { Type, Address }