import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
function nodeRecursion(scope: Scope, node: ASTNode, label: string[]): IR[] {
    let ir: IR[] = [];
    let op = Object.keys(node)[0] as 'loadOperatorOverload' | 'loadException' | 'loadArgument' | 'def' | 'def_ref' | 'accessField' | 'call' | 'load' | 'load_ref' | '_super' | '_this' | '_program' | 'immediate' | 'trycatch' | 'setter' | 'throwStmt' | 'ret' | 'ifStmt' | 'ifElseStmt' | 'do_while' | '_while' | '_for' | '_break' | '_continue' | '_instanceof' | 'not' | '++' | '--' | 'ternary' | 'cast' | 'box' | 'unbox' | '_new' | '_newArray' | '[]' | '=' | '+' | '-' | '*' | '/' | '<' | '<=' | '>' | '>=' | '==' | '||' | '&&' | '_switch';
    switch (op) {
        case '_program':
            {
                ir.push({ opCode: 'p_load', operand: undefined });
            }
            break;
        case 'accessField':
            {
                let r = nodeRecursion(scope, node['accessField']!.obj, label);
                ir.push({ opCode: 'p_load', operand: undefined });
            }
            break;
    }
    return [];
}
function defalutValue(type: TypeUsed): IR[] {
    return [];
}
function BlockScan(blockScope: BlockScope, label: string[]): IR[] {
    return [];
}
function functionScan(blockScope: BlockScope, fun: FunctionType): IR[] {
    return [];
}
let programInit: IR[] = [];
export default function programScan(program: Program) {
    let programScope = new ProgramScope(program, { program: program });
    let programInitCode: IR[] = [];
    //扫描property
    for (let variableName in program.property) {
        var prop = program.property[variableName];
        if (prop.initAST != undefined) {
            let code = nodeRecursion(programScope, prop.initAST, []);
        } else if (prop.type?.FunctionType) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!);
            functionScan(blockScope, prop.type?.FunctionType);
        } else {
            //使用default
        }
    }
}