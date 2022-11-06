import { pointSize } from './constant.js';
import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
let program: Program;
function nodeRecursion(scope: Scope, node: ASTNode, label: string[]): IR[] {
    if (node['_program'] != undefined) {
        return [{ opCode: 'p_load' }];
    }
    else if (node['accessField'] != undefined) {
        let r = nodeRecursion(scope, node['accessField']!.obj, label);
        let prop = scope.getPropOffset(node['accessField']!.field);
        r.push({ opCode: 'getfield', opSize: prop.size, operand: prop.offset });
        return r;
    }
    else if (node['immediate'] != undefined) {
        if (isNaN(Number(node["immediate"]!.primiviteValue))) {
            throw `暂时不支持字符串`;
        } else {
            return [{ opCode: 'const_i32_load', operand: Number(node["immediate"]!.primiviteValue) }];
        }
    }
    else if (node['+'] != undefined) {
        let r1 = nodeRecursion(scope, node['+']!.leftChild, label);
        let r2 = nodeRecursion(scope, node['+']!.rightChild, label);
        r1.push(...r2);
        r1.push({ opCode: 'i32_add' });
        return r1;
    }
    else if (node['<'] != undefined) {
        let r1 = nodeRecursion(scope, node['<']!.leftChild, label);
        let r2 = nodeRecursion(scope, node['<']!.rightChild, label);
        r1.push(...r2);//比较指令由使用者添加
        return r1;
    }
    else if (node['ternary'] != undefined) {
        let condition = node['ternary']!.condition;
        let r1: IR[] = nodeRecursion(scope, condition, label);
        let jmp: IR;
        if (condition['<'] != undefined) {//判断condition是不是< > == !=这些指令,决定用if_lt、if_gt还是if_eq
            jmp = { opCode: 'if_ge' };
        } else {
            jmp = { opCode: 'if_ne' };
        }
        r1.push(jmp);
        let r2 = nodeRecursion(scope, node['ternary']!.obj1, label);
        jmp.operand = r2.length + 1;
        let r3 = nodeRecursion(scope, node['ternary']!.obj2, label);
        r1.push(...r2)
        r1.push(...r3)
        return r1;
    }
    else { throw `还没支持的AST类型` };
}
function fieldAssign(type: TypeUsed, offset: number): IR {
    if (type.PlainType && program.definedType[type.PlainType.name].modifier == 'valuetype') {
        return { opCode: 'putfield', opSize: program.definedType[type.PlainType.name].size, operand: offset };
    } else {
        return { opCode: 'putfield', opSize: pointSize, operand: offset };
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
let programInit: IR[] = [];
export default function programScan(primitiveProgram: Program) {
    program = primitiveProgram;
    let programScope = new ProgramScope(program, { program: program });
    let programInitCode: IR[] | undefined = undefined;
    //扫描property
    for (let variableName in program.property) {
        var prop = program.property[variableName];
        if (prop.initAST != undefined) {
            let code = [] as IR[];
            code.push({ opCode: 'p_load' });
            code.push(...nodeRecursion(programScope, prop.initAST, []));
            let description = programScope.getPropOffset(variableName);
            code.push(fieldAssign(prop.type!, description.offset));
            if (programInitCode == undefined) {
                programInitCode = code
            } else {
                programInitCode.push(...code)
            }
        } else if (prop.type?.FunctionType) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!);
            functionScan(blockScope, prop.type?.FunctionType);
        } else {
            //使用default
        }
    }
    console.table(programInitCode);
}