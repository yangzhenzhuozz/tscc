import fs from 'fs';
import { irAbsoluteAddressRelocationTable, globalVariable, registerType, stackFrameTable, stackFrameRelocationTable, typeRelocationTable, typeTableToBin, typeTable } from './ir.js';
import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
import { IR, IRContainer } from './ir.js'
import { FunctionSign, FunctionSignWithArgumentAndRetType, TypeUsedSign } from './lib.js';
import { classTable, stringPool, typeItemDesc, typeTable as binTypeTable, stackFrameTable as binStackFrameTable, link } from './binaryTools.js'
/**
 * 经过几轮扫描，有一些步骤是重复的，为了能清晰掌握每个步骤的顺序(其实就是在设计前一步的时候不知道后面应该怎么做，要做什么，想起来已经晚了)，先将就用着吧
 */
let program: Program;
let programScope: ProgramScope;
/**
 * 
 * @param list 
 * @param target 
 * @param offset 补偿，默认为0
 */
function backPatch(list: IR[], target: IR, offset = 0) {
    for (let ir of list) {
        ir.operand1 = target.index - ir.index + offset;
    }
}
function merge(a: IR[], b: IR[]) {
    return a.concat(b);
}
/**
 * 判断类型是否为指针类型
 * @param type 
 * @returns 
 */
function isPointType(type: TypeUsed): boolean {
    if (type.PlainType?.name) {
        if (program.definedType[type.PlainType!.name].modifier == 'valuetype') {
            return false;
        } else {
            return true;
        }
    } else {
        return true;
    }
}
/**
 * 
 * @param scope 
 * @param node 
 * @param label 
 * @param inFunction 是否在函数中，这个参数决定了this的取值方式
 * @param argumentMap 函数参数的补偿和size，只用于loadArgument节点
 * @param boolNot 布尔运算的时候是否要取反向生成操作符，'||'和'&&'对leftObj采取的比较跳转指令不同，默认取反可以节约指令
 * @returns 
 */
