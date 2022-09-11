import fs from 'fs'
import { TypeUsedSingle } from './lib.js';
import { Scope, BlockScope } from './scope.js';
let program: Program;
let programScope: Scope;
/**
 * 推导load节点属性类型，同时处理闭包
 * @param scope 
 * @param name 
 * @returns 
 */
function loadDeduce(scope: Scope, node: ASTNode, level: number): TypeUsed {
    let name = node['load']!;
    if (scope.property[name] != undefined) {
        if (scope.property[name].type != undefined) {//目标属性有定义类型
            if (scope instanceof BlockScope && level > 0) {
                if (!(node as any).loadNodes) {
                    (node as any).loadNodes = [];
                }
                (node as any).loadNodes.push(node);//记录下bolck有多少def节点需要被打包到闭包类,每个prop被那些地方load的,block扫描完毕的时候封闭的时候把这些load节点全部替换
            }
            return scope.property[name].type!;
        } else {//目标属性的类型也是推导得到的
            if ((scope.property[name] as any).flag) {
                throw `类型推导出现了循环:${name}`;
            } else {
                (scope.property[name] as any).flag = true;//标记一下这个属性已经在推导路径中被使用过了
                let type = nodeRecursion(scope, scope.property[name].initAST!);//如果是自动推导的类型，一定会有initAST
                delete (scope.property[name] as any).flag;//删除标记,回溯常用手法
                return type;
            }
        }
    } else {
        if (scope.parent != undefined) {
            let l = level;
            if (scope instanceof BlockScope) {
                if (scope.isFunctionScope) {
                    l++;
                }
            }
            return loadDeduce(scope.parent, node, l);
        } else {
            throw `使用了未定义的变量:${name}`;
        }
    }
}
/**
 * 推导AST类型
 * @param scope 
 * @param node 
 * @returns 
 */
function nodeRecursion(scope: Scope, node: ASTNode): TypeUsed {
    if (node["def"] != undefined) {
        let name = Object.keys(node['def'])[0];
        scope.property[name] = node['def'][0];
        (scope.property[name] as any).defNode = node;//记录defnode
    }
    else if (node["load"] != undefined) {
        return loadDeduce(scope, node, 0);
    }
    else if (node["call"] != undefined) {
        let type = nodeRecursion(scope, node["call"].functionObj);
        for (let argNode of node["call"]._arguments) {
            nodeRecursion(scope, argNode);
        }
        if (!type.FunctionType) {
            throw `必须调用一个函数`;
        }
        return type;
    }
    else if (node["accessField"] != undefined) {
        let accessedType = nodeRecursion(scope, node["accessField"].obj);
        if (accessedType.ArrayType != undefined) {
            if (node["accessField"].field != 'length') {
                throw `数组只有length属性可访问`;
            } else {
                return { SimpleType: { name: 'number' } };
            }
        } else if (accessedType.FunctionType != undefined) {
            throw `函数目前没有任何属性可访问`;
        } else {
            let className = accessedType.SimpleType!.name;
            let accessName = node["accessField"].field;
            if (program.definedType[className].property[accessName] == undefined) {
                throw `访问了类型${className}中不存在的属性${accessName}`;
            }
            let type = program.definedType[className].property[accessName].type;
            if (type == undefined) {
                let classScope = new Scope(program.definedType[className].property, programScope);//切换scope
                type = nodeRecursion(classScope, program.definedType[className].property[accessName].initAST!);//类型推导爆栈，需要标记一下
            }
            return type;
        }
    }
    else if (node["_super"] != undefined) { }
    else if (node["_this"] != undefined) { }
    else if (node["immediate"] != undefined) {
        if (node["immediate"].primiviteValue) {
            if (isNaN(Number(node["immediate"].primiviteValue))) {
                return { SimpleType: { name: 'string' } };
            } else {
                return { SimpleType: { name: 'number' } };
            }
        } else {
            return functionScan(scope, node["immediate"].functionValue!);
        }
    }
    else if (node["trycatch"] != undefined) { }
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
    else if (node["="] != undefined) { console.error(`类型检查`); }
    else if (node["+"] != undefined) { }
    else if (node["-"] != undefined) { }
    else if (node["*"] != undefined) { }
    else if (node["/"] != undefined) { }
    else if (node["<"] != undefined) { }
    else if (node["<="] != undefined) { }
    else if (node[">"] != undefined) { }
    else if (node[">="] != undefined) { }
    else if (node["=="] != undefined) { }
    else if (node["||"] != undefined) { }
    else if (node["&&"] != undefined) { }
    else if (node["_switch"] != undefined) { }
    else { throw new Error(`未知节点`); }
    return {};
}
function typeCheck(a: TypeUsed, b: TypeUsed) {
    let ta = TypeUsedSingle(a);
    let tb = TypeUsedSingle(b);
    if (ta != tb) {
        throw `类型不匹配:${ta}<----->${tb}`;
    }
}
function BlockScan(scope: BlockScope, block: Block) {
    for (let nodeOrBlock of block.body) {
        if (nodeOrBlock.desc == 'ASTNode') {
            let node = nodeOrBlock as ASTNode;
            nodeRecursion(scope, node);
        } else {
            let block = nodeOrBlock as Block;
            let blockScope = new BlockScope({}, scope, false, block)
            BlockScan(blockScope, block);
        }
    }
}
function functionScan(scope: Scope, fun: FunctionType): TypeUsed {
    let argIndex = 0;
    for (let argumentName in fun._arguments) {
        let defNode: ASTNode = { desc: 'ASTNode', def: {} };
        defNode.def![argumentName] = { variable: 'var', initAST: { desc: 'ASTNode', loadArgument: argIndex } };
        fun.body.body.unshift(defNode);//插入args的def指令
        argIndex++;
    }
    BlockScan(new BlockScope({}, scope, true, fun.body), fun.body);
    //为这个Scope的所有prop插入load_stack指令
    throw 'unimplemented'
}
function ClassScan(scope: Scope, type: TypeDef) {
    for (let propName in type.property) {
        let prop = type.property[propName];
        if (prop.initAST) {
            let initType = nodeRecursion(scope, prop.initAST);
            if (prop.type) {
                typeCheck(initType, prop.type);
            } else {
                prop.type = initType;//如果是需要推导的类型，进行填充
            }
        } else if (prop.type?.FunctionType) {
            functionScan(scope, prop.type?.FunctionType);
        }
    }
}
function programScan() {
    program = JSON.parse(fs.readFileSync(`./src/example/toy-language/output/stage-1.json`).toString()) as Program;
    programScope = new Scope(program.property, undefined);
    //扫描definedType
    for (let typeName in program.definedType) {
        let type = program.definedType[typeName];
        ClassScan(new Scope(type.property, programScope), type);
    }
    //扫描property
}
programScan();