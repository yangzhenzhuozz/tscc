import { pointSize } from './constant.js';
import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
import { IR, codes } from './ir.js'
let program: Program;
function backPatch(list: IR[], target: IR) {
    for (let ir of list) {
        ir.operand = target.index - ir.index;
    }
}
function merge(a: IR[], b: IR[]) {
    for (let ir of b) {
        a.push(ir);
    }
}
/**
 * 
 * @param scope 
 * @param node 
 * @param label 
 * @param inFunction 是否在函数中，这个参数决定了this的取值方式
 * @returns 
 */
function nodeRecursion(scope: Scope, node: ASTNode, label: string[], inFunction: boolean): { startIR: IR, truelist: IR[], falselist: IR[] } {
    if (node['_program'] != undefined) {
        let ir = new IR('p_load');
        return { startIR: ir, truelist: [], falselist: [] };
    }
    else if (node['accessField'] != undefined) {
        let irs = nodeRecursion(scope, node['accessField']!.obj, label, inFunction);
        let prop = scope.getPropOffset(node['accessField']!.field);
        new IR('getfield', prop.offset, prop.size);
        return { startIR: irs.startIR, truelist: [], falselist: [] };
    }
    else if (node['immediate'] != undefined) {
        if (isNaN(Number(node["immediate"]!.primiviteValue))) {
            throw `暂时不支持字符串`;
        } else {
            let ir = new IR('const_i32_load', Number(node["immediate"]!.primiviteValue));
            return { startIR: ir, truelist: [], falselist: [] };
        }
    }
    else if (node['+'] != undefined) {
        let irs1 = nodeRecursion(scope, node['+']!.leftChild, label, inFunction);
        let irs2 = nodeRecursion(scope, node['+']!.rightChild, label, inFunction);
        if (node['+']!.leftChild.type?.PlainType?.name == 'int' && node['+']!.rightChild.type?.PlainType?.name == 'int') {
            let ir = new IR('i32_add');
        } else {
            throw `暂为支持的+操作`;
        }
        return { startIR: irs1.startIR, truelist: [], falselist: [] };
    }
    else if (node['<'] != undefined) {
        let irs1 = nodeRecursion(scope, node['<']!.leftChild, label, inFunction);
        let irs2 = nodeRecursion(scope, node['<']!.rightChild, label, inFunction);
        let jmp: IR;
        if (node['<']!.leftChild.type?.PlainType?.name == 'int' && node['<']!.rightChild.type?.PlainType?.name == 'int') {
            jmp = new IR('i_if_ge');
        } else {
            throw `暂为支持的+操作`;
        }
        return { startIR: irs1.startIR, truelist: [], falselist: [jmp] };
    }
    else if (node['ternary'] != undefined) {
        let condition = node['ternary']!.condition;
        let a = nodeRecursion(scope, condition, label, inFunction);
        let falselist: IR[] = [];
        if (a.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('if_ne');
            falselist.push(ir);
        }
        let b = nodeRecursion(scope, node['ternary']!.obj1, label, inFunction);
        let c = nodeRecursion(scope, node['ternary']!.obj2, label, inFunction);
        if (a.falselist.length == 0) {
            backPatch(falselist, c.startIR);//回填
        } else {
            backPatch(a.falselist, c.startIR);//回填
        }
        return { startIR: a.startIR, truelist: [], falselist: [] };
    }
    else { throw `还没支持的AST类型` };
}
function fieldAssign(type: TypeUsed, offset: number, falselist: IR[]): { lastIndex: number } {
    if (falselist.length > 0) {
        new IR('const_i8_load', 1);
        new IR('jmp', 2);
        let falseIR = new IR('const_i8_load', 0);
        backPatch(falselist, falseIR);//回填
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
    throw `unimplemented`
}
function BlockScan(blockScope: BlockScope, label: string[]): IR[] {
    throw `unimplemented`
}
function functionScan(blockScope: BlockScope, fun: FunctionType): IR[] {
    throw `unimplemented`
}
function classScan(classScope: ClassScope) {

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
            let nr = nodeRecursion(programScope, prop.initAST, [], false);
            let description = programScope.getPropOffset(variableName);
            fieldAssign(prop.type!, description.offset, nr.falselist);
        } else if (prop.type?.FunctionType) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!);
            functionScan(blockScope, prop.type?.FunctionType);
        } else {
            //使用default
            defalutValue(program.property[variableName].type!);
        }
    }
    //扫描definedType
    for (let typeName in program.definedType) {
        classScan(programScope.getClassScope(typeName));
    }
    console.table(codes);
}