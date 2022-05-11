//函数签名
export function FunctionSingle(argument: VariableDescriptor, templates?: string[]): string {
    let types: string[] = [];
    for (let k in argument) {
        types.push(TypeUsedSingle(argument[k].type!));
    }
    return `(${types.length > 0 ? types.reduce((p, c) => `${p},${c}`) : ''})[${templates != undefined ? templates.length : 0}]`;
}
//类型签名
export function TypeUsedSingle(type: TypeUsed): string {
    if (type.SimpleType != undefined) {
        return type.SimpleType.name;
    } else if (type.ArrayType != undefined) {
        return `Array<${TypeUsedSingle(type.ArrayType.innerType)}>`;
    } else {
        //函数类型
        return `${FunctionSingle(type.FunctionType!.argument, type.FunctionType?.templates)}`;
    }
}