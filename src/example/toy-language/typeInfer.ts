//预处理AST
import fs from 'fs'
import { FunctionSign, TypeUsedSign, FunctionSignWithArgument } from './lib.js';
import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
import { pointSize } from './constant.js'
let program: Program;
let programScope: ProgramScope;
function OperatorOverLoad(scope: Scope, leftObj: ASTNode, rightObj: ASTNode | undefined, originNode: ASTNode, op: opType | opType2): TypeUsed {
    let leftType = nodeRecursion(scope, leftObj, []).type;
    if (rightObj != undefined) {
        //双目运算符
        let rightType = nodeRecursion(scope, rightObj, []).type;
        let sign = FunctionSignWithArgument([rightType]);
        let opFunction = program.definedType[leftType.SimpleType!.name].operatorOverload[op as opType][sign];
        if (opFunction == undefined) {
            throw `类型${TypeUsedSign(leftType)}没有 ${op} (${TypeUsedSign(rightType)})的重载函数`;
        } else if (opFunction.isNative == undefined && !opFunction.isNative) {
            delete originNode[op];//删除原来的操作符
            originNode.call = { functionObj: { desc: 'ASTNode', loadOperatorOverload: [op, sign] }, _arguments: [rightObj] };
        } else {
            //不管，由vm实现
        }
        return opFunction.retType!;
    } else {
        //单目运算符
        let sign = FunctionSignWithArgument([]);
        let opFunction = program.definedType[leftType.SimpleType!.name].operatorOverload[op as opType][sign];
        if (opFunction.isNative == undefined && !opFunction.isNative) {
            delete originNode[op];//删除原来的操作符
            originNode.call = { functionObj: { desc: 'ASTNode', loadOperatorOverload: [op, sign] }, _arguments: [] };
        } else {
            //不管，由vm实现
        }
        return opFunction.retType!;
    }
}
/**
 * 类型检查并合并,如果要求a、b类型必须相同，any可以匹配任意类型
 * @param a 
 * @param b 
 */
function typeCheck(a: TypeUsed, b: TypeUsed, msg: string): TypeUsed {
    let ta = TypeUsedSign(a);
    let tb = TypeUsedSign(b);
    if (ta != 'any' && tb != 'any' && (ta != tb)) {
        throw `类型不匹配:${ta} - ${tb}:   ${msg}`;
    } else {
        if (ta == 'any') {
            return b;
        } else {
            return a;
        }
    }
}
/**
 * 推导AST类型
 * @param scope 
 * @param node 
 * @param assignmentObj 赋值语句a=b中的b
 * @returns hasRet表示是否为返回语句
 */
