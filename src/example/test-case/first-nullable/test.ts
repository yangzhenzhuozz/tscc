import TSCC from "../../../tscc/tscc.js";
import { Grammar } from "../../../tscc/tscc.js";
/**
 * 在tscc读取完产生式之后手动新增两行代码测试结果
 * let n = this.nullalbe(['b']);//分别测试b c d ε S B
 * console.log(n);
 * let f = this.first_wrapper(['b']);//分别测试b c d ε S B
 * console.log(f);
 */
let grammar: Grammar = {
    tokens: ['a','b','c','d'],
    association: [
    ],
    BNF: [
       {'S:a A b c':{}},
       {'S:a B d':{}},
       {'A:':{}},
       {'B:b':{}},
    ]
};
let tscc = new TSCC(grammar, { language: "zh-cn", debug: true });
let str = tscc.generate();
if (str == null) {
    console.error(`失败`);
} else {
    console.log(`成功`);
}
