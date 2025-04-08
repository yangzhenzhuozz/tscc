import TSCC from "../../../../dist/tscc/tscc.js";
import { Grammar } from "../../../../dist/tscc/tscc.js";

/**
 * 1.测试产生式优先级大于符号优先级的情况
 * 预期结果:生成成功,并且对冲突选择归约操作,提示符号没有定义优先级
 * 实际执行结果:和预期一致
 *
 * 条件:
 * 1.符号没有指定优先级-最低
 * 2.产生式指定优先级和结合性为nonassoc
 */
/*
let grammar: Grammar = {
    symbols: [],
    association: [
        { "nonassoc": ['non-use'] },//定义一个符号non-use
    ],
    tokens:['num','+'],
    BNF: [
        { "exp:exp + exp": {priority:"non-use"} },//指定产生式的优先级和结合性
        { "exp:num": {} }
    ]
};
*/

/**
 * 2.1 测试产生式优先级等于符号优先级,且产生式结合性为left
 * 预期结果:生成成功,并且对冲突选择归约操作,无提示
 * 实际执行结果:观察跳转表,可以看到状态4对符号'+'的操作为规约
 *
 * 条件:
 * 1.符号定义结合性为left
 */
/*
let grammar: Grammar = {
    symbols: [],
    association: [
        { "left": ['+'] },//定义一个符号+,左结合
    ],
    tokens:['num'],
    BNF: [
        { "exp:exp + exp": {} },
        { "exp:num": {} }
    ]
};
*/

/**
 * 2.2 测试产生式优先级等于符号优先级,且产生式结合性为right
 * 预期结果:生成成功,并且对冲突选择移入操作,无提示
 * 实际执行结果:观察跳转表,可以看到状态4对符号'+'的操作为移入
 *
 * 条件:
 * 1.符号定义结合性为right
 */
/*
let grammar: Grammar = {
    symbols: [],
    association: [
        { "right": ['+'] },//定义一个符号+,右结合
    ],
    tokens:['num'],
    BNF: [
        { "exp:exp + exp": {} },
        { "exp:num": {} }
    ]
};
*/

/**
 * 2.3 测试产生式优先级等于符号优先级,且产生式结合性为nonassoc
 * 预期结果:生成成功,并且将冲突符号的动作设置为err,无提示
 * 实际执行结果:观察跳转表,可以看到状态4对符号'+'的动作为err
 *
 * 条件:
 * 1.符号定义结合性为nonassoc
 */
/*
let grammar: Grammar = {
    symbols: [
    ],
    association: [
        { "nonassoc": ['+'] },//定义一个符号+,不结合
    ],
    tokens: ['num'],
    BNF: [
        { "exp:exp + exp": {} },
        { "exp:num": {} }
    ]
};
*/

/**
 * 3.测试产生式优先级小于符号优先级
 * 预期结果:生成成功,并且对冲突选择移入操作,提示产生式没有定义优先级
 * 与预期一致
 *
 * 条件:
 * 1.随意定义符号结合性为nonassoc,这样他就有了一个优先级
 * 2.产生式最右侧放置一个终结符ε,并且不指定其优先级,这样产生式的结合性就变为未定义-最低
 */
/* 
let grammar: Grammar = {
    symbols: [],
    association: [
        { "nonassoc": ['+'] },//定义一个符号+,右结合
    ],
    tokens:['num'],
    BNF: [
        { "exp:exp + exp ε": {} },
        { "exp:num": {} }
    ]
};
*/

/**
 * 5.测试产生式和符号都未定义优先级
 * 预期结果:生成失败,并且提示:终结符和产生式都没有优先级
 * 与预期一致
 *
 * 条件:
 * 1.不定义association就行了
 */
/*
 let grammar: Grammar = {
    symbols: [],
    tokens:['num','+'],
    BNF: [
        { "exp:exp + exp": {} },
        { "exp:num": {} }
    ]
};
*/

/**
 * 6.1 测试规约-规约冲突,优先级不一致
 * 预期结果:生成成功,并且提示:选择优先级高或者产生式序号更小的产生式进行规约
 * 实际执行结果:观察跳转表,可以看到状态4对符号'$'的动作为r4
 *
 * 条件:
 * 1.不定义association的产生式优先级最低
 */
/*
 let grammar: Grammar = {
    symbols: [],
    tokens:['a'],
    association:[
        {"right":['zero']},
    ],
    BNF: [
        { "S:A": {} },
        { "S:B": {} },
        { "A: a": {} },
        { "B: a": {priority:'zero'} }
    ]
};
*/
/**
 * 6.2 测试规约-规约冲突,优先级一致
 * 预期结果:生成成功,并且提示:选择优先级高或者产生式序号更小的产生式进行规约
 * 实际执行结果:观察跳转表,可以看到状态4对符号'$'的动作为r3
 *
 * 条件:
 * 1.都不定义association的产生式优先级最低且一致
 */

let grammar: Grammar = {
  tokens: ["a"],
  association: [],
  BNF: [{ "S:A": {} }, { "S:B": {} }, { "A: a": {} }, { "B: a": {} }],
};
let tscc = new TSCC(grammar, { language: "zh-cn", debug: true });
let str = tscc.generate();
if (str == null) {
  console.error(`失败`);
} else {
  console.log(`成功`);
}
