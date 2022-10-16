//函数签名
export function FunctionSingle(functionType: FunctionType): string {
    let types: string[] = [];
    for (let k in functionType._arguments) {
        types.push(TypeUsedSingle(functionType._arguments[k].type!));
    }
    return `args:(${types.length > 0 ? types.reduce((p, c) => `${p},${c}`) : ''}) templateLentgh:${functionType.templates != undefined ? functionType.templates.length : 0} retType:${functionType.retType == undefined ? '' : TypeUsedSingle(functionType.retType)}`;
}
//不带返回值的函数签名
export function FunctionSingleWithoutRetType(functionType: FunctionType): string {
    let types: string[] = [];
    for (let k in functionType._arguments) {
        types.push(TypeUsedSingle(functionType._arguments[k].type!));
    }
    return `args:(${types.length > 0 ? types.reduce((p, c) => `${p},${c}`) : ''}) templateLentgh:${functionType.templates != undefined ? functionType.templates.length : 0}`;
}
//根据参数生成签名
export function FunctionSingleWithArgument(ts: TypeUsed[], ret: TypeUsed) {
    let types: string[] = [];
    for (let t of ts) {
        types.push(TypeUsedSingle(t));
    }
    return `args:(${types.length > 0 ? types.reduce((p, c) => `${p},${c}`) : ''}) templateLentgh:0`;
}

//类型签名
export function TypeUsedSingle(type: TypeUsed): string {
    if (type.SimpleType != undefined) {
        return type.SimpleType.name;
    } else if (type.ArrayType != undefined) {
        return `Array<${TypeUsedSingle(type.ArrayType.innerType)}>`;
    } else {
        //函数类型
        return `${FunctionSingle(type.FunctionType!)}`;
    }
}