import { globalVariable } from "./constant.js";

type opcode =
    'new' |
    'p_load' |//将program指针压入表达式栈
    'push_stack_map' |//压入栈帧布局
    'pop_stack_map' |//弹出栈帧布局
    'getfield' |
    'putfield' |
    'v_load' |
    'v_store' |
    'const_i32_load' |
    'const_i64_load' |
    'const_i8_load' |
    'i32_add' |
    'i32_cmp' |
    'i_if_gt' |
    'i_if_ge' |
    'i_if_lt' |
    'i_if_cmp_eq' |//相等则跳转
    'i_if_cmp_ne' |//不相等则跳转
    'i_if_eq' |//等于0则跳转
    'i_if_ne' |//不等于0则跳转
    'jmp' |//相对跳转
    'dup' |//栈复制
    'call' |//以栈顶为目标，进行调用
    'abs_call' |//call一个绝对地址
    'nop'|
    'ret';
export let symbols: Symbol[] = [];//符号表
export let addRelocationTable: { sym: string, ir: IR }[] = [];//重定位表
export let typeRelocationTable: { sym: string, ir: IR }[] = [];//type重定向表
export let stackFrameRelocationTable: { sym: string, ir: IR }[] = [];//stackFrame重定向表
export let stackFrameMap: { [key: string]: { baseOffset: number, frame: { name: string, type: TypeUsed }[] } } = {};//栈布局记录
let symbol: Symbol;
export class Symbol {
    public index = 0;
    public irs: IR[] = [];
    public name: string;
    public debug: boolean;
    constructor(name: string, debug = false) {
        this.name = name;
        this.debug = debug;
        symbols.push(this);
    }
    public static setSymbol(container: Symbol) {
        symbol = container;
    }
    public static getSymbol() {
        return symbol;
    }
}
export class IR {
    public index: number = symbol.index++;
    public opCode: opcode;
    public operand?: number;
    public opSize?: number;
    public tag?: string;
    constructor(opCode: opcode, operand?: number, opSize?: number, tag?: string) {
        this.opCode = opCode;
        this.operand = operand;
        this.opSize = opSize;
        this.tag = tag;
        symbol.irs.push(this);
        if (symbol.debug) {
            console.log(`${this}`);
        }
    }
    public toString(): string {
        return `${this.index}\t${this.opCode}\t${this.operand}\t${this.opSize}`;
    }
}