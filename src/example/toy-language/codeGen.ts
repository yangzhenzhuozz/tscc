import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
function nodeRecursion(scope: Scope, node: ASTNode): baseBlock {
    return [];
}
function defalutValue(type: TypeUsed): baseBlock {
    return [];
}
function BlockScan(blockScope: BlockScope, label: string[]): baseBlock {
    return [];
}
function functionScan(blockScope: BlockScope, fun: FunctionType): baseBlock {
    return [];
}
export default function programScan(program: Program) {
    let programScope = new ProgramScope(program);
    //扫描property
    for (let variableName in program.property) {
        var prop = program.property[variableName];
        if (prop.initAST != undefined) {
            let code = nodeRecursion(programScope, prop.initAST);
        } if (prop.type?.FunctionType) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!);
            functionScan(blockScope, prop.type?.FunctionType);
        }
    }
}