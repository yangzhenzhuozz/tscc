abstract class Scope {
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
class ProgramScope extends Scope {
    constructor(prop: VariableDescriptor | null, parent: Scope | undefined) {
        super(prop, parent);
    }
}
class ClassScope extends Scope {
    public className:string;
    constructor(prop: VariableDescriptor | null, parent: Scope | undefined,className:string) {
        super(prop, parent);
        this.className=className;
    }
}
class BlockScope extends Scope {
    public block?: Block;//记录当前scope是属于哪个block,处理闭包时插入指令
    public isFunctionScope: boolean = false;//是否是一个function scope，用于判断闭包捕获
    public hasCapture:boolean=false;//本scope是否有被捕获的变量
    constructor(prop: VariableDescriptor | null, parent: Scope | undefined, isFunctionScope: boolean, block: Block) {
        super(prop, parent);
        this.isFunctionScope = !!isFunctionScope;
        this.block = block;
    }
}
export { Scope, BlockScope, ClassScope, ProgramScope };