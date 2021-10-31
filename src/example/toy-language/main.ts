import Lexical from "../../lexical_analyzer/lexical_analyzer.js";
import Parser from "./parser.js";

let parser = new Parser();
//定义词法的正则规则，所有正则都是sticky的,flag为y
let lex = new Lexical([
    [/\s+/y],
    ["var", /var/y],
    ["=>", /=>/y],
    ["...", /\.\.\./y],
    [",", /,/y],
    [";", /;/y],
    [":", /:/y],
    ["constant_val", /\d+/y, (str) => { return Number(str); }],
    ["++", /\+\+/y],
    ["--", /--/y],
    ["+", /\+/y],
    ["-", /-/y],
    ["*", /\*/y],
    ["/", /\//y],
    ["=", /=/y],
    ["(", /\(/y],
    [")", /\)/y],
    ["?", /\?/y],
    ["[", /\[/y],
    ["]", /\]/y],
    ["{", /{/y],
    ["}", /}/y],
    ["==", /==/y],
    ["!=", /!=/y],
    [">=", />=/y],
    ["<=", /<=/y],
    [">", />/y],
    ["<", /</y],
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
    ["do", /do/y],
    ["while", /while/y],
    ["if", /if/y],
    ["else", /else/y],
    ["for", /for/y],
    ["switch", /switch/y],
    ["case", /case/y],
    ["break", /break/y],
    ["continue", /continue/y],
    ["as", /as/y],
    ["import", /import/y],
    ["default", /default/y],
    ["valuetype", /valuetype/y],
    ["id", /[a-zA-Z][a-zA-Z0-9_]*/y, (str) => { return { name: str }; }],
]);
//测试用源码
let source =
    `
    import aa as aa;
    function a(a:int...):int{
        a<b;
        L0:
        for (i = 0; i++ < 100; i++) {
            break LA;
            break;
            continue A;
            continue ;
        }

        L1:
        while (i * 100) {
            break LB;
        }

        L2:
        do {
            break LC;
        } while (i >= 100);

        var a:()=>int;
        var a:(int)=>int;
        var a:(int,double)=>int;
        a=()=>{};
        if(a)
        {
            if(a)
                a;
        }
        else
            b;
        if(a)
        if(a)
            a;
        else
            b;
        a=a?b:c;
        a=a+b?c+d:e+f;
        a ? b : c ? d : e;
        a=new int[0];
        a=new int[0][][];
        a=a[0][1][2];
        switch(a){
            case 2:a=new int();
        }
        switch(a){
            case 1:a++;
        }
        switch(a){
            case 1:{a++;}
            default:{a++;}
        }
        switch(a){
            default:{a++;}
        }
    }
    function a(a:int,a:int...):int{}
    function a():double{
        function a():double{
            do a=a+b; while (a);
            while(a) a;
            do {a=a+b;} while (a);
            while(a) {a;}
            if(a+b){a;}
            if(a+b)a;
            if(a+b){a;}else a;
            if(a+b)a; else{a;}
        }
    }
    valuetype class a extends int{

    }
    class a extends int{
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
            a(a,()=>{});
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
