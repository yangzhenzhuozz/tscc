//函数签名
export function FunctionSign(functionType: FunctionType): string {
    let types: string[] = [];
    for (let k in functionType._arguments) {
        types.push(TypeUsedSign(functionType._arguments[k].type!));
    }
    return `args:(${types.length > 0 ? types.reduce((p, c) => `${p},${c}`) : ''}) templateLentgh:${functionType.templates != undefined ? functionType.templates.length : 0} retType:${functionType.retType == undefined ? '' : TypeUsedSign(functionType.retType)}`;
}
//不带返回值的函数签名
export function FunctionSignWithoutRetType(functionType: FunctionType): string {
    let types: string[] = [];
    for (let k in functionType._arguments) {
        types.push(TypeUsedSign(functionType._arguments[k].type!));
    }
    return `args:(${types.length > 0 ? types.reduce((p, c) => `${p},${c}`) : ''}) templateLentgh:${functionType.templates != undefined ? functionType.templates.length : 0}`;
}
//根据调用参数生成一个函数签名
export function FunctionSignWithArgument(ts: TypeUsed[]) {
    let types: string[] = [];
    for (let t of ts) {
        types.push(TypeUsedSign(t));
    }
    return `args:(${types.length > 0 ? types.reduce((p, c) => `${p},${c}`) : ''}) templateLentgh:0`;
}

//类型签名
export function TypeUsedSign(type: TypeUsed): string {
    if (type.SimpleType != undefined) {
        return type.SimpleType.name;
    } else if (type.ArrayType != undefined) {
        return `Array<${TypeUsedSign(type.ArrayType.innerType)}>`;
    } else {
        //函数类型
        return `${FunctionSign(type.FunctionType!)}`;
    }
}