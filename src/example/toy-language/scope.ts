class Scope {
    public property: VariableDescriptor;
    public parent: Scope | undefined;
    public isFunction: boolean;
    public captured: Set<string>;//需要进行lambda捕获的变量名
    public template: string[];
    public defNodes: { [key: string]: ASTNode };//propery定义的节点
    public body: Array<ASTNode> = [];//AST节点集合
    constructor(prop: VariableDescriptor, parent: Scope | undefined, isFunction: boolean, template: string[]) {
        this.property = prop;
        this.parent = parent;
        this.isFunction = isFunction;
        this.captured = new Set();
        this.template = template;
        this.defNodes = {};
    }
    public postProcessor() { }
}
export { Scope };