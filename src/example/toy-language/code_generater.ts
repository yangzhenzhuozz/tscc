export default function generater(program_source: string) {
    let program = JSON.parse(program_source) as Program;
    let arrayBuffer = new ArrayBuffer(1024);
    let dataview = new DataView(arrayBuffer);
    //set magic number
    dataview.setInt8(0, "t".charCodeAt(0));
    dataview.setInt8(1, "y".charCodeAt(0));
}