function nodeRecursion(scope: Scope, node: ASTNode, label: string[], assignmentObj?: ASTNode): { type: TypeUsed, hasRet: boolean, location?: 'prop' | 'field' | 'stack' } {
    if (node["def"] != undefined) {
        let blockScope = (scope as BlockScope);//def节点是block专属
        let name = Object.keys(node['def'])[0];
        blockScope.setProp(name, node['def'][name], node);
        let initType: TypeUsed | undefined;
        if (node['def'][name].initAST != undefined) {
            initType = nodeRecursion(scope, node['def'][name].initAST!, label).type;
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
        return { type: { SimpleType: { name: 'void' } }, hasRet: false };
    }
    else if (node["load"] != undefined) {
        let name = node["load"];
        let propDesc = scope.getProp(name);
        if (propDesc.scope instanceof ClassScope) {
            delete node.load;//把load改为access
            node.accessField = { obj: { desc: 'ASTNode', _this: propDesc.scope.className }, field: name };//load阶段还不知道是不是property,由access节点处理进行判断
            return nodeRecursion(scope, node, label, assignmentObj);//处理access节点需要附带这个参数
        } else if (propDesc.scope instanceof ProgramScope) {
            delete node.load;//把load改为access
            node.accessField = { obj: { desc: 'ASTNode', _program: '' }, field: name };//load阶段还不知道是不是property,由access节点处理进行判断
            return nodeRecursion(scope, node, label, assignmentObj);//处理access节点需要附带这个参数
        } else if (propDesc.scope instanceof BlockScope) {//blockScope
            if (assignmentObj != undefined) {
                if (propDesc.prop.variable == 'val') {//load不可能变成access
                    throw `变量${name}声明为val,禁止赋值`;
                }
            }
            propDesc.scope.defNodes[name].loads.push(node);//记录下bolck有多少def节点需要被打包到闭包类,每个prop被那些地方load的,block扫描完毕的时候封闭的时候把这些load节点全部替换
            return { type: propDesc.prop.type!, hasRet: false, location: 'stack' };//如果是读取block内部定义的变量,则这个变量一点是已经被推导出类型的，因为代码区域的变量是先定义后使用的
        } else {
            throw `未定义的其他类型Scope`;
        }

    }
    else if (node["call"] != undefined) {
        let funType = nodeRecursion(scope, node["call"].functionObj, label).type.FunctionType!;//FunctionType不可能为undefined
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
            for (let i = 0; node["call"]._arguments.length; i++) {
                let argNode = node["call"]._arguments[i];
                let arg_type = nodeRecursion(scope, argNode, label).type;
                typeCheck(arg_type, funType._arguments, `函数调用的参数类型不匹配`);//参数类型检查
            }
        }
        return { type: funType.retType!, hasRet: false };
    }
    else if (node["accessField"] != undefined) {
        let accessName = node["accessField"].field;
        let accessedType = nodeRecursion(scope, node["accessField"].obj, label).type;
        let type: undefined | TypeUsed;
        if (accessedType.ArrayType != undefined) {
            if (node["accessField"].field != 'length') {
                throw `数组只有length属性可访问`;
            } else {
                return { type: { SimpleType: { name: 'number' } }, hasRet: false };
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
                type = nodeRecursion(programScope, initAST, label).type;
                delete (initAST).hasTypeInferRecursion;//删除标记,回溯常用手法
            }
            if (assignmentObj != undefined) {
                if (prop.variable == 'val') {
                    throw `program.${accessName}声明为val,禁止赋值`;
                }
            }
            return { type: type, hasRet: false, location: 'field' };
        } else {
            let className = accessedType.SimpleType!.name;
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
                        type = { SimpleType: { name: 'void' } };//set没有返回值
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
                return { type: type, location: 'prop', hasRet: false };
            } else {
                type = prop.type;
                if (type == undefined) {
                    let initAST = prop.initAST!;
                    if ((initAST).hasTypeInferRecursion) {
                        throw `类型推导出现了循环:${className}.${accessName}`;
                    }
                    (initAST).hasTypeInferRecursion = true;//标记一下这个属性已经在推导路径中被使用过了
                    type = nodeRecursion(classScope, initAST, label).type;
                    delete (initAST).hasTypeInferRecursion;//删除标记,回溯常用手法
                }
                if (assignmentObj != undefined) {
                    if (prop.variable == 'val') {
                        throw `${className}.${accessName}声明为val,禁止赋值`;
                    }
                }
                return { type: type, hasRet: false, location: 'field' };
            }
        }
    }
    else if (node["_super"] != undefined) {
        throw `不支持super`;
    }
    else if (node["_this"] != undefined) {
        let s: Scope | undefined = scope;
        let targeScope: ClassScope | undefined;
        if (node['_this'] == "") {
            if (scope instanceof BlockScope) {
                if (scope.classScope != undefined) {
                    return { type: { SimpleType: { name: scope.classScope.className } }, hasRet: false };
                } else {
                    throw `不在class内部不能使用this`;
                }
            } else if (scope instanceof ClassScope) {
                return { type: { SimpleType: { name: scope.className } }, hasRet: false };
            } else {
                throw `不在class内部不能使用this`;
            }
        } else {
            //通过load转换得到的_this
            return { type: { SimpleType: { name: node['_this'] } }, hasRet: false };
        }
    }
    else if (node["_program"] != undefined) {
        return { type: { ProgramType: "" }, hasRet: false };
    }
    else if (node["immediate"] != undefined) {
        if (node["immediate"].primiviteValue != undefined) {
            if (isNaN(Number(node["immediate"].primiviteValue))) {
                return { type: { SimpleType: { name: 'string' } }, hasRet: false };
            } else {
                return { type: { SimpleType: { name: 'int' } }, hasRet: false };
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
            return { type: { FunctionType: functionType }, hasRet: false };
        }
    }
    else if (node["="] != undefined) {
        let right = nodeRecursion(scope, node['='].rightChild, label);//计算右节点
        let left = nodeRecursion(scope, node['='].leftChild, label, node['='].rightChild);
        if (left.location != undefined && left.location == 'prop') {
            //已经在access节点的处理阶段被更改为call prop_set了,类型检查也做了,无需做任何处理
        } else if (left.location != undefined && (left.location == 'stack' || left.location == 'field')) {
            typeCheck(left.type, right.type, `赋值语句左右类型不一致`);//类型检查
        } else {
            throw `只有左值才能赋值`;
        }
        return { type: right.type, hasRet: false };
    }
    else if (node["+"] != undefined) {
        let op = '+' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild!, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node["-"] != undefined) {
        let op = '-' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node["*"] != undefined) {
        let op = '*' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node["/"] != undefined) {
        let op = '/' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node["<"] != undefined) {
        let op = '<' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node["<="] != undefined) {
        let op = '<=' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node[">"] != undefined) {
        let op = '>' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node[">="] != undefined) {
        let op = '>=' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node["=="] != undefined) {
        let op = '==' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node["||"] != undefined) {
        let op = '||' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node["&&"] != undefined) {
        let op = '&&' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node["trycatch"] != undefined) {
        let tryScope = new BlockScope(scope, undefined, node["trycatch"].tryBlock);//catch语句只能出现在block内部
        let tryBlockRet = BlockScan(tryScope, label);//此时的block一定是BlockScope
        let catchRet = true;
        for (let _catch of node["trycatch"].catch_list) {
            let varialbe: VariableDescriptor = {};
            varialbe[_catch.catchVariable] = { variable: 'var', type: _catch.catchType, initAST: { desc: 'ASTNode', loadException: _catch.catchType } };
            let def: ASTNode = { desc: 'ASTNode', def: varialbe };
            let catchBlock = _catch.catchBlock;
            catchBlock.body.unshift(def);//插入一个读取exception指令
            let catchScope = new BlockScope(scope, undefined, catchBlock);//catch语句只能出现在block内部
            let catchBlockRet = BlockScan(catchScope, label);
            if (catchBlockRet != undefined) {
                if (tryBlockRet != undefined) {
                    typeCheck(tryBlockRet, catchBlockRet, `try和catch返回值类型不一致`);//检查try和catch返回值类型是否一致
                }
            } else {
                catchRet = false;
            }
        }
        let retType: TypeUsed;
        if (tryBlockRet != undefined && catchRet) {
            retType = tryBlockRet;
        } else {
            retType = { SimpleType: { name: 'any' } };
        }
        return { hasRet: tryBlockRet != undefined && catchRet, type: retType };
    }
    else if (node["throwStmt"] != undefined) {
        nodeRecursion(scope, node["throwStmt"], label);
        return { hasRet: true, type: { SimpleType: { name: 'any' } } };//throw可以作为任意类型的返回值
    }
    else if (node["ret"] != undefined) {
        let type: TypeUsed;
        if (node["ret"] == '') {
            type = { SimpleType: { name: 'void' } }
        } else {
            type = nodeRecursion(scope, node["ret"], label).type;
        }
        return { hasRet: true, type: type };
    }
    else if (node["ifStmt"] != undefined) {
        let type = nodeRecursion(scope, node["ifStmt"].condition, label).type;
        typeCheck(type, { SimpleType: { name: 'bool' } }, `if条件只能是bool值`);
        if (node["ifStmt"].stmt.desc == 'ASTNode') {
            nodeRecursion(scope, node["ifStmt"].stmt as ASTNode, label);
        } else {
            let blockScope = new BlockScope(scope, undefined, node["ifStmt"].stmt);//ifStmt语句只能出现在block内部
            BlockScan(blockScope, label);
        }
        return { hasRet: false, type: { SimpleType: { name: 'void' } } };
    }
    else if (node["ifElseStmt"] != undefined) {
        let type = nodeRecursion(scope, node["ifElseStmt"].condition, label).type;
        typeCheck(type, { SimpleType: { name: 'bool' } }, `if条件只能是bool值`);
        let type1: TypeUsed | undefined;
        let type2: TypeUsed | undefined;
        if (node["ifElseStmt"].stmt1.desc == 'ASTNode') {
            let stmtRet = nodeRecursion(scope, node["ifElseStmt"].stmt1 as ASTNode, label);
            if (stmtRet.hasRet) {
                type1 = stmtRet.type;
            }
        } else {
            let blockScope = new BlockScope(scope, undefined, node["ifElseStmt"].stmt1);//ifElseStmt语句只能出现在block内部
            type1 = BlockScan(blockScope, label);
        }
        if (node["ifElseStmt"].stmt2.desc == 'ASTNode') {
            let stmtRet = nodeRecursion(scope, node["ifElseStmt"].stmt2 as ASTNode, label);
            if (stmtRet.hasRet) {
                type2 = stmtRet.type;
            }
        } else {
            let blockScope = new BlockScope(scope, undefined, node["ifElseStmt"].stmt2);//ifElseStmt语句只能出现在block内部
            type2 = BlockScan(blockScope, label);
        }
        if (type1 != undefined && type2 != undefined) {
            let retType = typeCheck(type1, type2, `if语句和else语句返回值类型不一致`);
            return { hasRet: true, type: retType };
        } else if (type1 == undefined && type2 == undefined) {
            return { hasRet: false, type: { SimpleType: { name: 'void' } } };
        } else {
            throw `if和else语句一个有返回值，一个没有`;
        }
    }
    else if (node["do_while"] != undefined) {
        if (node["do_while"].label != undefined) {
            label.push(node["do_while"].label)
        }
        let type = nodeRecursion(scope, node["do_while"].condition, label).type;
        typeCheck(type, { SimpleType: { name: 'bool' } }, `do while条件只能是bool值`);
        if (node["do_while"].stmt.desc == 'ASTNode') {
            nodeRecursion(scope, node["do_while"].stmt as ASTNode, label);
        } else {
            let blockScope = new BlockScope(scope, undefined, node["do_while"].stmt);//do_while语句只能出现在block内部
            BlockScan(blockScope, label);
        }
        label.pop();
        return { hasRet: false, type: { SimpleType: { name: 'void' } } };
    }
    else if (node["_while"] != undefined) {
        if (node["_while"].label != undefined) {
            label.push(node["_while"].label)
        }
        let type = nodeRecursion(scope, node["_while"].condition, label).type;
        typeCheck(type, { SimpleType: { name: 'bool' } }, `while条件只能是bool值`);
        if (node["_while"].stmt.desc == 'ASTNode') {
            nodeRecursion(scope, node["_while"].stmt as ASTNode, label);
        } else {
            let blockScope = new BlockScope(scope, undefined, node["_while"].stmt);//while语句只能出现在block内部
            BlockScan(blockScope, label);
        }
        label.pop();
        return { hasRet: false, type: { SimpleType: { name: 'void' } } };
    }
    else if (node["_for"] != undefined) {
        if (node["_for"].label != undefined) {
            label.push(node["_for"].label)
        }
        if (node["_for"].init) {
            nodeRecursion(scope, node["_for"].init, label);
        }
        if (node["_for"].condition) {
            let type = nodeRecursion(scope, node["_for"].condition, label).type;
            typeCheck(type, { SimpleType: { name: 'bool' } }, `for条件只能是bool值或者空`);
        }
        if (node["_for"].step) {
            nodeRecursion(scope, node["_for"].step, label);
        }
        if (node["_for"].stmt.desc == 'ASTNode') {
            nodeRecursion(scope, node["_for"].stmt as ASTNode, label);
        } else {
            let blockScope = new BlockScope(scope, undefined, node["_for"].stmt);//for语句只能出现在block内部
            BlockScan(blockScope, label);
        }
        label.pop();
        return { hasRet: false, type: { SimpleType: { name: 'void' } } };
    }
    else if (node["_break"] != undefined) {
        if (node["_break"].label != '') {
            if (label.indexOf(node["_break"].label) == -1) {
                throw `break使用了未定义的label:${node["_break"].label}`;
            }
        }
        return { hasRet: false, type: { SimpleType: { name: 'void' } } };
    }
    else if (node["_continue"] != undefined) {
        if (node["_continue"].label != '') {
            if (label.indexOf(node["_continue"].label) == -1) {
                throw `break使用了未定义的label:${node["_continue"].label}`;
            }
        }
        return { hasRet: false, type: { SimpleType: { name: 'void' } } };
    }
    else if (node["_instanceof"] != undefined) {
        nodeRecursion(scope, node["_instanceof"].obj, label);
        return { hasRet: false, type: { SimpleType: { name: 'bool' } } };
    }
    else if (node["not"] != undefined) {
        let not_obj_type = nodeRecursion(scope, node["not"], label).type;
        typeCheck(not_obj_type, { SimpleType: { name: 'bool' } }, `not运算必须是一个bool值`);
        return { hasRet: false, type: { SimpleType: { name: 'bool' } } };
    }
    else if (node["++"] != undefined) {
        let retType = OperatorOverLoad(scope, node['++'], undefined, node, '++');
        return { type: retType, hasRet: false };
    }
    else if (node["--"] != undefined) {
        let retType = OperatorOverLoad(scope, node["--"], undefined, node, '--');
        return { type: retType, hasRet: false };
    }
    else if (node["[]"] != undefined) {
        let op = '[]' as opType;
        let retType = OperatorOverLoad(scope, node[op]!.leftChild, node[op]!.rightChild, node, op);
        return { type: retType, hasRet: false };
    }
    else if (node["ternary"] != undefined) {
        let conditionType = nodeRecursion(scope, node["ternary"].condition, label).type;
        typeCheck(conditionType, { SimpleType: { name: 'bool' } }, `三目运算符的条件必须是bool值`);
        let t1 = nodeRecursion(scope, node["ternary"].obj1, label).type;
        let t2 = nodeRecursion(scope, node["ternary"].obj2, label).type;
        typeCheck(t1, t2, `三目运算符左右类型不一致`);
        return { type: t1, hasRet: false };
    }
    else if (node["cast"] != undefined) {
        throw `不支持强制转型`;
    }
    else if (node["_new"] != undefined) {
        let ts: TypeUsed[] = [];
        for (let n of node["_new"]._arguments) {
            ts.push(nodeRecursion(scope, n, label).type);
        }
        let callsign: string = FunctionSignWithArgument(ts);//根据调用参数生成一个签名,构造函数没有返回值
        if (scope instanceof ProgramScope) {
            if (scope.program.definedType[node["_new"].type.SimpleType!.name]._constructor[callsign] == undefined) {
                throw '无法找到合适的构造函数'
            }
        } else if (scope instanceof BlockScope || scope instanceof ClassScope) {
            if (scope.programScope.program.definedType[node["_new"].type.SimpleType!.name]._constructor[callsign] == undefined) {
                throw '无法找到合适的构造函数'
            }
        } else {
            throw `未知类型的Scope`;
        }
        return { type: node["_new"].type, hasRet: false };
    }
    else if (node["_newArray"] != undefined) {
        for (let n of node["_newArray"].initList) {
            nodeRecursion(scope, n, label);
        }
        return { type: { ArrayType: { innerType: node["_newArray"].type } }, hasRet: false };
    }
    else if (node["_switch"] != undefined) {
        nodeRecursion(scope, node["_switch"].pattern, label);
        for (let caseStmt of node["_switch"].matchList) {
            nodeRecursion(scope, caseStmt.matchObj, label);
            if (caseStmt.stmt.desc == 'Block') {
                BlockScan(new BlockScope(scope, undefined, caseStmt.stmt), label);
            } else if (caseStmt.stmt.desc == 'ASTNode') {
                nodeRecursion(scope, caseStmt.stmt as ASTNode, label);
            } else {
                throw `未知类型`;
            }
        }
        if (node["_switch"].defalutStmt?.desc == 'Block') {
            BlockScan(new BlockScope(scope, undefined, node["_switch"].defalutStmt), label);
        } else if (node["_switch"].defalutStmt?.desc == 'ASTNode') {
            nodeRecursion(scope, node["_switch"].defalutStmt as ASTNode, label);
        } else {
            throw `未知类型`;
        }
        return { type: { SimpleType: { name: 'void' } }, hasRet: false };
    }
    else if (node["loadException"] != undefined) {
        return { type: node["loadException"], hasRet: false };
    }
    else if (node["loadArgument"] != undefined) {
        return { type: node["loadArgument"].type, hasRet: false };
    }
    else {
        throw new Error(`未知节点`);
    }
}
/**
 * 返回值表示是否为一个ret block
 */
