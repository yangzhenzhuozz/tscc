import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
function nodeRecursion(scope: Scope, node: ASTNode): ir[] {
    return [];
}
function defalutValue(type: TypeUsed): ir[] {
    return [];
}
function BlockScan(blockScope: BlockScope, label: string[]): ir[] {
    return [];
}
function functionScan(blockScope: BlockScope, fun: FunctionType): ir[] {
    return [];
}
export default function programScan(program: Program) {
    let programScope = new ProgramScope(program);
    let programInitCode: ir[] = [];
    //扫描property
    for (let variableName in program.property) {
        var prop = program.property[variableName];
        if (prop.initAST != undefined) {
            let code = nodeRecursion(programScope, prop.initAST);
        } else if (prop.type?.FunctionType) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!);
            functionScan(blockScope, prop.type?.FunctionType);
        }else{
            //使用default
        }
    }
}