不支持参数重载，否则会遇到下面的问题
function add(a:int,b:int){
    return a+b;
};
function add(a:int,b:int,c:int){
    return a+b+c;
};
这里会提示add重复定义