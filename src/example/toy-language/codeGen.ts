import fs from 'fs';
import { irAbsoluteAddressRelocationTable, stackFrameTable, stackFrameRelocationTable, typeRelocationTable, tmp, typeTable, nowIRContainer, OPCODE, globalVariable, program } from './ir.js';
import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
import { IR, IRContainer } from './ir.js'
import { FunctionSign, FunctionSignWithArgumentAndRetType, TypeUsedSign } from './lib.js';
import { classTable, stringPool, typeItemDesc, typeTable as binTypeTable, stackFrameTable as binStackFrameTable, link } from './binaryTools.js'
import { registerType } from './semanticCheck.js';
/**
 * 经过几轮扫描，有一些步骤是重复的，为了能清晰掌握每个步骤的顺序(其实就是在设计前一步的时候不知道后面应该怎么做，要做什么，想起来已经晚了)，先将就用着吧
 */
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
        if (program.getDefinedType(type.PlainType!.name).modifier == 'valuetype') {
            return false;
        } else {
            return true;
        }
    } else {
        return true;
    }
}
/**
 * 因为是边做边改，所以参数越来越多，可以用option一个包裹起来
 * @param scope 
 * @param node 
 * @param label for while的label,jmpIRs:break或者continue的列表
 * @param argumentMap 函数参数的补偿和size，只用于loadArgument节点
 * @param isGetAddress 是否读取地址,比如 int a; a.toString(); 这里的load a就是读取a的地址而不是值，默认取false，只有accessField和callEXM取true
 * 因为机器码的if指令如果命中则跳转，不命中则执行下一条指令，所以要想实现分支就要利用这个特性，bool反向的时候，jmp目标是falseIR，所以下一条应该是trueIR，不反向的时候，目标是trueIR，所以下一条指令是falseIR
 * 因为&&指令流如下:
 *      trueIR
 *      jmp
 *      false
 * ‖指令流如下:
 *      false
 *      jmp
 *      true
 * 所以只有is_or_left_child=false时条件跳转指令是正常生成的，其他情况都是取反向条件跳转
 * @param is_or_left_child 布尔运算的时候是否要取反向生成操作符，'||'和'&&'对leftObj采取的比较跳转指令不同，默认取反可以节约指令，默认取ture，只有||的左子节点取false
 * @param isAssignment 是否是对某个成员或者局部变量赋值，在处理=的时候有用到,如果是loaction节点，则load、getField、[]不生成真实指令，默认false，只有=左子节点取true
 * @param singleLevelThis 是否为普通函数(影响block内部对this的取值方式)，需要向下传递
 * @param functionWrapName 函数包裹类的名字，需要向下传递，在处理loadFunctionWrap的时候用到
 * @returns 
 * 前面几个都是常规返回值
 * virtualIR 虚拟ir，这个指令先不生成,配合isAssignment使用，等调用者创建好代码找之后利用这个东西生成真正的指令
 * isRightVaiable是否为右值,标记这个obj来自计算栈还是其他可寻址位置或者计算栈，如果是来自计算栈的内容表示这是一个右值
 * 怎么判断是否为右值?
 * 1.通过运算得到的值都是右值，call,++,--,+,-,*,/,[]等运算符
 * 2.imeediate是右值
 * 3.通过取成员或者load局部变量得到的都是左值
 * isRightVaiable只影响isGetAddress的使用(只有存访中vauleType的地址时才有用，也就是只有accessField和callEXM才会用到)，所以有些AST的返回值是没意义的，比如for,if,if-else
 */
