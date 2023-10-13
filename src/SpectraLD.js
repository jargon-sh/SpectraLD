import yaml from 'js-yaml'
import {JSONPath} from 'jsonpath-plus'

export default class SpectraLD{
    constructor(rulesetYAML, options){
        this.severities = ['error','warn','info','hint']
        this.rules = {}

        this.ruleset = yaml.load(SpectraLD.Sanitise(rulesetYAML))
        if(this.ruleset == null){
            this.ruleset = {rules:[]}
        }

        if(this.ruleset.rules == undefined) this.ruleset.rules = {}

        var givenRoots = Object.keys(this.ruleset)

        // Check for unknown tokens
        var allowedRoots = 'rules,extends'.split(',')
        var unallowedRoots = unallowable(allowedRoots, givenRoots)
        if(unallowedRoots.length != 0){
            throw {'message':`Unexpected token /${unallowedRoots[0]}`}
        }

        // Check for required tokens
        var requiredRoots = 'rules'.split(',')
        var missingRequiredRoots = required(requiredRoots, givenRoots)
        if(missingRequiredRoots.length != 0){
            throw {'message':`Missing required token /${missingRequiredRoots[0]}`}
        }


        var ruleNames = Object.keys(this.ruleset.rules)
        for(var irn = 0; irn < ruleNames.length; irn++){
            var ruleName = ruleNames[irn]
            this.rules[ruleName] = new Rule(ruleName, this.ruleset.rules[ruleName])
        }
    }

    // I'm not sure why, but sometimes JSONPath returns an array of JSON strings, not an array of JSON
    // this only happens with JSONLD
    static BackToJSON(thing){
        if(Array.isArray(thing)){
            var output = []
            for(var ia = 0; ia < thing.length; ia++){
                var thingA = thing[ia]
                if(typeof(thingA) == 'string'){
                    output.push(JSON.parse(thingA))
                }else{
                    output.push(thingA)
                }
            }
            return output
        }
        if(typeof(thing) == 'string') return JSON.parse(thing)
        return thing
    }

    static Sanitise(yaml){
        return yaml.replace(/@/g,'<<AT>>')
    }


    // js-yaml fails to parse yaml that has
    // any keys starting with @
    // @ is replaced with <<AT>> before parsing
    // and every field that might have had an @
    // uses this method to put it back again
    static ReplaceAts(theValue){
        if(theValue == undefined) return
        if(Array.isArray(theValue)){
            return theValue.map(x=>x.replace(/<<AT>>/g,'@'))
        }else{
            return theValue.replace(/<<AT>>/g,'@')
        }
        
    }


    // replace a known set of @-prepended strings
    // that have meaning in JSON-LD, but break
    // JSONPathPlus and need escaping
    static EscapeAtInPaths(given){
        if(Array.isArray(given)){
            return given.map(x=>SpectraLD._EscapeAtInPaths(x))
        }else{
            return SpectraLD._EscapeAtInPaths(given)
        }
    }


