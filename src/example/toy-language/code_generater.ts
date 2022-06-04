import fs from "fs";

//搜索当前节点使用所使用到的所有load节点
function loadSearch(node: ASTNode): ASTNode[] {
    let ret: ASTNode[] = [];
    return ret;
}

function blockScan(scope: Scope, block: Block) {
    for (let node of block) {//遍历block的所有节点
        if (Array.isArray(node)) {
            //是一个新的block
            blockScan({ isFunction: true, parent: scope, property: {} }, node);//递归扫描
        } else {
            //是一个普通节点,只处理def和load
            if (node.def != undefined) {
                //往scope中增加property
                let key = Object.keys(node.def)[0];
                if (scope.property[key] != undefined) {
                    throw new Error(`重复定义变量:${key}`);
                } else {
                    scope.property[key] = node.def[key];
                    if (node.def[key].type?.FunctionType != undefined) {//定义了一个函数，需要再次解析
                        blockScan({ isFunction: true, parent: scope, property: node.def[key].type!.FunctionType!.argument }, node.def[key].type!.FunctionType!.body);
                    }
                }
            }
            let loads = loadSearch(node);
            if (loads.length > 0) {
                for (let loadNode of loads) {
                    let tmpScope: Scope | undefined = scope;
                    let functionScopeLevel = 0;
                    for (; tmpScope != undefined && tmpScope.property[loadNode.load!] == undefined;) {//向上搜索，直到找到需要访问的属性
                        tmpScope = tmpScope.parent;
                        if (tmpScope!.isFunction) {
                            functionScopeLevel++;
                        }
                    }
                    if (tmpScope == undefined || tmpScope.property[loadNode.load!] == undefined) {
                        throw new Error(`访问为定义的属性:${node.load}`);
                    }
                    if (functionScopeLevel > 1) {
                        console.log(`捕获属性:${node.load}`);
                    }
                }
            }
        }
    }
}
//第二步不是生成代码，应该先扫描闭包
export default function scan(program_source: string) {
    let program = JSON.parse(program_source) as Program;
    let property = program.property;
    let programScope: Scope = { parent: undefined, property: property, isFunction: false };
    for (let key in property) {
        let prop = property[key];
        if (prop?.type?.FunctionType != undefined) {//处理顶层Fcuntion
            blockScan({ isFunction: true, parent: programScope, property: prop.type.FunctionType.argument }, prop.type.FunctionType.body);
        }
    }
}
scan(fs.readFileSync("./src/example/toy-language/output/class.json").toString());