import fs from 'fs'
import { TypeUsedSingle } from './lib.js';
import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
let program: Program;
let programScope: ProgramScope;
function OperatorCheck(leftType: TypeUsed, rightType: TypeUsed, op: opType): TypeUsed {
    throw `unimplemented`
}
/**
 * 推导AST类型
 * @param scope 
 * @param node 
 * @param setter
 * @returns hasRet表示是否为返回语句
 */
function nodeRecursion(scope: Scope, node: ASTNode, isSetter?: boolean): { type: TypeUsed, hasRet: boolean } {
    if (node["def"] != undefined) {
        //def节点是block专属
        let name = Object.keys(node['def'])[0];
        if (scope.property[name] != undefined) {
            throw `重复定义变量${name}`;
        }
        scope.property[name] = node['def'][name];
        let initType: TypeUsed | undefined;
        if (node['def'][name].initAST != undefined) {
            initType = nodeRecursion(scope, node['def'][name].initAST!).type;
        }
        if (scope.property[name].type == undefined) {//如果是需要进行类型推导的，则推导
            scope.property[name].type = initType;
        } else {//否则检查initialization的类型和声明类型是否一致
            if (initType != undefined) {
                typeCheck(initType!, scope.property[name].type!);
            }
            if (node['def'][name].type!.FunctionType?.body != undefined) {
                /**
                 * 下面两种代码
                 * function f1():int{};
                 * var f1:()=>int;
                 * 都会生成一个def节点,一个有body，一个没有(函数声明没有，函数定义有)
                 * 所以遇到这种情况，通通扫描一次，在functionScan中，如果function.body==undefined,则直接放弃扫描
                */
                functionScan(scope, node['def'][name].type!.FunctionType!);//如果是定义了函数，则扫描一下
            }
        }
        (scope.property[name] as any).defNode = node;//记录defnode
        return { type: { SimpleType: { name: 'void' } }, hasRet: false };
    }
    else if (node["load"] != undefined) {
        let name = node["load"];
        let prop: VariableProperties | undefined;
        let level = 0;
        let flag = false;
        let s: Scope | undefined = scope;
        for (; s != undefined; s = s.parent) {
            if (flag) {//每越过一个functionScope，层级+1
                level++;
                flag = false;
            }
            if (s instanceof BlockScope && s.isFunctionScope) {
                flag = true;
            }
            if (s.property[name] != undefined) {
                prop = s.property[name];
                break;
            }
        }
        if (prop == undefined) {
            throw `load未定义变量${name}`;
        } else {
            if (s instanceof ClassScope) {
                delete node.load;//把load改为access
                node.accessField = { obj: { desc: 'ASTNode', _this: s.className }, field: name };//load阶段还不知道是不是property,由access节点处理进行判断
                return nodeRecursion(scope, node, isSetter);
            } else if (s instanceof ProgramScope) {
                delete node.load;//把load改为access
                node.accessField = { obj: { desc: 'ASTNode', _program: '' }, field: name };//load阶段还不知道是不是property,由access节点处理进行判断
                return nodeRecursion(scope, node, isSetter);
            } else {//blockScope
                if (!(node as any).loadNodes) {
                    (node as any).loadNodes = [];
                }
                if (level > 0) {
                    (s as BlockScope).hasCapture = true;
                }
                if (isSetter) {
                    if (prop.variable == 'val') {
                        throw `变量${name}禁止赋值`;
                    }
                }
                (node as any).loadNodes.push(node);//记录下bolck有多少def节点需要被打包到闭包类,每个prop被那些地方load的,block扫描完毕的时候封闭的时候把这些load节点全部替换
                return { type: prop.type!, hasRet: false };//如果是读取block内部定义的变量,则这个变量一点是已经被推导出类型的，因为代码区域的变量是先定义后使用的
            }
        }
    }
    else if (node["call"] != undefined) {
        let funType = nodeRecursion(scope, node["call"].functionObj).type.FunctionType!;//FunctionType不可能为undefined
        if (funType.retType == undefined) {
            if ((funType as any).flag) {
                return { type: {}, hasRet: false };//返回一个空值
            }
            (funType as any).flag = true;//标记
            functionScan(scope, funType);
            delete (funType as any).flag;//删除标记
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
                let arg_type = nodeRecursion(scope, argNode).type;
                typeCheck(arg_type, funType._arguments);//参数类型检查
            }
        }
        return { type: funType.retType!, hasRet: false };
    }
    else if (node["accessField"] != undefined) {
        let accessedType = nodeRecursion(scope, node["accessField"].obj).type;
        if (accessedType.ArrayType != undefined) {
            if (node["accessField"].field != 'length') {
                throw `数组只有length属性可访问`;
            } else {
                return { type: { SimpleType: { name: 'number' } }, hasRet: false };
            }
        } else if (accessedType.FunctionType != undefined) {
            throw `函数目前没有任何属性可访问`;
        } else {
            let className = accessedType.SimpleType!.name;
            let accessName = node["accessField"].field;
            let prop = program.definedType[className].property[accessName];
            if (prop == undefined) {
                throw `访问了类型${className}中不存在的属性${accessName}`;
            }
            let type = prop.type;
            if (prop.getter != undefined || prop.setter != undefined) {
                if (isSetter) {
                    if (prop.setter == undefined) {
                        throw `${className}.${accessName}没有setter`;
                    } else {
                        throw `改成set调用`;
                    }
                } else {
                    if (prop.getter == undefined) {
                        throw `${className}.${accessName}没有getter`;
                    } else {
                        type = prop.getter.retType;
                        throw `改成get调用`;
                    }
                }
            } else {
                if (type == undefined) {
                    let initAST = prop.initAST!;
                    if ((initAST as any).flag) {
                        throw `类型推导出现了循环:${className}.${accessName}`;
                    }
                    let classScope = new ClassScope(program.definedType[className].property, programScope, className);//切换scope
                    (initAST as any).flag = true;//标记一下这个属性已经在推导路径中被使用过了
                    type = nodeRecursion(classScope, initAST).type;
                    delete (initAST as any).flag;//删除标记,回溯常用手法
                }
            }
            return { type: type, hasRet: false };
        }
    }
    else if (node["_super"] != undefined) {
        throw `super节点暂未解析，下个版本实现`
    }
    else if (node["_this"] != undefined) {
        let s: Scope | undefined = scope;
        let targeScope: ClassScope | undefined;
        if (node['_this'] == "") {

            for (; s != undefined; s = s.parent) {
                if (s instanceof ClassScope) {
                    targeScope = s;
                }
            }
            if (targeScope != undefined) {
                return { type: { SimpleType: { name: targeScope.className } }, hasRet: false };
            } else {
                throw `不是定义在class内部的函数不能使用this`;
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
        if (node["immediate"].primiviteValue) {
            if (isNaN(Number(node["immediate"].primiviteValue))) {
                return { type: { SimpleType: { name: 'string' } }, hasRet: false };
            } else {
                return { type: { SimpleType: { name: 'int' } }, hasRet: false };
            }
        } else {
            return { type: functionScan(scope, node["immediate"].functionValue!), hasRet: false };
        }
    }
    else if (node["="] != undefined) {
        let leftType = nodeRecursion(scope, node['='].leftChild).type;
        let rightType = nodeRecursion(scope, node['='].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '=');
        throw `检查左子节点是否为prop,如果是则检查是否有setType，否则检查是否为var变量`;
        return { type: retType, hasRet: false };
    }
    else if (node["+"] != undefined) {
        let leftType = nodeRecursion(scope, node['+'].leftChild).type;
        let rightType = nodeRecursion(scope, node['+'].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '+');
        return { type: retType, hasRet: false };
    }
    else if (node["-"] != undefined) {
        let leftType = nodeRecursion(scope, node['-'].leftChild).type;
        let rightType = nodeRecursion(scope, node['-'].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '-');
        return { type: retType, hasRet: false };
    }
    else if (node["*"] != undefined) {
        let leftType = nodeRecursion(scope, node['*'].leftChild).type;
        let rightType = nodeRecursion(scope, node['*'].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '*');
        return { type: retType, hasRet: false };
    }
    else if (node["/"] != undefined) {
        let leftType = nodeRecursion(scope, node['/'].leftChild).type;
        let rightType = nodeRecursion(scope, node['/'].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '/');
        return { type: retType, hasRet: false };
    }
    else if (node["<"] != undefined) {
        let leftType = nodeRecursion(scope, node['<'].leftChild).type;
        let rightType = nodeRecursion(scope, node['<'].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '<');
        return { type: retType, hasRet: false };
    }
    else if (node["<="] != undefined) {
        let leftType = nodeRecursion(scope, node['<='].leftChild).type;
        let rightType = nodeRecursion(scope, node['<='].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '<=');
        return { type: retType, hasRet: false };
    }
    else if (node[">"] != undefined) {
        let leftType = nodeRecursion(scope, node['>'].leftChild).type;
        let rightType = nodeRecursion(scope, node['>'].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '>');
        return { type: retType, hasRet: false };
    }
    else if (node[">="] != undefined) {
        let leftType = nodeRecursion(scope, node['>='].leftChild).type;
        let rightType = nodeRecursion(scope, node['>='].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '>=');
        return { type: retType, hasRet: false };
    }
    else if (node["=="] != undefined) {
        let leftType = nodeRecursion(scope, node['=='].leftChild).type;
        let rightType = nodeRecursion(scope, node['=='].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '==');
        return { type: retType, hasRet: false };
    }
    else if (node["||"] != undefined) {
        let leftType = nodeRecursion(scope, node['||'].leftChild).type;
        let rightType = nodeRecursion(scope, node['||'].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '||');
        return { type: retType, hasRet: false };
    }
    else if (node["&&"] != undefined) {
        let leftType = nodeRecursion(scope, node['&&'].leftChild).type;
        let rightType = nodeRecursion(scope, node['&&'].rightChild).type;
        let retType = OperatorCheck(leftType, rightType, '&&');
        return { type: retType, hasRet: false };
    }
    else if (node["trycatch"] != undefined) {
        let tryScope = new BlockScope({}, scope, false, node["trycatch"].tryBlock);
        let tryBlockRet = BlockScan(tryScope, node["trycatch"].tryBlock);//此时的block一定是BlockScope
        for (let _catch of node["trycatch"].catch_list) {
            let varialbe: VariableDescriptor = {};
            varialbe[_catch.catchVariable] = { variable: 'var', type: _catch.catchType, initAST: { desc: 'ASTNode', loadException: '' } };
            let defNode: ASTNode = { desc: 'ASTNode', def: varialbe };
            let catchBlock = _catch.catchBlock;
            catchBlock.body.unshift(defNode);//插入一个读取exception指令
            let catchScope = new BlockScope({}, scope, false, catchBlock);
            let catchBlockRet = BlockScan(catchScope, catchBlock);
            if (tryBlockRet == undefined) {
                if (catchBlockRet != undefined) {
                    throw `如果try不返回值,catch也不能返回值`;
                }
            } else {
                if (catchBlockRet == undefined) {
                    throw `如果try有返回值,catch也必须有返回值`;
                } else {
                    typeCheck(tryBlockRet, catchBlockRet);//检查try和catch返回值类型是否一致
                }
            }
        }
    }
    else if (node["throwStmt"] != undefined) { }
    else if (node["ret"] != undefined) { }
    else if (node["ifStmt"] != undefined) { }
    else if (node["ifElseStmt"] != undefined) { }
    else if (node["do_while"] != undefined) { }
    else if (node["_while"] != undefined) { }
    else if (node["_for"] != undefined) { }
    else if (node["_break"] != undefined) { }
    else if (node["_continue"] != undefined) { }
    else if (node["_instanceof"] != undefined) { }
    else if (node["not"] != undefined) { }
    else if (node["increase"] != undefined) { }
    else if (node["decrease"] != undefined) { }
    else if (node["indexOP"] != undefined) { }
    else if (node["ternary"] != undefined) { }
    else if (node["cast"] != undefined) { }
    else if (node["_new"] != undefined) { }
    else if (node["_newArray"] != undefined) { }
    else if (node["_switch"] != undefined) { }
    throw new Error(`未知节点`);
}
function typeCheck(a: TypeUsed, b: TypeUsed) {
    let ta = TypeUsedSingle(a);
    let tb = TypeUsedSingle(b);
    if (ta != tb) {
        throw `类型不匹配:${ta}<----->${tb}`;
    }
}
/**
 * 返回值表示是否为一个ret block
 */
function BlockScan(scope: BlockScope, block: Block): TypeUsed | undefined {
    let ret: TypeUsed | undefined = undefined;
    for (let i = 0; i < block.body.length; i++) {
        let nodeOrBlock = block.body[i];
        if (nodeOrBlock.desc == 'ASTNode') {
            let node = nodeOrBlock as ASTNode;
            let nodeRet = nodeRecursion(scope, node);
            ret = nodeRet.hasRet ? nodeRet.type : undefined;
        } else {
            let block = nodeOrBlock as Block;
            let blockScope = new BlockScope({}, scope, false, block)
            ret = BlockScan(blockScope, block);
            if (blockScope.hasCapture) {
                throw `unimplemented`;//闭包处理还未完成
            }
        }
        if (ret != undefined) {
            if (i != block.body.length - 1) {
                throw 'return之后不能再有语句';
            }
        }
    }
    return ret;
}
function functionScan(scope: Scope, fun: FunctionType): TypeUsed {
    if (fun.body!.body == undefined) {//函数里面没有任何语句，放弃扫描
        console.error('后面需要补充返回值类型');
        return {};
    }
    let argIndex = 0;
    for (let argumentName in fun._arguments) {
        let defNode: ASTNode = { desc: 'ASTNode', def: {} };
        defNode.def![argumentName] = { variable: 'var', initAST: { desc: 'ASTNode', loadArgument: argIndex } };
        fun.body!.body.unshift(defNode);//插入args的def指令
        argIndex++;
    }
    let blockScope = new BlockScope({}, scope, true, fun.body!);
    let blockret = BlockScan(blockScope, fun.body!);
    if (blockScope.hasCapture) {
        throw `unimplemented`;//闭包处理还未完成
    }
    if (blockret == undefined) {
        return { SimpleType: { name: 'void' } };//block没有任何返回语句，则说明返回void
    } else {
        return blockret;
    }
}
function ClassScan(scope: ClassScope, type: TypeDef) {
    for (let propName in type.property) {
        let prop = type.property[propName];
        if (prop.getter == undefined && prop.setter == undefined) {
            if (prop.initAST) {
                let initType = nodeRecursion(scope, prop.initAST).type;
                if (prop.type) {
                    typeCheck(initType, prop.type);
                } else {
                    prop.type = initType;//如果是需要推导的类型，进行填充
                }
            } else if (prop.type?.FunctionType) {
                functionScan(scope, prop.type?.FunctionType);
            }
        } else {
            throw `属性还没有扫描`;
        }
    }
}
function programScan() {
    program = JSON.parse(fs.readFileSync(`./src/example/toy-language/output/stage-1.json`).toString()) as Program;
    programScope = new ProgramScope(program.property, undefined);
    //扫描definedType
    for (let typeName in program.definedType) {
        let type = program.definedType[typeName];
        ClassScan(new ClassScope(type.property, programScope, typeName), type);
    }
    //扫描property
}
programScan();