import fs from 'fs'
import { TypeUsedSingle } from './lib.js';
import { Scope, BlockScope, ClassScope, ProgramScope } from './scope.js';
let program: Program;
let programScope: ProgramScope;
/**
 * 推导AST类型
 * @param scope 
 * @param node 
 * @returns 
 */
function nodeRecursion(scope: Scope, node: ASTNode): TypeUsed {
    if (node["def"] != undefined) {
        //def节点是block专属
        let name = Object.keys(node['def'])[0];
        if (scope.property[name] != undefined) {
            throw `重复定义变量${name}`;
        }
        scope.property[name] = node['def'][name];
        let initType: TypeUsed | undefined;
        if (node['def'][name].initAST != undefined) {
            initType = nodeRecursion(scope, node['def'][name].initAST!)
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
                 * 所以遇到这种情况，通通扫描一次，在functionScan中，如果function.body.body.length==0,则直接放弃扫描
                */
                functionScan(scope, node['def'][name].type!.FunctionType!);//如果是定义了函数，则扫描一下
            }
        }
        (scope.property[name] as any).defNode = node;//记录defnode
        return { SimpleType: { name: 'void' } };
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
                node.accessField = { obj: { desc: 'ASTNode', _this: s.className }, field: name };
                return nodeRecursion(scope, node);
            } else if (s instanceof ProgramScope) {
                delete node.load;//把load改为access
                node.accessField = { obj: { desc: 'ASTNode', _program: '' }, field: name };
                return nodeRecursion(scope, node);
            } else {//blockScope
                if (!(node as any).loadNodes) {
                    (node as any).loadNodes = [];
                }
                if (level > 0) {
                    (s as BlockScope).hasCapture = true;
                }
                (node as any).loadNodes.push(node);//记录下bolck有多少def节点需要被打包到闭包类,每个prop被那些地方load的,block扫描完毕的时候封闭的时候把这些load节点全部替换
                return prop.type!;//如果是读取block内部定义的变量,则这个变量一点是已经被推导出类型的，因为代码区域的变量是先定义后使用的
            }
        }
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
                let initAST = program.definedType[className].property[accessName].initAST!;
                if ((initAST as any).flag) {
                    throw `类型推导出现了循环:${className}.${accessName}`;
                }
                let classScope = new ClassScope(program.definedType[className].property, programScope, className);//切换scope
                (initAST as any).flag = true;//标记一下这个属性已经在推导路径中被使用过了
                type = nodeRecursion(classScope, initAST);
                delete (initAST as any).flag;//删除标记,回溯常用手法
            }
            return type;
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
                return { SimpleType: { name: targeScope.className } };
            } else {
                throw `不是定义在class内部的函数不能使用this`;
            }
        } else {
            //通过load转换得到的_this
            return { SimpleType: { name: node['_this'] } };
        }
    }
    else if (node["_program"] != undefined) {
        return { ProgramType: "" };
    }
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
    throw new Error(`未知节点`);
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
            if (blockScope.hasCapture) {
                throw `unimplemented`;//闭包处理还未完成
            }
        }
    }
}
function functionScan(scope: Scope, fun: FunctionType): TypeUsed {
    if (fun.body!.body.length == 0) {//函数里面没有任何语句，放弃扫描
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
    BlockScan(blockScope, fun.body!);
    if (blockScope.hasCapture) {
        throw `unimplemented`;//闭包处理还未完成
    }
    //为这个Scope的所有prop插入load_stack指令
    // throw 'unimplemented'
    console.error('后面需要补充返回值类型');
    return {};
}
function ClassScan(scope: ClassScope, type: TypeDef) {
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
    programScope = new ProgramScope(program.property, undefined);
    //扫描definedType
    for (let typeName in program.definedType) {
        let type = program.definedType[typeName];
        ClassScan(new ClassScope(type.property, programScope, typeName), type);
    }
    //扫描property
}
programScan();