function nodeRecursion(scope: Scope, node: ASTNode, label: string[], inFunction: boolean, argumentMap: { offset: number, type: TypeUsed }[], frameLevel: number, boolNot: boolean = true): { startIR: IR, endIR: IR, truelist: IR[], falselist: IR[], jmpToFunctionEnd?: IR[] } {
    if (node['_program'] != undefined) {
        let ir = new IR('program_load');
        return { startIR: ir, endIR: ir, truelist: [], falselist: [] };
    }
    else if (node['accessField'] != undefined) {
        let irs = nodeRecursion(scope, node['accessField']!.obj, label, inFunction, argumentMap, frameLevel, boolNot);
        let type = node['accessField']!.obj.type!;
        let baseScope: Scope;
        if (type.ProgramType != undefined) {
            baseScope = programScope;
        } else if (type.PlainType != undefined) {
            baseScope = programScope.getClassScope(type.PlainType.name);
        } else {
            throw `其他类型暂时不能访问成员`;
        }
        let offset = baseScope.getPropOffset(node['accessField']!.field);
        let ir: IR;
        if (isPointType(type)) {
            ir = new IR('p_getfield', offset);
        } else {
            if (type.PlainType?.name == 'int') {
                ir = new IR('i32_getfield', offset);//读取被捕获变量
            } else {
                throw `暂时不支持类型:${type.PlainType?.name}的getfield`;
            }
        }
        return { startIR: irs.startIR, endIR: ir, truelist: [], falselist: [] };
    }
    else if (node['immediate'] != undefined) {
        if (node["immediate"].functionValue) {
            let blockScope = new BlockScope(scope, node["immediate"].functionValue, node["immediate"].functionValue.body!, { program });
            let fun = functionGen(blockScope, node["immediate"].functionValue);
            let functionWrapScpoe = programScope.getClassScope(fun.wrapClassName);
            let this_type = functionWrapScpoe.getProp(`@this`).prop.type!;
            let this_offset = functionWrapScpoe.getPropOffset(`@this`);//this指针在函数包裹类中的offset
            let startIR = new IR('newFunc', undefined, undefined, undefined);
            irAbsoluteAddressRelocationTable.push({ sym: fun.text, ir: startIR });
            typeRelocationTable.push({ t2: fun.realTypeName, t3: fun.wrapClassName, ir: startIR });
            let endIR: IR | undefined;
            if (blockScope.classScope != undefined) {
                //如果是在class中定义的函数，设置this
                new IR('p_dup');//复制一份functionWrap，用来设置this
                new IR('p_load', 0);//读取this
                endIR = putfield(this_type, this_offset, [], []);//设置this
            }
            let capture = node["immediate"].functionValue.capture;
            for (let capturedName in capture) {//设置捕获变量
                let captureOffset = blockScope.getPropOffset(capturedName);//当前scope被捕获对象的描述符
                let captureType = blockScope.getProp(capturedName).prop.type!;//被捕获对象的类型(已经是包裹类)
                let targetOffset = functionWrapScpoe.getPropOffset(capturedName);//捕获对象在被包裹类中的描述符
                new IR('p_dup');//复制函数对象的指针
                new IR('p_load', captureOffset);//读取被捕获变量
                endIR = putfield(captureType, targetOffset, [], []);
            }
            return { startIR: startIR, endIR: endIR ?? startIR, truelist: [], falselist: [] };
        } else {
            if (isNaN(Number(node["immediate"]!.primiviteValue))) {
                throw `暂时不支持非数字的initAST`;//就剩下字符串类型了
            } else {
                let ir = new IR('const_i32_load', Number(node["immediate"]!.primiviteValue));
                return { startIR: ir, endIR: ir, truelist: [], falselist: [] };
            }
        }
    }
    else if (node['+'] != undefined) {
        let left = nodeRecursion(scope, node['+']!.leftChild, label, inFunction, argumentMap, frameLevel, boolNot);
        let right = nodeRecursion(scope, node['+']!.rightChild, label, inFunction, argumentMap, frameLevel, boolNot);
        let opIR: IR;
        if (node['+']!.leftChild.type?.PlainType?.name == 'int' && node['+']!.rightChild.type?.PlainType?.name == 'int') {
            opIR = new IR('i32_add');
        } else {
            throw `暂为支持的+操作`;
        }
        return { startIR: left.startIR, endIR: opIR, truelist: [], falselist: [] };
    }
    else if (node['<'] != undefined) {
        let left = nodeRecursion(scope, node['<']!.leftChild, label, inFunction, argumentMap, frameLevel, boolNot);
        let right = nodeRecursion(scope, node['<']!.rightChild, label, inFunction, argumentMap, frameLevel, boolNot);
        let opIR: IR;
        let tureList: IR[] = [];
        let falseList: IR[] = [];
        if (node['<']!.leftChild.type?.PlainType?.name == 'int' && node['<']!.rightChild.type?.PlainType?.name == 'int') {
            if (boolNot) {
                opIR = new IR('i_if_ge');
                falseList.push(opIR)
            } else {
                opIR = new IR('i_if_lt');
                tureList.push(opIR)
            }
        } else {
            throw `暂为支持的+操作`;
        }
        return { startIR: left.startIR, endIR: opIR, truelist: tureList, falselist: falseList };
    }
    else if (node['ternary'] != undefined) {
        let condition = node['ternary']!.condition;
        let a = nodeRecursion(scope, condition, label, inFunction, argumentMap, frameLevel, boolNot);
        if (a.truelist.length == 0 && a.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('i_if_ne');
            a.falselist.push(ir);
        }
        let b = nodeRecursion(scope, node['ternary']!.obj1, label, inFunction, argumentMap, frameLevel, boolNot);
        let ir = new IR('jmp');
        let c = nodeRecursion(scope, node['ternary']!.obj2, label, inFunction, argumentMap, frameLevel, boolNot);
        ir.operand1 = c.endIR.index - ir.index + c.endIR.length;
        backPatch(a.truelist, b.startIR);//回填trueList
        backPatch(a.falselist, c.startIR);//回填falseList
        return { startIR: a.startIR, endIR: c.endIR, truelist: [], falselist: [] };
    } else if (node['_this'] != undefined) {
        if (inFunction) {
            let loadFunctionBase = new IR('p_load', 0);
            let loadThis = new IR('p_getfield', 0);//拿到正确的this
            return { startIR: loadFunctionBase, endIR: loadThis, truelist: [], falselist: [] };;
        } else {
            let ir = new IR('p_load', 0);
            return { startIR: ir, endIR: ir, truelist: [], falselist: [] };;
        }
    } else if (node['def'] != undefined) {
        let blockScope = (scope as BlockScope);//def节点是block专属
        let name = Object.keys(node['def'])[0];
        blockScope.setProp(name, node['def'][name]);
        let offset = blockScope.getPropOffset(name);
        if (node['def'][name].initAST != undefined) {
            let nr = nodeRecursion(blockScope, node['def'][name].initAST!, label, inFunction, argumentMap, frameLevel, boolNot);
            if (nr.truelist.length > 0 || nr.falselist.length > 0) {
                let trueIR = new IR('const_i8_load', 1);
                let jmp = new IR('jmp');
                let falseIR = new IR('const_i8_load', 0);
                jmp.operand1 = falseIR.index - jmp.index + falseIR.length
                backPatch(nr.truelist, trueIR);//回填true
                backPatch(nr.falselist, falseIR);//回填false
            }
            let assginment: IR;
            if (isPointType(node['def'][name].type!)) {
                assginment = new IR('p_store', offset);
            } else {
                if (node['def'][name].type!.PlainType!.name == 'int') {
                    assginment = new IR('i32_store', offset);
                } else {
                    throw `暂时不支持类型:${node['def'][name].type!.PlainType!.name}的store`;
                }
            }
            return { startIR: nr.startIR, endIR: assginment, truelist: [], falselist: [] };
        } else if (node['def'][name].type?.FunctionType && node['def'][name].type?.FunctionType?.body) {//如果是函数定义则生成函数
            let blockScope = new BlockScope(scope, node['def'][name].type?.FunctionType, node['def'][name].type?.FunctionType?.body!, { program });
            let fun = functionGen(blockScope, node['def'][name].type?.FunctionType!);
            let functionWrapScpoe = programScope.getClassScope(fun.wrapClassName);
            let this_type = functionWrapScpoe.getProp(`@this`).prop.type!;
            let startIR = new IR('newFunc', undefined, undefined, undefined);
            irAbsoluteAddressRelocationTable.push({ sym: fun.text, ir: startIR });
            typeRelocationTable.push({ t2: fun.realTypeName, t3: fun.wrapClassName, ir: startIR });
            if (blockScope.classScope != undefined) {
                //如果是在class中定义的函数，设置this
                new IR('p_dup');//复制一份functionWrap，用来设置this
                new IR('p_load', 0);//读取this
                new IR('p_putfield', 0);//设置this到functionWrap
            }
            let endIR = new IR('p_store', offset);
            let capture = node['def'][name].type!.FunctionType!.capture;
            for (let capturedName in capture) {//设置捕获变量
                let capturedOffset = blockScope.getPropOffset(capturedName);//当前scope被捕获对象的描述符
                let capturedType = blockScope.getProp(capturedName).prop.type!;//被捕获对象的类型(已经是包裹类)
                let targetOffset = functionWrapScpoe.getPropOffset(capturedName);//捕获对象在被包裹类中的描述符
                new IR('p_load', offset);//读取函数对象的指针
                if (isPointType(blockScope.getProp(name).prop.type!)) {
                    new IR('p_load', capturedOffset);//读取被捕获变量
                } else {
                    if (blockScope.getProp(name).prop.type!.PlainType?.name == 'int') {
                        new IR('i32_load', capturedOffset);//读取被捕获变量
                    } else {
                        throw `暂时不支持类型:${node['def'][name].type!.PlainType!.name}的store`;
                    }
                }
                endIR = putfield(capturedType, targetOffset, [], []);
            }
            return { startIR: startIR, endIR: endIR, truelist: [], falselist: [] };
        } else {
            //如果没有init命令则使用defalut
            return defalutValue(node['def'][name].type!);
        }
    }
    else if (node['loadArgument'] != undefined) {
        let argDesc = argumentMap![node['loadArgument'].index];
        let ir: IR;
        if (isPointType(argDesc.type)) {
            ir = new IR('p_load', -argDesc.offset);
        } else {
            if (argDesc.type!.PlainType?.name == 'int') {
                ir = new IR('i32_load', -argDesc.offset);
            } else {
                throw `暂时不支持类型:${argDesc.type!.PlainType?.name}的store`;
            }
        }
        return { startIR: ir, endIR: ir, truelist: [], falselist: [] };
    }
    else if (node['load'] != undefined) {
        let type = (scope as BlockScope).getProp(node['load']).prop.type!;
        let offset = (scope as BlockScope).getPropOffset(node['load']);
        let ir: IR;
        if (isPointType(type)) {
            ir = new IR('p_load', offset);
        } else {
            if (type!.PlainType?.name == 'int') {
                ir = new IR('i32_load', offset);
            } else {
                throw `暂时不支持类型:${type!.PlainType?.name}的store`;
            }
        }
        return { startIR: ir, endIR: ir, truelist: [], falselist: [] };
    }
    else if (node['_new'] != undefined) {
        let ir = new IR('_new', undefined, undefined, undefined);
        typeRelocationTable.push({ t1: node['_new'].type.PlainType.name, ir: ir });
        let call = new IR('abs_call', undefined, undefined, undefined);
        irAbsoluteAddressRelocationTable.push({ sym: `${node['_new'].type.PlainType.name}_init`, ir: call });
        let argTypes: TypeUsed[] = [];
        let args = node['_new']._arguments;
        for (let i = args.length - 1; i >= 0; i--) {
            argTypes.push(args[args.length - 1 - i].type!);//顺序获取type
            nodeRecursion(scope, args[i], label, inFunction, argumentMap, frameLevel, boolNot);//逆序压参
        }
        let sign = `@constructor:${node['_new'].type.PlainType.name}  ${FunctionSignWithArgumentAndRetType(argTypes, { PlainType: { name: 'void' } })}`;//构造函数签名
        call = new IR('abs_call', undefined, undefined, undefined);//执行调用
        irAbsoluteAddressRelocationTable.push({ sym: sign, ir: call });
        return { startIR: ir, endIR: call, truelist: [], falselist: [] };
    }
    else if (node['||'] != undefined) {
        let left = nodeRecursion(scope, node['||'].leftChild, label, inFunction, argumentMap, frameLevel, false);
        if (left.falselist.length == 0 && left.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            left.truelist.push(new IR('i_if_eq'));
        }
        let right = nodeRecursion(scope, node['||'].rightChild, label, inFunction, argumentMap, frameLevel, boolNot);
        let endIR: IR;
        if (right.falselist.length == 0 && right.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            endIR = new IR('i_if_ne')
            right.falselist.push(endIR);
        } else {
            endIR = right.endIR;
        }
        backPatch(left.falselist, right.startIR);
        let truelist = merge(left.truelist, right.truelist);
        return { startIR: left.startIR, endIR: endIR, truelist: truelist, falselist: right.falselist };
    }
    else if (node['&&'] != undefined) {
        let left = nodeRecursion(scope, node['&&'].leftChild, label, inFunction, argumentMap, frameLevel, boolNot);
        if (left.falselist.length == 0 && left.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            left.falselist.push(new IR('i_if_ne'));
        }
        let right = nodeRecursion(scope, node['&&'].rightChild, label, inFunction, argumentMap, frameLevel, boolNot);
        let endIR: IR;
        if (right.falselist.length == 0 && right.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            endIR = new IR('i_if_ne');
            right.falselist.push(endIR);
        } else {
            endIR = right.endIR;
        }
        backPatch(left.truelist, right.startIR);
        let falselist = merge(left.falselist, right.falselist);
        return { startIR: left.startIR, endIR: endIR, truelist: right.truelist, falselist: falselist };
    }
    else if (node['ifElseStmt'] != undefined) {
        let condition = nodeRecursion(scope, node['ifElseStmt'].condition, label, inFunction, argumentMap, frameLevel, boolNot);
        if (condition.truelist.length == 0 && condition.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('i_if_ne');
            condition.falselist.push(ir);
        }
        let block1Ret = BlockScan(new BlockScope(scope, undefined, node['ifElseStmt'].stmt1, { program }), label, argumentMap, frameLevel + 1);
        let jmp = new IR('jmp');
        let block2Ret = BlockScan(new BlockScope(scope, undefined, node['ifElseStmt'].stmt2, { program }), label, argumentMap, frameLevel + 1);
        jmp.operand1 = block2Ret.endIR.index - jmp.index + block2Ret.endIR.length;
        backPatch(condition.truelist, block1Ret.startIR);
        backPatch(condition.falselist, block2Ret.startIR);
        return { startIR: condition.startIR, endIR: block2Ret.endIR, truelist: [], falselist: [], jmpToFunctionEnd: block1Ret.jmpToFunctionEnd.concat(block2Ret.jmpToFunctionEnd) };
    }
    else if (node['ifStmt'] != undefined) {
        let condition = nodeRecursion(scope, node['ifStmt'].condition, label, inFunction, argumentMap, frameLevel, boolNot);
        if (condition.truelist.length == 0 && condition.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('i_if_ne');
            condition.falselist.push(ir);
        }
        let blockRet = BlockScan(new BlockScope(scope, undefined, node['ifStmt'].stmt, { program }), label, argumentMap, frameLevel + 1);
        backPatch(condition.truelist, blockRet.startIR);
        backPatch(condition.falselist, blockRet.endIR, 1);
        return { startIR: condition.startIR, endIR: blockRet.endIR, truelist: [], falselist: [], jmpToFunctionEnd: blockRet.jmpToFunctionEnd };
    }
    else if (node['ret'] != undefined) {
        let startIR: IR;
        let jmpToFunctionEnd: IR[] = [];
        if (node['ret'] != '') {
            let ret = nodeRecursion(scope, node['ret'], label, inFunction, argumentMap, frameLevel, boolNot);
            startIR = ret.startIR;
            if (ret.truelist.length > 0 || ret.falselist.length > 0) {//如果需要回填，则说明是一个bool表达式
                let trueIR = new IR('const_i8_load', 1);
                let jmp = new IR('jmp');
                let falseIR = new IR('const_i8_load', 0);
                jmp.operand1 = falseIR.index - jmp.index + falseIR.length;
                backPatch(ret.truelist, trueIR);//回填true
                backPatch(ret.falselist, falseIR);//回填false
            }
            new IR('pop_stack_map', frameLevel);
            let jmp = new IR('jmp');
            jmpToFunctionEnd.push(jmp);
        } else {//无条件返回语句
            startIR = new IR('jmp');
            new IR('pop_stack_map', frameLevel);
            jmpToFunctionEnd.push(startIR);
        }
        return { startIR: startIR, endIR: jmpToFunctionEnd[0], truelist: [], falselist: [], jmpToFunctionEnd: jmpToFunctionEnd };
    } else if (node['call'] != undefined) {
        let startIR: IR | undefined = undefined;
        //参数逆序压栈
        for (let i = node['call']._arguments.length - 1; i >= 0; i--) {
            let nodeRet = nodeRecursion(scope, node['call']._arguments[i], label, inFunction, argumentMap, frameLevel, boolNot);
            if (startIR == undefined) {
                startIR = nodeRet.startIR;
            }
        }
        //获取函数对象
        let nodeRet = nodeRecursion(scope, node['call'].functionObj, label, inFunction, argumentMap, frameLevel, boolNot);
        if (startIR == undefined) {
            startIR = nodeRet.startIR;
        }
        let call = new IR('call');
        return { startIR: startIR, endIR: call, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    else if (node['_newArray'] != undefined) {
        let startIR: IR | undefined = undefined;
        let initList = node['_newArray'].initList;
        let placeholder = node['_newArray'].placeholder;
        let type: TypeUsed = node['_newArray'].type;
        for (let i = 0; i < initList.length + placeholder; i++) {
            type = { ArrayType: { innerType: type } };
        }
        for (let ast of initList) {
            let astRet = nodeRecursion(scope, ast, label, inFunction, argumentMap, frameLevel, boolNot);
            if (startIR == undefined) {
                startIR = astRet.startIR;
            }
        }
        let typeName = TypeUsedSign(type);
        let newArray = new IR('newArray', initList.length + placeholder, undefined, undefined);
        typeRelocationTable.push({ t1: typeName, ir: newArray });
        return { startIR: startIR!, endIR: newArray, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    else if (node['_break'] != undefined) {
        //需要考虑StackFrame
        throw `_break暂未实现`;
    }
    else if (node['_continue'] != undefined) {
        //需要考虑StackFrame
        throw `_continue暂未实现`;
    }
    else { throw `还没支持的AST类型` };
}
function putfield(type: TypeUsed, offset: number, truelist: IR[], falselist: IR[]): IR {
    if (truelist.length > 0 || falselist.length > 0) {
        let trueIR = new IR('const_i8_load', 1);
        let jmp = new IR('jmp');
        let falseIR = new IR('const_i8_load', 0);
        jmp.operand1 = falseIR.index - jmp.index + falseIR.length;
        backPatch(truelist, trueIR);//回填true
        backPatch(falselist, falseIR);//回填false
    }
    let endIR: IR;
    if (type.PlainType && program.definedType[type.PlainType.name].modifier == 'valuetype') {
        if (type.PlainType.name == 'int') {
            endIR = new IR('i32_putfield', offset);
        } else {
            throw `暂时不支持类型:${type!.PlainType?.name}的putfield`;
        }
    } else {//非值类型的copy统统按照指针处理
        endIR = new IR('p_putfield', offset);
    }
    return endIR;
}
function defalutValue(type: TypeUsed): { startIR: IR, endIR: IR, truelist: IR[], falselist: IR[] } {
    // throw `unimplemented`
    //要注意valueType的嵌套
    return {} as any;
}
function BlockScan(blockScope: BlockScope, label: string[], argumentMap: { offset: number, type: TypeUsed }[], frameLevel: number): { startIR: IR, endIR: IR, jmpToFunctionEnd: IR[] } {
    let stackFrameMapIndex = globalVariable.stackFrameMapIndex++;
    let startIR = new IR('push_stack_map', undefined, undefined, undefined);
    let endIR: IR;
    stackFrameRelocationTable.push({ sym: `@StackFrame_${stackFrameMapIndex}`, ir: startIR });
    let jmpToFunctionEnd: IR[] = [];//记录所有返回指令;
    for (let i = 0; i < blockScope.block!.body.length; i++) {
        let nodeOrBlock = blockScope.block!.body[i];
        if (nodeOrBlock.desc == 'ASTNode') {
            let nodeRet = nodeRecursion(blockScope, nodeOrBlock as ASTNode, label, true, argumentMap, frameLevel);
            endIR = nodeRet.endIR;
            if (nodeRet.jmpToFunctionEnd) {
                jmpToFunctionEnd = jmpToFunctionEnd.concat(nodeRet.jmpToFunctionEnd);
            }
        } else {
            let block = nodeOrBlock as Block;
            let blockRet = BlockScan(new BlockScope(blockScope, undefined, block, { program }), label, argumentMap, frameLevel + 1);
            endIR = blockRet.endIR;
            for (let ir of blockRet.jmpToFunctionEnd) {
                jmpToFunctionEnd.push(ir);
            }
        }
    }
    let lastNode = blockScope.block!.body[blockScope.block!.body.length - 1];
    /**
     * 如果block的最后一个AST是ret节点,则pop_stack_map已经由这个AST生成了
     * 否则弹出一个帧(因为每个block结束只需要弹出自己的帧,ret节点改变了处理流程，所以自己控制弹出帧的数量)
     */
    if (lastNode?.desc == 'ASTNode' && (lastNode as ASTNode).ret == undefined) {
        new IR('pop_stack_map', 1);
    }
    //到这里scope的所有def已经解析完毕，可以保存了
    let stackFrame: { name: string, type: TypeUsed }[] = [];
    for (let k in blockScope.property) {
        stackFrame.push({ name: k, type: blockScope.getProp(k).prop.type! });
    }
    stackFrameTable[`@StackFrame_${stackFrameMapIndex}`] = { baseOffset: blockScope.baseOffset, frame: stackFrame };
    return { startIR: startIR, endIR: endIR!, jmpToFunctionEnd: jmpToFunctionEnd };
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
/**
 * 
 * @param blockScope 
 * @param fun 
 * @returns wrapClassName:函数包裹类型名、realTypeName:函数真实类型名、text:函数代码的符号名
 */
function functionGen(blockScope: BlockScope, fun: FunctionType): { wrapClassName: string, realTypeName: string, text: string } {
    let lastSymbol = IRContainer.getContainer();//类似回溯，保留现场
    let argumentMap: { offset: number, type: TypeUsed }[] = [];
    let argOffset = 0;
    for (let argumentName in fun._arguments) {
        let type = fun._arguments[argumentName].type!;
        let size = propSize(type);
        argOffset += size;
        argumentMap.push({ offset: argOffset, type: type });
    }
    let functionIndex = globalVariable.functionIndex++;
    let functionWrapName = `@functionWrap_${functionIndex}`;
    let property: VariableDescriptor = {};
    //为函数对象创建两个基本值
    property['@this'] = {
        variable: 'val',
        type: {
            PlainType: { name: '@point' }
        }
    };
    for (let c in fun.capture) {
        property[c] = {
            variable: 'val',
            type: blockScope.getProp(c).prop.type//向上查找闭包包裹类的类型
        };
    }
    //注册函数容器
    program.definedType[functionWrapName] = {
        operatorOverload: {},
        _constructor: {},
        property: property,
        size: globalVariable.pointSize + Object.keys(fun.capture).length * globalVariable.pointSize
    };
    programScope.registerClassForCapture(functionWrapName);//注册类型
    registerType({ PlainType: { name: functionWrapName } });//在类型表中注册函数包裹类的类型
    let functionSymbol = new IRContainer(`@function_${functionIndex}`);
    IRContainer.setContainer(functionSymbol);
    let jmpToFunctionEnd = BlockScan(blockScope, [], argumentMap, 1).jmpToFunctionEnd;
    let retIR = new IR('ret', argOffset);
    for (let ir of jmpToFunctionEnd) {
        ir.operand1 = retIR.index - ir.index;//处理所有ret jmp
    }
    IRContainer.setContainer(lastSymbol);//回退
    return { wrapClassName: functionWrapName, realTypeName: FunctionSign(fun), text: functionSymbol.name };
}
function classScan(classScope: ClassScope) {
    let lastSymbol = IRContainer.getContainer();//类似回溯，保留现场
    let symbol = new IRContainer(`${classScope.className}_init`);
    IRContainer.setContainer(symbol);
    //扫描property
    for (let propName of classScope.getPropNames()) {
        let prop = classScope.getProp(propName).prop;
        let offset = classScope.getPropOffset(propName);
        if (prop.initAST != undefined) {
            new IR('p_load', 0);
            let nr = nodeRecursion(classScope, prop.initAST, [], false, [], 1);
            putfield(prop.type!, offset, nr.truelist, nr.falselist);
        } else if (prop.type?.FunctionType && prop.type?.FunctionType.body) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!, { program });
            let fun = functionGen(blockScope, prop.type?.FunctionType);
            let functionWrapScpoe = programScope.getClassScope(fun.wrapClassName);
            let this_type = functionWrapScpoe.getProp(`@this`).prop.type!;
            new IR('p_load', 0);
            let newIR = new IR('newFunc', undefined, undefined, undefined);
            irAbsoluteAddressRelocationTable.push({ sym: fun.text, ir: newIR });
            typeRelocationTable.push({ t2: fun.realTypeName, t3: fun.wrapClassName, ir: newIR });
            new IR('p_dup', globalVariable.pointSize);//复制一份functionWrap，用来设置this
            new IR('p_load', 0);//读取this
            new IR('p_putfield', 0);//设置this
            new IR('p_putfield', offset);//设置函数对象
        } else {
            //使用default
            defalutValue(prop.type!);
        }
    }
    new IR('ret', globalVariable.pointSize);//classInit返回
    IRContainer.setContainer(lastSymbol);//回退
}
/**
 * 创建propertyDescriptor，program和每个class都创建一个，成员的tpye引用typeTable的序号
 * @param property 
 */
function ClassTableItemGen(property: VariableDescriptor, size: number, className: string, isValueType: boolean) {
    let classNamePoint = stringPool.register(className);
    let props: { name: number, type: number }[] = [];
    for (let k in property) {
        let name = stringPool.register(k);
        let typeSign = TypeUsedSign(property[k].type!);
        let type = typeTable[typeSign].index;
        props.push({ name, type });
    }
    classTable.items.push({ name: classNamePoint, size: size, isValueType: isValueType, props: props });
}
function TypeTableGen() {
    for (let name in typeTable) {
        let namePoint = stringPool.register(name);
        let typeDesc: number;
        if (typeTable[name].type.ArrayType != undefined) {
            typeDesc = typeItemDesc.Array;
        } else if (typeTable[name].type.FunctionType != undefined) {
            typeDesc = typeItemDesc.Function;
        } else {
            typeDesc = typeItemDesc.PlaintObj;
        }
        binTypeTable.items.push({ name: namePoint, desc: typeDesc, innerType: typeTable[name].index });
    }
}
function stackFrameTableGen() {
    for (let itemKey in stackFrameTable) {
        let frame: { baseOffset: number, props: { name: number, type: number }[] } = {
            baseOffset: stackFrameTable[itemKey].baseOffset,
            props: []
        };
        for (let variable of stackFrameTable[itemKey].frame) {
            frame.props.push({
                name: stringPool.register(variable.name),
                type: typeTable[TypeUsedSign(variable.type)].index
            });
        }
        binStackFrameTable.push(frame, itemKey);
    }
}
//输出所有需要的文件
function finallyOutput() {
    //注册@program
    ClassTableItemGen(program.property, program.size!, '@program', false);
    registerType({ PlainType: { name: '@program' } });
    for (let k in program.definedType) {
        ClassTableItemGen(program.definedType[k].property, program.definedType[k].size!, k, program.definedType[k].modifier == 'valuetype');
    }
    fs.writeFileSync(`./src/example/toy-language/output/classTable.bin`, Buffer.from(classTable.toBinary()));
    fs.writeFileSync(`./src/example/toy-language/output/classTable.json`, JSON.stringify(classTable.items, null, 4));

    TypeTableGen();
    fs.writeFileSync(`./src/example/toy-language/output/typeTable.bin`, Buffer.from(binTypeTable.toBinary()));
    fs.writeFileSync(`./src/example/toy-language/output/typeTable.json`, JSON.stringify(binTypeTable.items, null, 4));

    stackFrameTableGen();
    fs.writeFileSync(`./src/example/toy-language/output/stackFrameTable.bin`, Buffer.from(binStackFrameTable.toBinary()));
    fs.writeFileSync(`./src/example/toy-language/output/stackFrameTable.json`, JSON.stringify(binStackFrameTable.getItems(), null, 4));

    let linkRet = link(programScope);
    fs.writeFileSync(`./src/example/toy-language/output/text.bin`, Buffer.from(linkRet.text));
    fs.writeFileSync(`./src/example/toy-language/output/text.json`, JSON.stringify(linkRet.debugIRS));
    fs.writeFileSync(`./src/example/toy-language/output/irTable.bin`, Buffer.from(linkRet.irTableBuffer));
    fs.writeFileSync(`./src/example/toy-language/output/irTable.json`, JSON.stringify([...linkRet.irTable]));

    fs.writeFileSync(`./src/example/toy-language/output/stringPool.bin`, Buffer.from(stringPool.toBinary()));//字符串池最后输出
    fs.writeFileSync(`./src/example/toy-language/output/stringPool.json`, JSON.stringify(stringPool.items, null, 4));
}
export default function programScan(primitiveProgram: Program) {
    program = primitiveProgram;
    programScope = new ProgramScope(program, { program: program });

    let symbol = new IRContainer('@program_init');
    IRContainer.setContainer(symbol);

    //扫描property
    for (let variableName in program.property) {
        var prop = program.property[variableName];
        let offset = programScope.getPropOffset(variableName);
        if (prop.initAST != undefined) {
            new IR('p_load');
            let nr = nodeRecursion(programScope, prop.initAST, [], false, [], 1);
            putfield(prop.type!, offset, nr.truelist, nr.falselist);
        } else if (prop.type?.FunctionType && prop.type?.FunctionType.body) {//如果是函数定义则生成函数
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!, { program });
            let fun = functionGen(blockScope, prop.type?.FunctionType);
            new IR('p_load');
            let newIR = new IR('newFunc', undefined, undefined, undefined);
            irAbsoluteAddressRelocationTable.push({ sym: fun.text, ir: newIR });
            typeRelocationTable.push({ t2: fun.realTypeName, t3: fun.wrapClassName, ir: newIR });
            putfield(prop.type, offset, [], []);
        } else {
            //使用default
            defalutValue(program.property[variableName].type!);
        }
    }
    new IR('ret', globalVariable.pointSize);//programInit返回
    for (let typeName in program.definedType) {
        classScan(programScope.getClassScope(typeName));
    }

    finallyOutput();
}