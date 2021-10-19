import fs from "fs";
import TSCC from "../../tscc/tscc.js";
import { Grammar } from "../../tscc/tscc.js";
let grammar: Grammar = {
    userCode: ``,//让自动生成的代码包含import语句
    tokens: ['var', ';', 'id', 'number', '+', '(', ')'],
    association: [
        { 'right': ['='] },
        { 'left': ['==', '!='] },
        { 'left': ['||'] },
        { 'left': ['&&'] },
        { 'left': ['!'] },
        { 'left': ['>', '<', '<=', '>='] },
        { 'left': ['+', '-'] },
        { 'left': ['*', '/'] },
    ],
    BNF: []
};
let tscc = new TSCC(grammar, { language: "zh-cn", debug: false });
let str = tscc.generate();//构造编译器代码
if (str != null) {//如果构造成功,往代码中添加调用代码
    console.log(`成功`);
    fs.writeFileSync('./src/example/toy-language/parser.ts', str);
} else {
    console.log(`失败`);
}