function BlockScan(blockScope: BlockScope, label: string[]): TypeUsed | undefined {
    let ret: TypeUsed | undefined = undefined;
    for (let i = 0; i < blockScope.block!.body.length; i++) {
        let nodeOrBlock = blockScope.block!.body[i];
        if (nodeOrBlock.desc == 'ASTNode') {
            let node = nodeOrBlock as ASTNode;
            let nodeRet = nodeRecursion(blockScope, node, label);
            ret = nodeRet.hasRet ? nodeRet.type : undefined;
        } else {
            let block = nodeOrBlock as Block;
            ret = BlockScan(new BlockScope(blockScope, undefined, block), label);
        }
        if (ret != undefined) {
            if (i != blockScope.block!.body.length - 1) {
                throw 'return之后不能再有语句';
            }
        }
    }
    if (blockScope.captured.size > 0) {
        for (let k of [...blockScope.captured]) {
            blockScope.defNodes[k].defNode.def_ref = blockScope.defNodes[k].defNode.def;
            delete blockScope.defNodes[k].defNode.def;//把def改成def_ref
            for (let loadNode of blockScope.defNodes[k].loads) {
                loadNode.load_ref = loadNode.load;
                delete loadNode.load;//把load改成load_ref
            }
        }
    }
    return ret;
}
function functionScan(blockScope: BlockScope, fun: FunctionType): TypeUsed {
    if ((fun).hasFunctionScan) {//避免已经处理过的函数被重复处理
        /**
         * 因为可能出现这种情况
         * function a(){
         *  if xxx
         *      return a();//这里暂时把返回值设置为any
         *  else
         *      return 1;
         * }
         * 此时应该将函数的返回值类型推导为int
         * 
         * any只有在函数递归推导时才会出现
         */
        if (fun.retType == undefined) {
            fun.retType = { SimpleType: { name: 'any' } }
        }
        return fun.retType!;//已经处理过的函数retType一定有值
    } else {
        (fun).hasFunctionScan = true;
    }
    if (fun.isNative || fun.body == undefined) {//函数体,根据有无body判断是函数类型声明还是定义，声明语句不做扫描
        if (fun.retType == undefined) {
            throw `函数声明一定有返回值声明`;
        }
        return fun.retType;
    }
    let argIndex = 0;
    for (let argumentName in fun._arguments) {
        let defNode: ASTNode = { desc: 'ASTNode', def: {} };
        defNode.def![argumentName] = { variable: 'var', initAST: { desc: 'ASTNode', loadArgument: { index: argIndex, type: fun._arguments[argumentName].type! } } };
        fun.body!.body.unshift(defNode);//插入args的def指令
        argIndex++;
    }
    let blockRetType = BlockScan(blockScope, []);
    if (blockRetType == undefined) {
        blockRetType = { SimpleType: { name: 'void' } };//block没有任何返回语句，则说明返回void
    }
    if (fun.retType != undefined && TypeUsedSign(fun.retType) != 'any') {//函数明确声明了返回值类型
        typeCheck(fun.retType, blockRetType, `函数声明返回值类型和语句实际返回值类型不一致`);
    } else {
        /**
         * function f(){
         *      return f();//无法推导返回值
         * }
         * function f(){
         *      f();//这种写法就没问题
         * }
         */
        if (TypeUsedSign(blockRetType) == 'any') {
            throw `无法推导返回值`;
        }
        else {
            fun.retType = blockRetType;
        }
    }
    return fun.retType;
}
function ClassScan(classScope: ClassScope) {
    for (let propName of classScope.getPropNames()) {//扫描所有成员
        let prop = classScope.getProp(propName).prop;
        if (prop.getter == undefined && prop.setter == undefined) {//扫描field
            if (prop.initAST != undefined) {
                let initType = nodeRecursion(classScope, prop.initAST, []).type;
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
    }
    let operatorOverloads = program.definedType[classScope.className].operatorOverload;
    for (let op in operatorOverloads) {//扫描重载操作符
        for (let sign in operatorOverloads[op as opType | opType2]) {
            let blockScope = new BlockScope(classScope, operatorOverloads[op as opType | opType2][sign], operatorOverloads[op as opType | opType2][sign].body!);
            functionScan(blockScope, operatorOverloads[op as opType | opType2][sign]);
        }
    }
}
//深度优先搜索，检查是否有值类型直接或者间接包含自身
function valueTypeRecursiveCheck(typeName: string) {
    if (program.definedType[typeName].recursiveChecked == true) {
        throw `值类型${typeName}直接或者间接包含自身`
    } else {
        program.definedType[typeName].recursiveChecked = true;
        for (let fieldName in program.definedType[typeName].property) {//遍历所有成员
            let fieldTypeName = program.definedType[typeName].property[fieldName].type!.SimpleType?.name;
            if (fieldTypeName != undefined && program.definedType[fieldTypeName].modifier == 'valuetype') {//如果有值类型的成员，则递归遍历
                valueTypeRecursiveCheck(fieldTypeName);
            }
        }
    }
}
function sizeof(typeName: string): number {
    let ret = 0;
    switch (typeName) {
        case 'int': ret = 4; break;
        case 'double': ret = 8; break;
        case 'bool': ret = 1; break;
        case 'byte': ret = 1; break;
        default:
            for (let fieldName in program.definedType[typeName].property) {
                let field = program.definedType[typeName].property[fieldName];
                if (field.type!.SimpleType != undefined) {
                    let fieldTypeName = field.type!.SimpleType.name;
                    if (program.definedType[fieldTypeName].modifier != 'valuetype') {
                        ret += pointSize;//非值类型
                    } else {
                        ret += sizeof(fieldTypeName);
                    }
                } else {
                    ret += pointSize;//不是普通类型就只能用指针表示
                }
            }
            break;
    }
    return ret;
}
export default function programScan(primitiveProgram: Program) {
    program = primitiveProgram;
    programScope = new ProgramScope(program);
    //扫描definedType
    for (let typeName in program.definedType) {
        ClassScan(programScope.getClassScope(typeName));
    }
    //扫描property
    for (let variableName in program.property) {
        var prop = program.property[variableName];
        if (prop.initAST != undefined) {
            let initType = nodeRecursion(programScope, prop.initAST, []).type;
            if (prop.type != undefined) {
                typeCheck(prop.type, initType, `初始化的值类型和声明类型不一致:${variableName}`);
            } else {
                prop.type = initType;
            }
        } if (prop.type?.FunctionType) {
            let blockScope = new BlockScope(programScope, prop.type?.FunctionType, prop.type?.FunctionType.body!);
            functionScan(blockScope, prop.type?.FunctionType);
        }
    }
    for (let typeName in program.definedType) {
        if (program.definedType[typeName].recursiveChecked != true && program.definedType[typeName].modifier == 'valuetype') {
            valueTypeRecursiveCheck(typeName);
        }
    }
    for (let typeName in program.definedType) {
        program.definedType[typeName].size = sizeof(typeName);
    }
    return program;
}