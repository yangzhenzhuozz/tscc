class Scope {
    public property: VariableDescriptor;
    public parent: Scope | undefined;

    constructor(prop: VariableDescriptor | null, parent: Scope | undefined) {
        if (prop == null) {
            this.property = {};
        } else {
            this.property = prop;
        }
        this.parent = parent;
    }
}
class BlockScope extends Scope {
    public block?: Block;//记录当前scope是属于哪个block,处理闭包时插入指令
    public isFunctionScope: boolean = false;//是否是一个function scope，用于判断闭包捕获
    constructor(prop: VariableDescriptor | null, parent: Scope | undefined, isFunctionScope: boolean, block: Block) {
        super(prop, parent);
        this.isFunctionScope = !!isFunctionScope;
        this.block = block;
    }
}
export { Scope, BlockScope };