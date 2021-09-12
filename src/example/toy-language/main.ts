import Lexical from "../../lexical_analyzer/lexical_analyzer";
import Parser from "./parser";
let parser = new Parser();
//定义词法的正则规则，所有正则都是sticky的,flag为y
let lex = new Lexical([
    [/\s+/y],
    ["[", /\[/y],
    ["]", /\]/y],
    ["number", /\d+/y, (str) => { return Number(str); }],
    ["int", /int/y],
]);
//测试用源码
let source =
    `
int [] []
`;
lex.setSource(source);
if (parser.parse(lex)) {
    console.log(`成功`);
    console.log(new Date());
} else {
    console.error(`失败`);
}
