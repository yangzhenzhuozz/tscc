import { Type, Address } from "./lib.js";
let int=new Type("int","referentialType");
let A=new Type("A","valuetype");
let B=new Type("B","valuetype");
A.registerField("b",new Address("class",B,0));
B.registerField("a",new Address("class",A,0));
A.setParent(B);
B.setParent(A);
B.checkRecursive();
