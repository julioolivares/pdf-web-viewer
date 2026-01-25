const { default: typescript } = require('@rollup/plugin-typescript')
const { default: dts } = require('rollup-plugin-dts')
const isDevelopment = process.env.NODE_ENV === 'development'
const terser = require('@rollup/plugin-terser')

const watch = {
    exclude: 'node_modules/**',
    clearScreen: false,
    include: 'src/**/*.ts'
}
const plugins = [typescript()]
const external = []
const onwarn = (warning, warn) => {

    // Si el warning es sobre dependencias no resueltas, lanzar un error
    if (warning.code === 'UNRESOLVED_IMPORT') {
        console.error(warning)
        throw new Error(
            `Dependencia no resuelta: ${warning.exporter}: \n ${warning.message}`
        );
    }

    warn(warning);
}

if (!isDevelopment) {
    plugins.push(terser({ format: { comments: false }, compress: { drop_console: !isDevelopment, drop_debugger: !isDevelopment } })
    )
}

module.exports = [
    {
        input: './src/index.ts',
        output: [
            {
                file: 'dist/index.mjs',
                format: 'esm',
                sourcemap: isDevelopment ? 'inline' : false,
                compact: true,
                inlineDynamicImports: true,

                globals: {},
            },
            {
                file: `dist/index.umd.js`,
                format: 'umd',
                sourcemap: (isDevelopment) ? true : false,
                name: 'PdfViewer',
                compact: true,
                globals: {},
            },
        ],
        plugins,
        external,
        watch,
        onwarn
    },

    // Type declarations
    {
        input: './src/index.ts',
        output: {
            file: 'dist/index.d.ts',
            format: 'es'
        },
        plugins: [dts({
            respectExternal: false
        })],
        external
    }
]
