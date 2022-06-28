/**
 * 1.处理闭包
 * 2.把所有的引用换成this,super
 * 3.把内层嵌套的fucntion剥离出去,在全局空间中注册
 * 4.返回值检查
 */
import { Scope } from "./scope.js";
//注册函数
function registerFucntion() {

}

/**
 * 在处理闭包时，需要处理函数参数，因为这参数是没有def节点的
 * @param scope 
 * @param block 
 * @param template 
 */
function blockScan(scope: Scope, block: Block, template: string[]) {
    for (let node of block) {
        if (Array.isArray(node)) {//是一个block
            let newScope: Scope = new Scope({}, scope, false, template);//为block创建Scope
            blockScan(newScope, node, template);//递归扫描
            newScope.postProcessor();
        } else {
            //是一个普通节点
            if (node["def"] != undefined) {
                let key = Object.keys(node.def)[0];
                if (scope.property[key] != undefined) {
                    throw new Error(`重复定义属性${key}`);
                } else {
                    scope.property[key] = node.def[key];
                    scope.defNodes[key] = node;//挂载def节点指向自己
                    //定义了一个函数
                    if (node.def[key].type?.FunctionType != undefined || node.def[key].initAST?.immediate?.functionValue != undefined) {
                    }
                }
            }
            else if (node["load"] != undefined) { }
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
            else {
                throw new Error(`存在未定义的ASTNode`);
            }
        }
    }
}