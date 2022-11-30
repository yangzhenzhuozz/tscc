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
    public toBin(): ArrayBuffer {
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
    public getindex(str: string): number {
        let ret = this.pool.get(str);
        if (ret == undefined) {
            throw `字符串池中无该字符串:${str}`;
        } else {
            return ret;
        }
    }
    public toBin() {
        this.buffer.writeInt64(BigInt(this.pool.size));//写入长度
        for (let i = 0; i < this.pool.size; i++) {
            this.buffer.writeInt64(0n);//指针暂时置0
        }
        for (let i = 0; i < this.strArray.length; i++) {
            let str = this.strArray[i];
            let stringOffset = this.buffer.writeStringUTF8(str);
            this.buffer.setInt64(BigInt(stringOffset), (i + 1) * 8);
        }
        return this.buffer.toBin();
    }
}
export const stringPool = new StringPool();