import { TypeUsedSign } from './lib.js';

//全局变量
export const globalVariable = {
    pointSize: 8,//指针大小
    stackFrameMapIndex: 0,//栈帧序号
    functionIndex: 0
}
export let symbolsRelocationTable: IR[] = [];//重定位表
export let typeRelocationTable: { t1?: string, t2?: string, t3?: string, ir: IR }[] = [];//type重定向表
export let stackFrameRelocationTable: { sym: string, ir: IR }[] = [];//stackFrame重定向表
export let symbolsTable: IRContainer[] = [];//符号表
export let stackFrameTable: { [key: string]: { baseOffset: number, frame: { name: string, type: TypeUsed }[] } } = {};//栈布局记录
export let typeTable: { [key: string]: { index: number, type: TypeUsed } } = {};//类型表
let typeIndex = 0;
//注册类型
export function registerType(type: TypeUsed): number {
    let sign = TypeUsedSign(type);
    let ret: number;
    if (typeTable[sign] != undefined) {
        ret = typeTable[sign].index;
    } else {
        typeTable[sign] = { index: typeIndex, type: type };
        ret = typeIndex++;
    }
    if (type.ArrayType != undefined) {//如果是数组类型，注册内部类型
        registerType(type.ArrayType.innerType);
    }
    return ret;
}
export function typeTableToBin(): ArrayBuffer {
    let length: BigUint64Array;
    let zero = new Uint8Array(1).fill(0);
    length = new BigUint64Array(1);
    length[0] = BigInt(Object.keys(typeTable).length)
    let table: BigUint64Array = new BigUint64Array(Object.keys(typeTable).length);
    let buffer: Uint8Array[] = [];
    let offset = 8 + table.byteLength;
    let encoder = new TextEncoder()
    let index = 0;
    for (let k in typeTable) {
        table[index] = BigInt(offset);
        let bytes = encoder.encode(k);
        buffer.push(bytes);
        buffer.push(zero);
        offset += bytes.byteLength + 1;
        index++;
    }
    let ret = new Uint8Array(offset);
    let view = new DataView(ret.buffer);
    view.setBigUint64(0, length[0]);
    offset = 8;
    for (let item of table) {
        view.setBigUint64(offset, item);
        offset += 8;
    }
    for (let item of buffer) {
        for (let index = 0; index < item.byteLength; index++) {
            view.setUint8(offset, item[index]);
            offset += 1;
        }
    }
    return ret.buffer;
}
export enum OPCODE {
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
    'ret',
    'exit'
};
let symbol: IRContainer;
export class IRContainer {
    public index = 0;
    public irs: IR[] = [];
    public name: string;
    constructor(name: string, linkToEnd = true) {
        this.name = name;
        if (linkToEnd) {
            symbolsTable.push(this);
        }
    }
    public static setSymbol(container: IRContainer) {
        symbol = container;
    }
    public static getSymbol() {
        return symbol;
    }
    public toBinary(): ArrayBuffer {
        let bin = new BigUint64Array(4 * this.irs.length);//每条指令32字节(是不是太浪费了，单字节指令也用这么多内存，太奢侈了)
        for (let i = 0; i < this.irs.length; i++) {
            let ir = this.irs[i];
            bin[i * 4 + 0] = BigInt(OPCODE[ir.opCode]);
            bin[i * 4 + 1] = ir.operand1 != undefined ? BigInt(ir.operand1) : BigInt(0);
            bin[i * 4 + 2] = ir.operand2 != undefined ? BigInt(ir.operand2) : BigInt(0);
            bin[i * 4 + 3] = ir.operand3 != undefined ? BigInt(ir.operand3) : BigInt(0);
        }
        return bin.buffer;
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
    }
}