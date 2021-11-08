从0开始自制编程语言?严格来说不算,因为我懒得自己写正则引擎了,所以用了js自身的正则引擎,所以应该是从0.2自制编程语言,又或者我认为lex+yacc的组合中,lex的重要性只占比20%?。
# 产生式优先级和结合性:
> 默认由该产生式的最右侧终结符决定,如果定义了priority,则使用priority对应符号所对应的优先级和结合性  
> 需要注意的是:*如果一个产生式最右终结符没有定义优先级和结合性,则产生式的优先级和结合性也为未定义,即使该产生式非最右终结符定义了优先级和结合性*  
> 如:  
> 设有一产生式:A->B + C * D,其中终结符+定义了优先级和结合性,但是终结符*没有定义,则产生式的优先级和结合性也为未定义
# 规约-规约冲突:
> 选择优先级高的产生式进行规约,如果优先级一致则选择序号小的产生式,并提示规约-规约冲突  
> 这里和yacc不一致,yacc只选择序号小的产生式,因为经过我的观察,yacc使用%prec强制指定产生式优先级时不是无条件的把产生设置成和%prec的符号一致,所以如果遇到一个状态又有移入-规约冲突,又有规约-规约冲突时,tscc会和描述不一致,假设有如下文法:
> ```
> S:A
> S:B y
> S:C y
> A:x y
> B:x
> C:x
> ```
> 则会存在包含如下三个项的一个状态:
> ```
> 1. A:x .y,$
> 2. B:x .,y
> 3. C:x .,y
> ```
> 对于输入y,项1分别和项2、项3产生移入-规约冲突。项2和项3产生了规约-规约冲突
> 如果我们用priority指定符号和产生式优先级(括号中)如下
> ```
> 符号y(2)
> 1. A:x .y,$
> 2. B:x .,y (1)
> 3. C:x .,y (3)
> ```
> 如果按照yacc的规约-规约冲突选择产生式序号小的项规约,则
> 1. 符号y和项2的移入-规约冲突中,我们应该选择移入,此时移入操作的优先级为2
> 2. 符号y项1和项3的冲突选择项3进行规约(产生式优先级大于符号优先级)  
> 
>  如果我们换个对比序  
> 1. 符号y和项3的移入-规约冲突中,我们应该选择规约,此时规约操作的优先级为3
> 2. 项3和项2的冲突选择项2进行规约(选择序号小的产生式)  
> 
> 可见如果只选择产生式序号小的项进行规约,不同的对比顺序在tscc中会产生不一样的结果,所以我们选择优先级作为判断条件,只有优先级相等时才对比产生式序号
# 移入-规约冲突:
本条说明中用"产生式"代指冲突中需要规约而成的产生式,用符号表示向前看符号(即将移入的符号),如果出现移入-规约冲突,使用下面的规则进行处理:  
优先级的定义请参见:*grammar.association*一节  
> 1. 产生式优先级大于符号,选择规约操作;
> 2. 产生式优先级等于符号:
>     >1. 产生式结合性为左结合,选择规约操作;
>     >2. 产生式结合性为右结合,选择移入操作;
>     >3. 产生式结合性为不结合,提示移入-规约冲突,并将冲突的符号设置为err(技术细节请看下面说明)
> 3. 产生式优先级小于符号优先级,选择移入操作;
> 4. 如果产生式和符号有一个定义了优先级,另一个没有定义(undefine),则认为undefine优先级小于任何已定义的优先级,根据规则1、3进行操作,并提示移入-规约冲突;
> 5. 如果符号和产生式都没有定义优先级,提示移入-规约冲突,并停止后续分析  
> 
> 对nonassoc的处理和left类似,当一个状态中出现移入-规约冲突时(文法出现二义性),规约而成的产生式优先级和移入符号优先级一致,且产生式的结合性为nonassoc,tscc内部会将这个冲突的解决方法设置为规约进行后续处理,在最终输出跳转表的时候将这个动作设置为err  

优先级和结合性是用于解决文法二义性的,如果文法本身没有出现二义性,则符号和产生式的优先级和结合性将会毫无意义,假设有如下文法:

```
association:[
    {'nonassoc':['a','s']}
]
S:A s
A:a
```
或者
```
association:[
    {'nonassoc':['a','s']}
]
S:A
S:B
A:a
B:b a s
```
如果试图通过定义a,s为同一优先级的非结合终结符来避免a和s结合,会发现没有任何作用,因为文法不是一个二义性文法。

