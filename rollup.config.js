import pkg from './package.json';
import babel from 'rollup-plugin-babel';
import { terser } from "rollup-plugin-terser";
import json from 'rollup-plugin-json';

export default [
    {
        input: 'src/scatter.js',
        external: Object.keys(pkg.dependencies),
        output: [
            { file: pkg.main, format: 'es' },
            { file: pkg.module, format: 'cjs' }
        ],
        plugins:[
            json({}),
            // terser({
            //     ecma:5
            // }),
            babel({
                "presets": [
                    [
                        "es2015",
                        {
                            "modules": false
                        }
                    ]
                ],
                "plugins": [
                    "external-helpers"
                ],
                babelrc: false
            })
        ]
    }
];