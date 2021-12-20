import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
import lexer from "./lexrule.js";
import { BackPatchTools, Descriptor, Scope, Address, SemanticException, Type, GlobalScope, FunctionScope, ClassScope, StmtScope, StmtDescriptor, ObjectDescriptor, BlockScope, Quadruple } from './lib.js'
let grammar: Grammar = {
    userCode: `import { BackPatchTools, Descriptor, Scope, Address, SemanticException, Type, GlobalScope, FunctionScope, ClassScope, StmtScope, StmtDescriptor, ObjectDescriptor, BlockScope, Quadruple } from './lib.js'`,//让自动生成的代码包含import语句
    tokens: ['var', '...', ';', 'id', 'constant_val', '+', '-', '++', '--', '(', ')', '?', '{', '}', '[', ']', ',', ':', 'basic_type', 'function', 'class', '=>', 'operator', 'new', '.', 'extends', 'if', 'else', 'do', 'while', 'for', 'switch', 'case', 'default', 'valuetype', 'import', 'as', 'break', 'continue', 'sealed', 'this', 'return'],
    association: [
        { 'right': ['='] },
        { 'right': ['?'] },
        { 'left': ['==', '!='] },
        { 'left': ['||'] },
        { 'left': ['&&'] },
        { 'left': ['!'] },
        { 'nonassoc': ['>', '<', '<=', '>='] },
        { 'left': ['+', '-'] },
        { 'left': ['*', '/'] },
        { 'left': ['++', '--'] },
        { 'nonassoc': ['low_priority_for_array_placeholder'] },
        { 'right': ['['] },
        { 'nonassoc': ['('] },
        { 'left': ['.'] },
        { 'nonassoc': ['low_priority_for_if_stmt'] },//这个符号的优先级小于else
        { 'nonassoc': ['else'] },
    ],
    BNF: [
        /**
         * 任何使用到object的地方都进行回填判断
         * 如 a<b 其中a重载和<操作符,则生成回填代码处理b
         * 任何时候如果进行回填，则会终止回填向上传递
         * 因为正常情况是将回填一直向上传递，直到遇到某些代码可以进行回填
         * 如if(a<b) xxx则是在处理if stmt的时候进行回填
         *  a||b<c 和 a||b都会被规约成 obj1||obj2
         * 前者在obj1不需要回填，obj2需要回填，后者两个地方都不需要回填
         */
        { "program:createScopeForProgram import_stmts W3_1 program_units": {} },
        {
            "createScopeForProgram:": {
                action: function ($, s): Scope {
                    return new GlobalScope();
                }
            }
        },
        {
            "W3_1:": {
                action: function ($, s) {
                    return s.slice(-3)[1];
                }
            }
        },
        { "program_units:program_units W2_0 program_unit": {} },
        { "program_units:": {} },
        { "program_unit:declare ;": {} },
        { "program_unit:cass_definition": {} },
        { "import_stmts:": {} },
        { "import_stmts:import_stmts import_stmt": {} },
        { "import_stmt:import id as id ;": {} },

        { "cass_definition:modifier class id extends_declare { class_units }": {} },
        { "modifier:": {} },
        { "modifier:valuetype": {} },
        { "modifier:sealed": {} },
        { "extends_declare:extends basic_type": {} },
        { "extends_declare:": {} },
        { "class_units:class_units class_unit": {} },
        { "class_units:": {} },
        { "class_unit:cass_definition": {} },
        { "class_unit:declare ;": {} },
        { "class_unit:operator_overload": {} },
        { "operator_overload:operator + ( parameter ) : type { statements }": {} },

        {
            "declare:var id : type": {
                action: function ($, s) {
                    let id = $[1] as string;
                    let type = $[3] as Type;
                    let head = s.slice(-1)[0] as Scope;
                    head.createVariable(id, type);
                    return new StmtDescriptor();
                }
            }
        },
        { "declare:function_definition": {} },

        {
            "type:basic_type arr_definition": {
                action: function ($, s) {
                    return $[1];//basic_type的属性已经被继承到arr_definition中了
                }
            }
        },
        { "type:( lambda_parameter_types ) => type": { action: ($, s) => `(${$[1]})=>${$[4]}` } },
        {
            "lambda_parameter_types:": {
                action: () => ""
            }
        },
        { "lambda_parameter_types:lambda_parameter_type_list": { action: ($, s) => $[0] } },
        { "lambda_parameter_type_list:lambda_parameter_type_list , type": { action: ($, s) => `${$[0]},${$[2]}` } },
        { "lambda_parameter_type_list:type": { action: ($, s) => $[0] } },
        {
            "arr_definition:arr_definition [ ]": {
                action: function ($, s) {
                    let arr_definition = $[0] as Type;
                    return Type.ConstructArray(arr_definition);
                }
            }
        },
        {
            "arr_definition:": {
                action: function ($, s) {
                    return s.slice(-1)[0];//从basic_type中得到属性
                }
            }
        },

        {
            "function_definition:function id ( parameters ) : type { createFunctionScope statements }": {
                action: function ($, s) {
                    let createFunctionDescriptor = $[8] as FunctionScope;
                    let statements = $[9] as StmtDescriptor;
                    if (createFunctionDescriptor.returnType.type != "base_type" || createFunctionDescriptor.returnType.basic_type != "void") {
                        if (!statements.hasReturn) {
                            throw new SemanticException("函数必须有返回值");
                        }
                    }
                    console.log(`${statements}`);
                }
            }
        },
        {
            "createFunctionScope:": {
                action: function ($, s): FunctionScope {
                    let stacks = s.slice(-9);
                    let parameters = stacks[4] as [string, Type][];
                    let id = stacks[2] as string;
                    let returnType = stacks[7] as Type;
                    let head = stacks[0] as Scope;
                    let parameterTypes: Type[] = [];
                    for (let p of parameters) {
                        parameterTypes.push(p[1]);
                    }
                    if (!head.createVariable(id, Type.ConstructFunction(parameterTypes, returnType))) {
                        throw new SemanticException(head.errorMSG);//并且终止解析
                    }
                    //创建函数空间
                    let functionScope = new FunctionScope(returnType);
                    functionScope.linkParentScope(head);
                    for (let p of parameters) {//在函数空间中定义变量
                        if (!functionScope.createVariable(p[0], p[1])) {
                            throw new SemanticException(head.errorMSG);//并且终止解析
                        }
                    }
                    return functionScope;
                }
            }
        },
        { "parameters:parameter_list": { action: ($) => $[0] } },
        { "parameters:varible_argument": { action: ($) => $[0] } },
        {
            "parameters:parameter_list , varible_argument": {
                action: ($, s): [string, Type][] => {
                    let parameter_list = $[0] as [string, Type][];
                    let varible_argument = $[2] as [string, Type];
                    parameter_list.push(varible_argument);
                    return parameter_list;
                }
            }
        },
        { "parameters:": { action: () => [] } },
        {
            "parameter_list:parameter_list , parameter": {
                action: function ($, s): [string, Type][] {
                    let parameter_list = $[0] as [string, Type][];
                    let parameter = $[2] as [string, Type];
                    parameter_list.push(parameter);
                    return parameter_list;
                }
            }
        },
        {
            "parameter_list:parameter": {
                action: function ($, s): [string, Type][] {
                    let parameter = $[0] as [string, Type];
                    return [parameter];
                }
            }
        },
        {
            "parameter:id : type": {
                action: function ($, s): [string, Type] {
                    let id = $[0] as string;
                    let type = $[2] as Type;
                    return [id, type];
                }
            }
        },
        {
            "varible_argument: ... id : type": {
                action: function ($, s): [string, Type] {
                    let id = $[1] as string;
                    let type = $[3] as Type;
                    return [id, Type.ConstructArray(type)];
                }
            }
        },
        { "statement:declare ;": { action: ($, s) => $[0] } },
        {
            "statement:return W2_0 object ;": {
                action: function ($, s): StmtDescriptor {
                    let ret = new StmtDescriptor();
                    ret.hasReturn = true;
                    return ret;
                }
            }
        },
        {
            "statement:return ;": {
                action: function ($, s): StmtDescriptor {
                    let ret = new StmtDescriptor();
                    ret.hasReturn = true;
                    return ret;
                }
            }
        },
        {
            "statement:if ( W3_0 object objInIfCondition ) W7_0_for_stmt statement": {
                action: function ($, s): StmtDescriptor {
                    let obj = $[3] as ObjectDescriptor;
                    let stmt = $[7] as StmtDescriptor;
                    let ret = new StmtDescriptor();
                    //经过objInIfCondition的处理,obj一定是需要回填的代码
                    let trueAddressValue: number;
                    let falseAddressValue: number;
                    if (stmt.quadruples.length > 0) {//stmt不是空白语句
                        trueAddressValue = stmt.quadruples[0].pc;
                        falseAddressValue = stmt.quadruples[stmt.quadruples.length - 1].pc + 1;
                    } else {//stmt是空白语句
                        trueAddressValue = obj.quadruples[obj.quadruples.length - 1].pc + 1;
                        falseAddressValue = obj.quadruples[obj.quadruples.length - 1].pc + 1;
                    }
                    BackPatchTools.backpatch(obj.trueList, trueAddressValue);
                    BackPatchTools.backpatch(obj.falseList, falseAddressValue);
                    ret.quadruples = obj.quadruples.concat(stmt.quadruples);
                    return ret;
                }, priority: "low_priority_for_if_stmt"
            }
        },
        {
            "statement:if ( W3_0 object objInIfCondition ) W7_0_for_stmt statement else W10_0_for_stmt statement": {
                action: function ($, s) {
                    let stmt1 = $[6] as StmtDescriptor;
                    let stmt2 = $[9] as StmtDescriptor;
                    let ret = new StmtDescriptor();
                    ret.hasReturn = stmt1.hasReturn && stmt2.hasReturn;
                    "判断object是值类型的还是需要回填的那种，比如if(a) xxx 这种则直接对a进行判断，如果是 if(xx||xx) xxx 这种，则进行回填";
                    return ret;
                }
            }
        },
        {
            "objInIfCondition:": {
                action: function ($, s): void {
                    let stack = s.slice(-2);
                    let ScopeContainer = stack[0] as StmtScope;
                    let obj = stack[1] as ObjectDescriptor;
                    ScopeContainer.removeTemporary();//移除临时变量
                    //如果obj是不需要回填的代码,如if(a)，则为其生成回填代码
                    if (!obj.backPatch) {
                        let trueAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                        let falseAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                        let trueInstruction = new Quadruple("if", obj.address, undefined, trueAddress);
                        let falseInstruction = new Quadruple("goto", undefined, undefined, falseAddress);
                        obj.quadruples.push(trueInstruction);
                        obj.quadruples.push(falseInstruction);
                        obj.trueList.push(trueAddress);
                        obj.falseList.push(falseAddress);
                        obj.backPatch = true;
                    }
                }
            }
        },
        { "statement:lable_def do statement while ( object ) ;": {} },
        { "statement:lable_def while ( object ) statement": {} },
        {
            "statement:lable_def for ( for_loop_init_scope for_init for_init_post_processor ; for_condition_scope for_condition for_condition_post_processor ; for_step_scope for_step for_step_post_processor ) for_stmt_scope statement": {
                action: function ($, s): StmtDescriptor {
                    let for_init = $[4] as ObjectDescriptor | StmtDescriptor;
                    let for_condition = $[8] as ObjectDescriptor | undefined;
                    let for_step = $[12] as ObjectDescriptor | undefined;
                    let for_stmt_scope = $[15] as StmtScope;
                    let stmt = $[16] as StmtDescriptor;
                    let loopAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                    let loopInstruction = new Quadruple("goto", undefined, undefined, loopAddress);
                    stmt.quadruples.push(loopInstruction);
                    let ret = new StmtDescriptor();
                    // 处理boolean回填的问题
                    if (for_condition == undefined && for_step == undefined) {
                        loopAddress.value = stmt.quadruples[0].pc;
                        if (for_init instanceof ObjectDescriptor && for_init.backPatch) {//回填
                            BackPatchTools.backpatch(for_init.trueList, stmt.quadruples[0].pc);
                            BackPatchTools.backpatch(for_init.falseList, stmt.quadruples[0].pc);
                        } else {
                            (for_init.tag as Address).value = stmt.quadruples[0].pc;
                        }
                        ret.quadruples = for_init.quadruples.concat(stmt.quadruples);
                    } else if (for_condition != undefined && for_step == undefined) {
                        loopAddress.value = for_condition.quadruples[0].pc;
                        if (for_init instanceof ObjectDescriptor && for_init.backPatch) {//回填
                            BackPatchTools.backpatch(for_init.trueList, for_condition.quadruples[0].pc);
                            BackPatchTools.backpatch(for_init.falseList, for_condition.quadruples[0].pc);
                        } else {
                            (for_init.tag as Address).value = for_condition.quadruples[0].pc;
                        }
                        ret.quadruples = for_init.quadruples.concat(for_condition.quadruples).concat(stmt.quadruples);
                        if (for_condition.backPatch) {//回填
                            BackPatchTools.backpatch(for_condition.trueList, stmt.quadruples[0].pc);
                            BackPatchTools.backpatch(for_condition.falseList, loopInstruction.pc + 1);
                        }
                    } else if (for_condition == undefined && for_step != undefined) {
                        loopAddress.value = for_step.quadruples[0].pc;
                        if (for_init instanceof ObjectDescriptor && for_init.backPatch) {//回填
                            BackPatchTools.backpatch(for_init.trueList, for_step.quadruples[0].pc);
                            BackPatchTools.backpatch(for_init.falseList, for_step.quadruples[0].pc);
                        } else {
                            (for_init.tag as Address).value = for_step.quadruples[0].pc;
                        }
                        ret.quadruples = for_init.quadruples.concat(for_step.quadruples).concat(stmt.quadruples);
                        if (for_step != undefined && for_step.backPatch) {//回填
                            //不管如何,step都跳转到condtiton,conditon为undefined则跳转到stmt
                            BackPatchTools.backpatch(for_step.trueList, stmt.quadruples[0].pc);
                            BackPatchTools.backpatch(for_step.falseList, stmt.quadruples[0].pc);
                        }
                    } else if (for_condition != undefined && for_step != undefined) {
                        loopAddress.value = for_condition.quadruples[0].pc;
                        if (for_init instanceof ObjectDescriptor && for_init.backPatch) {//回填
                            BackPatchTools.backpatch(for_init.trueList, for_step.quadruples[0].pc);
                            BackPatchTools.backpatch(for_init.falseList, for_step.quadruples[0].pc);
                        } else {
                            (for_init.tag as Address).value = for_step.quadruples[0].pc;
                        }
                        ret.quadruples = for_init.quadruples.concat(for_step.quadruples).concat(for_condition.quadruples).concat(stmt.quadruples);
                        if (for_condition.backPatch) {//回填
                            BackPatchTools.backpatch(for_condition.trueList, stmt.quadruples[0].pc);
                            BackPatchTools.backpatch(for_condition.falseList, loopInstruction.pc + 1);
                        }
                        if (for_step != undefined && for_step.backPatch) {//回填
                            //不管如何,step都跳转到condtiton
                            BackPatchTools.backpatch(for_step.trueList, for_condition.quadruples[0].pc);
                            BackPatchTools.backpatch(for_step.falseList, for_condition.quadruples[0].pc);
                        }
                    } else {
                        throw "没有其他可能了吧"
                    }
                    BackPatchTools.backpatch(for_stmt_scope.breakAddresses, ret.quadruples.slice(-1)[0].pc + 1);
                    BackPatchTools.backpatch(for_stmt_scope.continueAddresses, loopAddress.value);
                    /**
                     * init
                     * step
                     * condition
                     * stmt
                     * goto step
                     */
                    return ret;
                }
            }
        },
        {
            "for_loop_init_scope:": {
                action: function ($, s): StmtScope {
                    let head = s.slice(-4)[0] as StmtScope;
                    let block = new BlockScope();//创建一个blockScope
                    block.linkParentScope(head);
                    let ret = new StmtScope();
                    ret.linkParentScope(block);
                    return ret;
                }
            }
        },
        {
            "for_init:": {
                action: function ($, s) {
                    return new StmtDescriptor();
                }
            }
        },
        {
            "for_init:declare": {
                action: function ($, s) {
                    return $[0] as StmtDescriptor;
                }
            }
        },
        {
            "for_init:object": {
                action: function ($, s) {
                    return $[0] as ObjectDescriptor;
                }
            }
        },
        {
            "for_init_post_processor:": {
                action: function ($, s) {
                    let stack = s.slice(-2);
                    let ScopeContainer = stack[0] as StmtScope;
                    ScopeContainer.removeTemporary();//清理stmtscope
                    let for_init = stack[1] as StmtDescriptor | ObjectDescriptor;
                    if (for_init instanceof ObjectDescriptor && for_init.backPatch) {
                        //如果for_init本身是obj，且需要回填,则不增加goto指令
                    } else {
                        let address = new Address("constant_val", 0, Type.ConstructBase("PC"));
                        for_init.quadruples.push(new Quadruple('goto', undefined, undefined, address));
                        for_init.tag = address;//需要回填的指令
                    }
                }
            }
        },
        {
            "for_condition_scope:": {
                action: function ($, s): StmtScope {
                    //直接使用for_loop_init_scope创建的stmtscope
                    let for_loop_init_scope = s.slice(-4)[0] as StmtScope;
                    return for_loop_init_scope;
                }
            }
        },
        { "for_condition:": {} },
        {
            "for_condition:object": {
                action: function ($, s) {
                    return $[0] as ObjectDescriptor;
                }
            }
        },
        {
            "for_condition_post_processor:": {
                action: function ($, s) {
                    let stack = s.slice(-2);
                    let ScopeContainer = stack[0] as StmtScope;
                    ScopeContainer.removeTemporary();//清理stmtscope
                    let for_condition = stack[1] as ObjectDescriptor | undefined;
                    if (for_condition != undefined && !for_condition.backPatch) {//如果condition不是空白，且没有回填代码，则为其增加回填代码
                        let trueAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                        let falseAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                        let trueInstruction = new Quadruple("if", for_condition.address, undefined, trueAddress);
                        let falseInstruction = new Quadruple("goto", undefined, undefined, falseAddress);
                        for_condition.quadruples.push(trueInstruction);
                        for_condition.quadruples.push(falseInstruction);
                        for_condition.trueList.push(trueAddress);
                        for_condition.falseList.push(falseAddress);
                        for_condition.backPatch = true;
                    } else {
                        //if里面没有语句，不做任何处理
                    }
                }
            }
        },
        {
            "for_step_scope:": {
                action: function ($, s) {
                    //直接使用for_loop_init_scope创建的stmtscope
                    let for_loop_init_scope = s.slice(-8)[0] as StmtScope;
                    return for_loop_init_scope;
                }
            }
        },
        { "for_step:": {} },
        {
            "for_step:object": {
                action: function ($, s) {
                    return $[0] as ObjectDescriptor;
                }
            }
        },
        {
            "for_step_post_processor:": {
                action: function ($, s) {
                    let stack = s.slice(-5);
                    let ScopeContainer = stack[3] as StmtScope;
                    ScopeContainer.removeTemporary();//清理stmtscope
                    let condition = stack[0] as undefined | ObjectDescriptor;
                    let step = stack[4] as undefined | ObjectDescriptor;
                    if (condition == undefined || step == undefined) {
                        //任意一个是undefined都不用处理了,不需要交换
                    } else {
                        //交换condition和step的指令位置,同时注意跳转指令,实际上如果goto指令还在truelist或者false中，就不需要更改，后面会被回填处理
                        //因为语义保证了condition和step不可能会跳转到其他地方，他们唯一产生跳转的原因就是内部是boolean运算,所以这里可以放心大胆的处理
                        let first_pc = condition.quadruples[0].pc;
                        for (let instruction of step.quadruples) {
                            instruction.pc = first_pc++;
                            if (instruction.isJmp) {
                                (instruction.result.value as number) = (instruction.result.value as number) - condition.quadruples.length;
                            }
                        }
                        for (let instruction of condition.quadruples) {
                            instruction.pc = first_pc++;
                            if (instruction.isJmp) {
                                (instruction.result.value as number) = (instruction.result.value as number) + step.quadruples.length;
                            }
                        }
                    }
                }
            }
        },
        {
            "for_stmt_scope:": {
                action: function ($, s) {
                    //直接使用for_loop_init_scope创建的stmtscope
                    let stack = s.slice(-16);
                    let for_loop_init_scope = stack[4] as StmtScope;
                    let label = stack[1] as string;
                    let parent = for_loop_init_scope.parentScope;
                    if (label != undefined) {
                        for (; parent != undefined;) {
                            if (parent instanceof StmtScope) {
                                if (parent.isLoopStmt && parent.loopLabel == label) {
                                    throw new SemanticException(`标签:${label}重复`);
                                }
                            }
                            parent = parent.parentScope;
                        }
                    }
                    for_loop_init_scope.isLoopStmt = true;
                    for_loop_init_scope.loopLabel = label;
                    return for_loop_init_scope;
                }
            }
        },
        { "statement:block": { action: ($, s) => $[0] } },
        {
            "statement:break lable_use ;": {
                action: function ($, s): StmtDescriptor {
                    //判断是否有label,决定跳转指令
                    let label = $[1] as string | undefined;
                    let head = s.slice(-1)[0] as Scope;
                    let parent: Scope | undefined = head;
                    let ret = new StmtDescriptor();
                    let breakAddress = new Address("constant_val", -1, Type.ConstructBase("PC"));
                    ret.quadruples.push(new Quadruple("goto", undefined, undefined, breakAddress));
                    if (label == undefined) {
                        //搜索最靠近的一层循环
                        for (; ; parent = parent.parentScope) {
                            if (parent == undefined) {
                                throw new SemanticException(`break必须在loop中`);
                            }
                            if (parent instanceof StmtScope && parent.isLoopStmt) {
                                parent.breakAddresses.push(breakAddress);
                                break;
                            }
                        }
                    } else {
                        //搜索最靠近的一层循环
                        for (; ; parent = parent.parentScope) {
                            if (parent == undefined) {
                                throw new SemanticException(`无法找到label:${label}`);
                            }
                            if (parent instanceof StmtScope && parent.isLoopStmt && parent.loopLabel == label) {
                                parent.breakAddresses.push(breakAddress);
                                break;
                            }
                        }
                    }
                    return ret;
                }
            }
        },
        {
            "statement:continue lable_use ;": {
                action: function ($, s): StmtDescriptor {
                    //判断是否有label,决定跳转指令
                    let label = $[1] as string | undefined;
                    let head = s.slice(-1)[0] as Scope;
                    let parent: Scope | undefined = head;
                    let ret = new StmtDescriptor();
                    let breakAddress = new Address("constant_val", -1, Type.ConstructBase("PC"));
                    ret.quadruples.push(new Quadruple("goto", undefined, undefined, breakAddress));
                    if (label == undefined) {
                        //搜索最靠近的一层循环
                        for (; ; parent = parent.parentScope) {
                            if (parent == undefined) {
                                throw new SemanticException(`break必须在loop中`);
                            }
                            if (parent instanceof StmtScope && parent.isLoopStmt) {
                                parent.continueAddresses.push(breakAddress);
                                break;
                            }
                        }
                    } else {
                        //搜索最靠近的一层循环
                        for (; ; parent = parent.parentScope) {
                            if (parent == undefined) {
                                throw new SemanticException(`无法找到label:${label}`);
                            }
                            if (parent instanceof StmtScope && parent.isLoopStmt && parent.loopLabel == label) {
                                parent.continueAddresses.push(breakAddress);
                                break;
                            }
                        }
                    }
                    return ret;
                }
            }
        },
        { "statement:switch ( object ) { switch_bodys }": {} },
        {
            "statement:object clearObjectTemporary ;": {
                action: function ($, s): StmtDescriptor {
                    let ret = new StmtDescriptor();
                    ret.quadruples = ($[0] as ObjectDescriptor).quadruples;
                    return ret;
                }
            }
        },
        {
            "clearObjectTemporary:": {//在object后面清理申请的临时空间
                action: function ($, s) {
                    let stack = s.slice(-2);
                    let ScopeContainer = stack[0] as StmtScope;
                    ScopeContainer.removeTemporary();//清理stmtscope
                }
            }
        },
        { "lable_use:": {} },
        {
            "lable_use:id": {
                action: ($, s) => $[0]
            }
        },
        { "lable_def:": {} },
        {
            "lable_def:id :": {
                action: ($, s) => $[0]
            }
        },
        { "switch_bodys:": {} },
        { "switch_bodys:switch_bodys switch_body": {} },
        { "switch_body:case constant_val : statement": {} },
        { "switch_body:default : statement": {} },
        {
            "block:{ createBlockScope statements }": {
                action: function ($, s) {
                    let blockScope = $[1] as BlockScope;
                    blockScope.removeBlockVariable();
                    return $[2];
                }
            }
        },
        {
            "createBlockScope:": {
                action: function ($, s): BlockScope {
                    let head = s.slice(-2)[0] as Scope;
                    let ret = new BlockScope();
                    ret.linkParentScope(head);
                    return ret;
                }
            }
        },
        { "statements:": { action: () => new StmtDescriptor() } },
        {
            "statements:statements reachableCheckAndCreateStmtScope statement": {
                action: function ($, s) {
                    let statements = $[0] as StmtDescriptor;
                    let statement = $[2] as StmtDescriptor;
                    //此处应该把statements和statement的代码连接起来
                    let ret = new StmtDescriptor();
                    ret.hasReturn = statement.hasReturn;
                    ret.quadruples = statements.quadruples.concat(statement.quadruples);
                    return ret;
                }
            }
        },
        {
            "reachableCheckAndCreateStmtScope:": {
                action: function ($, s): Scope {
                    let stack = s.slice(-2);
                    let head = stack[0] as Scope;
                    let statements = stack[1] as StmtDescriptor;
                    if (statements.hasReturn) {
                        throw new SemanticException("return 之后不能有语句");
                    }
                    let ret = new StmtScope();
                    ret.linkParentScope(head);
                    return ret;
                }
            }
        },
        {
            "object:id": {
                action: function ($, s): ObjectDescriptor {
                    let head = s.slice(-1)[0] as StmtScope;
                    let id = $[0];
                    let add = head.getVariable(id);
                    if (add == undefined) {
                        throw new SemanticException(`未定义的符号:${id}`);
                    }
                    let ret = new ObjectDescriptor(add);
                    ret.locationValue = true;
                    return ret;
                }
            }
        },
        { "object:constant_val": { action: ($, s) => new ObjectDescriptor($[0]) } },
        { "object:object ( arguments )": {} },
        { "object:( parameters ) => { statements }": {} },//lambda
        { "object:( object )": {} },
        { "object:object . id": {} },
        {
            "object:object = W3_0 object": {
                action: function ($, s): ObjectDescriptor {
                    let a = $[0] as ObjectDescriptor;
                    let b = $[3] as ObjectDescriptor;
                    if (a.address.type.type != b.address.type.type || a.address.type.basic_type != a.address.type.basic_type) {
                        throw new SemanticException('=号两侧类型不匹配');
                    }
                    if (!a.locationValue) {
                        throw new SemanticException('=号左侧必须是左值');
                    }
                    let ret = new ObjectDescriptor(a.address);
                    ret.quadruples = a.quadruples.concat(b.quadruples);
                    if (b.backPatch) {
                        let trueInstruction = new Quadruple("=", new Address("constant_val", 'true', Type.ConstructBase("boolean")), undefined, a.address);
                        let jmpInstruction = new Quadruple("goto", undefined, undefined, new Address("constant_val", 0, Type.ConstructBase("PC")));
                        let falseInstruction = new Quadruple("=", new Address("constant_val", 'false', Type.ConstructBase("boolean")), undefined, a.address);
                        jmpInstruction.result.value = falseInstruction.pc + 1;
                        ret.quadruples.push(trueInstruction);
                        ret.quadruples.push(jmpInstruction);
                        ret.quadruples.push(falseInstruction);
                        BackPatchTools.backpatch(b.trueList, trueInstruction.pc);
                        BackPatchTools.backpatch(b.falseList, falseInstruction.pc);
                    } else {
                        ret.quadruples.push(new Quadruple("=", b.address, undefined, a.address));
                    }
                    return ret;
                }
            }
        },
        {
            "object:object + W3_0 object": {
                action: function ($, s): ObjectDescriptor {
                    let a = $[0] as ObjectDescriptor;
                    let b = $[3] as ObjectDescriptor;
                    let head = s.slice(-1)[0] as StmtScope;
                    if ((a.address.type.type == "base_type" && a.address.type.basic_type == "int") && (b.address.type.type == "base_type" && b.address.type.basic_type == "int")) {
                        let result = head.createTmp(Type.ConstructBase('int'));
                        let ret = new ObjectDescriptor(result);
                        ret.quadruples = a.quadruples.concat(b.quadruples);
                        ret.quadruples.push(new Quadruple("+", a.address, b.address, result));
                        return ret;
                    } else {
                        throw new SemanticException(`暂时只支持int类型的+运算符`);
                    }
                }
            }
        },
        { "object:object - W3_0 object": {} },
        { "object:object * W3_0 object": {} },
        { "object:object / W3_0 object": {} },
        {
            "object:object < W3_0 object": {
                action: function ($, s): ObjectDescriptor {
                    let a = $[0] as ObjectDescriptor;
                    let b = $[3] as ObjectDescriptor;
                    if ((a.address.type.type == "base_type" && a.address.type.basic_type == "int") && (b.address.type.type == "base_type" && b.address.type.basic_type == "int")) {
                        let trueAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                        let falseAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                        let trueInstruction = new Quadruple("if <", a.address, b.address, trueAddress);
                        let falseInstruction = new Quadruple("goto", undefined, undefined, falseAddress);
                        let ret = new ObjectDescriptor(new Address("constant_val", -1, Type.ConstructBase("boolean")));//需要回填，所以value是没用的,type有用
                        ret.quadruples = a.quadruples.concat(b.quadruples);
                        ret.quadruples.push(trueInstruction);
                        ret.quadruples.push(falseInstruction);
                        ret.trueList.push(trueAddress);
                        ret.falseList.push(falseAddress);
                        ret.backPatch = true;
                        return ret;
                    } else {
                        throw new SemanticException(`暂时只支持int类型的<运算符`);
                    }
                }
            }
        },
        { "object:object <= W3_0 object": {} },
        { "object:object > W3_0 object": {} },
        { "object:object >= W3_0 object": {} },
        { "object:object == W3_0 object": {} },
        {
            "object:object || W3_0 object": {
                action: function ($, s): ObjectDescriptor {
                    let a = $[0] as ObjectDescriptor;
                    let b = $[3] as ObjectDescriptor;
                    if ((a.address.type.type == "base_type" && a.address.type.basic_type == "boolean") && (b.address.type.type == "base_type" && b.address.type.basic_type == "boolean")) {
                        if (!a.backPatch) {
                            let trueAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                            let falseAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                            let trueInstruction = new Quadruple("if", a.address, undefined, trueAddress);
                            let falseInstruction = new Quadruple("goto", undefined, undefined, falseAddress);
                            a.quadruples.push(trueInstruction);
                            a.quadruples.push(falseInstruction);
                            a.trueList.push(trueAddress);
                            a.falseList.push(falseAddress);
                            a.backPatch = true;
                        }
                        if (!b.backPatch) {
                            let trueAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                            let falseAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                            let trueInstruction = new Quadruple("if", b.address, undefined, trueAddress);
                            let falseInstruction = new Quadruple("goto", undefined, undefined, falseAddress);
                            b.quadruples.push(trueInstruction);
                            b.quadruples.push(falseInstruction);
                            b.trueList.push(trueAddress);
                            b.falseList.push(falseAddress);
                            b.backPatch = true;
                        }
                        let ret = new ObjectDescriptor(new Address("constant_val", -1, Type.ConstructBase("boolean")));//需要回填，所以value是没用的,type有用
                        ret.quadruples = a.quadruples.concat(b.quadruples);
                        ret.backPatch = true;
                        BackPatchTools.backpatch(a.falseList, b.quadruples[0].pc);
                        ret.trueList = BackPatchTools.merge(a.trueList, b.trueList);
                        ret.falseList = b.falseList;
                        return ret;
                    } else {
                        throw new SemanticException(`||运算符两侧必须是boolean`);
                    }
                }
            }
        },
        {
            "object:object && W3_0 object": {
                action: function ($, s): ObjectDescriptor {
                    let a = $[0] as ObjectDescriptor;
                    let b = $[3] as ObjectDescriptor;
                    if ((a.address.type.type == "base_type" && a.address.type.basic_type == "boolean") && (b.address.type.type == "base_type" && b.address.type.basic_type == "boolean")) {
                        if (!a.backPatch) {
                            let trueAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                            let falseAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                            let trueInstruction = new Quadruple("if", a.address, undefined, trueAddress);
                            let falseInstruction = new Quadruple("goto", undefined, undefined, falseAddress);
                            a.quadruples.push(trueInstruction);
                            a.quadruples.push(falseInstruction);
                            a.trueList.push(trueAddress);
                            a.falseList.push(falseAddress);
                            a.backPatch = true;
                        }
                        if (!b.backPatch) {
                            let trueAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                            let falseAddress = new Address("constant_val", 0, Type.ConstructBase("PC"));
                            let trueInstruction = new Quadruple("if", b.address, undefined, trueAddress);
                            let falseInstruction = new Quadruple("goto", undefined, undefined, falseAddress);
                            b.quadruples.push(trueInstruction);
                            b.quadruples.push(falseInstruction);
                            b.trueList.push(trueAddress);
                            b.falseList.push(falseAddress);
                            b.backPatch = true;
                        }
                        let ret = new ObjectDescriptor(new Address("constant_val", -1, Type.ConstructBase("boolean")));//需要回填，所以value是没用的,type有用
                        ret.quadruples = a.quadruples.concat(b.quadruples);
                        ret.backPatch = true;
                        BackPatchTools.backpatch(a.trueList, b.quadruples[0].pc);
                        ret.falseList = BackPatchTools.merge(a.falseList, b.falseList);
                        ret.trueList = b.trueList;
                        return ret;
                    } else {
                        throw new SemanticException(`&&运算符两侧必须是boolean`);
                    }
                }
            }
        },
        { "object:object ? object : object": { action: () => { throw `三目运算符?还没来得及做` }, priority: "?" } },
        { "object:object ++": {} },
        { "object:object --": {} },
        { "object:new { anonymous_stmts }": {} },//匿名类，类似C#而不是java
        { "object:new basic_type ( arguments )": {} },
        { "object:new basic_type array_init_list": {} },
        { "object:object [ object ]": {} },
        { "object:this": {} },
        { "array_init_list:array_inits array_placeholder": {} },
        { "array_inits:array_inits [ object ]": {} },
        { "array_inits:[ object ]": {} },
        { "array_placeholder:array_placeholder_list": { priority: "low_priority_for_array_placeholder" } },//遇到方括号一律选择移入
        { "array_placeholder:": { priority: "low_priority_for_array_placeholder" } },
        { "array_placeholder_list:array_placeholder_list [ ]": {} },
        { "array_placeholder_list:[ ]": { priority: "low_priority_for_array_placeholder" } },

        { "anonymous_stmts:anonymous_stmts anonymous_stmt": {} },
        { "anonymous_stmts:": {} },
        { "anonymous_stmt:id = object ;": {} },

        { "arguments:argument_list": {} },
        { "arguments:": {} },
        { "argument_list:argument": {} },
        { "argument_list:argument_list , argument": {} },
        { "argument:object": {} },

        { "W2_0:": { action: ($, s) => s.slice(-2)[0] } },
        { "W3_0:": { action: ($, s) => s.slice(-3)[0] } },
        {
            "W7_0_for_stmt:": {
                action: function ($, s): StmtScope {
                    let head = s.slice(-7)[0] as Scope;
                    let ret = new StmtScope();
                    ret.linkParentScope(head);
                    return ret;
                }
            }
        },
        {
            "W10_0_for_stmt:": {
                action: function ($, s): StmtScope {
                    let head = s.slice(-10)[0] as Scope;
                    let ret = new StmtScope();
                    ret.linkParentScope(head);
                    return ret;
                }
            }
        },
    ]
};
let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();//构造编译器代码
if (str != null) {//如果构造成功则生成编编译器代码
    console.log(`成功`);
    fs.writeFileSync('./src/example/toy-language/parser.ts', str);
} else {
    console.log(`失败`);
}
