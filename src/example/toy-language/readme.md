这是早期代码，现在编译器的代码已经移动到ty-compiler中了


不支持参数重载，否则会遇到下面的问题
function add(a:int,b:int){
    return a+b;
};
function add(a:int,b:int,c:int){
    return a+b+c;
};
这里会提示add重复定义


++
--
=
没有返回值
++、--:
    int a=0;
    int b=a++;
    b==0 or b==1，看起来烦
    (a++)++
=：
    1.下面这种写法看起来脑壳痛，我不喜欢
    while(len=read('file')==-1){
        xxxx
    }
    2.a=b=c=d这种写法，如果重载了赋值操作符，自己都读不懂，还不如不准连续赋值

虽然文法上面允许这样写:
class myClass{
    function inc<T>(i:T):T{return i++;};
}
(new myClass()).inc<int>(1);
但是我觉得实现的价值不高，所以目前只允许在program中定义模板函数,否则用户这样写:
function outter(){
    function inner<T>(v:T){
        return v++;
    }
    return inner();
}
......
var f=outter();
if(v==1){
    f<int>();
}else{
    f<double>();
}
......
这样做还得支持运行时特化，更难搞了
所以一个字，砍，这些功能砍掉就对了