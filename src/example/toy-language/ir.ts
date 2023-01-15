/**
 * 本文件存放一些全局使用的对象和变量
 */

import { Program } from "./program.js";

export let irAbsoluteAddressRelocationTable: { sym: string, ir: IR }[] = [];//指令地址重定位表
export let typeRelocationTable: { t1?: string, t2?: string, t3?: string, ir: IR }[] = [];//type重定向表
export let stackFrameRelocationTable: { sym: string, ir: IR }[] = [];//stackFrame重定向表
export let irContainerList: IRContainer[] = [];//符号表
export let stackFrameTable: { [key: string]: { baseOffset: number, frame: { name: string, type: TypeUsed }[] } } = {};//栈布局记录
export let typeTable: { [key: string]: { index: number, type: TypeUsed } } = {};//类型表

export const globalVariable = {
    pointSize: 8,//指针大小
    stackFrameMapIndex: 1,//栈帧序号,从1开始，0预留给class_init保存this指针
    functionIndex: 0
}
export let program: Program;
export function setProgram(p: Program) {
    program = p;
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
    '_new' = 0,//创建一个普通对象
    'newFunc',//创建一个函数对象,op1是text,op2是函数类型名字，op3是函数包裹类名字
    'newArray',//操作数是基本类型，长度和是否仍然是一个数组从栈中取
    'program_load',//将program指针压入表达式栈
    'program_store',//将program从栈存入program指针
    'push_stack_map',//压入栈帧布局
    'pop_stack_map',//弹出栈帧布局
    'p_getfield',//从计算栈顶弹出一个指针，以指针作为obj基础地址，读取一个指针成员到计算栈顶
    'p_putfield',//从计算栈顶弹出一个指针，接着再弹出一个指针，以指针作为obj的基础地址，把指针写入成员区域
    'valueType_getfield',//从计算栈顶弹出一个指针，以指针作为obj基础地址，读取一个valueType成员到计算栈顶
    'valueType_putfield',//从计算栈顶弹出一个valueType，接着再弹出一个指针，以指针作为obj的基础地址，把valueType写入成员区域

    /**
     * array相关的,operand1是系数(即每个element的size)
     */
    'array_get_element_address',//先从计算栈弹出一个i32作为下标，再从计算栈弹出一个指针,以该指针为基础地址加上i32*element_size压入计算栈
    'array_get_point',//先从计算栈弹出一个i32作为下标，再从计算栈弹出一个指针，以读取指针的方式读取元素值
    'array_get_valueType',//先从计算栈弹出一个i32作为下标，再从计算栈弹出一个指针，以读取valueType的方式读取元素值
    /**
     * arr_set少一个address，见getfield_address和load_address的说明
     */
    'array_set_point',//先从计算栈弹出一个指针,再从计算栈弹出一个i32作为下标，再从计算栈弹出一个指针，以设置指针的方式设置元素值
    'array_set_valueType',//先从计算栈弹出一个value,再从计算栈弹出一个i32作为下标，再从计算栈弹出一个指针，以设置valueType的方式设置元素值

    /**
     * 只有读取需要用到address，设置不需要
     */
    'getfield_address',//从计算栈弹出一个指针，加上偏移压入计算栈
    'load_address',//读取局部变量区域的基础地址(bp指针),然后加上偏移压入计算栈
    'valueType_load',//从局部变量加载一个value到计算栈
    'valueType_store',//从计算栈存储到局部变量,op1是offset,op2是size
    'p_load',//从局部变量加载一个指针到计算栈
    'p_store',//从计算栈顶弹出一个指针到局部变量
    'const_i32_load',//加载一个立即数(i32)到计算栈
    'const_i8_load',//加载一个立即数(i8)到计算栈
    'const_i64_load',//加载一个立即数(i64)到计算栈
    'i32_inc',//从计算栈顶弹出i32，自增后压入
    'i32_dec',//从计算栈顶弹出i32，自减后压入


    'i32_add',//从计算栈中弹出两个i32，结果相加之后压入计算栈
    'i32_sub',//....
    'i32_mul',//....
    'i32_div',//....




    'i_if_gt',//大于则跳转
    'i_if_ge',//大于等于则跳转
    'i_if_lt',//小于则跳转
    'i_if_le',//小于等于则跳转
    'i_if_cmp_eq',//相等则跳转
    'i_if_cmp_ne',//不相等则跳转
    'i_if_eq',//等于0则跳转
    'i_if_ne',//不等于0则跳转


    'jmp',//相对跳转
    'p_dup',//栈复制
    'call',//以栈顶为目标，进行调用，这里不会消费计算栈
    'abs_call',//call一个绝对地址
    'ret',//ret
    'valueType_pop',//从计算栈中弹出valueType
    'p_pop',//从计算栈中弹出指针
    '__exit',//退出
    'alloc',//申请局部变量空间
    'access_array_length',//读取数组的length
    'box',//读取右值的地址
    'native_call',//调用native函数
};
export let nowIRContainer: IRContainer;
export class IRContainer {
    public irs: IR[] = [];
    public name: string;
    constructor(name: string, push_direct: 'begin' | 'end' = 'end') {
        this.name = name;
        if (push_direct == 'begin') {
            irContainerList.unshift(this);
        } else {
            irContainerList.push(this);
        }
    }
    public static setContainer(container: IRContainer) {
        nowIRContainer = container;
    }
    public static getContainer() {
        return nowIRContainer;
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
    public index: number = nowIRContainer.irs.length;
    public opCode: keyof typeof OPCODE;
    public operand1?: number;
    public operand2?: number;
    public operand3?: number;
    public length: number;
    constructor(opCode: keyof typeof OPCODE, operand1?: number, operand2?: number, operand3?: number/*, tag1?: string, tag2?: string, tag3?: string*/) {
        this.opCode = opCode;
        this.operand1 = operand1;
        this.operand2 = operand2;
        this.operand3 = operand3;
        this.length = 1;
        nowIRContainer.irs.push(this);
    }
}
export let tmp = {};