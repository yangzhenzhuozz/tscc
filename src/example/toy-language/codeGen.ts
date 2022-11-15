import { globalVariable } from './constant.js';
import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
import { IR, codes } from './ir.js'
let program: Program;
let programScope: ProgramScope;
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
 * @param argumentMap 函数参数的补偿和size
 * @returns 
 */
function nodeRecursion(scope: Scope, node: ASTNode, label: string[], inFunction: boolean, argumentMap: { offset: number, size: number }[]): { startIR: IR, endIR: IR, truelist: IR[], falselist: IR[] } {
    if (node['_program'] != undefined) {
        let ir = new IR('p_load');
        return { startIR: ir, endIR: ir, truelist: [], falselist: [] };
    }
    else if (node['accessField'] != undefined) {
        let irs = nodeRecursion(scope, node['accessField']!.obj, label, inFunction, argumentMap);
        let type = node['accessField']!.obj.type!;
        let baseScope: Scope;
        if (type.ProgramType != undefined) {
            baseScope = programScope;
        } else if (type.PlainType != undefined) {
            baseScope = programScope.getClassScope(type.PlainType.name);
        } else {
            throw `其他类型暂时不能访问成员`;
        }
        let prop = baseScope.getPropOffset(node['accessField']!.field);
        let ir = new IR('getfield', prop.offset, prop.size);
        return { startIR: irs.startIR, endIR: ir, truelist: [], falselist: [] };
    }
    else if (node['immediate'] != undefined) {
        if (isNaN(Number(node["immediate"]!.primiviteValue))) {
            throw `暂时不支持字符串`;
        } else {
            let ir = new IR('const_i32_load', Number(node["immediate"]!.primiviteValue));
            return { startIR: ir, endIR: ir, truelist: [], falselist: [] };
        }
    }
    else if (node['+'] != undefined) {
        let irs1 = nodeRecursion(scope, node['+']!.leftChild, label, inFunction, argumentMap);
        let irs2 = nodeRecursion(scope, node['+']!.rightChild, label, inFunction, argumentMap);
        let ir: IR;
        if (node['+']!.leftChild.type?.PlainType?.name == 'int' && node['+']!.rightChild.type?.PlainType?.name == 'int') {
            ir = new IR('i32_add');
        } else {
            throw `暂为支持的+操作`;
        }
        return { startIR: irs1.startIR, endIR: ir, truelist: [], falselist: [] };
    }
    else if (node['<'] != undefined) {
        let irs1 = nodeRecursion(scope, node['<']!.leftChild, label, inFunction, argumentMap);
        let irs2 = nodeRecursion(scope, node['<']!.rightChild, label, inFunction, argumentMap);
        let jmp: IR;
        if (node['<']!.leftChild.type?.PlainType?.name == 'int' && node['<']!.rightChild.type?.PlainType?.name == 'int') {
            jmp = new IR('i_if_ge');
        } else {
            throw `暂为支持的+操作`;
        }
        return { startIR: irs1.startIR, endIR: irs2.endIR, truelist: [], falselist: [jmp] };
    }
    else if (node['ternary'] != undefined) {
        let condition = node['ternary']!.condition;
        let a = nodeRecursion(scope, condition, label, inFunction, argumentMap);
        let falselist: IR[] = [];
        if (a.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('if_ne');
            falselist.push(ir);
        }
        let b = nodeRecursion(scope, node['ternary']!.obj1, label, inFunction, argumentMap);
        let ir = new IR('jmp');
        let c = nodeRecursion(scope, node['ternary']!.obj2, label, inFunction, argumentMap);
        ir.operand = c.endIR.index - ir.index + 1;
        if (a.falselist.length == 0) {
            backPatch(falselist, c.startIR);//回填
        } else {
            backPatch(a.falselist, c.startIR);//回填
        }
        return { startIR: a.startIR, endIR: c.endIR, truelist: [], falselist: [] };
    } else if (node['_this'] != undefined) {
        if (inFunction) {
            let loadFunctionBase = new IR('v_load', 0);
            let loadThis = new IR('v_load', 0);//函数中的this需要load两次才能拿到正确的this
            return { startIR: loadFunctionBase, endIR: loadThis, truelist: [], falselist: [] };;
        } else {
            let ir = new IR('v_load', 0);
            return { startIR: ir, endIR: ir, truelist: [], falselist: [] };;
        }
    } else if (node['def'] != undefined) {
        let blockScope = (scope as BlockScope);//def节点是block专属
        let name = Object.keys(node['def'])[0];
        blockScope.setProp(name, node['def'][name]);
        if (node['def'][name].initAST != undefined) {
            let description = blockScope.getPropOffset(name);
            let nr = nodeRecursion(blockScope, node['def'][name].initAST!, label, inFunction, argumentMap);
            let assginment = new IR('v_store', description.offset, description.size);
            return { startIR: nr.startIR, endIR: assginment, truelist: [], falselist: [] };
        } else {
            //如果没有init命令则使用defalut
            return defalutValue(node['def'][name].type!);
        }
    }
    else if (node['loadArgument'] != undefined) {
        let argDesc = argumentMap![node['loadArgument'].index];
        let ir = new IR('v_load', -argDesc.offset, argDesc.size);
        return { startIR: ir, endIR: ir, truelist: [], falselist: [] };
    }
    else if (node['load'] != undefined) {
        let desc = (scope as BlockScope).getPropOffset(node['load']);
        let ir = new IR('v_load', desc.offset, desc.size);
        return { startIR: ir, endIR: ir, truelist: [], falselist: [] };
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
        let ir = new IR('putfield', offset, globalVariable.pointSize);
        return { lastIndex: ir.index };
    }
}
function defalutValue(type: TypeUsed): { startIR: IR, endIR: IR, truelist: IR[], falselist: IR[] } {
    // throw `unimplemented`
    return {} as any;
}
function BlockScan(blockScope: BlockScope, label: string[], argumentMap: { offset: number, size: number }[]) {
    for (let i = 0; i < blockScope.block!.body.length; i++) {
        let nodeOrBlock = blockScope.block!.body[i];
        if (nodeOrBlock.desc == 'ASTNode') {
            nodeRecursion(blockScope, nodeOrBlock as ASTNode, label, true, argumentMap);
        } else {
            let block = nodeOrBlock as Block;
            BlockScan(new BlockScope(blockScope, undefined, block, { program }), label, argumentMap);
        }
    }
}
function propSize(type: TypeUsed): number {
    if (type.PlainType != undefined) {
        if (program.definedType[type.PlainType.name].modifier == 'valuetype') {
            return program.definedType[type.PlainType.name].size!;
        } else {
            return globalVariable.pointSize;
        }
    } else {
        return globalVariable.pointSize;
    }
}
let functionIndex = 0;
function functionGen(blockScope: BlockScope, fun: FunctionType) {
    let argumentMap: { offset: number, size: number }[] = [];
    let argOffset = 0;
    for (let argumentName in fun._arguments) {
        let size = propSize(fun._arguments[argumentName].type!);
        argOffset += size;
        argumentMap.push({ offset: argOffset, size: size });
    }
    let wrapName = `@functionWrap_${functionIndex++}`;
    let property: VariableDescriptor = {};
    //为函数对象创建两个基本值
    property['@this'] = {
        variable: 'val',
        type: {
            PlainType: { name: '@point' }
        }
    };
    property['@exec'] = {
        variable: 'val',
        type: {
            PlainType: { name: '@point' }
        }
    };
    for (let c in fun.capture) {
        property[c] = {
            variable: 'val',
            type: fun.capture[c]
        };
    }
    //注册函数容器
    let typeIndex = globalVariable.typeIndex++;
    program.definedType[wrapName] = {
        operatorOverload: {},
        _constructor: {},
        property: property,
        size: globalVariable.pointSize + Object.keys(fun.capture).length * globalVariable.pointSize,
        typeIndex: typeIndex
    };
    programScope.registerClassForCapture(wrapName);//注册类型
    let start = new IR('new', typeIndex);
    let end: IR;
    new IR('dup', undefined, globalVariable.pointSize);
    let _thisDesc = programScope.getClassScope(wrapName).getPropOffset('@this');
    end = new IR('putfield', _thisDesc.offset, propSize(programScope.getClassScope(wrapName).getProp('@this').prop.type!));
    let capturedNames = Object.keys(fun.capture);
    if (capturedNames.length > 0) {
        for (let capturedName of capturedNames) {
            new IR('dup', undefined, propSize(blockScope.getProp(capturedName).prop.type!));
            //把待捕获的变量复制到函数容器中
        }
    }
    BlockScan(blockScope, [], argumentMap);
}
function classScan(classScope: ClassScope) {
    //扫描property
    for (let propName of classScope.getPropNames()) {
        let prop = classScope.getProp(propName).prop;
        if (prop.initAST != undefined) {
            new IR('v_load', 0);
            let nr = nodeRecursion(classScope, prop.initAST, [], false, []);
            let description = classScope.getPropOffset(propName);
            fieldAssign(prop.type!, description.offset, nr.falselist);
        } else if (prop.type?.FunctionType) {
            let blockScope = new BlockScope(classScope, prop.type?.FunctionType, prop.type?.FunctionType.body!, { program });
            functionGen(blockScope, prop.type?.FunctionType);
            console.log('创建函数对象之后调用fieldAssign');
        } else {
            //使用default
            defalutValue(prop.type!);
        }
    }
}
let symbolTable: { [key: string]: number } = {};//符号表
export default function programScan(primitiveProgram: Program) {
    program = primitiveProgram;
    programScope = new ProgramScope(program, { program: program });
    program.definedType['@point'] = {
        modifier: 'valuetype',
        property: {},
        operatorOverload: {},
        _constructor: {},
        size:globalVariable.pointSize
    };
    programScope.registerClassForCapture('@point');//注册类型
    //扫描property
    for (let variableName in program.property) {
        var prop = program.property[variableName];
        if (prop.initAST != undefined) {
            new IR('p_load');
            let nr = nodeRecursion(programScope, prop.initAST, [], false, []);
            let description = programScope.getPropOffset(variableName);
            fieldAssign(prop.type!, description.offset, nr.falselist);
        } else if (prop.type?.FunctionType) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!, { program });
            functionGen(blockScope, prop.type?.FunctionType);
        } else {
            //使用default
            defalutValue(program.property[variableName].type!);
        }
    }
    new IR('ret');
    symbolTable['program_init'] = 0;//program初始化程序在位置0
    //扫描definedType
    for (let typeName in program.definedType) {
        classScan(programScope.getClassScope(typeName));
    }
    console.table(codes);
}