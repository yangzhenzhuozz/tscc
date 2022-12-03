import { IR, OPCODE, symbolsRelocationTable, symbolsTable, typeRelocationTable, typeTable as irTypeTable } from "./ir.js";

class Buffer {
    private buffer: number[] = [];
    public writeInt8(n: number): number {
        let ret = this.buffer.length;
        this.buffer.push(n);
        return ret;
    }
    public writeUInt8(n: number): number {
        let ret = this.buffer.length;
        this.buffer.push(n & 0xff);
        return ret;
    }
    public writeInt64(n: bigint): number {
        let ret = this.buffer.length;
        this.buffer.push(Number((n >> 0n) & 0xffn));
        this.buffer.push(Number((n >> 8n) & 0xffn));
        this.buffer.push(Number((n >> 16n) & 0xffn));
        this.buffer.push(Number((n >> 24n) & 0xffn));
        this.buffer.push(Number((n >> 32n) & 0xffn));
        this.buffer.push(Number((n >> 40n) & 0xffn));
        this.buffer.push(Number((n >> 48n) & 0xffn));
        this.buffer.push(Number((n >> 56n) & 0xffn));
        return ret;
    }
    public writeStringUTF8(str: string): number {
        let ret = this.buffer.length;
        let encoder = new TextEncoder();
        let bytes = encoder.encode(str);
        for (let byte of bytes) {
            this.buffer.push(byte);
        }
        this.buffer.push(0);//写\0
        return ret;
    }
    public setInt64(n: bigint, offset: number) {
        this.buffer[offset + 0] = Number((n >> 0n) & 0xffn);
        this.buffer[offset + 1] = Number((n >> 8n) & 0xffn);
        this.buffer[offset + 2] = Number((n >> 16n) & 0xffn);
        this.buffer[offset + 3] = Number((n >> 24n) & 0xffn);
        this.buffer[offset + 4] = Number((n >> 32n) & 0xffn);
        this.buffer[offset + 5] = Number((n >> 40n) & 0xffn);
        this.buffer[offset + 6] = Number((n >> 48n) & 0xffn);
        this.buffer[offset + 7] = Number((n >> 56n) & 0xffn);
    }
    public toBinary(): ArrayBuffer {
        return Uint8Array.from(this.buffer).buffer;
    }
}
class StringPool {
    private buffer: Buffer = new Buffer();
    private pool: Map<string, number> = new Map();
    private strArray: string[] = [];
    private index = 0;
    public register(str: string): number {
        if (this.pool.has(str)) {
            return this.pool.get(str)!;
        } else {
            let ret = this.index;
            this.pool.set(str, this.index++);
            this.strArray.push(str);
            return ret;
        }
    }
    public toBinary() {
        this.buffer.writeInt64(BigInt(this.pool.size));//写入长度
        for (let i = 0; i < this.pool.size; i++) {
            this.buffer.writeInt64(0n);//指针暂时置0
        }
        for (let i = 0; i < this.strArray.length; i++) {
            let str = this.strArray[i];
            let stringOffset = this.buffer.writeStringUTF8(str);
            this.buffer.setInt64(BigInt(stringOffset), (i + 1) * 8);
        }
        return this.buffer.toBinary();
    }
}
class ClassTable {
    public items: { size: number, name: number, isValueType: boolean, props: { name: number, type: number }[] }[] = [];
    public toBinary() {
        let buffer = new Buffer();
        buffer.writeInt64(BigInt(this.items.length));
        for (let item of this.items) {
            buffer.writeInt64(BigInt(item.size));
            buffer.writeInt64(BigInt(item.name));
            buffer.writeInt64(BigInt(item.isValueType));
            buffer.writeInt64(BigInt(item.props.length));
            for (let prop of item.props) {
                buffer.writeInt64(BigInt(prop.name));
                buffer.writeInt64(BigInt(prop.type));
            }
        }
        return buffer.toBinary();
    }
}
class StackFrameTable {
    public items: { baseOffset: number, props: { name: number, type: number }[] }[] = [];
    public toBinary() {
        let buffer = new Buffer();
        buffer.writeInt64(BigInt(this.items.length));
        for (let item of this.items) {
            buffer.writeInt64(BigInt(item.baseOffset));
            buffer.writeInt64(BigInt(item.props.length));
            for (let prop of item.props) {
                buffer.writeInt64(BigInt(prop.name));
                buffer.writeInt64(BigInt(prop.type));
            }
        }
        return buffer.toBinary();
    }
}
//和ir.ts中的typeTable不同
class TypeTable {
    public items: { name: number, desc: number, innerType: number }[] = [];
    public toBinary() {
        let buffer = new Buffer();
        buffer.writeInt64(BigInt(this.items.length));
        for (let item of this.items) {
            buffer.writeInt64(BigInt(item.desc));
            buffer.writeInt64(BigInt(item.innerType));
            buffer.writeInt64(BigInt(item.name));
        }
        return buffer.toBinary();
    }
}
export function link() {
    let newSymbolTable: Map<string, number> = new Map();
    let index = 0;
    //重新计算符号表
    for (let _symbol of symbolsTable) {
        newSymbolTable.set(_symbol.name, index);
        index += _symbol.irs.length;
    }
    //修改需要重定位的指令
    for (let item of symbolsRelocationTable) {
        item.ir.operand1 = newSymbolTable.get(item.t1);
    }
    //类型重定位
    for (let item of typeRelocationTable) {
        if (item.t1) {
            item.ir.operand1 = irTypeTable[item.t1].index;
        }
        if (item.t2) {
            item.ir.operand1 = irTypeTable[item.t2].index;
        }
        if (item.t3) {
            item.ir.operand1 = irTypeTable[item.t3].index;
        }
    }
    //将ir变成二进制
    let irBuffer = new Buffer();
    for (let _symbol of symbolsTable) {
        for (let ir of _symbol.irs) {
            irBuffer.writeInt64(BigInt(OPCODE[ir.opCode]));
            irBuffer.writeInt64(BigInt(ir.operand1 ?? 0));
            irBuffer.writeInt64(BigInt(ir.operand2 ?? 0));
            irBuffer.writeInt64(BigInt(ir.operand3 ?? 0));
        }
    }
    //输出符号表
    let symbolTableBuffer = new Buffer();
    for (let item of newSymbolTable) {
        symbolTableBuffer.writeInt64(BigInt(stringPool.register(item[0])));
        symbolTableBuffer.writeInt64(BigInt(item[1]));
    }
    return { text: irBuffer.toBinary(), symbolTable: symbolTableBuffer.toBinary() };
}
export enum typeItemDesc {
    PlaintObj,
    Array,
    Function
};
export const stackFrameTable = new StackFrameTable();
export const typeTable = new TypeTable();
export const classTable = new ClassTable();
export const stringPool = new StringPool();