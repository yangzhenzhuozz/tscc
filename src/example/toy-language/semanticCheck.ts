//预处理AST
import { FunctionSign, FunctionSignWithArgumentAndRetType, TypeUsedSign, FunctionSignWithArgument } from './lib.js';
import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
import { globalVariable, registerType } from './ir.js'
let program: Program;
let programScope: ProgramScope;
function OperatorOverLoad(scope: Scope, leftObj: ASTNode, rightObj: ASTNode | undefined, originNode: ASTNode, op: opType | opType2): { type: TypeUsed, location?: 'prop' | 'field' | 'stack' | 'array_element' } {
    let leftType = nodeRecursion(scope, leftObj, [], {}).type;
    if (leftType?.PlainType?.name == 'void') {
        throw `void类型没有重载操作符${op}`;
    }
    registerType(leftType);
    //双目运算符
    if (rightObj != undefined) {
        let rightType = nodeRecursion(scope, rightObj, [], {}).type;
        registerType(rightType);
        //如果是数组的[]运算
        if (op == '[]' && leftType.ArrayType != undefined) {
            typeCheck(rightType, { PlainType: { name: 'int' } }, `数组索引必须是int`);
            return { type: leftType.ArrayType.innerType, location: 'array_element' };
        } else {
            let sign = FunctionSignWithArgument([rightType]);
            let opFunction = program.definedType[leftType.PlainType!.name].operatorOverload[op as opType]?.[sign];
            if (opFunction == undefined) {
                throw `类型${TypeUsedSign(leftType)}没有 ${op} (${TypeUsedSign(rightType)})的重载函数`;
            } else if (opFunction.isNative == undefined || !opFunction.isNative) {
                delete originNode[op];//删除原来的操作符
                originNode.call = { functionObj: { desc: 'ASTNode', loadOperatorOverload: [op, sign] }, _arguments: [rightObj] };//改为函数调用
            } else {
                //由vm实现
            }
            return { type: opFunction.retType! };
        }
    }
    //单目运算符
    else {
        let sign = FunctionSignWithArgument([]);
        let opFunction = program.definedType[leftType.PlainType!.name].operatorOverload[op as opType]![sign];
        if (opFunction.isNative == undefined || !opFunction.isNative) {
            delete originNode[op];//删除原来的操作符
            originNode.call = { functionObj: { desc: 'ASTNode', loadOperatorOverload: [op, sign] }, _arguments: [] };
        } else {
            //由vm实现
        }
        return { type: opFunction.retType! };
    }
}
/**
 * 类型检查,a、b类型必须相同，exception可以匹配任意类型
 * @param a 
 * @param b 
 */
function typeCheck(a: TypeUsed, b: TypeUsed, msg: string): void {
    let ta = TypeUsedSign(a);
    let tb = TypeUsedSign(b);
    if (ta == 'exception' || tb == 'exception') {//遇到exception不作判断，因为throw语句可以结束代码块
        return;
    }
    if (ta != tb) {
        throw `类型不匹配:${ta} - ${tb}:   ${msg}`;
    }
}
/**
 * 推导AST类型
 * @param scope 
 * @param node 
 * @param assignmentObj 赋值语句a=b中的b
 * @param declareRetType 保存返回值类型的地方
 * type表示AST推导出来的类型
 * retType表示返回值类型
 * 
 */
