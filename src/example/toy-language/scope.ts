abstract class Scope {
    public property: VariableDescriptor;
    constructor(prop: VariableDescriptor | undefined) {
        if (prop == undefined) {
            this.property = {};
        } else {
            this.property = prop;
        }
    }
    public abstract getProp(name: string): { prop: VariableProperties, scope: Scope };
}
class ProgramScope extends Scope {
    private classMap: { [key: string]: ClassScope } = {};
    constructor(program: Program) {
        super(program.property);
        //创建所有的classScope
        for (let typeName in program.definedType) {
            let type = program.definedType[typeName];
            if (type.extends != undefined) {//有继承于其他类
                if (type.extends?.SimpleType == undefined) {
                    throw `${typeName}只能继承于基础类型，不能继承数组和函数`;
                }
            }
            this.classMap[typeName] = new ClassScope(type.property, typeName, this, type.extends != undefined ? type.extends.SimpleType : undefined);
        }
        for (let typeName in program.definedType) {
            this.classMap[typeName].extendCheck();
        }
    }
    public getClassScope(className: string): ClassScope {
        if (this.classMap[className] != undefined) {
            return this.classMap[className];
        } else {
            throw `未定义的类型:${className}`;
        }
    }
    public setClassScope(className: string, scope: ClassScope): void {
        if (this.classMap[className] != undefined) {
            throw `重复定义类型:${className}`;
        } else {
            this.classMap[className] = scope;
        }
    }
    public getProp(name: string): { prop: VariableProperties, scope: Scope } {
        if (this.property[name] != undefined) {
            return { prop: this.property[name], scope: this };
        } else {
            throw `试图读取未定义的标识符:${name}`;
        }
    }
}
class ClassScope extends Scope {
    public className: string;
    public programScope: ProgramScope;
    public superClass: SimpleType | undefined;
    constructor(prop: VariableDescriptor | undefined, className: string, programScope: ProgramScope, superClass: SimpleType | undefined) {
        super(prop);
        this.programScope = programScope;
        this.className = className;
        this.superClass = superClass;
    }
    //检查继承链是否出现循环或者继承未定义的类型
    public extendCheck() {
        let now = this.superClass;
        for (; now != undefined; now = this.programScope.getClassScope(now.name).superClass) {
            if (now.name == this.className) {
                throw `${this.className}出现循环继承`;
            }
        }
    }
    public getProp(name: string): { prop: VariableProperties, scope: Scope } {
        let scope: ClassScope | undefined = this;
        let prop: VariableProperties | undefined;
        for (; scope != undefined; scope = this.superClass != undefined ? this.programScope.getClassScope(this.superClass.name) : undefined) {
            if (scope.property[name] != undefined) {
                prop = scope.property[name];
                break;
            }
        }
        if (prop != undefined) {
            return { prop: prop, scope: this };
        } else {
            return this.programScope.getProp(name);
        }
    }
}
class BlockScope extends Scope {
    public parent: BlockScope | undefined;
    public block?: Block;//记录当前scope是属于哪个block,处理闭包时插入指令
    public isFunctionScope: boolean = false;//是否是一个function scope，用于判断闭包捕获
    public hasCapture: boolean = false;//本scope是否有被捕获的变量
    public programScope: ProgramScope;
    public classScope: ClassScope | undefined;
    constructor(scope: Scope, isFunctionScope: boolean, block: Block) {
        super(undefined);
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
        this.isFunctionScope = !!isFunctionScope;
        this.block = block;
    }
    public getProp(name: string): { prop: VariableProperties, scope: Scope } {
        let prop: VariableProperties | undefined;
        let level = 0;
        let flag = false;
        let scope: BlockScope | undefined = this;
        for (; scope != undefined; scope = scope.parent) {
            if (flag) {//每越过一个functionScope，层级+1
                level++;
                flag = false;
            }
            if (scope instanceof BlockScope && scope.isFunctionScope) {
                flag = true;
            }
            if (scope.property[name] != undefined) {
                prop = scope.property[name];
                break;
            }
        }
        if (prop == undefined) {
            level = 0;//不是在blockScope中的属性，清除标记
        }
        if (prop != undefined) {
            this.hasCapture = level > 0;
            return { prop: prop, scope: this };
        } else {
            if (this.classScope != undefined) {
                return this.classScope.getProp(name);
            } else {
                return this.programScope.getProp(name);
            }
        }
    }
}
export { Scope, BlockScope, ClassScope, ProgramScope };