interface ir {
    opCode: 'i32_push' | 'i32_pop' | 'i_i32_push' | 'i_i32_pop' | 'add' | 'i32_cmp' | 'if' | 'if_gt' | 'if_lt' | 'if_eq'
    operand: number | 'true' | 'false'
}
type baseBlock = ir[];