function nodeRecursion(scope: Scope, node: ASTNode, label: string[], declareRetType: { retType?: TypeUsed }, assignmentObj?: ASTNode): { type: TypeUsed, retType?: TypeUsed, hasRet: boolean, location?: 'prop' | 'field' | 'stack' | 'array_element' } {
    let result: { type: TypeUsed, retType?: TypeUsed, hasRet: boolean, location?: 'prop' | 'field' | 'stack' | 'array_element' };
    //因为有的指令在本阶段不出现，所以下面的分支没有列出全部的AST操作码
    if (node["def"] != undefined) {
        let blockScope = (scope as BlockScope);//def节点是block专属
        let name = Object.keys(node['def'])[0];
        blockScope.setProp(name, node['def'][name], node);
        let initType: TypeUsed | undefined;
        if (node['def'][name].initAST != undefined) {
            initType = nodeRecursion(scope, node['def'][name].initAST!, label, declareRetType).type;
        }
        let prop = node['def'][name];
        if (prop.type == undefined) {//如果是需要进行类型推导，则推导类型
            prop.type = initType;
        } else {//否则检查initialization的类型和声明类型是否一致
            if (initType != undefined) {
                typeCheck(initType!, prop.type!, `声明类型和初始化类型不匹配`);
            }
            if (node['def'][name].type!.FunctionType?.body != undefined) {
                /**
                 * 下面两种代码
                 * function f1():int{};
                 * var f1:()=>int;
                 * 都会生成一个def节点,一个有body，一个没有(函数声明没有，函数定义有)
                 * 所以遇到这种情况，通通扫描一次，在functionScan中，如果function.body==undefined,则直接放弃扫描
                */
                functionScan(new BlockScope(scope, node['def'][name].type!.FunctionType!, node['def'][name].type!.FunctionType!.body!), node['def'][name].type!.FunctionType!);//如果是定义了函数，则扫描一下
            }
        }
        if (prop.type?.PlainType?.name == 'void') {
            throw `void无法计算大小,任何成员都不能是void类型`;
        }
        result = { type: prop.type!, hasRet: false };//经过推导，类型已经确定
    }
    else if (node["load"] != undefined) {
        let name = node["load"];
        let propDesc = scope.getProp(name);
        if (propDesc.scope instanceof ClassScope) {
            delete node.load;//把load改为access
            node.accessField = { obj: { desc: 'ASTNode', _this: '' }, field: name };//load阶段还不知道是不是property,由access节点处理进行判断
            return nodeRecursion(scope, node, label, declareRetType, assignmentObj);//处理access节点需要附带这个参数
        } else if (propDesc.scope instanceof ProgramScope) {
            delete node.load;//把load改为access
            node.accessField = { obj: { desc: 'ASTNode', _program: '' }, field: name };//load阶段还不知道是不是property,由access节点处理进行判断
            return nodeRecursion(scope, node, label, declareRetType, assignmentObj);//处理access节点需要附带这个参数
        } else if (propDesc.scope instanceof BlockScope) {//blockScope
            if (assignmentObj != undefined) {
                if (propDesc.prop.variable == 'val') {//load不可能变成access
                    throw `变量${name}声明为val,禁止赋值`;
                }
            }
            if (propDesc.crossFunction) {
                propDesc.scope.defNodes[name].crossFunctionLoad.push(node);//跨函数的load节点
            } else {
                propDesc.scope.defNodes[name].loads.push(node);//记录下bolck有多少def节点需要被打包到闭包类,每个prop被那些地方load的,block扫描完毕的时候的时候把这些load节点全部替换
            }
            result = { type: propDesc.prop.type!, hasRet: false, location: 'stack' };//如果是读取block内部定义的变量,则这个变量一点是已经被推导出类型的，因为代码区域的变量是先定义后使用的
        } else {
            throw `未定义的其他类型Scope`;
        }

    }
    else if (node["call"] != undefined) {
        let funType = nodeRecursion(scope, node["call"].functionObj, label, declareRetType).type.FunctionType!;//FunctionType不可能为undefined
        if (funType.retType == undefined) {//说明函数没有被推导过
            functionScan(new BlockScope(scope, funType, funType.body!), funType);
        }
        if (funType == undefined) {
            throw `必须调用一个函数`;
        }
        let keyOfDeclare = Object.keys(funType._arguments);
        if (keyOfDeclare.length != node["call"]._arguments.length) {
            throw `函数需要${keyOfDeclare.length}个参数，实际传递了${node["call"]._arguments.length}个参数`;
        } else {
            for (let i = 0; i < node["call"]._arguments.length; i++) {
                let argNode = node["call"]._arguments[i];
                let arg_type = nodeRecursion(scope, argNode, label, declareRetType).type;
                typeCheck(arg_type, funType._arguments[keyOfDeclare[i]].type!, `函数调用的参数类型不匹配`);//参数类型检查
            }
        }
        result = { type: funType.retType!, hasRet: false };
    }
    else if (node["accessField"] != undefined) {
        let accessName = node["accessField"].field;
        let accessedType = nodeRecursion(scope, node["accessField"].obj, label, declareRetType).type;
        let type: undefined | TypeUsed;
        if (accessedType.ArrayType != undefined) {
            if (node["accessField"].field != 'length') {
                throw `数组只有length属性可访问`;
            } else {
                result = { type: { PlainType: { name: 'number' } }, hasRet: false };
            }
        } else if (accessedType.FunctionType != undefined) {
            throw `函数目前没有任何属性可访问`;
        } else if (accessedType.ProgramType != undefined) {
            let prop = program.property[accessName];
            if (prop == undefined) {
                throw `访问了program中不存在的属性${accessName}`;
            }
            type = prop.type;
            if (type == undefined) {
                let initAST = prop.initAST!;
                if ((initAST).hasTypeInferRecursion) {
                    throw `类型推导出现了循环:program.${accessName}`;
                }
                (initAST).hasTypeInferRecursion = true;//标记一下这个属性已经在推导路径中被使用过了
                type = nodeRecursion(programScope, initAST, label, declareRetType).type;
                delete (initAST).hasTypeInferRecursion;//删除标记,回溯常用手法
            }
            if (assignmentObj != undefined) {
                if (prop.variable == 'val') {
                    throw `program.${accessName}声明为val,禁止赋值`;
                }
            }
            result = { type: type, hasRet: false, location: 'field' };
        } else {
            let className = accessedType.PlainType!.name;
            let prop = program.definedType[className].property[accessName];
            if (prop == undefined) {
                throw `访问了类型${className}中不存在的属性${accessName}`;
            }
            let classScope = programScope.getClassScope(className);//切换scope
            if (prop.getter != undefined || prop.setter != undefined) {
                if (assignmentObj) {
                    if (prop.setter == undefined) {
                        throw `${className}.${accessName}没有setter`;
                    } else {
                        //改成set调用
                        functionScan(new BlockScope(classScope, prop.setter, prop.setter.body!), prop.setter);
                        type = prop.setter._arguments[0].type!;//argument已经定义了类型
                        node.call = { functionObj: { desc: 'ASTNode', accessField: { obj: node["accessField"].obj, field: `@set_${node["accessField"].field}` } }, _arguments: [assignmentObj] };
                    }
                } else {
                    if (prop.getter == undefined) {
                        throw `${className}.${accessName}没有getter`;
                    } else {
                        //改成get调用
                        type = functionScan(new BlockScope(classScope, prop.getter, prop.getter.body!), prop.getter);
                        node.call = { functionObj: { desc: 'ASTNode', accessField: { obj: node["accessField"].obj, field: `@get_${node["accessField"].field}` } }, _arguments: [] };//改为get
                    }
                }
                delete node.accessField;//删除accessField节点
                result = { type: type, location: 'prop', hasRet: false };
            } else {
                type = prop.type;
                if (type == undefined) {
                    let initAST = prop.initAST!;
                    if ((initAST).hasTypeInferRecursion) {
                        throw `类型推导出现了循环:${className}.${accessName}`;
                    }
                    (initAST).hasTypeInferRecursion = true;//标记一下这个属性已经在推导路径中被使用过了
                    type = nodeRecursion(classScope, initAST, label, declareRetType).type;
                    delete (initAST).hasTypeInferRecursion;//删除标记,回溯常用手法
                }
                if (assignmentObj != undefined) {
                    if (prop.variable == 'val') {
                        throw `${className}.${accessName}声明为val,禁止赋值`;
                    }
                }
                result = { type: type, hasRet: false, location: 'field' };
            }
        }
    }
    else if (node["_super"] != undefined) {
        throw `不支持super`;
    }
    else if (node["_this"] != undefined) {
        if (scope instanceof BlockScope) {
            if (scope.classScope != undefined) {
                result = { type: { PlainType: { name: scope.classScope.className } }, hasRet: false };
            } else {
                throw `不在class内部不能使用this`;
            }
        } else if (scope instanceof ClassScope) {
            result = { type: { PlainType: { name: scope.className } }, hasRet: false };
        } else {
            throw `不在class内部不能使用this`;
        }
    }
    else if (node["_program"] != undefined) {
        result = { type: { ProgramType: "" }, hasRet: false };
    }
    else if (node["immediate"] != undefined) {
        if (node["immediate"].primiviteValue != undefined) {
            if (isNaN(Number(node["immediate"].primiviteValue))) {
                result = { type: { PlainType: { name: 'string' } }, hasRet: false };
            } else {
                result = { type: { PlainType: { name: 'int' } }, hasRet: false };
            }
        } else {//是一个函数体
            functionScan(new BlockScope(scope, node["immediate"].functionValue!, node["immediate"].functionValue!.body!), node["immediate"].functionValue!);
            let functionType: FunctionType = {
                isNative: node["immediate"].functionValue!.isNative,
                _arguments: node["immediate"].functionValue!._arguments,
                retType: node["immediate"].functionValue!.retType,
                capture: node["immediate"].functionValue!.capture,
                templates: node["immediate"].functionValue!.templates,
            };
            /**
             * 这里返回一个函数类型，不带body，因为只用于类型声明
             * 因为下面这中代码:
             * var a=(){body};
             * a.type就不用带body了，如果是
             * function a(){body}
             * 这种代码，a.type中带有body
             * 在代码生成阶段注意判断是类型声明还是函数定义
             * var a=()=>{body}  -- a只是一个类型
             * function a(){body} -- a是一个函数定义
             */
            result = { type: { FunctionType: functionType }, hasRet: false };
        }
    }
    else if (node["="] != undefined) {
        let right = nodeRecursion(scope, node['='].rightChild, label, declareRetType);//计算右节点
        let left = nodeRecursion(scope, node['='].leftChild, label, declareRetType, node['='].rightChild);
        if (left.location != undefined && left.location == 'prop') {
            //已经在access节点的处理阶段被更改为call prop_set了,类型检查也做了,无需做任何处理
        } else if (left.location != undefined && (left.location == 'stack' || left.location == 'field' || left.location == 'array_element')) {//数组元素、field以及stack都是左值
            typeCheck(left.type, right.type, `赋值语句左右类型不一致`);//类型检查
        } else {
            throw `只有左值才能赋值`;
        }
        result = { type: { PlainType: { name: 'void' } }, hasRet: false };
    }
    else if (node["+"] != undefined) {
        let op = '+' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["-"] != undefined) {
        let op = '-' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["*"] != undefined) {
        let op = '*' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["/"] != undefined) {
        let op = '/' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["<"] != undefined) {
        let op = '<' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["<="] != undefined) {
        let op = '<=' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node[">"] != undefined) {
        let op = '>' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node[">="] != undefined) {
        let op = '>=' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["=="] != undefined) {
        let op = '==' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["||"] != undefined) {
        let op = '||' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["&&"] != undefined) {
        let op = '&&' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["trycatch"] != undefined) {
        let tryScope = new BlockScope(scope, undefined, node["trycatch"].tryBlock);//catch语句只能出现在block内部
        let tryBlockRet = BlockScan(tryScope, label, declareRetType);//此时的block一定是BlockScope
        let hasRet: boolean = tryBlockRet.hasRet;
        let firstRetType: TypeUsed | undefined;
        if (firstRetType == undefined && tryBlockRet.retType != undefined) {
            firstRetType = tryBlockRet.retType;
        }
        for (let _catch of node["trycatch"].catch_list) {
            let varialbe: VariableDescriptor = {};
            varialbe[_catch.catchVariable] = { variable: 'var', type: _catch.catchType, initAST: { desc: 'ASTNode', loadException: _catch.catchType } };
            let def: ASTNode = { desc: 'ASTNode', def: varialbe };
            let catchBlock = _catch.catchBlock;
            catchBlock.body.unshift(def);//插入一个读取exception指令
            let catchScope = new BlockScope(scope, undefined, catchBlock);//catch语句只能出现在block内部
            let catchBlockRet = BlockScan(catchScope, label, declareRetType ?? firstRetType);//优先使用声明的返回值类型
            if (!catchBlockRet.hasRet) {
                hasRet = false;
            }
            if (firstRetType == undefined && catchBlockRet.retType != undefined) {
                firstRetType = catchBlockRet.retType;
            }
        }
        result = { hasRet: hasRet, retType: firstRetType, type: { PlainType: { name: 'void' } } };
    }
    else if (node["throwStmt"] != undefined) {
        nodeRecursion(scope, node["throwStmt"], label, declareRetType);
        //throw不像ret那样修改retType，所以对于后续的分析无影响
        result = { hasRet: true, type: { PlainType: { name: 'void' } }, retType: { PlainType: { name: 'exception' } } };//throw可以作为任意类型的返回值
    }
    else if (node["ret"] != undefined) {
        let type: TypeUsed;
        if (node["ret"] == '') {
            type = { PlainType: { name: 'void' } };
        } else {
            type = nodeRecursion(scope, node["ret"], label, declareRetType).type;
            if (declareRetType.retType != undefined) {
                typeCheck(type, declareRetType.retType, '返回语句和声明的返回值类型不同');
            } else {
                declareRetType.retType = type;//更新返回值类型
            }
        }
        result = { hasRet: true, type: type, retType: type };
    }
    else if (node["ifStmt"] != undefined) {
        let conditionType = nodeRecursion(scope, node["ifStmt"].condition, label, declareRetType).type;
        typeCheck(conditionType, { PlainType: { name: 'bool' } }, `if条件只能是bool值`);
        let blockScope = new BlockScope(scope, undefined, node["ifStmt"].stmt);//ifStmt语句只能出现在block内部
        let blockRet = BlockScan(blockScope, label, declareRetType);
        result = { hasRet: false, retType: undefined, type: { PlainType: { name: 'void' } } };
    }
    else if (node["ifElseStmt"] != undefined) {
        let type = nodeRecursion(scope, node["ifElseStmt"].condition, label, declareRetType).type;
        typeCheck(type, { PlainType: { name: 'bool' } }, `if条件只能是bool值`);
        let blockScope_1 = new BlockScope(scope, undefined, node["ifElseStmt"].stmt1);//ifElseStmt语句只能出现在block内部
        let if_stmt_ret = BlockScan(blockScope_1, label, declareRetType);
        let blockScope_2 = new BlockScope(scope, undefined, node["ifElseStmt"].stmt2);//ifElseStmt语句只能出现在block内部
        let else_stmt_ret = BlockScan(blockScope_2, label, declareRetType ?? if_stmt_ret.retType);
        let hasRet = if_stmt_ret.hasRet && else_stmt_ret.hasRet;
        result = { hasRet: hasRet, retType: hasRet ? if_stmt_ret.retType : undefined, type: { PlainType: { name: 'void' } } };
    }
    else if (node["do_while"] != undefined) {
        if (node["do_while"].label != undefined) {
            label.push(node["do_while"].label)
        }
        let type = nodeRecursion(scope, node["do_while"].condition, label, declareRetType).type;
        typeCheck(type, { PlainType: { name: 'bool' } }, `do while条件只能是bool值`);
        let blockScope = new BlockScope(scope, undefined, node["do_while"].stmt);//do_while语句只能出现在block内部
        let blockRet = BlockScan(blockScope, label, declareRetType);
        label.pop();
        result = { hasRet: false, retType: undefined, type: { PlainType: { name: 'void' } } };
    }
    else if (node["_while"] != undefined) {
        if (node["_while"].label != undefined) {
            label.push(node["_while"].label)
        }
        let type = nodeRecursion(scope, node["_while"].condition, label, declareRetType).type;
        typeCheck(type, { PlainType: { name: 'bool' } }, `while条件只能是bool值`);
        let blockScope = new BlockScope(scope, undefined, node["_while"].stmt);//while语句只能出现在block内部
        let blockRet = BlockScan(blockScope, label, declareRetType);
        label.pop();
        result = { hasRet: false, retType: undefined, type: { PlainType: { name: 'void' } } };
    }
    else if (node["_for"] != undefined) {
        if (node["_for"].label != undefined) {
            label.push(node["_for"].label)
        }
        if (node["_for"].init) {
            nodeRecursion(scope, node["_for"].init, label, declareRetType);
        }
        if (node["_for"].condition) {
            let type = nodeRecursion(scope, node["_for"].condition, label, declareRetType).type;
            typeCheck(type, { PlainType: { name: 'bool' } }, `for条件只能是bool值或者空`);
        }
        if (node["_for"].step) {
            nodeRecursion(scope, node["_for"].step, label, declareRetType);
        }
        if (node["_for"].stmt.desc == 'ASTNode') {
            nodeRecursion(scope, node["_for"].stmt as ASTNode, label, declareRetType);
        } else {
            let blockScope = new BlockScope(scope, undefined, node["_for"].stmt);//for语句只能出现在block内部
            BlockScan(blockScope, label, declareRetType);
        }
        label.pop();
        result = { hasRet: false, type: { PlainType: { name: 'void' } } };
    }
    else if (node["_break"] != undefined) {
        if (node["_break"].label != '') {
            if (label.indexOf(node["_break"].label) == -1) {
                throw `break使用了未定义的label:${node["_break"].label}`;
            }
        }
        result = { hasRet: false, type: { PlainType: { name: 'void' } } };
    }
    else if (node["_continue"] != undefined) {
        if (node["_continue"].label != '') {
            if (label.indexOf(node["_continue"].label) == -1) {
                throw `break使用了未定义的label:${node["_continue"].label}`;
            }
        }
        result = { hasRet: false, type: { PlainType: { name: 'void' } } };
    }
    else if (node["_instanceof"] != undefined) {
        registerType(node["_instanceof"].type);//这里需要额外注册一下，这个类型不会被nodeRecursion推导，如:obj instanceof ()=>int; obj会被nodeRecursion注册，但是()=>int就不会被注册
        let objType = nodeRecursion(scope, node["_instanceof"].obj, label, declareRetType).type;
        if (objType.PlainType?.name != 'object') {
            throw `只有object类型才可以instanceof`;
        }
        result = { hasRet: false, type: { PlainType: { name: 'bool' } } };
    }
    else if (node["not"] != undefined) {
        let not_obj_type = nodeRecursion(scope, node["not"], label, declareRetType).type;
        typeCheck(not_obj_type, { PlainType: { name: 'bool' } }, `not运算必须是一个bool值`);
        result = { hasRet: false, type: { PlainType: { name: 'bool' } } };
    }
    else if (node["++"] != undefined) {
        let opRet = OperatorOverLoad(scope, node['++'], undefined, node, '++');
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["--"] != undefined) {
        let opRet = OperatorOverLoad(scope, node["--"], undefined, node, '--');
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["[]"] != undefined) {
        let op = '[]' as opType;
        let opRet = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        result = { type: opRet.type, location: opRet.location, hasRet: false };
    }
    else if (node["ternary"] != undefined) {
        let conditionType = nodeRecursion(scope, node["ternary"].condition, label, declareRetType).type;
        typeCheck(conditionType, { PlainType: { name: 'bool' } }, `三目运算符的条件必须是bool值`);
        let t1 = nodeRecursion(scope, node["ternary"].obj1, label, declareRetType).type;
        let t2 = nodeRecursion(scope, node["ternary"].obj2, label, declareRetType).type;
        typeCheck(t1, t2, `三目运算符左右类型不一致`);
        result = { type: t1, hasRet: false };
    }
    else if (node["cast"] != undefined) {
        let srcType = nodeRecursion(scope, node["cast"].obj, label, declareRetType).type;
        let targetType = node['cast'].type;
        if (targetType.PlainType?.name == 'object') {
            //任何对象都可以转换为object
            if (srcType.PlainType != undefined) {
                if (program.definedType[srcType.PlainType.name].modifier == 'valuetype') {
                    node['box'] = node["cast"];//装箱
                    delete node["cast"];
                }
            }
        } else {
            if (srcType.PlainType?.name == 'object') {
                if (targetType.PlainType != undefined) {
                    if (program.definedType[targetType.PlainType.name].modifier == 'valuetype') {
                        node['unbox'] = node["cast"];//拆箱
                        delete node["cast"];
                    }
                }
            } else {
                throw `只有object类型对象才能转换为其他类型`;
            }
        }
        result = { type: targetType, hasRet: false };
    }
    else if (node["_new"] != undefined) {
        if (program.definedType[node["_new"].type.PlainType!.name].modifier == 'valuetype') {
            throw `值类型不能new`;
        }
        let ts: TypeUsed[] = [];
        for (let n of node["_new"]._arguments) {
            ts.push(nodeRecursion(scope, n, label, declareRetType).type);
        }
        let callsign: string = FunctionSignWithArgumentAndRetType(ts, { PlainType: { name: 'void' } });//根据调用参数生成一个签名,构造函数没有返回值
        if (program.definedType[node["_new"].type.PlainType!.name]._constructor[callsign] == undefined) {
            throw '无法找到合适的构造函数'
        }
        result = { type: node["_new"].type, hasRet: false };
    }
    else if (node["_newArray"] != undefined) {
        for (let n of node["_newArray"].initList) {
            let astRet = nodeRecursion(scope, n, label, declareRetType);
            typeCheck(astRet.type, { PlainType: { name: 'int' } }, '数组创建参数只能是int');
        }
        let type: TypeUsed = node["_newArray"].type;
        for (let i = 0; i < node["_newArray"].initList.length + node["_newArray"].placeholder; i++) {
            type = { ArrayType: { innerType: type } };
            registerType(type);//这里需要额外注册一下，这个类型不会被nodeRecursion推导，如:var arr:int[][][]; int[][][]会被注册，但是内部的int[]和int[][]就不会被注册
        }
        result = { type: type, hasRet: false };
    }
    else if (node["_switch"] != undefined) {
        let allCaseHasRet = true;
        let defaultRetType: TypeUsed | undefined;//直接从default语句取返回值类型
        for (let caseStmt of node["_switch"].matchList) {
            let leftObj = node["_switch"].pattern;
            let rightObj = caseStmt.matchObj!;
            caseStmt.condition = { desc: 'ASTNode', '==': { leftChild: leftObj, rightChild: rightObj } };//把switch的case改为if判断
            delete caseStmt.matchObj;//删除matchobj
            let conditionType = OperatorOverLoad(scope, leftObj, rightObj, caseStmt.condition, '==').type;
            if (conditionType.PlainType?.name != 'bool') {
                throw `case列表和switch object必须可以进行==操作，且返回值必须为bool`;
            }
            let caseRet = BlockScan(new BlockScope(scope, undefined, caseStmt.stmt), label, declareRetType);
            if (!caseRet.hasRet) {
                allCaseHasRet = false;
            }
        }
        if (node["_switch"].defalutStmt != undefined) {
            let defaultRet = BlockScan(new BlockScope(scope, undefined, node["_switch"].defalutStmt), label, declareRetType);
            defaultRetType = defaultRet.retType;
            if (!defaultRet.hasRet) {
                allCaseHasRet = false;
            }
        } else {
            allCaseHasRet = false;//如果没有default分支，则认为不是一个返回语句
        }
        result = { type: { PlainType: { name: 'void' } }, hasRet: allCaseHasRet, retType: defaultRetType };
    }
    else if (node["loadException"] != undefined) {
        result = { type: node["loadException"], hasRet: false };
    }
    else if (node["loadArgument"] != undefined) {
        result = { type: node["loadArgument"].type, hasRet: false };
    }
    else {
        throw new Error(`未知节点`);
    }
    node.type = result.type;//给node设置类型
    registerType(result.type);//注册类型，除了instanceof之外的类型都会在这里注册
    return result;
}
let captureWrapIndex = 0;
let wrapClassNames: string[] = [];
/**
 * 返回值表示是否为一个ret block
 * declareRetType 声明的返回值
 * 为了能够修改入参的retType，所以传入了一个对象
 */
