import fs from 'fs';
import { irAbsoluteAddressRelocationTable, globalVariable, registerType, stackFrameTable, stackFrameRelocationTable, typeRelocationTable, tmp, typeTable, nowIRContainer, OPCODE } from './ir.js';
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
function backPatch(list: IR[], targetIndex: number) {
    for (let ir of list) {
        ir.operand1 = targetIndex - ir.index;
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
 * 这么多参数谁看得懂，我都不懂,光最后几个bool值就晕了
 * @param scope 
 * @param node 
 * @param label for while的label,jmpIRs:break或者continue的列表
 * @param inFunction 是否在函数中，这个参数决定了this的取值方式
 * @param argumentMap 函数参数的补偿和size，只用于loadArgument节点
 * @param isGetAddress 是否读取地址,比如 int a; a.toString(); 这里的load a就是读取a的地址而不是值，默认取false，只有accessField取true
 * @param boolNot 布尔运算的时候是否要取反向生成操作符，'||'和'&&'对leftObj采取的比较跳转指令不同，默认取反可以节约指令，默认取ture，只有||的左子节点取false
 * @param isLoaction 是否左值，在处理=的时候有用到,如果是loaction节点，则load、getField、[]不生成真实指令，默认false，只有=左子节点取true
 * @param inPlainFunction 是否为普通函数(影响block内部对this的取值方式)，需要向下传递
 * @returns 
 */
function nodeRecursion(scope: Scope, node: ASTNode, label: { name: string, frameLevel: number, breakIRs: IR[], continueIRs: IR[] }[], inFunction: boolean, argumentMap: { type: TypeUsed }[], frameLevel: number, isGetAddress: boolean, boolNot: boolean, isLoaction: boolean, inPlainFunction: boolean): {
    startIR: IR, endIR: IR, truelist: IR[], falselist: IR[], jmpToFunctionEnd?: IR[],
    virtualIR?: {
        opCode: keyof typeof OPCODE,
        operand1?: number,
        operand2?: number,
        operand3?: number,
    }
} {
    if (node['_program'] != undefined) {
        let ir = new IR('program_load');
        return { startIR: ir, endIR: ir, truelist: [], falselist: [] };
    }
    else if (node['accessField'] != undefined) {
        let irs = nodeRecursion(scope, node['accessField']!.obj, label, inFunction, argumentMap, frameLevel, true, true, false, inPlainFunction);
        let objType = node['accessField']!.obj.type!;
        let baseScope: Scope;
        if (objType.ProgramType != undefined) {
            baseScope = programScope;
        } else if (objType.PlainType != undefined) {
            baseScope = programScope.getClassScope(objType.PlainType.name);
        } else {
            throw `其他类型暂时不能访问成员`;
        }
        let offset = baseScope.getPropOffset(node['accessField']!.field);
        let size = baseScope.getPropSize(node['accessField']!.field);
        let accessFieldType = baseScope.getProp(node['accessField']!.field).prop.type!;
        let ir: IR;
        let virtualIR: {
            opCode: keyof typeof OPCODE,
            operand1?: number,
            operand2?: number,
            operand3?: number,
        } | undefined;
        if (!isLoaction) {
            if (isPointType(accessFieldType)) {
                ir = new IR('p_getfield', offset);
            } else {
                if (isGetAddress) {
                    ir = new IR('getfield_address', offset);//读取成员地址
                } else {
                    if (accessFieldType.PlainType?.name == 'int') {
                        ir = new IR('i32_getfield', offset);//读取成员
                    } else if (accessFieldType.PlainType?.name == 'bool') {
                        ir = new IR('i8_getfield', offset);//读取成员
                    }
                    else {
                        ir = new IR('valueType_getfield', offset, size);//读取成员
                    }
                }
            }
        } else {
            if (isPointType(accessFieldType)) {
                virtualIR = { opCode: 'p_putfield', operand1: offset };
            } else {
                if (isGetAddress) {
                    /**
                     * var m:valType;
                     * m.a.b; //且a是值类型
                     * 这里的 .a就是isGetAddress,因为getField(m.a).b 和 a 是值类型决定了isGetAddress=true
                     * 而
                     * var m:valType;
                     * m.a=10; //且a是值类型
                     * 这里并不是对a的属性进行访问，所以这个条件永远不可到达
                     */
                    //先抛个异常，万一真的命中条件方便定位
                    throw `这里是不可能到达的`;
                } else {
                    if (accessFieldType.PlainType?.name == 'int') {
                        virtualIR = { opCode: 'i32_putfield', operand1: offset };//读取成员地址
                    } else if (accessFieldType.PlainType?.name == 'bool') {
                        virtualIR = { opCode: 'i8_putfield', operand1: offset };//读取成员
                    }
                    else {
                        virtualIR = { opCode: 'valueType_putfield', operand1: offset, operand2: size };//读取成员
                    }
                }
            }
            ir = irs.endIR;
        }
        return { startIR: irs.startIR, endIR: ir, truelist: [], falselist: [], virtualIR };
    }
    else if (node['immediate'] != undefined) {
        if (node["immediate"].functionValue) {
            let blockScope = new BlockScope(scope, node["immediate"].functionValue, node["immediate"].functionValue.body!, { program });
            let fun = functionObjGen(blockScope, node["immediate"].functionValue);
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
        let left = nodeRecursion(scope, node['+']!.leftChild, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        let right = nodeRecursion(scope, node['+']!.rightChild, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        let opIR: IR;
        if (node['+']!.leftChild.type?.PlainType?.name == 'int' && node['+']!.rightChild.type?.PlainType?.name == 'int') {
            opIR = new IR('i32_add');
        } else {
            throw `暂为支持的+操作`;
        }
        return { startIR: left.startIR, endIR: opIR, truelist: [], falselist: [] };
    }
    else if (node['<'] != undefined) {
        let left = nodeRecursion(scope, node['<']!.leftChild, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        let right = nodeRecursion(scope, node['<']!.rightChild, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
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
        let a = nodeRecursion(scope, condition, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        if (a.truelist.length == 0 && a.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('i_if_ne');
            a.falselist.push(ir);
        }
        let b = nodeRecursion(scope, node['ternary']!.obj1, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        let ir = new IR('jmp');
        let c = nodeRecursion(scope, node['ternary']!.obj2, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        ir.operand1 = c.endIR.index - ir.index + c.endIR.length;
        backPatch(a.truelist, b.startIR.index);//回填trueList
        backPatch(a.falselist, c.startIR.index);//回填falseList
        return { startIR: a.startIR, endIR: c.endIR, truelist: [], falselist: [] };
    } else if (node['_this'] != undefined) {
        if (inFunction) {
            let loadFunctionBase = new IR('p_load', 0);
            if (!inPlainFunction) {
                let loadThis = new IR('p_getfield', 0);//，如果是在函数对象中，需要再取一次值才能拿到正确的this
                return { startIR: loadFunctionBase, endIR: loadThis, truelist: [], falselist: [] };;
            } else {
                return { startIR: loadFunctionBase, endIR: loadFunctionBase, truelist: [], falselist: [] };;
            }
        } else {
            let ir = new IR('p_load', 0);
            return { startIR: ir, endIR: ir, truelist: [], falselist: [] };;
        }
    } else if (node['def'] != undefined) {
        let blockScope = (scope as BlockScope);//def节点是block专属
        let name = Object.keys(node['def'])[0];
        blockScope.setProp(name, node['def'][name]);
        let startIR = new IR('alloc', propSize(node['def'][name].type!));
        let offset = blockScope.getPropOffset(name);
        if (node['def'][name].initAST != undefined) {
            let nr = nodeRecursion(blockScope, node['def'][name].initAST!, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
            if (nr.truelist.length > 0 || nr.falselist.length > 0) {
                let trueIR = new IR('const_i8_load', 1);
                let jmp = new IR('jmp');
                let falseIR = new IR('const_i8_load', 0);
                jmp.operand1 = falseIR.index - jmp.index + falseIR.length
                backPatch(nr.truelist, trueIR.index);//回填true
                backPatch(nr.falselist, falseIR.index);//回填false
            }
            let assginment: IR;
            if (isPointType(node['def'][name].type!)) {
                assginment = new IR('p_store', offset);
            } else {
                if (node['def'][name].type!.PlainType!.name == 'int') {
                    assginment = new IR('i32_store', offset);
                } else if (node['def'][name].type!.PlainType!.name == 'bool') {
                    assginment = new IR('i8_store', offset);
                } else {
                    throw `暂时不支持类型:${node['def'][name].type!.PlainType!.name}的store`;
                }
            }
            return { startIR, endIR: assginment, truelist: [], falselist: [] };
        } else if (node['def'][name].type?.FunctionType && node['def'][name].type?.FunctionType?.body) {//如果是函数定义则生成函数
            let blockScope = new BlockScope(scope, node['def'][name].type?.FunctionType, node['def'][name].type?.FunctionType?.body!, { program });
            let fun = functionObjGen(blockScope, node['def'][name].type?.FunctionType!);
            let functionWrapScpoe = programScope.getClassScope(fun.wrapClassName);
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
            if (node['def'][name].type?.PlainType != undefined && program.definedType[node['def'][name].type!.PlainType!.name].modifier == 'valuetype') {
                new IR('load_address', offset);
                let initCall = new IR('abs_call', undefined, undefined, undefined);
                irAbsoluteAddressRelocationTable.push({ sym: `${node['def'][name].type?.PlainType!.name}_init`, ir: initCall });
                return { startIR: startIR, endIR: initCall, truelist: [], falselist: [] };
            } else {
                return { startIR: startIR, endIR: startIR, truelist: [], falselist: [] };
            }
        }
    }
    else if (node['load'] != undefined) {
        let type = (scope as BlockScope).getProp(node['load']).prop.type!;
        let offset = (scope as BlockScope).getPropOffset(node['load']);
        let ir: IR;
        let virtualIR: {
            opCode: keyof typeof OPCODE,
            operand1?: number,
            operand2?: number,
            operand3?: number,
        } | undefined;
        if (!isLoaction) {
            if (isPointType(type)) {
                ir = new IR('p_load', offset);
            } else {
                if (isGetAddress) {
                    ir = new IR('load_address', offset);
                }
                else {
                    if (type!.PlainType?.name == 'int') {
                        ir = new IR('i32_load', offset);
                    } else if (type!.PlainType?.name == 'bool') {
                        ir = new IR('i8_load', offset);
                    }
                    else {
                        throw `暂时不支持类型:${type!.PlainType?.name}的load`;
                    }
                }
            }
        } else {
            if (isPointType(type)) {
                virtualIR = { opCode: 'p_store', operand1: offset }
            } else {
                if (isGetAddress) {
                    //见accessField的注释
                    throw `这里是不可能到达的`;
                }
                else {
                    if (type!.PlainType?.name == 'int') {
                        virtualIR = { opCode: 'i32_store', operand1: offset }
                    } else if (type!.PlainType?.name == 'bool') {
                        virtualIR = { opCode: 'i8_store', operand1: offset }
                    }
                    else {
                        throw `暂时不支持类型:${type!.PlainType?.name}的load`;
                    }
                }
            }
            /**
             * 这里的startIR和endIR不会被使用到
             * 因为命中这里的代码如下
             * var a:int;
             * a=10;//尝试解析['=']节点的左子节点时命中
             * 所以作为jmp之类的跳转指令要使用也只能对整个['=']进行跳转
             */
            ir = nowIRContainer.irs[nowIRContainer.irs.length - 1];
        }
        return { startIR: ir, endIR: ir, truelist: [], falselist: [], virtualIR };
    }
    else if (node['_new'] != undefined) {
        let ir = new IR('_new', undefined, undefined, undefined);
        new IR('p_dup');//赋值一个指针用于调用init函数
        typeRelocationTable.push({ t1: node['_new'].type.PlainType.name, ir: ir });
        let initCall = new IR('abs_call', undefined, undefined, undefined);
        irAbsoluteAddressRelocationTable.push({ sym: `${node['_new'].type.PlainType.name}_init`, ir: initCall });
        let argTypes: TypeUsed[] = [];
        let args = node['_new']._arguments;
        for (let i = args.length - 1; i >= 0; i--) {
            argTypes.push(args[args.length - 1 - i].type!);//顺序获取type
            nodeRecursion(scope, args[i], label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);//逆序压参
        }
        new IR('p_dup');//赋值一个指针用于调用构造函数
        let sign = `@constructor:${node['_new'].type.PlainType.name} ${FunctionSignWithArgumentAndRetType(argTypes, { PlainType: { name: 'void' } })}`;//构造函数的签名
        let constructorCall = new IR('construct_call', undefined, undefined, undefined);//执行调用
        irAbsoluteAddressRelocationTable.push({ sym: sign, ir: constructorCall });
        return { startIR: ir, endIR: constructorCall, truelist: [], falselist: [] };
    }
    else if (node['||'] != undefined) {
        let left = nodeRecursion(scope, node['||'].leftChild, label, inFunction, argumentMap, frameLevel, false, false, false, inPlainFunction);
        if (left.falselist.length == 0 && left.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            left.truelist.push(new IR('i_if_eq'));
        }
        let right = nodeRecursion(scope, node['||'].rightChild, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        let endIR: IR;
        if (right.falselist.length == 0 && right.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            endIR = new IR('i_if_ne')
            right.falselist.push(endIR);
        } else {
            endIR = right.endIR;
        }
        backPatch(left.falselist, right.startIR.index);
        let truelist = merge(left.truelist, right.truelist);
        return { startIR: left.startIR, endIR: endIR, truelist: truelist, falselist: right.falselist };
    }
    else if (node['&&'] != undefined) {
        let left = nodeRecursion(scope, node['&&'].leftChild, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        if (left.falselist.length == 0 && left.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            left.falselist.push(new IR('i_if_ne'));
        }
        let right = nodeRecursion(scope, node['&&'].rightChild, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        let endIR: IR;
        if (right.falselist.length == 0 && right.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            endIR = new IR('i_if_ne');
            right.falselist.push(endIR);
        } else {
            endIR = right.endIR;
        }
        backPatch(left.truelist, right.startIR.index);
        let falselist = merge(left.falselist, right.falselist);
        return { startIR: left.startIR, endIR: endIR, truelist: right.truelist, falselist: falselist };
    }
    else if (node['ifElseStmt'] != undefined) {
        let condition = nodeRecursion(scope, node['ifElseStmt'].condition, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        if (condition.truelist.length == 0 && condition.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('i_if_ne');
            condition.falselist.push(ir);
        }
        let block1Ret = BlockScan(new BlockScope(scope, undefined, node['ifElseStmt'].stmt1, { program }), label, argumentMap, frameLevel + 1);
        let jmp = new IR('jmp');
        let block2Ret = BlockScan(new BlockScope(scope, undefined, node['ifElseStmt'].stmt2, { program }), label, argumentMap, frameLevel + 1);
        jmp.operand1 = block2Ret.endIR.index - jmp.index + block2Ret.endIR.length;
        backPatch(condition.truelist, block1Ret.startIR.index);
        backPatch(condition.falselist, block2Ret.startIR.index);
        return { startIR: condition.startIR, endIR: block2Ret.endIR, truelist: [], falselist: [], jmpToFunctionEnd: block1Ret.jmpToFunctionEnd.concat(block2Ret.jmpToFunctionEnd) };
    }
    else if (node['ifStmt'] != undefined) {
        let condition = nodeRecursion(scope, node['ifStmt'].condition, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        if (condition.truelist.length == 0 && condition.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('i_if_ne');
            condition.falselist.push(ir);
        }
        let blockRet = BlockScan(new BlockScope(scope, undefined, node['ifStmt'].stmt, { program }), label, argumentMap, frameLevel + 1);
        backPatch(condition.truelist, blockRet.startIR.index);
        backPatch(condition.falselist, blockRet.endIR.index + 1);
        return { startIR: condition.startIR, endIR: blockRet.endIR, truelist: [], falselist: [], jmpToFunctionEnd: blockRet.jmpToFunctionEnd };
    }
    else if (node['ret'] != undefined) {
        let startIR: IR;
        let jmpToFunctionEnd: IR[] = [];
        if (node['ret'] != '') {
            let ret = nodeRecursion(scope, node['ret'], label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
            startIR = ret.startIR;
            if (ret.truelist.length > 0 || ret.falselist.length > 0) {//如果需要回填，则说明是一个bool表达式
                let trueIR = new IR('const_i8_load', 1);
                let jmp = new IR('jmp');
                let falseIR = new IR('const_i8_load', 0);
                jmp.operand1 = falseIR.index - jmp.index + falseIR.length;
                backPatch(ret.truelist, trueIR.index);//回填true
                backPatch(ret.falselist, falseIR.index);//回填false
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
            let nodeRet = nodeRecursion(scope, node['call']._arguments[i], label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
            if (startIR == undefined) {
                startIR = nodeRet.startIR;
            }
        }
        //获取函数对象
        let nodeRet = nodeRecursion(scope, node['call'].functionObj, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        if (startIR == undefined) {
            startIR = nodeRet.startIR;
        }
        let call = new IR('call');
        return { startIR: startIR, endIR: call, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    /**
     * 这里什么指令都不需要生成 
     * 假如执行一个函数调用  f1(1,2,3);
     * 此时栈中是这样的布局
     *        ┌─────────┐
     *        │    3    │
     *        ├─────────┤
     *        │    2    │
     *        ├─────────┤
     *   sp-> │    1    │
     *        └─────────┘
     * 其他要使用参数的代码(有且仅有这些参数的def节点)依次从栈顶消费即可
     */
    else if (node['loadArgument'] != undefined) {
        return { startIR: nowIRContainer.irs[nowIRContainer.irs.length - 1], endIR: nowIRContainer.irs[nowIRContainer.irs.length - 1], truelist: [], falselist: [], jmpToFunctionEnd: [] };
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
            let astRet = nodeRecursion(scope, ast, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
            if (startIR == undefined) {
                startIR = astRet.startIR;
            }
        }
        let typeName = TypeUsedSign(type);
        let newArray = new IR('newArray', undefined, initList.length, undefined);
        typeRelocationTable.push({ t1: typeName, ir: newArray });
        return { startIR: startIR!, endIR: newArray, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    else if (node['='] != undefined) {
        let leftObj = nodeRecursion(scope, node['='].leftChild, label, inFunction, argumentMap, frameLevel, false, true, true, inPlainFunction);
        let rightObj = nodeRecursion(scope, node['='].rightChild, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);

        let type = node['='].leftChild.type!;
        if (type!.PlainType?.name == 'bool') {
            if (rightObj.truelist.length > 0 || rightObj.falselist.length > 0) {//如果bool值需要回填
                new IR('const_i8_load', 0);
                let jmp = new IR('jmp');
                let falseIR = new IR('const_i8_load', 1);
                jmp.operand1 = falseIR.index - jmp.index + falseIR.length;
            }
        }
        let virtualIR = leftObj.virtualIR!;
        let endIR = new IR(virtualIR.opCode, virtualIR.operand1, virtualIR.operand2, virtualIR.operand3);
        return { startIR: rightObj.startIR, endIR: endIR, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    else if (node['++'] != undefined) {
        let nr = nodeRecursion(scope, node['++'], label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        new IR('i32_inc');
        let type = node['++'].type;
        let endIR: IR;
        if (type!.PlainType?.name == 'int') {
            if (node['++'].load != undefined) {
                endIR = new IR('i32_store', nr.endIR.operand1);
            } else {
                //再来一次get_field操作
                let loadASTs = nodeRecursion(scope, node['++'], label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
                //把opcode强制改为put
                loadASTs.endIR.opCode = 'i32_putfield';
                endIR = loadASTs.endIR;
            }
        } else {
            throw `暂时不支持类型:${type!.PlainType?.name}的++`;
        }
        return { startIR: nr.startIR, endIR: endIR, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    else if (node['--'] != undefined) {
        let nr = nodeRecursion(scope, node['--'], label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        new IR('i32_dec');
        let type = node['--'].type;
        let endIR: IR;
        if (type!.PlainType?.name == 'int') {
            if (node['--'].load != undefined) {
                endIR = new IR('i32_store', nr.endIR.operand1);
            } else {
                //再来一次get_field操作
                let loadASTs = nodeRecursion(scope, node['--'], label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
                //把opcode强制改为put
                loadASTs.endIR.opCode = 'i32_putfield';
                endIR = loadASTs.endIR;
            }
        } else {
            throw `暂时不支持类型:${type!.PlainType?.name}的++`;
        }
        return { startIR: nr.startIR, endIR: endIR, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    else if (node['_for'] != undefined) {
        let startIR: IR | undefined;
        if (node['_for'].init) {
            let initRet = nodeRecursion(scope, node['_for'].init, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
            startIR = initRet.startIR;
        }
        let conditionStartIR: IR | undefined;
        let trueList: IR[] = [];
        let falseList: IR[] = [];
        if (node['_for'].condition) {
            let conditionRet = nodeRecursion(scope, node['_for'].condition, label, inFunction, argumentMap, frameLevel, false, true, false, false);
            trueList = conditionRet.truelist;
            falseList = conditionRet.falselist;
            conditionStartIR = conditionRet.startIR;
            if (!startIR) {
                startIR = conditionRet.startIR;
            }
        }
        let breakIRs: IR[] = [];
        let continueIRs: IR[] = [];
        if (node['_for'].label) {
            label.push({ name: node['_for'].label, frameLevel, breakIRs, continueIRs });
        } else {
            label.push({ name: '', frameLevel, breakIRs, continueIRs });
        }
        let blockRet = BlockScan(new BlockScope(scope, undefined, node['_for'].stmt, { program }), label, argumentMap, frameLevel + 1);
        label.pop();
        if (!startIR) {
            startIR = blockRet.startIR;
        }
        if (node['_for'].step) {
            nodeRecursion(scope, node['_for'].step, label, inFunction, argumentMap, frameLevel, false, true, false, inPlainFunction);
        }
        let loop = new IR('jmp');
        backPatch(breakIRs, loop.index + 1);
        if (conditionStartIR) {
            loop.operand1 = conditionStartIR.index - loop.index;
            if (trueList.length > 0 || falseList.length > 0) {
                backPatch(falseList, loop.index + 1);//for语句后面一定会有指令(至少一定会有一条ret或者pop_stackFrame指令,因为for一定是定义在functio或者block中的)
                backPatch(trueList, blockRet.startIR.index);
            }
            backPatch(continueIRs, conditionStartIR.index);
        } else {
            loop.operand1 = blockRet.startIR.index - loop.index;
            backPatch(continueIRs, blockRet.startIR.index);
        }
        return { startIR: startIR, endIR: loop, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    else if (node['_break'] != undefined) {
        let lab: {
            name: string;
            frameLevel: number;
            breakIRs: IR[];
            continueIRs: IR[];
        };
        let startIR: IR;
        let endIR: IR;
        if (!node['_break'].label) {//如果没有指明label，则寻找最近的一个label break
            lab = label[label.length - 1];
            startIR = new IR('pop_stack_map', 1);
            let jmp = new IR('jmp');
            lab.breakIRs.push(jmp);
            endIR = jmp;
        } else {
            for (let i = label.length - 1; i >= 0; i--) {
                if (label[i].name == node['_break'].label) {
                    lab = label[i];
                    break;
                }
            }
            startIR = new IR('pop_stack_map', frameLevel - lab!.frameLevel);
            let jmp = new IR('jmp');
            lab!.breakIRs.push(jmp);
            endIR = jmp;
        }
        return { startIR: startIR, endIR: endIR, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    else if (node['_continue'] != undefined) {
        let lab: {
            name: string;
            frameLevel: number;
            breakIRs: IR[];
            continueIRs: IR[];
        };
        let startIR: IR;
        let endIR: IR;
        if (!node['_continue'].label) {//如果没有指明label，则寻找最近的一个label break
            lab = label[label.length - 1];
            startIR = new IR('pop_stack_map', 1);
            let jmp = new IR('jmp');
            lab.continueIRs.push(jmp);
            endIR = jmp;
        } else {
            for (let i = label.length - 1; i >= 0; i--) {
                if (label[i].name == node['_continue'].label) {
                    lab = label[i];
                    break;
                }
            }
            startIR = new IR('pop_stack_map', frameLevel - lab!.frameLevel);
            let jmp = new IR('jmp');
            lab!.continueIRs.push(jmp);
            endIR = jmp;
        }
        return { startIR: startIR, endIR: endIR, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    else if (node['[]'] != undefined) {
        //需要判断isLoaction
        throw `unimplement`;
    }
    else if (node['loadOperatorOverload'] != undefined) {
        throw `unimplement`;
    }
    else if (node['trycatch'] != undefined) {
        throw `unimplement`;
    }
    else if (node['loadException'] != undefined) {
        throw `unimplement`;
    }
    else if (node['throwStmt'] != undefined) {
        throw `unimplement`;
    }
    else if (node['do_while'] != undefined) {
        throw `unimplement`;
    }
    else if (node['_while'] != undefined) {
        throw `unimplement`;
    }
    else if (node['_instanceof'] != undefined) {
        throw `unimplement`;
    }
    else if (node['not'] != undefined) {
        throw `unimplement`;
    }
    else if (node['cast'] != undefined) {
        throw `unimplement`;
    }
    else if (node['box'] != undefined) {
        throw `unimplement`;
    }
    else if (node['unbox'] != undefined) {
        throw `unimplement`;
    }
    else if (node['-'] != undefined) {
        throw `unimplement`;
    }
    else if (node['*'] != undefined) {
        throw `unimplement`;
    }
    else if (node['/'] != undefined) {
        throw `unimplement`;
    }
    else if (node['<'] != undefined) {
        throw `unimplement`;
    }
    else if (node['<='] != undefined) {
        throw `unimplement`;
    }
    else if (node['>'] != undefined) {
        throw `unimplement`;
    }
    else if (node['>='] != undefined) {
        throw `unimplement`;
    }
    else if (node['=='] != undefined) {
        throw `unimplement`;
    }
    else if (node['||'] != undefined) {
        throw `unimplement`;
    }
    else if (node['&&'] != undefined) {
        throw `unimplement`;
    }
    else if (node['_switch'] != undefined) {
        throw `unimplement`;
    }
    else { throw `还没支持的AST类型` };
}
function putfield(type: TypeUsed, offset: number, truelist: IR[], falselist: IR[]): IR {
    if (truelist.length > 0 || falselist.length > 0) {
        let trueIR = new IR('const_i8_load', 1);
        let jmp = new IR('jmp');
        let falseIR = new IR('const_i8_load', 0);
        jmp.operand1 = falseIR.index - jmp.index + falseIR.length;
        backPatch(truelist, trueIR.index);//回填true
        backPatch(falselist, falseIR.index);//回填false
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
/**
 * 
 * @param blockScope 
 * @param label 
 * @param argumentMap 
 * @param frameLevel 
 * @param inPlainFunction 是否为普通函数(影响block内部对this的取值方式)
 * @returns 
 */
function BlockScan(blockScope: BlockScope, label: { name: string, frameLevel: number, breakIRs: IR[], continueIRs: IR[] }[], argumentMap: { type: TypeUsed }[], frameLevel: number, inPlainFunction = false): { startIR: IR, endIR: IR, jmpToFunctionEnd: IR[], stackFrame: { name: string, type: TypeUsed }[] } {
    let stackFrameMapIndex = globalVariable.stackFrameMapIndex++;
    let startIR: IR = new IR('push_stack_map', undefined, undefined, undefined);
    stackFrameRelocationTable.push({ sym: `@StackFrame_${stackFrameMapIndex}`, ir: startIR });
    if (blockScope.parent == undefined) {//处于函数scope中
        new IR('alloc', globalVariable.pointSize);//给包裹类分配位置
    }
    let endIR: IR;
    let jmpToFunctionEnd: IR[] = [];//记录所有返回指令;
    for (let i = 0; i < blockScope.block!.body.length; i++) {
        let nodeOrBlock = blockScope.block!.body[i];
        if (nodeOrBlock.desc == 'ASTNode') {
            let nodeRet = nodeRecursion(blockScope, nodeOrBlock as ASTNode, label, true, argumentMap, frameLevel, false, true, false, inPlainFunction);
            endIR = nodeRet.endIR;
            if (nodeRet.jmpToFunctionEnd) {
                jmpToFunctionEnd = jmpToFunctionEnd.concat(nodeRet.jmpToFunctionEnd);
            }

            /**
             * 下面这两种stmt需要清理栈
             * new obj();
             * fun();
            */
            let stmtType = (nodeOrBlock as ASTNode).type!;
            if ((stmtType?.PlainType?.name != 'void') && ((nodeOrBlock as ASTNode)['_new'] != undefined || (nodeOrBlock as ASTNode)['call'] != undefined)) {
                if (stmtType.PlainType && program.definedType[stmtType.PlainType.name].modifier == 'valuetype') {
                    if (stmtType.PlainType.name == 'int') {
                        new IR('i32_pop');
                    } else {
                        throw `暂时不支持类型:${stmtType!.PlainType?.name}的popup`;
                    }
                } else {//非值类型对象统统按照指针处理
                    endIR = new IR('p_pop');
                }
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
    if (!(lastNode?.desc == 'ASTNode' && (lastNode as ASTNode).ret != undefined)) {
        endIR = new IR('pop_stack_map', 1);
    }
    //到这里scope的所有def已经解析完毕，可以保存了
    let stackFrame: { name: string, type: TypeUsed }[] = [];
    for (let k in blockScope.property) {
        stackFrame.push({ name: k, type: blockScope.getProp(k).prop.type! });
    }
    stackFrameTable[`@StackFrame_${stackFrameMapIndex}`] = { baseOffset: blockScope.baseOffset, frame: stackFrame };
    return { startIR: startIR, endIR: endIR!, jmpToFunctionEnd: jmpToFunctionEnd, stackFrame };
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
 * 生成函数对象
 * @param blockScope 
 * @param fun 
 * @param nativeName native名字
 * @returns wrapClassName:函数包裹类型名、realTypeName:函数真实类型名、text:函数代码的符号名
 */
function functionObjGen(blockScope: BlockScope, fun: FunctionType, option?: { nativeName?: string }): { wrapClassName: string, realTypeName: string, text: string, irContainer: IRContainer } {
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
    //为函数对象创建两个基本值(this和捕获变量)
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
    let functionIRContainer = new IRContainer(`@function_${functionIndex}`);
    IRContainer.setContainer(functionIRContainer);
    if (!fun.isNative) {
        let blockScanRet = BlockScan(blockScope, [], argumentMap, 1);
        blockScanRet.stackFrame.unshift({ name: '@wrap', type: { PlainType: { name: functionWrapName } } });//压入函数包裹类
        let retIR = new IR('ret');
        for (let ir of blockScanRet.jmpToFunctionEnd) {
            ir.operand1 = retIR.index - ir.index;//处理所有ret jmp
        }
    } else {
        if (option?.nativeName == undefined) {
            throw `native函数只能定义在program空间或者系统内置类型的operator overload中`;
        }
        new IR('native_call', stringPool.register(option?.nativeName!));//调用native函数
        new IR('ret');
    }
    IRContainer.setContainer(lastSymbol);//回退
    return { wrapClassName: functionWrapName, realTypeName: FunctionSign(fun), text: functionIRContainer.name, irContainer: functionIRContainer };
}
/**
 * 生成一个普通函数(构造函数和操作符重载函数)
 * @param blockScope 
 * @param fun 
 * @param functionName 函数在符号表中的名字
 * @returns 
 */
function PlainFunctionGen(blockScope: BlockScope, fun: FunctionType, functionName: string): { text: string, irContainer: IRContainer } {
    let lastSymbol = IRContainer.getContainer();//类似回溯，保留现场
    let argumentMap: { offset: number, type: TypeUsed }[] = [];
    let argOffset = 0;
    for (let argumentName in fun._arguments) {
        let type = fun._arguments[argumentName].type!;
        let size = propSize(type);
        argOffset += size;
        argumentMap.push({ offset: argOffset, type: type });
    }
    let functionIRContainer = new IRContainer(functionName);
    IRContainer.setContainer(functionIRContainer);
    let blockScanRet = BlockScan(blockScope, [], argumentMap, 1, true);
    let retIR = new IR('ret');
    for (let ir of blockScanRet.jmpToFunctionEnd) {
        ir.operand1 = retIR.index - ir.index;//处理所有ret jmp
    }
    IRContainer.setContainer(lastSymbol);//回退
    return { text: functionIRContainer.name, irContainer: functionIRContainer };
}
function classScan(classScope: ClassScope) {
    let lastSymbol = IRContainer.getContainer();//类似回溯，保留现场
    let symbol = new IRContainer(`${classScope.className}_init`);
    IRContainer.setContainer(symbol);
    let startIR: IR = new IR('push_stack_map', undefined, undefined, undefined);
    new IR('alloc', globalVariable.pointSize);//给包裹类分配位置
    stackFrameRelocationTable.push({ sym: `@StackFrame_0`, ir: startIR });
    new IR('p_store', 0);//保存this指针
    //扫描property
    for (let propName of classScope.getPropNames()) {
        let prop = classScope.getProp(propName).prop;
        let offset = classScope.getPropOffset(propName);
        if (prop.initAST != undefined) {
            new IR('p_load', 0);
            let nr = nodeRecursion(classScope, prop.initAST, [], false, [], 1, false, true, false, false);
            putfield(prop.type!, offset, nr.truelist, nr.falselist);
        } else if (prop.type?.FunctionType && prop.type?.FunctionType.body) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!, { program });
            let fun = functionObjGen(blockScope, prop.type?.FunctionType);
            new IR('p_load', 0);
            let newIR = new IR('newFunc', undefined, undefined, undefined);
            irAbsoluteAddressRelocationTable.push({ sym: fun.text, ir: newIR });
            typeRelocationTable.push({ t2: fun.realTypeName, t3: fun.wrapClassName, ir: newIR });
            new IR('p_dup');//复制一份functionWrap，用来设置this
            new IR('p_load', 0);//读取this
            new IR('p_putfield', 0);//设置this
            new IR('p_putfield', offset);//设置函数对象
        } else {
            if (prop.type?.PlainType != undefined && program.definedType[prop.type?.PlainType.name].modifier == 'valuetype') {
                new IR('p_load', 0);
                new IR('getfield_address', offset);
                let initCall = new IR('abs_call', undefined, undefined, undefined);
                irAbsoluteAddressRelocationTable.push({ sym: `${prop.type?.PlainType.name}_init`, ir: initCall });
            }
        }
    }
    //扫描构造函数
    //扫描构造函数
    for (let constructorName in program.definedType[classScope.className]._constructor) {
        let _constructor = program.definedType[classScope.className]._constructor[constructorName];
        _constructor.retType = { PlainType: { name: 'void' } };//所有构造函数不允许有返回值
        let blockScope = new BlockScope(classScope, _constructor, _constructor.body!, { program });
        let sign = `@constructor:${classScope.className} ${constructorName}`;//构造函数的签名
        PlainFunctionGen(blockScope, _constructor, sign);
    }
    new IR('pop_stack_map', 1);
    new IR('ret');//classInit返回
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
    let innerType: number;
    for (let name in typeTable) {
        let namePoint = stringPool.register(name);
        let typeDesc: typeItemDesc;
        if (typeTable[name].type.ArrayType != undefined) {
            typeDesc = typeItemDesc.Array;
            innerType = typeTable[TypeUsedSign(typeTable[name].type.ArrayType?.innerType!)].index
        } else if (typeTable[name].type.FunctionType != undefined) {
            typeDesc = typeItemDesc.Function;
            innerType = typeTable[name].index;
        } else if (typeTable[name].type.PlainType != undefined) {
            typeDesc = typeItemDesc.PlaintObj;
            if (typeTable[name].type.PlainType?.name == 'void') {
                innerType = -1;
            } else {
                innerType = classTable.getClassIndex(typeTable[name].type.PlainType?.name!);
            }
        } else {
            typeDesc = typeItemDesc.PlaintObj;
            innerType = classTable.getClassIndex("@program");
        }
        binTypeTable.items.push({ name: namePoint, desc: typeDesc, innerType });
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
    fs.writeFileSync(`./src/example/toy-language/output/typeTableForDebug.json`, JSON.stringify(typeTable, null, 4));

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

    stackFrameTable[`@StackFrame_0`] = { baseOffset: 0, frame: [{ name: '@this', type: { PlainType: { name: `@point` } } }] };//给class_init分配的frame

    let symbol = new IRContainer('@program_init');
    IRContainer.setContainer(symbol);

    //扫描property
    for (let variableName in program.property) {
        var prop = program.property[variableName];
        let offset = programScope.getPropOffset(variableName);
        if (prop.initAST != undefined) {
            new IR('program_load');
            let nr = nodeRecursion(programScope, prop.initAST, [], false, [], 1, false, true, false, false);
            putfield(prop.type!, offset, nr.truelist, nr.falselist);
        } else if (prop.type?.FunctionType && (prop.type?.FunctionType.body || prop.type?.FunctionType.isNative)) {//如果是函数定义则生成函数
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!, { program });
            let fun = functionObjGen(blockScope, prop.type?.FunctionType, { nativeName: variableName });
            new IR('program_load');
            let newIR = new IR('newFunc', undefined, undefined, undefined);
            irAbsoluteAddressRelocationTable.push({ sym: fun.text, ir: newIR });
            typeRelocationTable.push({ t2: fun.realTypeName, t3: fun.wrapClassName, ir: newIR });
            putfield(prop.type, offset, [], []);
        } else {
            if (prop.type?.PlainType != undefined && program.definedType[prop.type?.PlainType.name].modifier == 'valuetype') {
                new IR('program_load');
                new IR('getfield_address', offset);
                let initCall = new IR('abs_call', undefined, undefined, undefined);
                irAbsoluteAddressRelocationTable.push({ sym: `${prop.type?.PlainType.name}_init`, ir: initCall });
            }
        }
    }
    new IR('ret');//programInit返回
    for (let typeName in program.definedType) {
        classScan(programScope.getClassScope(typeName));
    }

    finallyOutput();
}
console.error(`newArray还没有测试,需要和数组访问[]配合测试才行`);