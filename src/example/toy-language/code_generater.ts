import fs from "fs";
//可以扫描Node和Block
function nodeScan(scope: Scope, node: ASTNode | Block) {
    if (Array.isArray(node)) {//是一个block
        let newScope: Scope = { isFunction: false, parent: scope, property: {}, captured: new Set() };//为block创建Scope
        for (let n of node) {//遍历block的所有节点
            nodeScan(newScope, n);//递归扫描
        }
    } else {
        //是一个普通节点，写这么长
        if (node["def"] != undefined) {
            let key = Object.keys(node.def)[0];
            if (scope.property[key] != undefined) {
                throw new Error(`重复定义属性${key}`);
            } else {
                scope.property[key] = node.def[key];
            }
        }
        else if (node["load"] != undefined) {
            let key = node["load"];
            let tmpScope = scope;
            let functionScopeLevel = 0;
            while (tmpScope != undefined && tmpScope.property[key] == undefined) {//一直向上搜索，直到搜索完毕或者找到指定的property
                if (tmpScope.isFunction) {
                    functionScopeLevel++;
                }
            }
            if (tmpScope == undefined || tmpScope.property[key] == undefined) {
                throw new Error(`使用了未定义的属性${key}`);
            } else {
                if (tmpScope.property[key].loadedNodes == undefined) {
                    tmpScope.property[key].loadedNodes = new Array();
                }
                tmpScope.property[key].loadedNodes!.push(node);
                if (functionScopeLevel > 1) {//等于1表示scope还在本function内部
                    tmpScope.captured.add(key);
                }
            }
        }
        else if (node["call"] != undefined) { }
        else if (node["accessField"] != undefined) { }
        else if (node["_super"] != undefined) { }
        else if (node["_this"] != undefined) { }
        else if (node["immediate"] != undefined) { }
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
        else if (node["immediate"] != undefined) { }
        else if (node["cast"] != undefined) { }
        else if (node["_new"] != undefined) { }
        else if (node["_newArray"] != undefined) { }
        else if (node["="] != undefined) { }
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
    }
}
//第二步不是生成代码，应该先扫描闭包
export default function scan(program_source: string) {
    let program = JSON.parse(program_source) as Program;
    let property = program.property;
    let programScope: Scope = { parent: undefined, property: property, isFunction: false, captured: new Set() };
    for (let key in property) {
        let prop = property[key];
        if (prop?.type?.FunctionType != undefined) {//处理顶层Fcuntion
            let functionScope: Scope = { isFunction: true, parent: programScope, property: prop.type.FunctionType.argument, captured: new Set() };
            for (let node of prop.type.FunctionType.body) {
                nodeScan(functionScope, node);
            }
        }
    }
}
scan(fs.readFileSync("./src/example/toy-language/output/class.json").toString());