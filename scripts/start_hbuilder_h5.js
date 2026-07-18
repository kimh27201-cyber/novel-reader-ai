const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const hbuilderRoot = process.env.HBUILDER_ROOT || 'D:\\HBuilderX'
const uniCliRoot = path.join(hbuilderRoot, 'plugins', 'uniapp-cli')
const uniCli = path.join(uniCliRoot, 'bin', 'uniapp-cli.js')
const port = process.env.H5_PORT || '8080'
const host = process.env.H5_HOST || '127.0.0.1'

process.env.NODE_ENV = 'development'
process.env.UNI_PLATFORM = 'h5'
process.env.UNI_INPUT_DIR = projectRoot
process.env.UNI_OUTPUT_DIR = path.join(projectRoot, 'unpackage', 'dist', 'dev', 'h5')
process.env.VUE_CLI_CONTEXT = uniCliRoot

process.chdir(uniCliRoot)
process.argv = [process.execPath, uniCli, '--auto-port', port, '--auto-host', host]
require(uniCli)
