import Lexical from "../../lexical_analyzer/lexical_analyzer";
import Parser from "./parser";
let parser = new Parser();
//定义词法的正则规则，所有正则都是sticky的,flag为y
let lex = new Lexical([
    [/\s+/y],
    ["+", /\+/y],
    [",", /,/y],
    ["-", /-/y],
    ["*", /\*/y],
    ["/", /\//y],
    ["=", /=/y],
    ["==", /==/y],
    ["||", /\|\|/y],
    ["&&", /&&/y],
    [">", />/y],
    ["<", /</y],
    [">=", />=/y],
    ["<=", /<=/y],
    ["{", /{/y],
    ["}", /}/y],
    ["(", /\(/y],
    [")", /\)/y],
    ["[", /\[/y],
    ["]", /\]/y],
    [":", /:/y],
    [";", /;/y],
    [".", /\./y],
    ["func", /func/y],
    ["var", /var/y],
    ["val", /val/y],
    ["type", /(int)|(double)/y, (str) => { return str; }],
    ["class", /class/y],
    ["struct", /struct/y],
    ["if", /if/y],
    ["else", /else/y],
    ["do", /do/y],
    ["while", /while/y],
    ["for", /for/y],
    ["get", /get/y],
    ["set", /set/y],
    ["enum", /enum/y],
    ["const_val", /\d+/y],
    ["id", /(_|[a-z])(_|[a-z]|\d)*/y]//id的优先级最低，这样if else等预留关键字就不会被识别为id了
]);
lex.setSource(`func a ():int{}`);
if (parser.parse(lex)) {
    console.log(`成功`);
} else {
    console.error(`失败`);
}
