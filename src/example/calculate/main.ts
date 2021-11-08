import Parser from "./parser";
let parser = new Parser();
//定义词法的正则规则，所有正则都是sticky的,flag为y
let lex = new Lexical([
    [/\s+/y],//跳过空白符
    ['+', /\+/y],
    ['-', /\-/y],
    ['*', /\*/y],
    ['/', /\//y],
    [';', /;/y],
    ['number', /[0-9]+/y,(str)=>Number(str)]
]);

//source第二行测试错误恢复
let source = `
11/2+2-3*4/5;
1+2-;
6+7-8*9/10;
`;
lex.setSource(source);
try {
    parser.parse(lex);//编译源码
} catch (e) {
    console.error(e);
}