    static _EscapeAtInPaths(given){
        var knownEscapes = [
            '@base',
            '@container',
            '@context',
            '@direction',
            '@graph',
            '@id',
            '@import',
            '@included',
            '@index',
            '@json',
            '@language',
            '@list',
            '@nest',
            '@none',
            '@prefix',
            '@propagate',
            '@protected',
            '@reverse',
            '@set',
            '@type',
            '@value',
            '@version',
            '@vocab'
        ]
        var chunks = given.split('.')
        var replaced = []
        for(var ic = 0; ic < chunks.length; ic++){
            var chunk = chunks[ic]
            if(knownEscapes.indexOf(chunk) != -1){
                //replaced.push("['`" + chunk + "']")
                replaced.push(`\`${chunk}`)
            }else{
                replaced.push(chunk)
            }
        }
        return replaced.join('.')
    }
    run(json){
        try{JSON.parse(json)}catch(e){throw {message:"Input document is not JSON"}}
        const p = new Promise((resolve, reject) => {
            var ruleNames = Object.keys(this.rules)
            var errors = []
            for(var irn = 0; irn < ruleNames.length; irn++){
                var rule = this.rules[ruleNames[irn]]

                if(rule.type != 'rule') continue


                var givens = rule.given 
                if(typeof(rule.given) == 'string'){
                    givens = [rule.given]
                }

                for(var ig = 0; ig < givens.length; ig++){
                    var given = givens[ig]
                    // get the details from the jsonpath
                    var pointedTos = JSONPath({resultType:'value',path: given, json:SpectraLD.BackToJSON(json)})
                    var paths = JSONPath({resultType:'path',path: given, json:SpectraLD.BackToJSON(json)});

                    for(var ipt = 0; ipt<pointedTos.length; ipt++){
                        var to = pointedTos[ipt]
                        var path = paths[ipt]

                        for(var ith = 0; ith < rule.thens.length; ith++){
                            var then = rule.thens[ith]

                            var target = to
                            if(then.field){
                                // target is an array, so I think taking the first one is what I want
                                target = JSONPath({path:SpectraLD.EscapeAtInPaths('$.' + then.field), json:to})[0]
                                if(target == undefined){
                                    target = to[then.field]
                                }
                            }

                            var didPass = then.functionPointer.function(target,then.functionOptions)
                            if(!didPass){
                                var newError = {
                                    code: rule.name,
                                    message: rule.expandMessage(rule.severity, this.convertPath(path), target),
                                    path: this.convertPath(path),
                                    severity: rule.severity
                                }
                                if(!errors.map(x=>JSON.stringify(x)).includes(JSON.stringify(newError))) errors.push(newError)

                            }
                        }
                    }
                }
            }
            resolve(errors);
        });
        return p
    }

