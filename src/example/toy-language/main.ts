import Lexical from "../../lexical_analyzer/lexical_analyzer.js";
import Parser from "./parser.js";

let parser = new Parser();
//定义词法的正则规则，所有正则都是sticky的,flag为y
let lex = new Lexical([
    [/\s+/y],
    ["var", /var/y],
    ["=>", /=>/y],
    [",", /,/y],
    [";", /;/y],
    [":", /:/y],
    ["number", /\d+/y, (str) => { return Number(str); }],
    ["++", /\+\+/y],
    ["--", /--/y],
    ["+", /\+/y],
    ["-", /-/y],
    ["*", /\*/y],
    ["/", /\//y],
    ["=", /=/y],
    ["(", /\(/y],
    [")", /\)/y],
    ["[", /\[/y],
    ["]", /\]/y],
    ["{", /{/y],
    ["}", /}/y],
    [">", />/y],
    ["==", /==/y],
    ["!=", /!=/y],
    [">=", />=/y],
    ["< ", /< /y],
    ["<=", /<=/y],
    ["&&", /&&/y],
    ["||", /\|\|/y],
    ["!", /!/y],
    [".", /\./y],
    ["function", /function/y],
    ["operator", /operator/y],
    ["base_type", /(int)|(double)/y],
    ["class", /class/y],
    ["new", /new/y],
    ["extends", /extends/y],
    ["lambda", /lambda/y],
    ["do", /do/y],
    ["while", /while/y],
    ["if", /if/y],
    ["else", /else/y],
    ["for", /for/y],
    ["id", /[a-zA-Z][a-zA-Z0-9_]*/y, (str) => { return { name: str }; }],
]);
//测试用源码
let source =
    `
    function a():double{
        function a():double{
            do a=a+b; while (a)
            while(a) a;
            do {a=a+b;} while (a)
            while(a) {a;}
            if(a+b){a;}
            if(a+b)a;
            if(a+b){a;}else a;
            if(a+b)a; else{a;}
        }
    }
    class a extends int{

    }
    class a extends int,double{
        class a{}
    }
    class a{
        function a():double{
            for(a;b;c)a++;
            for(;;)a++;
            a.b;
            a.b();
        }
        function a(a:int):int{

        }
        function a(a:int,b:int):double{

        }
        function a(a:int,b:int,c:int):int{
            a(a,lambda()=>{});
        }
        operator+(a:int):int{

        }
    }
`;
lex.setSource(source);
if (parser.parse(lex)) {
    console.log(`成功`);
    console.log(new Date());
} else {
    console.error(`失败`);
}