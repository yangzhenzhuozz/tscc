import fs from "fs";
let program: Program;
function scopePostProcess(scope: Scope) {
    if (scope.captured.size > 0) {
        console.log(scope.captured);
        console.log(`捕获变量,需要修改对于节点`);//这里直接这样修改还不行，父节点链接不到修改之后的节点
    }
}
//只扫描Node，处理block的时候调用者自己循环(因为nodeScan遇到block的时候会自己创建一个Scope)
function nodeScan(scope: Scope, node: ASTNode | Block) {
    if (Array.isArray(node)) {//是一个block
        let newScope: Scope = { isFunction: false, parent: scope, property: {}, captured: new Set() };//为block创建Scope
        for (let n of node) {//遍历block的所有节点
            nodeScan(newScope, n);//递归扫描
        }
        scopePostProcess(newScope);
    } else {
        //是一个普通节点，写这么长
        if (node["def"] != undefined) {
            let key = Object.keys(node.def)[0];
            if (scope.property[key] != undefined) {
                throw new Error(`重复定义属性${key}`);
            } else {
                scope.property[key] = node.def[key];
                if (node.def[key].type?.FunctionType != undefined) {
                    let newScope: Scope = { isFunction: true, parent: scope, property: node.def[key].type!.FunctionType!._arguments, captured: new Set() };//为block创建Scope
                    for (let n of node.def[key].type!.FunctionType!.body) {
                        nodeScan(newScope, n);
                    }
                    scopePostProcess(newScope);
                }
            }
        }
        else if (node["load"] != undefined) {
            let key = node["load"];
            let tmpScope: Scope | undefined = scope;
            let functionScopeLevel = 0;
            while (tmpScope != undefined && tmpScope.property[key] == undefined) {//一直向上搜索，直到搜索完毕或者找到指定的property
                if (tmpScope.isFunction) {
                    functionScopeLevel++;
                }
                tmpScope = tmpScope.parent;
            }
            if (tmpScope == undefined || tmpScope.property[key] == undefined) {
                throw new Error(`使用了未定义的属性${key}`);
            } else {
                if (tmpScope.property[key].loadedNodes == undefined) {
                    tmpScope.property[key].loadedNodes = new Array();
                }
                tmpScope.property[key].loadedNodes!.push(node);
                if (functionScopeLevel > 0) {//等于1表示scope还在本function内部
                    tmpScope.captured.add(key);
                }
            }
        }
        else if (node["call"] != undefined) {
            nodeScan(scope, node.call.functionObj);
            for (let n of node['call']._arguments) {
                nodeScan(scope, n);
            }
        }
        else if (node["accessField"] != undefined) {
            nodeScan(scope, node.accessField.obj);
        }
        else if (node["_super"] != undefined) { }
        else if (node["_this"] != undefined) { }
        else if (node["immediate"] != undefined) {
            if (node.immediate.functionValue != undefined) {
                let newScope: Scope = { isFunction: true, parent: scope, property: node.immediate.functionValue._arguments, captured: new Set() };//为block创建Scope
                for (let n of node.immediate.functionValue.body) {
                    nodeScan(newScope, n);
                }
                scopePostProcess(newScope);
            }
        }
        else if (node["trycatch"] != undefined) { }
        else if (node["throwStmt"] != undefined) {
            nodeScan(scope, node['throwStmt']);
        }
        else if (node["ret"] != undefined) {
            if (node.ret != '') {
                nodeScan(scope, node.ret);
            }
        }
        else if (node["ifStmt"] != undefined) {
            nodeScan(scope, node.ifStmt.condition);
            if (Array.isArray(node.ifStmt.stmt)) {
                let newScope: Scope = { isFunction: false, parent: scope, property: {}, captured: new Set() };//为block创建Scope
                for (let n of node.ifStmt.stmt) {
                    nodeScan(newScope, n);
                }
                scopePostProcess(newScope);
            } else {
                nodeScan(scope, node.ifStmt.stmt);
            }
        }
        else if (node["ifElseStmt"] != undefined) {
            nodeScan(scope, node.ifElseStmt.condition);
            if (Array.isArray(node.ifElseStmt.stmt1)) {
                let newScope: Scope = { isFunction: false, parent: scope, property: {}, captured: new Set() };//为block创建Scope
                for (let n of node.ifElseStmt.stmt1) {
                    nodeScan(newScope, n);
                }
                scopePostProcess(newScope);
            } else {
                nodeScan(scope, node.ifElseStmt.stmt1);
            }
            if (Array.isArray(node.ifElseStmt.stmt2)) {
                let newScope: Scope = { isFunction: false, parent: scope, property: {}, captured: new Set() };//为block创建Scope
                for (let n of node.ifElseStmt.stmt2) {
                    nodeScan(newScope, n);
                }
                scopePostProcess(newScope);
            } else {
                nodeScan(scope, node.ifElseStmt.stmt2);
            }
        }
        else if (node["do_while"] != undefined) {
            nodeScan(scope, node.do_while.condition);
            if (Array.isArray(node.do_while.stmt)) {
                let newScope: Scope = { isFunction: false, parent: scope, property: {}, captured: new Set() };//为block创建Scope
                for (let n of node.do_while.stmt) {
                    nodeScan(newScope, n);
                }
                scopePostProcess(newScope);
            } else {
                nodeScan(scope, node.do_while.stmt);
            }
        }
        else if (node["_while"] != undefined) {
            nodeScan(scope, node._while.condition);
            if (Array.isArray(node._while.stmt)) {
                let newScope: Scope = { isFunction: false, parent: scope, property: {}, captured: new Set() };//为block创建Scope
                for (let n of node._while.stmt) {
                    nodeScan(newScope, n);
                }
                scopePostProcess(newScope);
            } else {
                nodeScan(scope, node._while.stmt);
            }
        }
        else if (node["_for"] != undefined) {
            if (node._for.init != undefined) {
                nodeScan(scope, node._for.init);
            }
            if (node._for.condition != undefined) {
                nodeScan(scope, node._for.condition);
            }
            if (node._for.step != undefined) {
                nodeScan(scope, node._for.step);
            }
            if (Array.isArray(node._for.stmt)) {
                let newScope: Scope = { isFunction: false, parent: scope, property: {}, captured: new Set() };//为block创建Scope
                for (let n of node._for.stmt) {
                    nodeScan(newScope, n);
                }
                scopePostProcess(newScope);
            } else {
                nodeScan(scope, node._for.stmt);
            }
        }
        else if (node["_break"] != undefined) { }
        else if (node["_continue"] != undefined) { }
        else if (node["_instanceof"] != undefined) {
            nodeScan(scope, node._instanceof.obj);
        }
        else if (node["not"] != undefined) {
            nodeScan(scope, node.not.child);
        }
        else if (node["increase"] != undefined) {
            nodeScan(scope, node.increase.child);
        }
        else if (node["decrease"] != undefined) {
            nodeScan(scope, node.decrease.child);
        }
        else if (node["indexOP"] != undefined) {
            nodeScan(scope, node.indexOP.obj);
            nodeScan(scope, node.indexOP.index);
        }
        else if (node["ternary"] != undefined) {
            nodeScan(scope, node.ternary.condition);
            nodeScan(scope, node.ternary.obj1);
            nodeScan(scope, node.ternary.obj2);
        }
        else if (node["immediate"] != undefined) { }
        else if (node["cast"] != undefined) {
            nodeScan(scope, node.cast.obj);
        }
        else if (node["_new"] != undefined) {
            for (let n of node['_new']._arguments) {
                nodeScan(scope, n);
            }
        }
        else if (node["_newArray"] != undefined) {
            for (let n of node['_newArray'].initList) {
                nodeScan(scope, n);
            }
        }
        else if (node["="] != undefined) {
            nodeScan(scope, node['='].leftChild);
            nodeScan(scope, node['='].rightChild);
        }
        else if (node["+"] != undefined) {
            nodeScan(scope, node['+'].leftChild);
            nodeScan(scope, node['+'].rightChild);
        }
        else if (node["-"] != undefined) {
            nodeScan(scope, node['-'].leftChild);
            nodeScan(scope, node['-'].rightChild);
        }
        else if (node["*"] != undefined) {
            nodeScan(scope, node['*'].leftChild);
            nodeScan(scope, node['*'].rightChild);
        }
        else if (node["/"] != undefined) {
            nodeScan(scope, node['/'].leftChild);
            nodeScan(scope, node['/'].rightChild);
        }
        else if (node["<"] != undefined) {
            nodeScan(scope, node['<'].leftChild);
            nodeScan(scope, node['<'].rightChild);
        }
        else if (node["<="] != undefined) {
            nodeScan(scope, node['<='].leftChild);
            nodeScan(scope, node['<='].rightChild);
        }
        else if (node[">"] != undefined) {
            nodeScan(scope, node['>'].leftChild);
            nodeScan(scope, node['>'].rightChild);
        }
        else if (node[">="] != undefined) {
            nodeScan(scope, node['>='].leftChild);
            nodeScan(scope, node['>='].rightChild);
        }
        else if (node["=="] != undefined) {
            nodeScan(scope, node['=='].leftChild);
            nodeScan(scope, node['=='].rightChild);
        }
        else if (node["||"] != undefined) {
            nodeScan(scope, node['||'].leftChild);
            nodeScan(scope, node['||'].rightChild);
        }
        else if (node["&&"] != undefined) {
            nodeScan(scope, node['&&'].leftChild);
            nodeScan(scope, node['&&'].rightChild);
        }
        else if (node["_switch"] != undefined) {
            nodeScan(scope, node._switch.pattern);
            if (node._switch.defalutStmt != undefined) {
                if (Array.isArray(node._switch.defalutStmt)) {
                    let newScope: Scope = { isFunction: false, parent: scope, property: {}, captured: new Set() };//为block创建Scope
                    for (let n of node._switch.defalutStmt) {
                        nodeScan(newScope, n);
                    }
                    scopePostProcess(newScope);
                } else {
                    nodeScan(scope, node._switch.defalutStmt);
                }
            }
            for (let matcItem of node._switch.matchList) {
                nodeScan(scope, matcItem.matchObj);
                if (Array.isArray(matcItem.stmt)) {
                    let newScope: Scope = { isFunction: false, parent: scope, property: {}, captured: new Set() };//为block创建Scope
                    for (let n of matcItem.stmt) {
                        nodeScan(newScope, n);
                    }
                    scopePostProcess(newScope);
                } else {
                    nodeScan(scope, matcItem.stmt);
                }
            }
        } else {
            throw new Error(`存在未定义的ASTNode`);
        }
    }
}
//第二步不是生成代码，应该先扫描闭包
export default function scan(program_source: string) {
    program = JSON.parse(program_source) as Program;
    let property = program.property;
    let programScope: Scope = { parent: undefined, property: property, isFunction: false, captured: new Set() };
    for (let key in property) {
        let prop = property[key];
        if (prop?.type?.FunctionType != undefined) {//处理顶层Fcuntion
            let functionScope: Scope = { isFunction: true, parent: programScope, property: prop.type.FunctionType._arguments, captured: new Set() };
            for (let node of prop.type.FunctionType.body) {
                nodeScan(functionScope, node);
            }
            scopePostProcess(functionScope);
        }
    }
    fs.writeFileSync('./src/example/toy-language/output/stage-2.json', JSON.stringify(program));
}
scan(fs.readFileSync("./src/example/toy-language/output/stage-1.json").toString());
//progrom和class的scope不用管，闭包只捕获block中的变量，所以在Scope解析完成之后，应该创建闭包类，block不需要scope属性了
//刚好在每个报错的地方后面一点(遍历完block之后)生成闭包类