import { symbols } from "./constant.js";

enum OPCODE {
    'new' = 0,//创建一个普通对象
    'newFunc',//创建一个函数对象
    'newArray',//操作数是基本类型，长度和是否仍然是一个数组从栈中取
    'p_load',//将program指针压入表达式栈
    'push_stack_map',//压入栈帧布局
    'pop_stack_map',//弹出栈帧布局
    'getfield',
    'putfield',
    'v_load',
    'v_store',
    'const_i32_load',
    'const_i64_load',
    'const_i8_load',
    'i32_inc',
    'i32_dec',
    'i32_add',
    'i32_cmp',
    'i_if_gt',
    'i_if_ge',
    'i_if_lt',
    'i_if_cmp_eq',//相等则跳转
    'i_if_cmp_ne',//不相等则跳转
    'i_if_eq',//等于0则跳转
    'i_if_ne',//不等于0则跳转
    'jmp',//相对跳转
    'dup',//栈复制
    'call',//以栈顶为目标，进行调用
    'abs_call',//call一个绝对地址
    'ret'
};
let symbol: IRContainer;
export class IRContainer {
    public index = 0;
    public irs: IR[] = [];
    public name: string;
    public debug: boolean;
    constructor(name: string, debug = false) {
        this.name = name;
        this.debug = debug;
        symbols.push(this);
    }
    public static setSymbol(container: IRContainer) {
        symbol = container;
    }
    public static getSymbol() {
        return symbol;
    }
    public toBinary(): BigUint64Array {
        let bin = new BigUint64Array(4 * this.irs.length);//每条指令32字节(是不是太浪费了，单字节指令也用这么多内存，太奢侈了)
        for (let i = 0; i < this.irs.length; i++) {
            let ir = this.irs[i];
            bin[i * 4 + 0] = BigInt(OPCODE[ir.opCode]);
            bin[i * 4 + 1] = ir.operand1 != undefined ? BigInt(ir.operand1) : BigInt(0);
            bin[i * 4 + 2] = ir.operand2 != undefined ? BigInt(ir.operand2) : BigInt(0);
            bin[i * 4 + 3] = ir.operand3 != undefined ? BigInt(ir.operand3) : BigInt(0);
        }
        return bin;
    }
}
export class IR {
    public index: number = symbol.index++;
    public opCode: keyof typeof OPCODE;
    public operand1?: number;
    public operand2?: number;
    public operand3?: number;
    public tag1?: string;
    public tag2?: string;
    public tag3?: string;
    public length: number;
    constructor(opCode: keyof typeof OPCODE, operand1?: number, operand2?: number, operand3?: number, tag1?: string, tag2?: string, tag3?: string) {
        this.opCode = opCode;
        this.operand1 = operand1;
        this.operand2 = operand2;
        this.operand3 = operand3;
        this.tag1 = tag1;
        this.tag2 = tag2;
        this.tag3 = tag3;
        this.length = 1;
        symbol.irs.push(this);
        if (symbol.debug) {
            console.log(`${this}`);
        }
    }
}