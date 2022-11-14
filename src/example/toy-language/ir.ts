type opcode =
    'new' |
    'p_load' |//将program指针压入表达式栈
    'p_store' |//把栈中指针推出给program
    'getfield' |
    'putfield' |
    'v_load' |
    'v_store' |
    'const_i32_load' |
    'const_i8_load' |
    'i32_add' |
    'i32_cmp' |
    'if' |
    'i_if_gt' |
    'i_if_ge' |
    'i_if_lt' |
    'i_if_eq' |
    'i_if_ne' |
    'if_eq' |
    'if_ne' |
    'jmp' |
    'dup'|//栈复制
    'ret';
let irIndex = 0;
export const codes: IR[] = [];
export class IR {
    public index: number = irIndex++;
    public opCode: opcode;
    public operand?: number | 'true' | 'false';
    public opSize?: number;
    constructor(opCode: opcode, operand?: number | 'true' | 'false', opSize?: number) {
        this.opCode = opCode;
        this.operand = operand;
        this.opSize = opSize;
        codes.push(this);
    }
    public toString(): string {
        return `${this.index}\t${this.opCode}\t${this.operand}\t${this.opSize}`;
    }
}