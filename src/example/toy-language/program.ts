export class Program {
    private definedType: {//已经定义了的类型
        [key: string]: TypeDef
    } = {};
    property: VariableDescriptor = {};
    templateProp: VariableDescriptor = {};//模板成员(模板函数),在类型检测阶段会把模板函数移入这里
    tempalteType: {//已经定义了的模板类型,在类型检测阶段会把模板类型移入这里
        [key: string]: TypeDef
    } = {};
    size?: number;
    public getDefinedType(name: string): TypeDef {
        return this.definedType[name];
    }
    public setDefinedType(name: string, defType: TypeDef) {
        this.definedType[name] = defType;;
    }
    public getDefinedTypeNames(): string[] {
        return Object.keys(this.definedType);
    }
    public moveDefinedTypeToTemplateType(name: string) {
        this.tempalteType[name] = this.definedType[name];
        delete this.definedType[name];
    }
    public movePropToTemplateProp(name: string) {
        this.templateProp[name] = this.property[name];
        delete this.property[name];
    }
}