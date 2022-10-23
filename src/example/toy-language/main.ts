import Parser from "./parser.js";
import lexer from './lexrule.js';
import pre_process from './pre-process.js'
import fs from 'fs';
import { userTypeDictionary } from './lexrule.js';
import { programScan } from './first_scan.js'
userTypeDictionary.add('int');//注册系统类型
userTypeDictionary.add('double');
userTypeDictionary.add('void');
let source = fs.readFileSync("./src/example/toy-language/test_2.ty", 'utf-8').toString();
lexer.setSource(source);
try {
    lexer.compile();
    console.time("解析源码耗时");
    pre_process(source);
    let stage1 = Parser(lexer);
    console.timeEnd("解析源码耗时");
    fs.writeFileSync(`./src/example/toy-language/output/stage-1.json`, JSON.stringify(stage1, null, 4));
    console.time(`阶段二耗时`);
    programScan(`./src/example/toy-language/output/stage-2.json`, stage1);
    console.timeEnd(`阶段二耗时`);
} catch (e: unknown) {
    if (e instanceof Error) {
        console.error(e.stack);
    }
    console.error(`${e}`);
}