function nodeRecursion(scope: Scope, node: ASTNode, label: { name: string, frameLevel: number, breakIRs: IR[], continueIRs: IR[] }[], frameLevel: number, isGetAddress: boolean, is_or_left_child: boolean, isAssignment: boolean, singleLevelThis: boolean, functionWrapName: string | undefined): {
    startIR: IR, endIR: IR, truelist: IR[], falselist: IR[], jmpToFunctionEnd?: IR[],
    isRightVaiable?: boolean,
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
        let irs = nodeRecursion(scope, node['accessField']!.obj, label, frameLevel, true, true, false, singleLevelThis, functionWrapName);
        //访问一个值类型右值的成员时
        if (!isPointType(node['accessField'].obj.type!) && irs.isRightVaiable) {
            /**
             * 为什么一定要装箱？
             * valueType class MyClass{
             *    function foo(){
             *         printf('haha');
             *    };
             * }
             * function gen(){
             *    var ret:MyClass;
             *    return ;
             * }
             * var f=gen().foo;
             * f();
             * 如果不装箱的话，无法提取出这个右值的成员变量foo
             */
            let box = new IR('box');
            //装箱的情况下，一定是一个PlainType
            typeRelocationTable.push({ t1: node['accessField'].obj.type!.PlainType!.name, ir: box });
        }
        let objType = node['accessField']!.obj.type!;
        let ret: {
            startIR: IR, endIR: IR, truelist: IR[], falselist: IR[], jmpToFunctionEnd?: IR[],
            isRightVaiable?: boolean,
            virtualIR?: {
                opCode: keyof typeof OPCODE,
                operand1?: number,
                operand2?: number,
                operand3?: number,
            }
        };
        if (objType.ArrayType != undefined) {
            if (node["accessField"].field != 'length') {
                //这里不会命中，在阶段二进行类型检查的时候已经处理了
                throw `数组只有length属性可访问`;
            } else {
                let ir = new IR('access_array_length');
                return { startIR: irs.startIR, endIR: ir, truelist: [], falselist: [] };
            }
        } else {
            let baseScope: Scope;
            if (objType.ProgramType != undefined) {
                baseScope = programScope;
            } else if (objType.PlainType != undefined) {
                baseScope = programScope.getClassScope(objType.PlainType.name);
            } else {
                //此处条件不可能命中
                throw `其他类型暂时不能访问成员`;//还有啥其他类型?先抛个异常再说
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
            if (!isAssignment) {
                if (isPointType(accessFieldType)) {
                    ir = new IR('p_getfield', offset);
                } else {
                    if (isGetAddress) {
                        ir = new IR('getfield_address', offset);//读取成员地址
                    } else {
                        ir = new IR('valueType_getfield', offset, size);//读取成员
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
                        virtualIR = { opCode: 'valueType_putfield', operand1: offset, operand2: size };//设置成员
                    }
                }
                ir = irs.endIR;
            }
            return { startIR: irs.startIR, endIR: ir, truelist: [], falselist: [], virtualIR };
        }
    }
    else if (node['immediate'] != undefined) {
        if (node["immediate"].functionValue) {
            let functionScope = new BlockScope(scope, node["immediate"].functionValue, node["immediate"].functionValue.body!, { program });
            let fun = functionObjGen(functionScope, node["immediate"].functionValue);
            let functionWrapScpoe = programScope.getClassScope(fun.wrapClassName);
            let startIR = new IR('newFunc', undefined, undefined, undefined);
            let endIR: IR | undefined;
            irAbsoluteAddressRelocationTable.push({ sym: fun.text, ir: startIR });
            typeRelocationTable.push({ t2: fun.realTypeName, t3: fun.wrapClassName, ir: startIR });
            //判断创建的函数是否处于class中
            if (functionScope.classScope != undefined) {
                //如果是在class中定义的函数，设置this
                new IR('p_dup');//复制函数对象
                nodeRecursion(scope, { desc: 'ASTNode', _this: '' }, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);//读取this指针
                endIR = new IR('p_putfield', 0);//把this指针设置到包裹类的@this中
            }
            let capture = node["immediate"].functionValue.capture;
            for (let capturedName in capture) {//设置捕获变量
                let capturedOffset = scope.getPropOffset(capturedName);//当前scope被捕获对象的描述符(一定是一个指针对象)
                let capturedType = scope.getProp(capturedName).prop.type!;//被捕获对象的类型(已经是包裹类)
                let targetOffset = functionWrapScpoe.getPropOffset(capturedName);//捕获对象在被包裹类中的描述符
                new IR('p_dup');//复制函数对象
                new IR('p_load', capturedOffset);//读取被捕获变量
                endIR = putfield(capturedType, targetOffset, [], []);//把被捕获对象设置给函数对象的包裹类中
            }
            return { startIR: startIR, endIR: endIR ?? startIR, truelist: [], falselist: [], isRightVaiable: true };
        } else {
            if (isNaN(Number(node["immediate"]!.primiviteValue))) {
                throw `暂时不支持非数字的initAST`;//就剩下字符串类型了
            } else {
                let ir = new IR('const_i32_load', Number(node["immediate"]!.primiviteValue));
                return { startIR: ir, endIR: ir, truelist: [], falselist: [], isRightVaiable: true };
            }
        }
    }
    else if (node['+'] != undefined) {
        let left = nodeRecursion(scope, node['+']!.leftChild, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let right = nodeRecursion(scope, node['+']!.rightChild, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let opIR: IR;
        if (node['+']!.leftChild.type?.PlainType?.name == 'int' && node['+']!.rightChild.type?.PlainType?.name == 'int') {
            opIR = new IR('i32_add');
        } else {
            throw `vm 暂未支持${TypeUsedSign(node['<']!.leftChild.type!)}的+操作`;
        }
        return { startIR: left.startIR, endIR: opIR, truelist: [], falselist: [], isRightVaiable: true };
    }
    else if (node['ternary'] != undefined) {
        let condition = node['ternary']!.condition;
        let a = nodeRecursion(scope, condition, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        if (a.truelist.length == 0 && a.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('i_if_ne');
            a.falselist.push(ir);
        }
        let b = nodeRecursion(scope, node['ternary']!.obj1, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let ir = new IR('jmp');
        let c = nodeRecursion(scope, node['ternary']!.obj2, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        ir.operand1 = c.endIR.index - ir.index + c.endIR.length;
        backPatch(a.truelist, b.startIR.index);//回填trueList
        backPatch(a.falselist, c.startIR.index);//回填falseList
        return { startIR: a.startIR, endIR: c.endIR, truelist: [], falselist: [], isRightVaiable: true };
    } else if (node['_this'] != undefined) {
        let loadFunctionBase = new IR('p_load', 0);
        if (!singleLevelThis) {
            let loadThis = new IR('p_getfield', 0);//如果是在函数对象中，需要再取一次值才能拿到正确的this
            return { startIR: loadFunctionBase, endIR: loadThis, truelist: [], falselist: [] };
        } else {
            return { startIR: loadFunctionBase, endIR: loadFunctionBase, truelist: [], falselist: [] };;
        }
    } else if (node['def'] != undefined) {
        let blockScope = (scope as BlockScope);//def节点是block专属
        let name = Object.keys(node['def'])[0];
        blockScope.setProp(name, node['def'][name]);
        let startIR = new IR('alloc', propSize(node['def'][name].type!));
        let varOffset = blockScope.getPropOffset(name);//def变量
        let size = blockScope.getPropSize(name);
        if (node['def'][name].initAST != undefined) {
            let nr = nodeRecursion(blockScope, node['def'][name].initAST!, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
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
                assginment = new IR('p_store', varOffset);
            } else {
                assginment = new IR('valueType_store', varOffset, size);
            }
            return { startIR, endIR: assginment, truelist: [], falselist: [] };
        } else if (node['def'][name].type?.FunctionType && node['def'][name].type?.FunctionType?.body) {//如果是函数定义则生成函数
            let functionScope = new BlockScope(scope, node['def'][name].type?.FunctionType, node['def'][name].type?.FunctionType?.body!, { program });
            let fun = functionObjGen(functionScope, node['def'][name].type?.FunctionType!);
            let functionWrapScpoe = programScope.getClassScope(fun.wrapClassName);
            let startIR = new IR('newFunc', undefined, undefined, undefined);
            irAbsoluteAddressRelocationTable.push({ sym: fun.text, ir: startIR });
            typeRelocationTable.push({ t2: fun.realTypeName, t3: fun.wrapClassName, ir: startIR });
            //判断创建的函数是否处于class中
            if (functionScope.classScope != undefined) {
                //如果是在class中定义的函数，设置this
                new IR('p_dup');//复制函数对象
                nodeRecursion(scope, { desc: 'ASTNode', _this: '' }, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);//读取this指针
                new IR('p_putfield', 0);//把this指针设置到包裹类的@this中
            }
            let capture = node['def'][name].type!.FunctionType!.capture;
            for (let capturedName in capture) {//设置捕获变量
                let capturedOffset = scope.getPropOffset(capturedName);//当前scope被捕获对象的描述符(一定是一个指针对象)
                let capturedType = scope.getProp(capturedName).prop.type!;//被捕获对象的类型(已经是包裹类)
                let targetOffset = functionWrapScpoe.getPropOffset(capturedName);//捕获对象在被包裹类中的描述符
                new IR('p_dup');//复制函数对象
                new IR('p_load', capturedOffset);//读取被捕获变量
                putfield(capturedType, targetOffset, [], []);//把被捕获对象设置给函数对象的包裹类中
            }
            let endIR = new IR('p_store', varOffset);//保存函数对象到指定位置
            return { startIR: startIR, endIR: endIR, truelist: [], falselist: [] };
        } else {
            //如果是值类型，调用init方法
            if (!isPointType(node['def'][name].type!)) {
                new IR('load_address', varOffset);
                let initCall = new IR('abs_call', undefined, undefined, undefined);
                irAbsoluteAddressRelocationTable.push({ sym: `${node['def'][name].type?.PlainType!.name}_init`, ir: initCall });
                new IR('p_pop');//弹出init创建的指针
                return { startIR: startIR, endIR: initCall, truelist: [], falselist: [] };
            } else {
                return { startIR: startIR, endIR: startIR, truelist: [], falselist: [] };
            }
        }
    }
    else if (node['load'] != undefined) {
        let type = (scope as BlockScope).getProp(node['load']).prop.type!;
        let offset = (scope as BlockScope).getPropOffset(node['load']);
        let size = (scope as BlockScope).getPropSize(node['load']);
        let ir: IR;
        let virtualIR: {
            opCode: keyof typeof OPCODE,
            operand1?: number,
            operand2?: number,
            operand3?: number,
        } | undefined;
        if (!isAssignment) {
            if (isPointType(type)) {
                ir = new IR('p_load', offset);
            } else {
                if (isGetAddress) {
                    ir = new IR('load_address', offset);
                }
                else {
                    ir = new IR('valueType_load', offset, size);
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
                    virtualIR = { opCode: 'valueType_store', operand1: offset, operand2: size }
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
        let argTypes: TypeUsed[] = [];
        let args = node['_new']._arguments;
        //先处理参数
        for (let i = args.length - 1; i >= 0; i--) {
            argTypes.push(args[args.length - 1 - i].type!);//顺序获取type
            let nrRet = nodeRecursion(scope, args[i], label, frameLevel, false, true, false, singleLevelThis, functionWrapName);//逆序压参
            if (args[i].type!.PlainType && args[i].type!.PlainType!.name == 'bool') {
                if (nrRet.truelist.length > 0 || nrRet.falselist.length > 0) {//如果bool值需要回填
                    let trueIR = new IR('const_i8_load', 1);
                    let jmp = new IR('jmp');
                    let falseIR = new IR('const_i8_load', 0);
                    jmp.operand1 = falseIR.index - jmp.index + falseIR.length;
                    backPatch(nrRet.truelist, trueIR.index);//回填true
                    backPatch(nrRet.falselist, falseIR.index);//回填false
                }
            }
        }
        let ir = new IR('_new', undefined, undefined, undefined);
        typeRelocationTable.push({ t1: node['_new'].type.PlainType.name, ir: ir });
        let initCall = new IR('abs_call', undefined, undefined, undefined);
        irAbsoluteAddressRelocationTable.push({ sym: `${node['_new'].type.PlainType.name}_init`, ir: initCall });
        let constructorCall = new IR('abs_call', undefined, undefined, undefined);//执行调用
        let sign = `@constructor:${node['_new'].type.PlainType.name} ${FunctionSignWithArgumentAndRetType(argTypes, { PlainType: { name: 'void' } })}`;//构造函数的签名
        irAbsoluteAddressRelocationTable.push({ sym: sign, ir: constructorCall });
        return { startIR: ir, endIR: constructorCall, truelist: [], falselist: [] };
    }
    else if (node['||'] != undefined) {
        let left = nodeRecursion(scope, node['||'].leftChild, label, frameLevel, false, false, false, singleLevelThis, functionWrapName);
        if (left.falselist.length == 0 && left.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            left.truelist.push(new IR('i_if_eq'));
        }
        let right = nodeRecursion(scope, node['||'].rightChild, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let endIR: IR;
        if (right.falselist.length == 0 && right.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            endIR = new IR('i_if_ne')
            right.falselist.push(endIR);
        } else {
            endIR = right.endIR;
        }
        backPatch(left.falselist, right.startIR.index);
        let truelist = merge(left.truelist, right.truelist);
        return { startIR: left.startIR, endIR: endIR, truelist: truelist, falselist: right.falselist, isRightVaiable: true };
    }
    else if (node['&&'] != undefined) {
        let left = nodeRecursion(scope, node['&&'].leftChild, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        if (left.falselist.length == 0 && left.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            left.falselist.push(new IR('i_if_ne'));
        }
        let right = nodeRecursion(scope, node['&&'].rightChild, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let endIR: IR;
        if (right.falselist.length == 0 && right.truelist.length == 0) {//如果没有回填，则为其创建回填指令
            endIR = new IR('i_if_ne');
            right.falselist.push(endIR);
        } else {
            endIR = right.endIR;
        }
        backPatch(left.truelist, right.startIR.index);
        let falselist = merge(left.falselist, right.falselist);
        return { startIR: left.startIR, endIR: endIR, truelist: right.truelist, falselist: falselist, isRightVaiable: true };
    }
    else if (node['ifElseStmt'] != undefined) {
        let condition = nodeRecursion(scope, node['ifElseStmt'].condition, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        if (condition.truelist.length == 0 && condition.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('i_if_ne');
            condition.falselist.push(ir);
        }
        let block1Ret = BlockScan(new BlockScope(scope, undefined, node['ifElseStmt'].stmt1, { program }), label, frameLevel + 1, singleLevelThis, functionWrapName);
        let jmp = new IR('jmp');
        let block2Ret = BlockScan(new BlockScope(scope, undefined, node['ifElseStmt'].stmt2, { program }), label, frameLevel + 1, singleLevelThis, functionWrapName);
        jmp.operand1 = block2Ret.endIR.index - jmp.index + block2Ret.endIR.length;
        backPatch(condition.truelist, block1Ret.startIR.index);
        backPatch(condition.falselist, block2Ret.startIR.index);
        return { startIR: condition.startIR, endIR: block2Ret.endIR, truelist: [], falselist: [], jmpToFunctionEnd: block1Ret.jmpToFunctionEnd.concat(block2Ret.jmpToFunctionEnd) };
    }
    else if (node['ifStmt'] != undefined) {
        let condition = nodeRecursion(scope, node['ifStmt'].condition, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        if (condition.truelist.length == 0 && condition.falselist.length == 0) {//如果bool值不是通过布尔运算得到的，则必须为其插入一个判断指令
            let ir = new IR('i_if_ne');
            condition.falselist.push(ir);
        }
        let blockRet = BlockScan(new BlockScope(scope, undefined, node['ifStmt'].stmt, { program }), label, frameLevel + 1, singleLevelThis, functionWrapName);
        backPatch(condition.truelist, blockRet.startIR.index);
        backPatch(condition.falselist, blockRet.endIR.index + 1);
        return { startIR: condition.startIR, endIR: blockRet.endIR, truelist: [], falselist: [], jmpToFunctionEnd: blockRet.jmpToFunctionEnd };
    }
    else if (node['ret'] != undefined) {
        let startIR: IR;
        let jmpToFunctionEnd: IR[] = [];
        if (node['ret'] != '') {
            let ret = nodeRecursion(scope, node['ret'], label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
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
            new IR('pop_stack_map', frameLevel);
            startIR = new IR('jmp');
            jmpToFunctionEnd.push(startIR);
        }
        return { startIR: startIR, endIR: jmpToFunctionEnd[0], truelist: [], falselist: [], jmpToFunctionEnd: jmpToFunctionEnd };
    } else if (node['call'] != undefined) {
        let startIR: IR | undefined = undefined;
        //参数逆序压栈
        for (let i = node['call']._arguments.length - 1; i >= 0; i--) {
            let nodeRet = nodeRecursion(scope, node['call']._arguments[i], label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
            if (node['call']._arguments[i].type!.PlainType && node['call']._arguments[i].type!.PlainType!.name == 'bool') {
                if (nodeRet.truelist.length > 0 || nodeRet.falselist.length > 0) {//如果bool值需要回填
                    let trueIR = new IR('const_i8_load', 1);
                    let jmp = new IR('jmp');
                    let falseIR = new IR('const_i8_load', 0);
                    jmp.operand1 = falseIR.index - jmp.index + falseIR.length;
                    backPatch(nodeRet.truelist, trueIR.index);//回填true
                    backPatch(nodeRet.falselist, falseIR.index);//回填false
                }
            }
            if (startIR == undefined) {
                startIR = nodeRet.startIR;
            }
        }
        //获取函数对象
        let nodeRet = nodeRecursion(scope, node['call'].functionObj, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        if (startIR == undefined) {
            startIR = nodeRet.startIR;
        }
        let call = new IR('call');
        return { startIR: startIR, endIR: call, truelist: [], falselist: [], jmpToFunctionEnd: [], isRightVaiable: true };
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
            let astRet = nodeRecursion(scope, ast, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
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
        let leftObj = nodeRecursion(scope, node['='].leftChild, label, frameLevel, false, true, true, singleLevelThis, functionWrapName);
        let rightObj = nodeRecursion(scope, node['='].rightChild, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);

        let type = node['='].leftChild.type!;
        if (type!.PlainType?.name == 'bool') {
            if (rightObj.truelist.length > 0 || rightObj.falselist.length > 0) {//如果bool值需要回填
                let trueIR = new IR('const_i8_load', 1);
                let jmp = new IR('jmp');
                let falseIR = new IR('const_i8_load', 0);
                jmp.operand1 = falseIR.index - jmp.index + falseIR.length;
                backPatch(rightObj.truelist, trueIR.index);//回填true
                backPatch(rightObj.truelist, falseIR.index);//回填false
            }
        }
        let virtualIR = leftObj.virtualIR!;
        let endIR = new IR(virtualIR.opCode, virtualIR.operand1, virtualIR.operand2, virtualIR.operand3);
        return { startIR: rightObj.startIR, endIR: endIR, truelist: [], falselist: [], jmpToFunctionEnd: [], isRightVaiable: true };
    }
    else if (node['++'] != undefined) {
        let left = nodeRecursion(scope, node['++'], label, frameLevel, false, true, true, singleLevelThis, functionWrapName);//取得location
        nodeRecursion(scope, node['++'], label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let endIR: IR;
        let virtualIR = left.virtualIR!;
        if (node['++'].type!.PlainType?.name == 'int') {
            new IR('i32_inc');
            endIR = new IR(virtualIR.opCode, virtualIR.operand1, virtualIR.operand2, virtualIR.operand3);
        } else {
            throw `暂时不支持类型:${node['++'].type!.PlainType?.name}的++`;
        }
        return { startIR: left.startIR, endIR: endIR, truelist: [], falselist: [], jmpToFunctionEnd: [], isRightVaiable: true };
    }
    else if (node['--'] != undefined) {
        let left = nodeRecursion(scope, node['--'], label, frameLevel, false, true, true, singleLevelThis, functionWrapName);//取得location
        nodeRecursion(scope, node['--'], label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let endIR: IR;
        let virtualIR = left.virtualIR!;
        if (node['--'].type!.PlainType?.name == 'int') {
            new IR('i32_dec');
            endIR = new IR(virtualIR.opCode, virtualIR.operand1, virtualIR.operand2, virtualIR.operand3);
        } else {
            throw `暂时不支持类型:${node['--'].type!.PlainType?.name}的++`;
        }
        return { startIR: left.startIR, endIR: endIR, truelist: [], falselist: [], jmpToFunctionEnd: [], isRightVaiable: true };
    }
    else if (node['_for'] != undefined) {
        let startIR: IR | undefined;
        if (node['_for'].init) {
            let initRet = nodeRecursion(scope, node['_for'].init, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
            startIR = initRet.startIR;
        }
        let conditionStartIR: IR | undefined;
        let trueList: IR[] = [];
        let falseList: IR[] = [];
        if (node['_for'].condition) {
            let conditionRet = nodeRecursion(scope, node['_for'].condition, label, frameLevel, false, true, false, false, functionWrapName);
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
        let jmpToFunctionEnd: IR[] = [];
        let forLoopBodyStratIR: IR | undefined;
        if (node['_for'].stmt.desc == 'ASTNode') {
            let nr = nodeRecursion(scope, node['_for'].stmt as ASTNode, label, frameLevel, false, true, false, false, functionWrapName);
            if (!startIR) {
                startIR = nr.startIR;
            }
            forLoopBodyStratIR = nr.startIR;
            jmpToFunctionEnd = nr.jmpToFunctionEnd ?? [];
        } else {
            let blockRet = BlockScan(new BlockScope(scope, undefined, node['_for'].stmt, { program }), label, frameLevel + 1, singleLevelThis, functionWrapName);
            if (!startIR) {
                startIR = blockRet.startIR;
            }
            forLoopBodyStratIR = blockRet.startIR;
            jmpToFunctionEnd = blockRet.jmpToFunctionEnd;
        }
        label.pop();
        if (node['_for'].step) {
            nodeRecursion(scope, node['_for'].step, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        }
        let loop = new IR('jmp');
        backPatch(breakIRs, loop.index + 1);
        if (conditionStartIR) {
            loop.operand1 = conditionStartIR.index - loop.index;
            if (trueList.length > 0 || falseList.length > 0) {
                backPatch(falseList, loop.index + 1);//for语句后面一定会有指令(至少一定会有一条ret或者pop_stackFrame指令,因为for一定是定义在functio或者block中的)
                backPatch(trueList, forLoopBodyStratIR.index);
            }
            backPatch(continueIRs, conditionStartIR.index);
        } else {
            loop.operand1 = forLoopBodyStratIR.index - loop.index;
            backPatch(continueIRs, forLoopBodyStratIR.index);
        }
        return { startIR: startIR, endIR: loop, truelist: [], falselist: [], jmpToFunctionEnd };
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
        let left = nodeRecursion(scope, node['[]'].leftChild, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let right = nodeRecursion(scope, node['[]'].rightChild, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let innerType = node['[]'].leftChild.type!.ArrayType!.innerType;
        let ir: IR;
        let virtualIR: {
            opCode: keyof typeof OPCODE,
            operand1?: number,
            operand2?: number,
            operand3?: number,
        } | undefined;
        if (!isAssignment) {
            if (isPointType(innerType)) {
                ir = new IR('array_get_point', globalVariable.pointSize);
            } else {
                let elementSize = propSize(innerType);
                if (isGetAddress) {
                    ir = new IR('array_get_element_address', elementSize);//地址
                } else {
                    ir = new IR('array_get_valueType', elementSize);
                }
            }
        } else {
            if (isPointType(innerType)) {
                virtualIR = { opCode: 'array_set_point', operand1: globalVariable.pointSize };
            } else {
                let elementSize = propSize(innerType);
                if (isGetAddress) {
                    //见accessField的注释
                    throw `这里是不可能到达的`;
                } else {
                    virtualIR = { opCode: 'array_set_valueType', operand1: elementSize };
                }
            }
            ir = right.endIR;
        }
        return { startIR: left.startIR, endIR: ir, truelist: [], falselist: [], jmpToFunctionEnd: [], virtualIR, isRightVaiable: true };
    }
    else if (node['loadFunctionWrap'] != undefined) {
        node.type!.PlainType!.name = functionWrapName!;//更新functionWrap的名字
        let ir = new IR('p_load', 0);
        return { startIR: ir, endIR: ir, truelist: [], falselist: [], jmpToFunctionEnd: [] };
    }
    else if (node['callEXM'] != undefined) {
        let nrRet = nodeRecursion(scope, node['callEXM'].obj, label, frameLevel, true, true, false, singleLevelThis, functionWrapName);
        //访问一个值类型右值的成员时
        let box = new IR('box');
        //装箱的情况下，一定是一个PlainType
        typeRelocationTable.push({ t1: node['callEXM'].obj.type!.PlainType!.name, ir: box });

        let endIR = new IR('abs_call');
        irAbsoluteAddressRelocationTable.push({ sym: `${node['callEXM'].extendFuntionRealname}`, ir: endIR });
        return { startIR: nrRet.startIR, endIR: endIR, truelist: [], falselist: [], jmpToFunctionEnd: [], isRightVaiable: true };
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
        let left = nodeRecursion(scope, node['<']!.leftChild, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let right = nodeRecursion(scope, node['<']!.rightChild, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
        let opIR: IR;
        let tureList: IR[] = [];
        let falseList: IR[] = [];
        if (node['<']!.leftChild.type?.PlainType?.name == 'int' && node['<']!.rightChild.type?.PlainType?.name == 'int') {
            if (is_or_left_child) {
                opIR = new IR('i_if_ge');
                falseList.push(opIR)
            } else {
                opIR = new IR('i_if_lt');
                tureList.push(opIR)
            }
        } else {
            throw `vm 暂未支持${TypeUsedSign(node['<']!.leftChild.type!)}的<操作`;
        }
        return { startIR: left.startIR, endIR: opIR, truelist: tureList, falselist: falseList, isRightVaiable: true };
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
    if (isPointType(type)) {
        endIR = new IR('p_putfield', offset);
    } else {
        endIR = new IR('valueType_putfield', offset, propSize(type));
    }
    return endIR;
}
/**
 * 
 * @param blockScope 
 * @param label 
 * @param argumentMap 
 * @param frameLevel block的层级，从function开始为1，每次遇到嵌套的block则加一
 * @param singleLevelThis 在构造函数和init代码遇到this节点只需要取一层，成员函数中需要取两层，要向下传递(函数中定义的函数也要保持一致)，program中的函数和扩展函数不允许使用this,取值无所谓
 * @returns 
 */
function BlockScan(blockScope: BlockScope, label: { name: string, frameLevel: number, breakIRs: IR[], continueIRs: IR[] }[], frameLevel: number, singleLevelThis: boolean, functionWrapName: string | undefined): { startIR: IR, endIR: IR, jmpToFunctionEnd: IR[], stackFrame: { name: string, type: TypeUsed }[] } {
    let stackFrameMapIndex = globalVariable.stackFrameMapIndex++;
    let startIR: IR = new IR('push_stack_map', undefined, undefined, undefined);
    stackFrameRelocationTable.push({ sym: `@StackFrame_${stackFrameMapIndex}`, ir: startIR });
    if (frameLevel == 1) {//处于函数scope中
        //任何函数(除了扩展函数)都需要这个变量，这个变量保存着this指针或者包裹类指针的值
        new IR('alloc', globalVariable.pointSize);//给包裹类或者this指针分配位置
        new IR('p_store', 0);//保存this或者包裹类指针
    }
    let endIR: IR;
    let jmpToFunctionEnd: IR[] = [];//记录所有返回指令;
    for (let i = 0; i < blockScope.block!.body.length; i++) {
        let nodeOrBlock = blockScope.block!.body[i];
        if (nodeOrBlock.desc == 'ASTNode') {
            let nodeRet = nodeRecursion(blockScope, nodeOrBlock as ASTNode, label, frameLevel, false, true, false, singleLevelThis, functionWrapName);
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
                if (isPointType(stmtType)) {
                    endIR = new IR('p_pop');
                } else {
                    new IR('valueType_pop', propSize(stmtType));
                }
            }
        } else {
            let block = nodeOrBlock as Block;
            let blockRet = BlockScan(new BlockScope(blockScope, undefined, block, { program }), label, frameLevel + 1, singleLevelThis, functionWrapName);
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
    stackFrame.push({ name: '@this_or_funOjb', type: { PlainType: { name: '@point' } } });
    for (let k in blockScope.property) {
        stackFrame.push({ name: k, type: blockScope.getProp(k).prop.type! });
    }
    stackFrameTable[`@StackFrame_${stackFrameMapIndex}`] = { baseOffset: blockScope.baseOffset, frame: stackFrame };
    return { startIR: startIR, endIR: endIR!, jmpToFunctionEnd: jmpToFunctionEnd, stackFrame };
}
function propSize(type: TypeUsed): number {
    if (type.PlainType != undefined) {
        if (!isPointType(type)) {
            return program.getDefinedType(type.PlainType.name).size!;
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
    let functionIndex = globalVariable.functionIndex++;
    let functionWrapName = `@functionWrap_${functionIndex}`;
    let property: VariableDescriptor = {};
    //为函数对象创建一些必要值(this和捕获变量)
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
    blockScope.parent = undefined;//查询完捕获变量之后切断和外层函数的联系
    //注册函数容器
    program.setDefinedType(functionWrapName, {
        operatorOverload: {},
        _constructor: {},
        property: property,
        size: globalVariable.pointSize + Object.keys(fun.capture).length * globalVariable.pointSize
    });
    programScope.registerClass(functionWrapName);//注册类型
    registerType({ PlainType: { name: functionWrapName } });//在类型表中注册函数包裹类的类型
    let functionIRContainer = new IRContainer(`@function_${functionIndex}`);
    IRContainer.setContainer(functionIRContainer);
    if (!fun.isNative) {
        let blockScanRet = BlockScan(blockScope, [], 1, false, functionWrapName);
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
 * 生成一个普通函数(构造函数和操作符重载函数)，这些函数不能作为函数对象返回，因为没有函数包裹类
 * @param blockScope 
 * @param fun 
 * @param functionName 函数在符号表中的名字
 * @returns 
 */
function constructorFunctionGen(blockScope: BlockScope, fun: FunctionType, functionName: string): { text: string, irContainer: IRContainer } {
    let lastSymbol = IRContainer.getContainer();//类似回溯，保留现场
    let functionIRContainer = new IRContainer(functionName);
    IRContainer.setContainer(functionIRContainer);
    let blockScanRet = BlockScan(blockScope, [], 1, true, undefined);
    new IR('p_load', 0);//读取this指针到计算栈
    let retIR = new IR('ret');
    for (let ir of blockScanRet.jmpToFunctionEnd) {
        ir.operand1 = retIR.index - ir.index;//处理所有ret jmp
    }
    IRContainer.setContainer(lastSymbol);//回退
    return { text: functionIRContainer.name, irContainer: functionIRContainer };
}
/**
 * 这个函数用于创建一个扩展函数对象
 * 里面代码和constructorFunctionGen基本一样，两个区别
 * 1.因为不是构造调用，所以返回的时候不需要往计算栈写指针了
 * 2.因为没有this和包裹类,所以最前面的代码省略了alloc 8和p_store这两条
 * @param blockScope 
 * @param fun 
 * @param functionName 函数在符号表中的名字
 * @returns 
 */
function extensionMethodWrapFunctionGen(blockScope: BlockScope, fun: FunctionType, functionName: string, extendTypeName: string): { text: string, irContainer: IRContainer } {
    let lastSymbol = IRContainer.getContainer();//类似回溯，保留现场
    let functionIRContainer = new IRContainer(functionName);
    IRContainer.setContainer(functionIRContainer);

    let stackFrameMapIndex = globalVariable.stackFrameMapIndex++;
    let startIR: IR = new IR('push_stack_map', undefined, undefined, undefined);
    stackFrameRelocationTable.push({ sym: `@StackFrame_${stackFrameMapIndex}`, ir: startIR });
    /**
     * 扩展函数体只有两个节点，第一个是定义捕获闭包类，第二个是ret一个函数
     * 这个捕获闭包类只有一个成员，就是扩展的this,所以强制cast，使得这个闭包类和原来对象重叠即可
     * 所以如果是值类型，是不需要初始化这个闭包了，否则这个闭包持有的对象就是新的值了
     */
    //值类型的话，第一个AST直接忽略
    if (program.getDefinedType(extendTypeName)?.modifier == 'valuetype') {
        new IR('alloc', 8);
        new IR('p_store', 0);

        let name = Object.keys((fun.body!.body[0] as ASTNode).def!)[0];
        blockScope.setProp(name, (fun.body!.body[0] as ASTNode).def![name]);


        let nrRet = nodeRecursion(blockScope, (fun.body!.body[1] as ASTNode), [], 1, false, true, false, true, undefined);
        let retIR = new IR('ret');
        nrRet.jmpToFunctionEnd![0].operand1 = retIR.index - nrRet.jmpToFunctionEnd![0].index;// 有且仅有一个ret语句
    } else {
        nodeRecursion(blockScope, (fun.body!.body[0] as ASTNode), [], 1, false, true, false, true, undefined);
        let nrRet2 = nodeRecursion(blockScope, (fun.body!.body[1] as ASTNode), [], 1, false, true, false, true, undefined);
        let retIR = new IR('ret');
        nrRet2.jmpToFunctionEnd![0].operand1 = retIR.index - nrRet2.jmpToFunctionEnd![0].index;// 有且仅有一个ret语句
    }
    //都不加stackFrame_popup了,因为第二个AST就是ret语句，已经有了
    let stackFrame: { name: string, type: TypeUsed }[] = [];
    stackFrame.push({ name: '@this_or_funOjb', type: { PlainType: { name: '@point' } } });
    stackFrameTable[`@StackFrame_${stackFrameMapIndex}`] = { baseOffset: blockScope.baseOffset, frame: stackFrame };

    IRContainer.setContainer(lastSymbol);//回退
    return { text: functionIRContainer.name, irContainer: functionIRContainer };
}
function classScan(classScope: ClassScope) {
    let lastSymbol = IRContainer.getContainer();//类似回溯，保留现场
    let symbol = new IRContainer(`${classScope.className}_init`);
    IRContainer.setContainer(symbol);
    let startIR: IR = new IR('push_stack_map', undefined, undefined, undefined);
    stackFrameRelocationTable.push({ sym: `@StackFrame_0`, ir: startIR });
    new IR('alloc', globalVariable.pointSize);//给包裹类分配位置
    new IR('p_store', 0);//保存this指针
    //扫描property
    for (let propName of classScope.getPropNames()) {
        let prop = classScope.getProp(propName).prop;
        let offset = classScope.getPropOffset(propName);
        if (prop.initAST != undefined) {
            new IR('p_load', 0);
            let nr = nodeRecursion(classScope, prop.initAST, [], 1, false, true, false, false, undefined);
            putfield(prop.type!, offset, nr.truelist, nr.falselist);
        } else if (prop.type?.FunctionType && prop.type?.FunctionType.body) {
            let blockScope = new BlockScope(classScope, prop.type?.FunctionType, prop.type?.FunctionType.body!, { program });
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
            if (!isPointType(prop.type!)) {
                new IR('p_load', 0);
                new IR('getfield_address', offset);
                let initCall = new IR('abs_call', undefined, undefined, undefined);
                irAbsoluteAddressRelocationTable.push({ sym: `${prop.type!.PlainType!.name}_init`, ir: initCall });
                new IR('p_pop');//弹出init创建的指针
            }
        }
    }
    //扫描构造函数
    //扫描构造函数
    for (let constructorName in program.getDefinedType(classScope.className)._constructor) {
        let _constructor = program.getDefinedType(classScope.className)._constructor[constructorName];
        _constructor.retType = { PlainType: { name: 'void' } };//所有构造函数不允许有返回值
        let blockScope = new BlockScope(classScope, _constructor, _constructor.body!, { program });
        let sign = `@constructor:${classScope.className} ${constructorName}`;//构造函数的签名
        constructorFunctionGen(blockScope, _constructor, sign);
    }
    new IR('p_load', 0);//读取this指针到计算栈
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
    for (let k of program.getDefinedTypeNames()) {
        ClassTableItemGen(program.getDefinedType(k).property, program.getDefinedType(k).size!, k, program.getDefinedType(k).modifier == 'valuetype');
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
export default function programScan() {
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
            let nr = nodeRecursion(programScope, prop.initAST, [], 1, false, true, false, false, undefined);
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
            if (!isPointType(prop.type!)) {
                new IR('program_load');
                new IR('getfield_address', offset);
                let initCall = new IR('abs_call', undefined, undefined, undefined);
                irAbsoluteAddressRelocationTable.push({ sym: `${prop.type!.PlainType!.name}_init`, ir: initCall });
                new IR('p_pop');//弹出init创建的指针
            }
        }
    }
    new IR('ret');//programInit返回
    for (let typeName of program.getDefinedTypeNames()) {
        classScan(programScope.getClassScope(typeName));
    }
    //为所有类生成扩展方法
    for (let extendTypeName in program.extensionMethodsImpl) {
        for (let methodName in program.extensionMethodsImpl[extendTypeName]) {
            let funType = program.extensionMethodsImpl[extendTypeName][methodName];
            let blockScope = new BlockScope(programScope, funType, funType.body!, { program, isEXM: true });
            extensionMethodWrapFunctionGen(blockScope, funType, `@extension@${extendTypeName}@${methodName}`, extendTypeName);
        }
    }

    finallyOutput();
}