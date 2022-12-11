import { globalVariable, IR, IRContainer, OPCODE, symbolsRelocationTable, symbolsTable, typeRelocationTable, typeTable as irTypeTable } from "./ir.js";
import { TypeUsedSign } from "./lib.js";
import { ProgramScope } from "./scope.js";

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
    private pool: Map<string, number> = new Map();
    public items: string[] = [];
    private index = 0;
    public register(str: string): number {
        if (this.pool.has(str)) {
            return this.pool.get(str)!;
        } else {
            let ret = this.index;
            this.pool.set(str, this.index++);
            this.items.push(str);
            return ret;
        }
    }
    public toBinary() {
        let buffer: Buffer = new Buffer();
        buffer.writeInt64(BigInt(this.pool.size));//写入长度
        for (let i = 0; i < this.pool.size; i++) {
            buffer.writeInt64(0n);//指针暂时置0
        }
        for (let i = 0; i < this.items.length; i++) {
            let stringOffset = buffer.writeStringUTF8(this.items[i]);
            buffer.setInt64(BigInt(stringOffset), (i + 1) * 8);
        }
        return buffer.toBinary();
    }
}
class ClassTable {
    public items: { size: number, name: number, isValueType: boolean, props: { name: number, type: number }[] }[] = [];
    public toBinary() {
        let buffer = new Buffer();
        buffer.writeInt64(BigInt(this.items.length));//写ClassTable.length
        //预留ClassTable.items
        for (let i = 0; i < this.items.length; i++) {
            buffer.writeInt64(0n);//指针暂时置0
        }
        for (let i = 0; i < this.items.length; i++) {
            let classDesc = this.items[i];
            let classOffset = buffer.writeInt64(BigInt(classDesc.size));//写PropertyDesc的属性
            buffer.setInt64(BigInt(classOffset), (i + 1) * 8);
            buffer.writeInt64(BigInt(classDesc.name));
            buffer.writeInt64(BigInt(classDesc.isValueType));
            buffer.writeInt64(BigInt(classDesc.props.length));
            let propLocs = [] as number[];
            //预留PropertyDesc.items
            for (let j = 0; j < classDesc.props.length; j++) {
                let propLoc = buffer.writeInt64(0n);//指针暂时置0
                propLocs.push(propLoc);
            }
            for (let j = 0; j < classDesc.props.length; j++) {
                let prop = classDesc.props[j];
                let propOffset = buffer.writeInt64(BigInt(prop.name));
                buffer.setInt64(BigInt(propOffset), propLocs[j]);
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
        buffer.writeInt64(BigInt(this.items.length));//写length
        //预留StackFrameTable.items
        for (let i = 0; i < this.items.length; i++) {
            buffer.writeInt64(0n);//指针暂时置0
        }
        for (let i = 0; i < this.items.length; i++) {
            let item = this.items[i];
            let itemOffset = buffer.writeInt64(BigInt(item.baseOffset));//写StackFrameItem.baseOffset(写item的第一个属性的时候，这个偏移也是item的起始偏移)
            buffer.setInt64(BigInt(itemOffset), (i + 1) * 8);
            buffer.writeInt64(BigInt(item.props.length));//写写StackFrameItem.length
            let propItemLocs = [] as number[];
            //预留StackFrameItem.items
            for (let j = 0; j < item.props.length; j++) {
                let propLoc = buffer.writeInt64(0n);//指针暂时置0
                propItemLocs.push(propLoc);
            }
            for (let j = 0; j < item.props.length; j++) {
                let prop = item.props[j];
                let propOffset = buffer.writeInt64(BigInt(prop.name));
                buffer.setInt64(BigInt(propOffset), propItemLocs[j]);
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
        for (let item of this.items) {
            buffer.writeInt64(BigInt(item.desc));
            buffer.writeInt64(BigInt(item.innerType));
            buffer.writeInt64(BigInt(item.name));
        }
        return buffer.toBinary();
    }
}
function assertion(obj: any, name: string) {
    if (obj == undefined || obj == null) {
        throw `link失败,找不到符号:${name}`;
    }
}
export function link(programScope: ProgramScope) {

    let main = programScope.getProp('main').prop.type?.FunctionType;
    if (main == undefined || Object.keys(main._arguments).length != 0 || TypeUsedSign(main.retType!) != 'void') {
        throw `必须在program域定义一个函数main,类型为: ()=>void (无参,无返回值),后续再考虑有参数和返回值的情况`;
    }
    let start = new IRContainer('@start', 'begin');//在代码的最前面生成@start
    IRContainer.setSymbol(start);
    let call = new IR('abs_call', undefined, undefined, undefined, `@program_init`);//初始化@program
    symbolsRelocationTable.push(call);
    new IR('p_load');
    new IR('getfield', programScope.getPropOffset('main').offset, globalVariable.pointSize);
    new IR('call');
    new IR('__exit');


    let newSymbolTable: Map<string, number> = new Map();
    let newIRS: IR[] = [];//用于是输出调试代码
    let index = 0;
    //重新计算符号表
    for (let _symbol of symbolsTable) {
        newSymbolTable.set(_symbol.name, index);//这个1是留给第一条指令jmp到@start用的
        index += _symbol.irs.length;
    }
    //修改需要重定位的指令
    for (let item of symbolsRelocationTable) {
        item.operand1 = newSymbolTable.get(item.tag1!);
        assertion(item.tag1, item.tag1!);
    }
    //类型重定位
    for (let item of typeRelocationTable) {
        if (item.t1) {
            item.ir.operand1 = irTypeTable[item.t1].index;
            assertion(item.ir.operand1, item.t1);
        }
        if (item.t2) {
            item.ir.operand2 = irTypeTable[item.t2].index;
            assertion(item.ir.operand2, item.t2);
        }
        if (item.t3) {
            item.ir.operand2 = irTypeTable[item.t3].index;
            assertion(item.ir.operand2, item.t3);
        }
    }
    //将ir变成二进制
    let irBuffer = new Buffer();
    for (let _symbol of symbolsTable) {
        for (let ir of _symbol.irs) {
            newIRS.push(ir);
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
    return { text: irBuffer.toBinary(), symbolTable: symbolTableBuffer.toBinary(), newSymbolTable, newIRS };
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