    convertPath(path){
        return path.slice(3, -2).split("][").map(x=>x.startsWith("'")?x.substr(1):x).map(x=>x.endsWith("'")?x.substring(0,x.length-1):x).map(x=>!isNaN(Number(x))?Number(x):x) 
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function required(required, given){
    return required.filter(x => !given.includes(x))
}
function unallowable(allowed, given){
    return given.filter(x => !allowed.includes(x))
}

function checkFunctionOptions(allowed, functionOptions, options = {}){
    var objName = 'functionOptions'
    if(options.name) objName = options.name
    if(functionOptions == undefined) throw {message : `Missing required ${objName}`}    
    var keys = Object.keys(functionOptions)
    for(var ik = 0; ik < keys.length; ik ++){
        var key = keys[ik]
        if(!allowed.includes(key)) throw {message:`Unexpected ${objName}: ${key}. Allowed values: (${allowed.join('|')})`}
    }
}


var Functions = {
    'alphabetical':{
        'validate':function(functionOptions){
            var allowedOptions = 'keyedBy'.split(',')
            if(functionOptions != undefined) checkFunctionOptions(allowedOptions, functionOptions)
        },
        'function':function(input, functionOptions){
            var keyArray = []

            if(input.length == 0) return true

            if(!Array.isArray(input)) return true

            if(typeof(input[0]) == 'object'){
                var keyedBy = functionOptions.keyedBy 
                if(keyedBy == undefined) throw {message: 'keyedBy is needed when input is an array of objects'} 
                keyArray = input.map(x=>x[keyedBy])
            }else{
                keyArray = input
            }

            if(keyArray.length <= 1) return true
            var element = keyArray.shift()
            for(var i = 0; i < keyArray.length; i++){
                var compareTo = keyArray[i]
                if(element.localeCompare(compareTo) > 0) return false
                element = compareTo
            }
            return true

        }
    },
    'casing':{
        'cases':{
            'flat':  '[a-z][a-z{__DIGITS__}]*',
            'pascal':'[A-Z][a-z{__DIGITS__}]*(?:[A-Z{__DIGITS__}](?:[a-z{__DIGITS__}]+|$))*',
            'camel':'[a-z][a-z{__DIGITS__}]*(?:[A-Z{__DIGITS__}](?:[a-z{__DIGITS__}]+|$))*',
            'kebab': '[a-z][a-z{__DIGITS__}]*(?:-[a-z{__DIGITS__}]+)*',
            'cobol': '[A-Z][A-Z{__DIGITS__}]*(?:-[A-Z{__DIGITS__}]+)*',
            'snake': '[a-z][a-z{__DIGITS__}]*(?:_[a-z{__DIGITS__}]+)*',
            'macro': '[A-Z][A-Z{__DIGITS__}]*(?:_[A-Z{__DIGITS__}]+)*'

        },
        'validate':function(functionOptions){
            var allowedOptions = 'type'.split(',')
            checkFunctionOptions(allowedOptions, functionOptions)
            
            if(!functionOptions.hasOwnProperty('type')) throw {message: 'Missing required type funtionOption'}
            if(!this.cases.hasOwnProperty(functionOptions.type)) throw {message: `Invalid type value: ${functionOptions.type}. Valid values: (${Object.keys(this.cases).join('|')})`}


        },
        'function':function(input, functionOptions){
            if(input == undefined) return true 
            var disallowDigits = false
            var DIGITS_PATTERN = '0-9'
            var separatorChar = ''
            var allowLeading = false


            var base = this.cases[functionOptions.type]
            var pattern = base.replace(/\{__DIGITS__\}/g, !disallowDigits? DIGITS_PATTERN : '');
            var separatorPattern = `[${escapeRegExp(separatorChar)}]`;
            var leadingSeparatorPattern = allowLeading === true ? `${separatorPattern}?` : '';

            var regex = new RegExp(`^${leadingSeparatorPattern}${pattern}(?:${separatorPattern}${pattern})*$`);
            return input.match(regex) != null;
            

        }
    },
    'defined':{
        'validate':function(functionOptions){
            if(functionOptions != undefined) throw {message : 'Unexpected functionOptions'}    
        },
        'function':function(input, functionOptions){
            return input != undefined 
        }
    },
    'enumeration':{
        'validate':function(functionOptions){
            var allowedOptions = 'values'.split(',')
            checkFunctionOptions(allowedOptions, functionOptions)
            if(!Array.isArray(functionOptions['values'])) throw {message: ' functionOptions/values is not an Array'}
        },
        'function':function(input, functionOptions){
            return functionOptions.values.indexOf(input) != -1 
        }
    },
    'length':{
        'validate':function(functionOptions){
            var allowedOptions = 'min,max'.split(',')
            checkFunctionOptions(allowedOptions, functionOptions)
            if(functionOptions.max){
                if(isNaN(parseInt(functionOptions.max))) throw {message: 'max evaluates to NaN'}
            }
            if(functionOptions.min){
                if(isNaN(functionOptions.min)) throw {message: 'min evaluates to NaN'}
            }
            if(Object.keys(functionOptions).length < 1) throw {message:'need to provide at least min or max'}
        },
        'function':function(input, functionOptions){
            var min = 0
            var max = 9999999
            if(functionOptions.min){
                min = parseInt(functionOptions.min)
            }
            if(functionOptions.max){
                max = parseInt(functionOptions.max)
            }

            if(input.length < min) return false
            if(input.length > max) return false
            return true

        }
    },
    'equal':{
        'validate':function(functionOptions){
            var allowedOptions = 'to,not'.split(',')
            checkFunctionOptions(allowedOptions, functionOptions)
        },
        'function':function(input, functionOptions){
            if(functionOptions.to){
                if(input == undefined) return false
                return input === functionOptions.to
            }
            if(functionOptions.not){
                if(input == undefined) return true
                var regex = Functions.pattern.createRegexp(functionOptions.notMatch)
                return input.match(regex) == null;
            }
        }
    },
    'pattern':{
        'regexp': /^\/(.+)\/([a-z]*)$/,
        'createRegexp': function(pattern){
            const splitRegex = Functions.pattern.regexp.exec(pattern);
              if (splitRegex !== null) {
                return new RegExp(splitRegex[1], splitRegex[2]);
              } else {
                return new RegExp(pattern);
              }
        },
        'validate':function(functionOptions){
            var allowedOptions = 'match,notMatch'.split(',')
            checkFunctionOptions(allowedOptions, functionOptions)
        },
        'function':function(input, functionOptions){
            if(functionOptions.match){
                if(input == undefined) return false
                var regex = Functions.pattern.createRegexp(functionOptions.match)
                return input.match(regex) != null;
            }
            if(functionOptions.notMatch){
                if(input == undefined) return true
                var regex = Functions.pattern.createRegexp(functionOptions.notMatch)
                return input.match(regex) == null;
            }
        }
    },
    'falsy':{
        'validate':function(functionOptions){
            if(functionOptions != undefined) throw {message : 'Unexpected functionOptions'}    
        },
        'function':function(input, functionOptions){
            return Boolean(input) != true
        }
    },
    'truthy':{
        'validate':function(functionOptions){
            if(functionOptions != undefined) throw {message : 'Unexpected functionOptions'}    
        },
        'function':function(input, functionOptions){
            return Boolean(input) == true
        }
    },
    'undefined':{
        'validate':function(functionOptions){
            if(functionOptions != undefined) throw {message : 'Unexpected functionOptions'}    
        },
        'function':function(input, functionOptions){
            return input == undefined 
        }
    },

}


class Rule{
    constructor(name, json){
        this.name = SpectraLD.ReplaceAts(name)
        this.type = undefined
        if(typeof(json) == 'boolean'){
            this.type = 'skip'
            return
        }
        if(typeof(json) == 'object'){
            this.json = json
            this.type = 'rule'

            var propertyNames = Object.keys(this.json)

            // Check for missing required
            var requiredPropertyNames = 'given,then'.split(',')
            var missingRequiredProperties = required(requiredPropertyNames, propertyNames)
            if(missingRequiredProperties.length != 0){
                throw {'message':`Missing required token /rules/${this.name}/${missingRequiredProperties[0]}`}
            }

            this.given = SpectraLD.EscapeAtInPaths(SpectraLD.ReplaceAts(json.given))
            if(typeof(this.given) == 'object' && !Array.isArray(this.given)) throw new {message:`Invalid given /rules/${this.name}/given`}


            this.message  = (json.message == undefined) ? '' : json.message;
            this.description = (json.description == undefined) ? '' : json.description;
            this.severity = (json.severity == undefined) ? 'warn' : json.severity;
            

            this.parseThen(json['then'])

            delete this.json
        }
    }

    expandMessage(error, path, value){

        var property = ''
        try{
            property = path[path.length -2]
        }catch(e){}

        /*
         {{error}} - the error returned by function
         {{description}} - the description set on the rule
         {{path}} - the whole error path
         {{property}} - the last segment of error path
         {{value}} - the linted value
         */


        if(typeof(value) == 'object') value = JSON.stringify(value)

        return this.message.replace(/\{\{error\}\}/g,error)
                           .replace(/\{\{description\}\}/g, this.description)
                           .replace(/\{\{path\}\}/g,path.join('.'))
                           .replace(/\{\{property\}\}/g,property)
                           .replace(/\{\{value\}\}/g,value)
    }

    parseThen(jsonArray){
        this.thens = []
        if(!Array.isArray(jsonArray)) jsonArray = [jsonArray]
        for(var ija = 0; ija < jsonArray.length; ija++){
            var json = jsonArray[ija]
            var then = {}

            var propertyNames = Object.keys(json)
            then.functionOptions = {}

            // Check for unknown
            var allowablePropertyNames = 'field,function,functionOptions'.split(',')
            var unallowedProperties = unallowable(allowablePropertyNames, propertyNames)
            if(unallowedProperties.length != 0){
                throw {'message':`Unexpected token /rules/${this.name}/then/${unallowedProperties[0]}`}
            }

            // Check for missing required
            var requiredPropertyNames = 'function'.split(',')
            var missingRequiredProperties = required(requiredPropertyNames, propertyNames)
            if(missingRequiredProperties.length != 0){
                throw {'message':`Missing required token /rules/${this.name}/then/${missingRequiredProperties[0]}`}
            }

            // Check function exists
            if(!Functions.hasOwnProperty(json.function)){
                throw {'message':`Unknown Function ${json.function} /rules/${this.name}/then/function`}
            }


            then.functionPointer = Functions[json.function]
            try{
                then.functionPointer.validate(json.functionOptions)
                then.functionOptions = json.functionOptions
                then.field = SpectraLD.ReplaceAts(json.field)
            }catch(e){
                throw {'message':`Function configuration error: '${e.message}' /rules/${this.name}/then`}
            }

            this.thens.push(then)
        }
    }
}
