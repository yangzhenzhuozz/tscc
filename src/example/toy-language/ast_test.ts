let program: Program = {
    bulit_in_class: {
        int: {
            property: {}
        },
        double: {
            property: {}
        },
        map: { templates: ["K", "V"], property: {} },
        test: {
            property: { a: { type: { SimpleType: { name: 'int' } } } },
            operatorOverload: {
                "+": {
                    argument: { a: { type: { SimpleType: { name: 'int' } } }, b: { type: { SimpleType: { name: 'int' } } } },
                    body: [
                        {
                            "+": {
                                leftChild: {
                                    def: {
                                        a: {
                                            type: { SimpleType: { name: 'int' } },
                                            initAST: {
                                                immediate: {
                                                    numberVal: 1
                                                }
                                            }
                                        }
                                    },
                                },
                                rightChild: {
                                    load: 'b'
                                }
                            }
                        },
                        [//一个嵌套scope,我已经快要看不懂了，我记得设计是很漂亮的，就是没注释看不懂而已
                            {
                                "+": {
                                    leftChild: {
                                        def: {
                                            a: {
                                                type: { SimpleType: { name: 'int' } },
                                                initAST: {
                                                    immediate: {
                                                        numberVal: 1
                                                    }
                                                }
                                            }
                                        },
                                    },
                                    rightChild: {
                                        load: 'b'
                                    }
                                }
                            }
                        ]
                    ]
                }
            }
        }
    },
    property: {
        a: {
            type: { SimpleType: { name: 'int', templateSpecialization: [{ SimpleType: { name: "int" } }, { SimpleType: { name: "int" } }] } }
        },
        b: {
            initAST: {
                immediate: {
                    numberVal: 1
                }
            }
        },
        c: {
            initAST: {
                immediate: {
                    functionVal: { argument: {}, body: [], retType: { SimpleType: { name: "int" } } },//空函数体(一行代码也没有),但是返回值类型已经声明为int了，在推导的时候应该报错
                }
            }
        },
    }
};