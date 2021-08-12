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
    ["!", /!/y],
    ["function", /function/y],
    ["var", /var/y],
    ["val", /val/y],
    ["type_base", /(int)|(double)/y, (str) => { return str; }],
    ["class", /class/y],
    ["struct", /struct/y],
    ["if", /if/y],
    ["else", /else/y],
    ["do", /do/y],
    ["while", /while/y],
    ["for", /for/y],
    ["break", /break/y],
    ["continue", /continue/y],
    ["get", /get/y],
    ["set", /set/y],
    ["return", /return/y],
    ["const_val", /\d+/y],
    ["goto",/goto/y],
    ["await",/await/y],
    ["extend",/extend/y],
    ["async",/async/y],
    ["switch",/switch/y],
    ["case",/case/y],
    ["default",/default/y],
    ["operator",/operator/y],
    ["id", /(_|[a-z]|[A-Z])(_|[a-z]|[A-Z]|\d)*/y]//id的优先级最低，这样if else等预留关键字就不会被识别为id了
]);
//测试用源码
let source=
`
switch(a){}
switch(a){default:a=b;}
switch(a){case a:a=b;}
switch(a){case a:a=b;case b:a=b;default:a;}
val b=function():int{};
var b=function():int{};
val a:int{get{return a;}};
var a:int{get{return a;} set{return b;}};
L0:for(var i=0;c;b){
    break;
    break L0;
    continue;
    continue L0;
}
class a{}
class a extend:a{}
class val a extend:a,b,c{
    var a:int;
    operator+(a:int):int{}
    operator[](a:int):int{}
    operator!():int{}
    function f():int{
        var a=function():int{}.toString(1,2,3);
        if(a>b){
            if(c){
                while(b){
                    do{}while(c);
                }
            }
        }else{

        }
        return function():int{
            3.tostring();
        };
    }
}
function f1(i:int,i:int):double{

}
function a ():int{}
val a=5;
val a:int=0;
class a{}
function a ():int{
    var b=a();
    var b=a(a,b,c);
    val a=function():int{
        var b=6;
        b=b+c;
        var a:int[][][][];
        for(var i=0;a;b){

        }
    };
}
`;
lex.setSource(source);
if (parser.parse(lex)) {
    console.log(`成功`);
    console.log(new Date());
} else {
    console.error(`失败`);
}
