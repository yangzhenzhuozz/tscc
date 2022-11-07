import { pointSize } from './constant.js';
import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
import { IR, codes } from './ir.js'
let program: Program;
function backPatch(list: IR[], value: number) {
    for (let ir of list) {
        ir.operand = value;
    }
}
function nodeRecursion(scope: Scope, node: ASTNode, label: string[]): { lastIndex: number, truelist: IR[], falselist: IR[] } {
    if (node['_program'] != undefined) {
        let ir = new IR('p_load');
        return { lastIndex: ir.index, truelist: [], falselist: [] };
    }
    else if (node['accessField'] != undefined) {
        nodeRecursion(scope, node['accessField']!.obj, label);
        let prop = scope.getPropOffset(node['accessField']!.field);
        let ir = new IR('getfield', prop.offset, prop.size);
        return { lastIndex: ir.index, truelist: [], falselist: [] };
    }
    else if (node['immediate'] != undefined) {
        if (isNaN(Number(node["immediate"]!.primiviteValue))) {
            throw `暂时不支持字符串`;
        } else {
            let ir = new IR('const_i32_load', Number(node["immediate"]!.primiviteValue));
            return { lastIndex: ir.index, truelist: [], falselist: [] };
        }
    }
    else if (node['i32_+'] != undefined) {
        let ir1 = nodeRecursion(scope, node['+']!.leftChild, label);
        let ir2 = nodeRecursion(scope, node['+']!.rightChild, label);
        let ir = new IR('i32_add');
        return { lastIndex: ir.index, truelist: [], falselist: [] };
    }
    else if (node['i32_<'] != undefined) {
        nodeRecursion(scope, node['i32_<']!.leftChild, label);
        nodeRecursion(scope, node['i32_<']!.rightChild, label);
        let jmp: IR = new IR('i_if_ge');
        return { lastIndex: jmp.index, truelist: [], falselist: [jmp] };
    }
    else if (node['ternary'] != undefined) {
        let condition = node['ternary']!.condition;
        let a = nodeRecursion(scope, condition, label);
        let b = nodeRecursion(scope, node['ternary']!.obj1, label);
        let c = nodeRecursion(scope, node['ternary']!.obj2, label);
        backPatch(a.falselist, b.lastIndex - a.lastIndex + 1);//回填
        return { lastIndex: c.lastIndex, truelist: [], falselist: [] };
    }
    else { throw `还没支持的AST类型` };
}
function fieldAssign(type: TypeUsed, offset: number, falselist: IR[]): { lastIndex: number } {
    if (type.PlainType?.name == 'bool') {
        new IR('const_i8_load', 1);
        new IR('jmp', 2);
        backPatch(falselist, 3);//回填
        new IR('const_i8_load', 0);
    }
    if (type.PlainType && program.definedType[type.PlainType.name].modifier == 'valuetype') {
        let ir = new IR('putfield', offset, program.definedType[type.PlainType.name].size);
        return { lastIndex: ir.index };
    } else {
        let ir = new IR('putfield', offset, pointSize);
        return { lastIndex: ir.index };
    }
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
export default function programScan(primitiveProgram: Program) {
    program = primitiveProgram;
    let programScope = new ProgramScope(program, { program: program });
    new IR('new', program.size);
    new IR('p_store');
    //扫描property
    for (let variableName in program.property) {
        var prop = program.property[variableName];
        if (prop.initAST != undefined) {
            new IR('p_load');
            let nr = nodeRecursion(programScope, prop.initAST, []);
            let description = programScope.getPropOffset(variableName);
            fieldAssign(prop.type!, description.offset, nr.falselist);
        } else if (prop.type?.FunctionType) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!);
            functionScan(blockScope, prop.type?.FunctionType);
        } else {
            //使用default
        }
    }
    console.table(codes);
}