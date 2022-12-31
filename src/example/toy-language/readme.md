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