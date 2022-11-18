import { IR } from "./ir";

//全局变量
export const globalVariable: {
    pointSize: number;
    typeIndex: number;
    irContainer: {
        index: number;
        codes: IR[];
        debug?:boolean;
    };
} = {
    pointSize: 8,
    typeIndex: 0,
    irContainer: {
        index: 0,
        codes: []
    }
}