# 使用说明
> 使用import tscc from "tscc.js"导入tscc模块,然后new tscc(grammar,argument)即可,grammar包含和文法的BNF和词法的正则规则。
> ## grammar
>> grammar原型如下:
>> ```
>> interface Grammar {
>>     userCode?:string,    
>>     association?: { [key: string]: string[] }[],
>>     symbols: {
>>         symbol: string;
>>         value?: (args: string) => any;
>>         reg: RegExp;
>>     }[];
>>     tokens?:string[];
>>     accept?: (args: any[]) => any;
>>     BNF: {
>>         [key: string]: {
>>             action?: ((args: any[]) => any);
>>             priority?: string;
>>         };
>>     }[];
>> }
>> ```
>> ### userCode
>>> 可选
>>> ```
>>> userCode?:string
>>> ```
>>> 用户的自定义代码，会被放在parser的最前面，可以用于自定义一些class或者interface
>> ### association
>>> 可选
>>> ```
>>> association?:[{
>>>    key:[symbol]
>>> }]
>>> ```
>>> association为一个数组,数组中每个元素为一个以'left'、'right'或者'nonassoc'为key的属性,表示符号的符号的结合性,属性值为一个string数组,表示当前key所描述的符号,以在association数组中所定义的下标作为终结符优先级,下标大的符号优先级高。如果一个符号在数组中的多个对象中被定义,后面的定义会覆盖前面的定义。  
>>> 例：
>>> ```
>>> association:[
>>>     {'left':['+','-']},
>>>     {'left':['*','/']},
>>>     {'right': [`uminus`] }
>>> ]
>>> ```
>>> 定义了四个左结合的终结符"+"、"-"、"*"、"/",其中"\*"、"/"的优先级大于"+"、"-"。 一个右结合的终结符uminus,优先级最高(在数组中的序号最大)  
>>> 需要注意的是:*与类似yacc或者bison中进行分析一样,在解决冲突时,符号的结合性是没用的,实际上符号只有优先级,产生式才有优先级和结合性,对符号定义结合性的原因是为了将这个结合性赋予对应的产生式*  
>> ### symbols
>>> ```
>>>  symbols: {
>>>          symbol: string;
>>>          value?: (args: string) => any;
>>>          reg: RegExp;
>>>      }[];
>>>  ```
>>> symbols为一个数组,数组中每个元素包含三个属性:symbol、reg、value,其中value可以为undefine
>>> #### symbol
>>>> *正在尝试移除该属性,词法分析器应该由其他模块(如还未开始做的ts-lexical)完成,不该放在tscc中*  
>>>> symbol:用于自动生成词法分析器代码  
>>>> reg:定义该符号的正则表达式,即使该正则表达式有标志位,也会被忽略,并且在词法分析器lexical中被设置为y(粘滞模式,sticky)  
>>>> value:一个函数,参数为当前正则匹配到的字符串,用户可以对其处理,并返回符号的值,如果value为undefine,表示词法分析器跳过本单词  
>>>> 系统内置了两个终结符:"ε","$",分别表示空和结束(EOF)  
>>>> 例:
>>>> ```
>>>> symbols: [
>>>>        {
>>>>            symbol: "",
>>>>            reg: /\s+/
>>>>        },
>>>>        {
>>>>            symbol: "number",
>>>>            reg: /\d+/,
>>>>            value: function (lex: string) {
>>>>                return Number(lex);
>>>>            }
>>>>        },
>>>>        {
>>>>            symbol: `-`,
>>>>            reg: /-/,
>>>>            value: function (lex) {
>>>>            }
>>>>        }
>>>>      ]
>>>> ```
>>>> 定义了两个终结符"number"、"-",并且让词法分析器忽略空白符。
>> ### tokens
>>> 可选  
>>> 定义BNF中的终结符,一个字符串数组,每个元素为一个终结符,如果终结符在association中定义过,也可以不在tokens中再次定义  
>>> 系统内置了两个终结符:"ε","$",分别表示空和结束(EOF)  
>>> 例:
>>> ```
>>> tokens:['+','-','*','/']
>>> ```
>> ### BNF
>>> ```
>>>    BNF: {
>>>        [key: string]: {
>>>            action?: ((args: any[]) => any);
>>>            priority?: string;
>>>        };
>>>    }[];
>>> ```
>>> symbols为一个数组,数组中每个元素为一个产生式,元素的key为产生式定义描述字符串,值为一个包含属性action和priority的对象,这两个属性都可以为undefine。
>>> #### key
>>>> 产生式定义字符串编写规则如下:
>>>> ```
>>>> A:B C D
>>>> A:
>>>> ```
>>>> 当产生式体为空时,自动为其补充产生式体ε,所以上面第二个产生式
>>>> ```
>>>> A:
>>>> ```
>>>> 等价于:  
>>>> ```
>>>> A:ε
>>>> ```
>>>> ### BNF编写中的一些需要注意的点
>>>>> 1. 如果同一个产生式出现多次,虽然在debug等途径中这些产生式看起来一样,但是在实际处理中他们会被当成不同的产生式,如:
>>>>>> ```
>>>>>> A:a
>>>>>> A:a
>>>>>> ```
>>>>>> 会被tscc理解成:
>>>>>> ```
>>>>>> S1=A:a
>>>>>> S2=A:a
>>>>>> ```    
>>>>>> 通过debug等渠道打印状态表时,看到的还是A:a和A:a,并且这种情况还会出现规约-规约冲突,相当于在这个状态中可以规约成产生式S1或者规约成产生式S2，这和bison处理结果一致  
>>>>>2. *如果一个符号没有在tokens或者association中定义过,则这个符号会被当成非终结符处理*  
>>>>>3. *产生式中的符号不能包含"$","@","#"这三个字符。*  
>>>>>4. 如果文法中某个产生式重来没有被规约过,则提示：下面这些产生式没有被使用(规约)过或者rules useless in grammar  
>>>>>5. 起始符号:用户定义的第一条产生式的头部为文法的起始符号  
>>>>>6. tscc会自动在产生式数组最前面插入一个产生式构成增广文法,目的是告诉语法分析器什么时候停止解析并宣布成功解析输入的符号串
>>>>>> 假设编写了如下的产生式,第一条产生式为:S->A
>>>>>> ```
>>>>>> S->A
>>>>>> A->a
>>>>>> A->B
>>>>>> B->b
>>>>>> ```
>>>>>> 则tscc会自动生成一个产生式:S'->S,使得上面的产生式列表变成
>>>>>> ```
>>>>>> S'->S
>>>>>> S->A
>>>>>> A->a
>>>>>> A->B
>>>>>> B->b
>>>>>> ```
>>>>>> 规则为:取用户输入的第一个产生式头的符号A(起始符号),然后添加一个产生式A'->A,在符号A的后面追加一个字符',使A'->A成为整个文法的第一条产生式,yacc也用类似的方法增加一条产生式  
>>>>>> ```
>>>>>> $accept-> A $end
>>>>>> ```
>>>>>7. 如果文法的起始符号没有推导任何有效句子,即first(start_symbol)为空(不是为ε,ε也是一个符号,而是在计算first集合的时候没有得到任何终结符),则抛出异常"起始符号A没有推导出任何句子"
>>>>>8. 提示信息远远没有yacc丰富,很多提示规则也是我边想边添加的,以后遇到新问题继续添加提示
>>> #### priority
>>>> 参考*产生式优先级和结合性*一节
>>> #### action
>>>> action为一个函数,当输入的单词能够规约成这条产生式时,就会调用本函数,所以可以叫做规约动作。传入的参数为一个数组,数组的元素分别为产生式体中的符号,产生式头的值被设置为规约动作的返回值。  
>>>> 需要注意的是:*ε会被忽略,即对于产生式 A:ε B ε C 来说,规约动作的参数数组长度为2,并且args[0]对应符号B的值,args[1]对应符号C的值,产生式体中的ε被跳过*  
>>>> ##### 中间动作:
>>>>> action的第二个参数被设置为语法分析栈中的符号，这是因为yacc或者bison可以在一条产生式的中间插入产生式动作，而tscc可以做到一样的功能，但是写法有些区别  
>>>>> 在yacc中,如果对一条产生式规则 E:E + E ,在产生式中间定义了一个动作,在末尾定义了一个规约动作,如下:
>>>>> ```
>>>>> E:E '+' {printf("中间动作,第一个符号%d,第二个符号:%d",$1,$2);} E {$$=$1+$4;};
>>>>> ```
>>>>> 则本质上yacc是在产生式的中间插入了一个非终结符,然后将中间动作设置为这个非终结符的规约动作,可以看到产生的规约动作取第二个E的时候用$4,而不是$3,并且中间动作中的$$表示的也是插入产生头部的值,将从分析栈中提取栈顶的两个符号(不弹出,只取值)赋给动作的$1,$2等变量,如下:
>>>>> ```
>>>>> E:E '+' Tmp E;
>>>>> Tmp: ε {printf("中间动作,第一个符号%d,第二个符号:%d",$1,$2);};//$1为前面一条产生式中的符号E,$2前面一条产生式的符号'+'
>>>>> ```
>>>>> 因为yacc在解析.y文件的时候知道中间动作的位置,所以能自动从栈中取出确定数量的符号给中间动作使用,而tscc对动作没有任何解析,直接使用了js函数原型作为动作(因为编写BNF的解析也需要时间,像bison就用自己编写了自己的.y文件解析器,而因为时间成本问题,tscc暂时没这么做，因为js本身的灵活性,tscc的BNF定义规则可读性也还不错),所以需要自己定义插入符号,然后自行从分析栈中取得符号  
>>>>>```
>>>>>BNF:[
>>>>>    {"E:E + tmp E":{action:(args)=>{return args[0]+args[3];}}},
>>>>>    {"tmp:":{action:(args,stack)=>{
>>>>>     let sym=stack.slice(-2);//取栈中最后两个符号,得到的就是E和+
>>>>>     console.log(`${sym[0]}:${sym[1]}`);
>>>>>    }}}
>>>>>]
>>>>>
>>>>>```
>>> BNF例子:
>>> ```
>>> BNF:[{ "exp:exp + exp": { action: function (args) { return args[0] + args[2]; } } },//将产生式体第一个exp和第二个exp相加,结果赋予产生式头
>>> { "exp:number": { action: function (args) { return args[0]; } } },//将产生式体第一个符号的值赋予产生式头
>>> { "exp:- number": { action: function (args) { return -args[0]; }, priority: "uminus" } }]//定义产生式的优先级和结合性与符号uminus相同,将exp的值取反
>>> ```
>> ### accept
>>> 可选  
>>> ```
>>> accept?: (args: any[]) => any;
>>> ```
>>> accept为增广文法成功规约时的规约动作,设BNF中定义的第一个产生式为A:B C,tscc会自动添加一个产生式A':A,并将规约动作设置为accept,并且将accept的返回值作为parse方法的返回值。  
>>> 例:
>>> ```
>>> accept:function(args){console.log('编译完成');}
>>> ```
> ## argument
>> agrument定义如下:
>> ```
>> {
>>    debug: boolean,
>>    language: "zh-cn" | "en-us"
>> }
>> ```
>> debug:tscc是否输出LR(1)项集族和跳转表,方便用户调试
>> language:目前只能为"zh-cn"或者"en-us",控制tscc的调试语言和生成代码中提示的语言
# 错误恢复
> tscc的错误恢复采用和yacc类似的策略,如果用户定义了一个形如 A: α error β 的错误处理产生式,则当语法分析器遇到一个错误时,会不断的从分析栈中弹出符号,直到栈中的一个状态包含形如 A-> α .error β 的项(简单来说就是直到遇到一个能移入error的状态),然后语法分析器就假装在输入中遇到了error,执行移入操作,在移入之后从词法分析器中抛弃一系列符号,直到新的输入能正常进行语法分析为止。
# tscc的输出
> tscc会输出一个字符串,这个字符串是一段合法的typescript代码,里面包Parser这个类,用户可以在后面增加一行代码调用这个类:
> ```
> new Parser().parse(new Lex());//Lex为词法分析器
> ```
# parser的使用
> 如上面所说,使用tscc生成parser之后,调用这个类的parse方法即可,该方法的返回值为accept定义的返回值,如果在分析过程中遇到错误，将会抛出异常
# demo
> 参考四则运算demo  
> /src/example/calculate/calculate.ts  
> ./tsconfig.json配置了输入输出目录,可以自行查看并修改
> 1. 使用tsc编译typescript代码
> 2. 执行"node .\output\src\example\calculate\calculate.js"生成compiler.ts
> 3. 使用tsc编译compiler.ts
> 4. 执行"node ./output/compiler.js"  
> 输出:
> ```
> 语句运算结果:0.6000000000000001
> 语法错误:此处不能接受;
> yytext is ;
> 错误恢复:读取下一个stmt
> 语句运算结果:5.8
> AST处理完成
> ```
# 一些常见错误原因分析
> 1. 存在无法计算first集合的符号串
>> 串中的某个非终结符不能推导出first集合,如下面的文法
>> ```
>> S->S a
>> ```
>> 其中S为非终结符,a为终结符,first(S)无法计算
> 2. 存在无法推导的非终结符
>> 某个符号无法推导出任何符号,如下面的文法
>> ```
>> S->A
>> ```
>> 其中S和A都为非终结符,很明显在first(S)=first(A),然而非终结符A没有任何有效推导  
>> 或者:
>> ```
>> S->S α
>> ```
>> 这种悬空递归文法也是没有任何有效推到的
# LR(1)文法局限性
> LR(1)文法也不是上下文无法文法的终极解决办法，同样存在很多CFG(context free grammar,上下文无关文法)是LR(1)分析办法解决不了的,如:
> ```
> token: a b c d e
>
> S:a A c d
> S:a B c
> A:B
> B:b
> ```
> 可以看出上述文法并没有二义性,输入:a b c的时候,因为如果后续是d则应该把b按照A->B->b的路径反向归约,如果后续输入是文件结束符,则应该按照B->b归约即可,然而LR(1)分析器只向后读取一个符号,所以只能知道下一个符号是c,所以理所当然的出现了二义性,当然如果是LR(2)解析器则可以解决上述冲突。然而不管LR(k)的k到底是多少,k总是有一个极限的。当然GLR分析器理论上可以分析所有CFG
