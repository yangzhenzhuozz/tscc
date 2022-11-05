interface IR {
    opCode:
    'p_load' |//将program指针压入表达式栈
    'i32_load' |
    'i32_store' |
    'i_i32_load' |
    'i_i32_store' |
    'i32_add' |
    'i32_cmp' |
    'if' |
    'if_gt' |
    'if_lt' |
    'if_eq'
    operand: number | 'true' | 'false' | undefined
}