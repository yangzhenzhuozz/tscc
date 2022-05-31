import fs from "fs";
function functionScan(ScopeLink: VariableDescriptor | FunctionType, fun: FunctionType) {

}
//第二步不是生成代码，应该先扫描闭包
export default function scan(program_source: string) {
    let program = JSON.parse(program_source) as Program;
    let arrayBuffer = new ArrayBuffer(1024);
    let dataview = new DataView(arrayBuffer);
    //set magic number
    dataview.setInt8(0, "t".charCodeAt(0));
    dataview.setInt8(1, "y".charCodeAt(0));
    let property = program.property;
    for (let key in property) {
        let prop = property[key];
        if (prop?.type?.FunctionType != undefined) {
            functionScan(property, prop.type.FunctionType);
        }
    }
}
scan(fs.readFileSync("./src/example/toy-language/output/class.json").toString());