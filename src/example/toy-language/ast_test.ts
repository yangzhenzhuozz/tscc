let program: Program = {
    definedType: {
        int: {
            property: {},
            operatorOverload: {},
            _constructor: {}
        },
        double: {
            property: {},
            operatorOverload: {},
            _constructor: {}
        },
        Map: {
            templates: ["K", "V"],
            property: {},
            operatorOverload: {},
            _constructor: {}
        },
        HashMap: {
            templates: ["K", "V"],
            property: {},
            extends: { SimpleType: { name: "Map" } },
            operatorOverload: {},
            _constructor: {}
        },
        test: {
            _constructor: {},
            property: { a: { variable: 'var', type: { SimpleType: { name: 'int' } } }, b: { variable: 'g-set', getter: { _arguments: {}, body: [] } } },
            operatorOverload: {
                "+": {
                    _arguments: { a: { variable: 'var', type: { SimpleType: { name: 'int' } } }, b: { variable: 'var', type: { SimpleType: { name: 'int' } } } },
                    body: [
                        {
                            "+": {
                                leftChild: {
                                    def: {
                                        a: {
                                            variable: 'var',
                                            type: { SimpleType: { name: 'int' } },
                                            initAST: {
                                                immediate: {
                                                    primiviteValue: 1
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
                                                variable: 'var',
                                                type: { SimpleType: { name: 'int' } },
                                                initAST: {
                                                    immediate: {
                                                        primiviteValue: 1
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
            variable: 'var',
            type: { SimpleType: { name: 'int', templateSpecialization: [{ SimpleType: { name: "int" } }, { SimpleType: { name: "int" } }] } }
        },
        b: {
            variable: 'var',
            initAST: {
                immediate: {
                    primiviteValue: 1
                }
            }
        },
        c: {
            variable: 'var',
            initAST: {
                immediate: {
                    functionValue: { _arguments: {}, body: [], retType: { SimpleType: { name: "int" } } },//空函数体(一行代码也没有),但是返回值类型已经声明为int了，在推导的时候应该报错
                }
            }
        },
    }
};