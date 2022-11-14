import { globalVariable } from './constant.js'

let debugID = 0;
abstract class Scope {
    public ID;//用于调试的ID
    protected property: VariableDescriptor;
    protected fieldOffsetMap?: { [key: string]: { size: number, offset: number } };//在代码生成阶段使用
    /**
     * 
     * @param prop 
     * @param offsetPatch 在执行完类型推导之后，可以计算各个变量的偏移
     */
    constructor(prop: VariableDescriptor | undefined, offsetPatch?: { program: Program }) {
        this.ID = debugID++;
        if (prop == undefined) {
            this.property = {};
        } else {
            this.property = prop;
        }
        if (offsetPatch) {
            let { program } = offsetPatch;
            this.fieldOffsetMap = {};
            let offset = 0;
            for (let k in this.property) {
                let type = this.property[k].type!;
                if (type.PlainType && program.definedType[type.PlainType.name].modifier == 'valuetype') {//是值类型,offset累加size大小
                    let typeName = type.PlainType.name;
                    let size = program.definedType[typeName].size!;
                    this.fieldOffsetMap[k] = { size: size, offset: offset };
                    offset += size;
                } else {//否则按照指针处理
                    this.fieldOffsetMap[k] = { size: globalVariable.pointSize, offset: offset };
                    offset += globalVariable.pointSize;
                }
            }
        }
    }
    public abstract getPropOffset(name: string): { size: number, offset: number };//只需要在自己的scope范围内搜索，不用向上搜索到class和program了
    public abstract getProp(name: string): { prop: VariableProperties, scope: Scope };
}
class ProgramScope extends Scope {
    public program: Program;
    private classMap: { [key: string]: ClassScope } = {};
    public setProp(name: string, variableProperties: VariableProperties): void {
        this.property[name] = variableProperties;
    }
    constructor(program: Program, offsetPatch?: { program: Program }) {
        super(program.property, offsetPatch);
        this.program = program;
        //创建所有的classScope
        for (let typeName in program.definedType) {
            let type = program.definedType[typeName];
            if (type.extends != undefined) {//有继承于其他类
                throw `不支持extends:${typeName}`;
            } else {
                this.classMap[typeName] = new ClassScope(program.definedType[typeName].property, typeName, this, offsetPatch);
            }
        }
    }
    /**
     * 注册因为闭包捕获而新增的类型
     * @param name 
     */
    public registerClassForCapture(name: string) {
        this.classMap[name] = new ClassScope(this.program.definedType[name].property, name, this);
    }
    public getClassScope(className: string): ClassScope {
        if (this.classMap[className] != undefined) {
            return this.classMap[className];
        } else {
            throw `未定义的类型:${className}`;
        }
    }
    public getProp(name: string): { prop: VariableProperties, scope: Scope } {
        if (this.property[name] != undefined) {
            return { prop: this.property[name], scope: this };
        } else {
            throw `试图读取未定义的标识符:${name}`;
        }
    }
    public getPropOffset(name: string): { size: number, offset: number } {
        if (this.fieldOffsetMap![name] == undefined) {
            throw `试图获取未知的属性:${name}`;
        }
        return this.fieldOffsetMap![name];
    }
}
class ClassScope extends Scope {
    public className: string;
    public programScope: ProgramScope;
    constructor(prop: VariableDescriptor | undefined, className: string, programScope: ProgramScope, offsetPatch?: { program: Program }) {
        super(prop, offsetPatch);
        this.programScope = programScope;
        this.className = className;
    }
    public getPropNames() {
        return Object.keys(this.property);
    }
    public getProp(name: string): { prop: VariableProperties, scope: Scope } {
        let scope: ClassScope | undefined = this;
        let prop: VariableProperties | undefined = this.property[name];
        if (prop != undefined) {
            return { prop: prop, scope: this };
        } else {
            return this.programScope.getProp(name);
        }
    }
    public getPropOffset(name: string): { size: number, offset: number } {
        if (this.fieldOffsetMap![name] == undefined) {
            throw `试图获取未知的属性:${name}`;
        }
        return this.fieldOffsetMap![name];
    }
}
class BlockScope extends Scope {
    public parent: BlockScope | undefined;
    public block?: Block;//记录当前scope是属于哪个block,处理闭包时插入指令
    public fun: FunctionType | undefined;//是否是一个function scope，用于判断闭包捕获
    public captured: Set<string> = new Set();//本scope被捕获的变量
    public defNodes: { [key: string]: { defNode: ASTNode, loads: ASTNode[] } } = {};//def:哪个节点定义的变量,loads:被哪些节点读取，在处理闭包捕获时用到
    public programScope: ProgramScope;
    public classScope: ClassScope | undefined;
    public baseOffset: number;
    constructor(scope: Scope, fun: FunctionType | undefined, block: Block, offsetPatch?: { program: Program }) {
        super(undefined, offsetPatch);
        if (scope instanceof ProgramScope) {
            this.parent = undefined;
            this.programScope = scope;
            this.classScope = undefined;
        } else if (scope instanceof ClassScope) {
            this.parent = undefined;
            this.programScope = scope.programScope;
            this.classScope = scope;
        } else if (scope instanceof BlockScope) {
            this.parent = scope;
            this.programScope = scope.programScope;
            this.classScope = scope.classScope;
        } else {
            throw `scope只能是上面三种情况`;
        }
        if (this.parent == undefined) {
            this.baseOffset = globalVariable.pointSize;//是functionScope,预留this和闭包位置
        } else {
            this.baseOffset = this.parent.baseOffset;
        }
        this.fun = fun;
        this.block = block;
    }
    /**
     * @param name 
     * @param variableProperties 
     * @param defNode 语义分析阶段使用，参加defNodes说明，在代码生成阶段不使用
     */
    public setProp(name: string, variableProperties: VariableProperties, defNode?: ASTNode): void {
        if (this.property[name] != undefined) {
            throw `重复定义变量${name}`;
        } else {
            this.property[name] = variableProperties;
            if (defNode != undefined) {
                this.defNodes[name] = { defNode: defNode, loads: [] };
            }
            if (this.fieldOffsetMap) {//如果需要填充变量偏移
                let type = variableProperties.type!;
                let program = this.programScope.program;
                if (type.PlainType && program.definedType[type.PlainType.name].modifier == 'valuetype') {//是值类型,offset累加size大小
                    let typeName = type.PlainType.name;
                    let size = program.definedType[typeName].size!;
                    this.fieldOffsetMap[name] = { size: size, offset: this.baseOffset };
                    this.baseOffset += size;
                } else {//否则按照指针处理
                    this.fieldOffsetMap[name] = { size: globalVariable.pointSize, offset: this.baseOffset };
                    this.baseOffset += globalVariable.pointSize;
                }
            }
        }
    }
    public getProp(name: string): { prop: VariableProperties, scope: Scope } {
        let prop: VariableProperties | undefined;
        let level = 0;
        let needCaptureFun: FunctionType[] = [];
        let fast: BlockScope | undefined = this;
        let low: BlockScope | undefined = undefined;
        for (; fast != undefined; low = fast, fast = fast.parent) {
            if (low?.fun != undefined) {//每越过一个functionScope，层级+1
                needCaptureFun.push(low!.fun!);//刚好越过一个函数，慢指针肯定指向一个函数
                level++;
            }
            if (fast.property[name] != undefined) {
                prop = fast.property[name];
                break;
            }
        }
        if (prop == undefined) {
            level = 0;//不是在blockScope中的属性，清除标记
        }
        if (prop != undefined) {
            if (level > 0) {
                for (let f of needCaptureFun) {
                    if (prop.type == undefined) {
                        throw `定义在block中的变量没有完成类型推导`;//定义在block中的变量肯定已经推导过类型
                    }
                    f.capture[name] = prop.type;
                }
                fast!.captured.add(name);//如果能找到变量,fast一定不是undeinfed
            }
            return { prop: prop, scope: fast! };
        } else {
            if (this.classScope != undefined) {
                return this.classScope.getProp(name);
            } else {
                return this.programScope.getProp(name);
            }
        }
    }
    public getPropOffset(name: string): { size: number, offset: number } {
        let scope: BlockScope | undefined = this;
        for (; scope != undefined; scope = scope.parent) {
            if (scope.fieldOffsetMap![name] != undefined) {
                return scope.fieldOffsetMap![name];
            }
        }
        throw `试图获取未知的属性:${name}`;
    }
}
export { Scope, BlockScope, ClassScope, ProgramScope };