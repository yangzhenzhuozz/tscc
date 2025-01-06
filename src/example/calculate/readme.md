> 1. 确保已经将 tscc 安装成模块
>    > 1."tsc -P src\tscc\tsconfig.json"  
>    > 1."npm pack",这将生成一个.tgz 文件  
>    > 1."npm install path/to/xxxx.tgz"
> 1. 使用 "tsc -P src\example\tsconfig.json" 编译 typescript 代码(如果是从头构建，这一步会报错，没关系，因为下一步的 parser.ts 没有构建)
> 1. 执行"node .\dist\example\calculate\calculate.js"生成 parser.ts
> 1. 使用 "tsc -P src\example\tsconfig.json" 编译 parser.ts
> 1. 执行"node .\dist\example\calculate\main.js"

> 输出(做了一些调整，实际输出可能不是这样了):
>
> ```
> 语句运算结果:0.6000000000000001
> 语法错误:此处不能接受;
> yytext is ;
> 错误恢复:读取下一个stmt
> 语句运算结果:5.8
> AST处理完成
> ```
