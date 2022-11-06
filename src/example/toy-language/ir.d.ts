interface IR {
    opCode:
    'p_load' |//将program指针压入表达式栈
    'getfield' |
    'putfield' |
    'load' |
    'store' |
    'const_i32_load' |
    'i32_add' |
    'i32_cmp' |
    'if' |
    'if_gt' |
    'if_ge' |
    'if_lt' |
    'if_eq' |
    'if_ne' |
    'pop'
    ;
    opSize?: number;
    operand?: number | 'true' | 'false'
}