function BlockScan(blockScope: BlockScope, label: string[], declareRetType: { retType?: TypeUsed }): { hasRet: boolean, retType?: TypeUsed } {
    let ret: { hasRet: boolean, retType?: TypeUsed } | undefined = undefined;
    for (let i = 0; i < blockScope.block!.body.length; i++) {
        let nodeOrBlock = blockScope.block!.body[i];
        if (nodeOrBlock.desc == 'ASTNode') {
            let node = nodeOrBlock as ASTNode;
            let nodeRet = nodeRecursion(blockScope, node, label, declareRetType);
            ret = { hasRet: nodeRet.hasRet, retType: nodeRet.retType };
        } else {
            let block = nodeOrBlock as Block;
            ret = BlockScan(new BlockScope(blockScope, undefined, block), label, declareRetType);
        }
        if (ret.hasRet) {
            if (i != blockScope.block!.body.length - 1) {
                throw 'return之后不能再有语句';
            }
        }
    }
    if (blockScope.captured.size > 0) {
        for (let k of [...blockScope.captured]) {
            //为每个被捕获的变量创建一个包裹类型
            let sourceType = blockScope.defNodes[k].defNode!.def![k].type!;//到这里type已经推导出来了
            let variable = blockScope.defNodes[k].defNode!.def![k].variable;
            let initAST = blockScope.defNodes[k].defNode!.def![k].initAST;
            let wrapClassName = `@captureWrapClass_${captureWrapIndex++}`;
            let wrapTypeUsed: { PlainType: PlainType; } = { PlainType: { name: wrapClassName } };
            let wrapTypeDef: TypeDef = {
                _constructor: {},
                operatorOverload: {},
                property: {
                    "value": {
                        variable: variable,
                        type: sourceType
                    }
                }
            };
            program.definedType[wrapClassName] = wrapTypeDef;
            wrapClassNames.push(wrapClassName);
            delete blockScope.defNodes[k].defNode!.def![k];//删除def节点原来的所有内容
            blockScope.defNodes[k].defNode!.def![k] = {
                variable: variable,
                type: wrapTypeUsed
            };//重新定义def节点
            if (initAST != undefined) {//如果有初始化部分，则为其创建一个构造函数,并调用构造函数
                let constructorSign = FunctionSignWithArgumentAndRetType([sourceType], { PlainType: { name: 'void' } });
                let _arguments: VariableDescriptor = {};
                _arguments['initVal'] = {
                    variable: 'var',
                    type: sourceType
                };
                wrapTypeDef._constructor[constructorSign] = {
                    capture: {},
                    _construct_for_type: wrapClassName,
                    _arguments: _arguments,
                    body: {
                        desc: 'Block',
                        body: [{
                            desc: 'ASTNode',
                            '=': {
                                leftChild: {
                                    desc: 'ASTNode',
                                    load: 'value',
                                    type: sourceType
                                },
                                rightChild: {
                                    desc: 'ASTNode',
                                    load: 'initVal',
                                    type: sourceType
                                }
                            }
                        }]
                    }
                };
                blockScope.defNodes[k].defNode!.def![k].initAST = { desc: 'ASTNode', _new: { type: wrapTypeUsed, _arguments: [initAST] } };
                //创建改造结束
            }
            //处理load节点
            for (let loadNode of blockScope.defNodes[k].loads) {
                loadNode['accessField'] = {
                    obj: {
                        desc: 'ASTNode',
                        load: k,
                        type: wrapTypeUsed
                    },
                    field: "value"
                };
                delete loadNode.load;//把load改成accessField
            }
            //处理跨函数的load节点
            for (let loadNode of blockScope.defNodes[k].crossFunctionLoad) {
                loadNode['accessField'] = {
                    obj: {
                        desc: 'ASTNode',
                        accessField: {
                            obj: {
                                desc: 'ASTNode',
                                loadFunctionWrap: '',
                                type: {
                                    PlainType: {
                                        name: "@uncreated_function_wrap"//在这里还没有创建函数包裹类的类型，需要在codeGen阶段才创建，这里先留空吧
                                    }
                                }
                            },
                            field: k,
                        },
                        type: wrapTypeUsed
                    },
                    field: "value"
                };
                delete loadNode.load;//把load改成accessField
            }
        }
    }
    if (ret == undefined) {//bolck是个空的
        ret = { hasRet: false };
    }
    return ret;
}
function functionScan(blockScope: BlockScope, fun: FunctionType): TypeUsed {
    if (fun.templates) {
        if (blockScope.classScope) {
            throw `class内部的function不能是模板函数`;
        }
        console.log(fun.templates);
    }
    if ((fun).hasFunctionScan) {//避免已经处理过的函数被重复处理
        /**
         *  var g:bool;
         *  function f1(){
         *      var a=f1();
         *      if(g)
         *          return f1();
         *      else
         *          return 0;
         *  };
         * 这种类型推导需要向后看，直接放弃推导
         */
        if (fun.retType == undefined) {
            throw `无法推导函数返回值类型`;
        }
        return fun.retType;
    } else {
        (fun).hasFunctionScan = true;
    }
    if (fun.isNative || fun.body == undefined) {//函数体,根据有无body判断是函数类型声明还是定义，声明语句不做扫描
        if (fun.retType == undefined) {
            throw `函数声明一定有返回值声明`;
        }
        return fun.retType;
    }
    //为所有参数创建一个def节点，要把参数按顺序压入block最前面,因为是用unshift压入的，所以遍历参数的时候要逆序
    let argIndex = 0;
    let argNames = Object.keys(fun._arguments);
    for (let i = argNames.length - 1; i >= 0; i--) {
        let argumentName = argNames[i];
        let defNode: ASTNode = { desc: 'ASTNode', def: {} };
        defNode.def![argumentName] = { variable: 'var', initAST: { desc: 'ASTNode', loadArgument: { index: argIndex, type: fun._arguments[argumentName].type! } } };
        fun.body!.body.unshift(defNode);//插入args的def指令
        argIndex++;
    }
    let blockRet = BlockScan(blockScope, [], fun);
    if (blockRet.retType == undefined) {//函数声明返回void，block没有返回语句，则设置block返回值为void
        blockRet.retType = { PlainType: { name: 'void' } };
    }
    if (fun.retType == undefined && (blockRet.retType == undefined || blockRet.retType?.PlainType?.name == 'exception')) {
        throw `无法推导返回值`;
    } else {
        if (fun.retType != undefined) {
            typeCheck(fun.retType, blockRet.retType!, `函数声明返回值类型和语句实际返回值类型不一致`);
        } else {
            fun.retType = blockRet.retType;
        }
    }
    return fun.retType!;
}
function ClassScan(classScope: ClassScope) {
    for (let propName of classScope.getPropNames()) {//扫描所有成员
        let prop = classScope.getProp(propName).prop;
        if (prop.getter == undefined && prop.setter == undefined) {//扫描field
            if (prop.initAST != undefined) {
                let initType = nodeRecursion(classScope, prop.initAST, [], {}).type;
                if (prop.type) {
                    typeCheck(initType, prop.type, `属性${propName}声明类型和初始化类型不一致`);
                } else {
                    prop.type = initType;//如果是需要推导的类型，进行填充
                }
            } else if (prop.type?.FunctionType) {
                let blockScope = new BlockScope(classScope, prop.type?.FunctionType, prop.type?.FunctionType.body!);
                functionScan(blockScope, prop.type?.FunctionType);
            }
        } else {//扫描prop
            if (prop.getter != undefined) {
                let blockScope = new BlockScope(classScope, prop.getter, prop.getter.body!);
                functionScan(blockScope, prop.getter);
            }
            if (prop.setter != undefined) {
                let blockScope = new BlockScope(classScope, prop.getter, prop.setter.body!);
                functionScan(blockScope, prop.setter);
            }
        }
        if (prop.type?.PlainType?.name == 'void') {
            throw `void无法计算大小,任何成员都不能是void类型`;
        }
        registerType(prop.type!);//经过推导，类型已经确定了
    }
    let operatorOverloads = program.definedType[classScope.className].operatorOverload;
    for (let op in operatorOverloads) {//扫描重载操作符
        for (let sign in operatorOverloads[op as opType | opType2]) {
            let blockScope = new BlockScope(classScope, operatorOverloads[op as opType | opType2]![sign], operatorOverloads[op as opType | opType2]![sign].body!);
            functionScan(blockScope, operatorOverloads[op as opType | opType2]![sign]);
        }
    }
    //扫描构造函数
    for (let constructorName in program.definedType[classScope.className]._constructor) {
        let _constructor = program.definedType[classScope.className]._constructor[constructorName];
        _constructor.retType = { PlainType: { name: 'void' } };//所有构造函数不允许有返回值
        let blockScope = new BlockScope(classScope, _constructor, _constructor.body!);
        functionScan(blockScope, _constructor);
    }
}
//深度优先搜索，检查是否有值类型直接或者间接包含自身
function valueTypeRecursiveCheck(typeName: string) {
    if (program.definedType[typeName].recursiveFlag == true) {
        throw `值类型${typeName}直接或者间接包含自身`
    } else {
        program.definedType[typeName].recursiveFlag = true;
        for (let fieldName in program.definedType[typeName].property) {//遍历所有成员
            if (program.definedType[typeName].property[fieldName].type!.PlainType != undefined) {
                let fieldTypeName = program.definedType[typeName].property[fieldName].type!.PlainType?.name!;
                if (program.definedType[fieldTypeName].recursiveChecked != true && fieldTypeName != undefined && program.definedType[fieldTypeName].modifier == 'valuetype') {//如果有值类型的成员，则递归遍历
                    valueTypeRecursiveCheck(fieldTypeName);
                }
            }
        }
        program.definedType[typeName].recursiveChecked = true;
    }
}
function sizeof(typeName: string): number {
    let ret = 0;
    switch (typeName) {
        case 'void': throw `void无法计算大小,任何成员都不能是void类型`;
        case 'int': ret = 4; break;
        case 'double': ret = 8; break;
        case 'bool': ret = 1; break;
        case 'byte': ret = 1; break;
        case '@point': ret = 8; break;
        default:
            for (let fieldName in program.definedType[typeName].property) {
                let field = program.definedType[typeName].property[fieldName];
                if (field.type!.PlainType != undefined) {
                    let fieldTypeName = field.type!.PlainType.name;
                    if (program.definedType[fieldTypeName].modifier != 'valuetype') {
                        ret += globalVariable.pointSize;//非值类型
                    } else {
                        ret += sizeof(fieldTypeName);
                    }
                } else {
                    ret += globalVariable.pointSize;//不是普通类型就只能用指针表示
                }
            }
            break;
    }
    return ret;
}
export default function semanticCheck(primitiveProgram: Program) {
    program = primitiveProgram;
    programScope = new ProgramScope(program);
    //扫描definedType
    let primitiveTypeNames = Object.keys(program.definedType);//这是最开始定义的类型，后面还有因为闭包而新增的类型
    for (let typeName of primitiveTypeNames) {
        ClassScan(programScope.getClassScope(typeName));
    }
    //扫描property
    for (let variableName in program.property) {
        var prop = program.property[variableName];
        if (prop.initAST != undefined) {
            let initType = nodeRecursion(programScope, prop.initAST, [], {}).type;
            if (prop.type != undefined) {
                typeCheck(prop.type, initType, `初始化的值类型和声明类型不一致:${variableName}`);
            } else {
                prop.type = initType;
            }
        } if (prop.type?.FunctionType) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!);
            functionScan(blockScope, prop.type?.FunctionType);
        }
        registerType(prop.type!);//经过推导，类型已经确定了
    }
    program.definedType['@point'] = {
        modifier: 'valuetype',
        property: {},
        operatorOverload: {},
        _constructor: {}
    };
    programScope.registerClassForCapture('@point');//注册point类型
    registerType({ PlainType: { name: '@point' } });//在类型表中注册类型
    //扫描因为闭包捕获而新增的类型
    for (let typeName of wrapClassNames) {
        programScope.registerClassForCapture(typeName);//因为包裹类不会用到其他未注册的类型，所以可以边注册边使用
        ClassScan(programScope.getClassScope(typeName));
        registerType({ PlainType: { name: typeName } });
    }
    //检查值类型是否递归包含
    for (let typeName in program.definedType) {
        if (program.definedType[typeName].recursiveChecked != true && program.definedType[typeName].modifier == 'valuetype') {
            valueTypeRecursiveCheck(typeName);
        }
    }

    for (let typeName in program.definedType) {//计算每个类型的size和索引，同时注册类型
        program.definedType[typeName].size = sizeof(typeName);
        registerType({ PlainType: { name: typeName } });//在类型表中注册类型
    }
    let programSize = 0;
    //计算program的size
    for (let fieldName in program.property) {
        let field = program.property[fieldName];
        if (field.type!.PlainType != undefined) {
            let fieldTypeName = field.type!.PlainType.name;
            if (fieldTypeName == 'void') {
                throw `void无法计算大小,任何成员都不能是void类型`;
            }
            if (program.definedType[fieldTypeName].modifier != 'valuetype') {
                programSize += globalVariable.pointSize;//非值类型
            } else {
                programSize += sizeof(fieldTypeName);
            }
        } else {
            programSize += globalVariable.pointSize;//不是普通类型就只能用指针表示
        }
    }
    program.size = programSize;
    return program;
}