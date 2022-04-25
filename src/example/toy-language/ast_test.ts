//测试ast.d.ts设计的行不行
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
                                                    value: 1,
                                                    type: { SimpleType: { name: 'int' } }
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
                        {
                            immediate: {
                                value: 1,
                                type: {
                                    FunctionType: {
                                        argument: {},
                                        body: []
                                    }
                                }
                            }
                        },
                        [
                            {
                                "+": {
                                    leftChild: {
                                        def: {
                                            a: {
                                                type: { SimpleType: { name: 'int' } },
                                                initAST: {
                                                    immediate: {
                                                        value: 1,
                                                        type: { SimpleType: { name: 'int' } }
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
                        ]
                    ]
                }
            }
        }
    },
    property: {
        c: {
            type: { SimpleType: { name: 'int', templateSpecialization: [{ SimpleType: { name: "int" } }, { SimpleType: { name: "int" } }] } }
        }
    }
};