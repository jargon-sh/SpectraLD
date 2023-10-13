import SpectraLD from './SpectraLD.js'

const commandLineArgs = require('command-line-args')
const commandLineUsage = require('command-line-usage')

const fs = require('fs')


const optionDefinitions = [
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        description: 'Display this usage guide.'
    },
    {
        name: 'input',
        alias: 'i',
        type: String,
        description: 'JSON-LD File path [Required]',
        required:true
    },
    {
        name: 'ruleset',
        alias: 'r',
        type: String,
        description: 'Ruleset File path [Required]',
        required:true
    }
]
function parseAndValidateArgs(){



    const options = commandLineArgs(optionDefinitions, { stopAtFirstUnknown: true })

    // fail if any unknown args
    if(options.hasOwnProperty('_unknown')){
        console.log('Invalid arguments:')
        console.log(options['_unknown'])
        console.log()
        showUsageAndExit()
    }

    // show options if no args, or help
    if (Object.keys(options).length == 0 || options.help) showUsageAndExit()

    // check all requireds
    var requireds = optionDefinitions.filter(x=>x.required == true).map(x=>x.name)
    for(var ir = 0; ir < requireds.length; ir++){
        var required = requireds[ir]
        if(!options.hasOwnProperty(required)){
            console.log('Missing required argument: ' + required)
            process.exit(22)
        }
    }

    return options
}

function showUsageAndExit(){
    const usage = commandLineUsage([
        {
            header: 'SpectraLD',
            content: 'A Linter and custom rule processor for JSON-LD'
        },
        {
            header: 'Example',
            content: 'node ./SpectraLD-cli.js -i context.jsonld -r ruleset.yml'
        },
        {
            header: 'Options',
            optionList: optionDefinitions
        },
        {
            content: 'Project home: {underline https://github.com/jargon-sh/spectrald}'
        }
    ])
    console.log(usage)
    process.exit(22)
}


function getStringFromFile(path, type){
    try{
        return fs.readFileSync(path,{ encoding: 'utf8', flag: 'r' });
    }catch(e){
        console.log(`Cannot open ${type} file: ${path}`)
        process.exit(2);
    }
}

async function runSpectraLD(){
    var options = parseAndValidateArgs()
    var input = getStringFromFile(options.input, "input")
    var ruleset = getStringFromFile(options.ruleset, "ruleset")

    try{
        var spectrald = new SpectraLD(ruleset)
        var errors = await spectrald.run(input)

        if(errors.length == 0){
            process.exit(0)
        }
        console.log(errors)


        var anyErrors = errors.filter(x=>x.severity == 'error').length != 0
        if(anyErrors) process.exit(1)
        process.exit(0)
    }catch(e){
        console.log('An error occured running SpectraLD. Your JSON-LD has not been linted.')
        console.log(e.message)
        process.exit(22)
    }
}

runSpectraLD()
