import SpectraLD from './SpectraLD.js'
describe('SpectraLD tests', () => {


    test('Can expand @graph @context, etc in givens', () => {
        expect(SpectraLD.EscapeAtInPaths('$.@context')).toEqual("$.`@context")
        expect(SpectraLD.EscapeAtInPaths('$..@context')).toEqual("$..`@context")
        expect(SpectraLD.EscapeAtInPaths('$.@graph')).toEqual("$.`@graph")
        expect(SpectraLD.EscapeAtInPaths(['$..@graph'])).toEqual(["$..`@graph"])
    })

    test('Can replace @ back from escaped', () => {
        expect(SpectraLD.ReplaceAts('$.<<AT>>context')).toEqual("$.@context")
        expect(SpectraLD.ReplaceAts(['$.<<AT>>context'])).toEqual(["$.@context"])
    })

    test('Validates root properties', () => {
        var rule = `
unexpectedRoot: 4
rules:
  adidas-paths-kebab-case:
    description: All YAML/JSON paths MUST follow kebab-case
        `
        expect(() => {
            new SpectraLD(rule)
        }).toThrow({
            'message':'Unexpected token /unexpectedRoot'
        })
    })
    
    test('Can check @context version = 1.1', async () => {
        var rule = `
rules:

  @context must have a version of 1.1:
    description: @context must have a version of 1.1 
    severity: error 
    given: 
      - $.@context.*.@version
      - $.@context.@version
    then: 
        function: equal 
        functionOptions:
          to: 1.1
        `

        var spectraLD = new SpectraLD(rule)
        var errors = await spectraLD.run(jargon)
        expect(errors).toEqual([])
        errors = await spectraLD.run(sample)
        expect(errors).toEqual([])
    })

    test('Can check @context version != 1.1', async () => {
        var rule = `
rules:

  @context must have a version of 1.1:
    description: @context must have a version of 1.1 
    severity: error 
    given: 
      - $.@context.*.@version
      - $.@context.@version

    then: 
        function: equal 
        functionOptions:
          to: 1.2
        `

        var spectraLD = new SpectraLD(rule)
        var errors = await spectraLD.run(sample)
        expect(errors).toEqual([
            {
                code: "@context must have a version of 1.1",
                message: "",
                "path": ["@context",0,"@version"],
                severity: "error"
            }
        ])
        errors = await spectraLD.run(jargon)
        expect(errors).toEqual([
            {
                code: "@context must have a version of 1.1",
                message: "",
                "path": ["@context","@version"],
                severity: "error"
            }
        ])
    })

    test('Defined function', async () => {
        var rule = `
rules:

  Defined @version:
    severity: error 
    given: $.@context
    then: 
        field: @version 
        function: defined 
        `

        var spectraLD = new SpectraLD(rule)
        var errors = await spectraLD.run(jargon)
        expect(errors).toEqual([])
    })

    test('!Defined function', async () => {
        var rule = `
rules:

  fail-no-@graph:
    severity: error 
    given: $.@context
    then: 
        field: @graph
        function: defined 
        `

        var spectraLD = new SpectraLD(rule)
        var errors = await spectraLD.run(jargon)
        expect(errors).toEqual([
            {
                "code": "fail-no-@graph",
                "message": "",
                "path": [
                    "@context"
                ],
                "severity": "error",
            },
        ])
    })

    test('Unefined function', async () => {
        var rule = `
rules:

  Undefined @graph:
    severity: error 
    given: $.@context
    then: 
        field: @graph
        function: undefined 
        `

        var spectraLD = new SpectraLD(rule)
        var errors = await spectraLD.run(jargon)
        expect(errors).toEqual([])
    })

    test('!Unefined function', async () => {
        var rule = `
rules:

  fail-with-@version:
    severity: error 
    given: $.@context
    then: 
        field: @version
        function: undefined 
        `

        var spectraLD = new SpectraLD(rule)
        var errors = await spectraLD.run(jargon)
        expect(errors).toEqual([
            {
                "code": "fail-with-@version",
                "message": "",
                "path": [
                    "@context"
                ],
                "severity": "error",
            },
        ])
    })

    test('Supports multiple fields', async () => {
        var rule = `
rules:

  Check @id and type of Person: 
    severity: error 
    given: 
      - $.@context.Person.@context.name
    then: 
        - field: @id
          function: equal 
          functionOptions:
            to: https://jargon.sh/user/test/Test/v/working/artefacts/jsonld/test.jsonld#Person.name 
        - field: @type
          function: equal
          functionOptions:
            to: xsd:string
        `

        var spectraLD = new SpectraLD(rule)
        var errors = await spectraLD.run(jargon)
        expect(errors).toEqual([])
    })


    test('Checks for valid functions', () => {

        var rule = `
rules:

  fail-invalid-function:
    severity: warn
    given: $
    then:
      function: fakepattern
      functionOptions:
        match: ".*"
        `

        expect(() => {
            new SpectraLD(rule)
        }).toThrow({
            'message':'Unknown Function fakepattern /rules/fail-invalid-function/then/function'
        })
    })


    test('Can validate functionOptions', () => {

        var rule = `
rules:
  fail-invalid-functionoptions:
    severity: warn
    given: $
    then:
      function: pattern

        `

        expect(() => {
            new SpectraLD(rule)
        }).toThrow({
            "message": "Function configuration error: 'Missing required functionOptions' /rules/fail-invalid-functionoptions/then"

        })
    })

    test('Check validates function option values', () => {

        var rule = `
rules:

  fail-invalid-functionoptions-value:
    severity: error 
    given: $
    then: 
        function: enumeration
        functionOptions:
            values2:
        `

        expect(() => {
            new SpectraLD(rule)
        }).toThrow({
            "message": "Function configuration error: 'Unexpected functionOptions: values2. Allowed values: (values)' /rules/fail-invalid-functionoptions-value/then"


        })
    })




    var jargon = `{
  "@context": {
    "@version": 1.1,
    "@vocab": "#",
    "schema": "https://schema.org",
    "Person": {
      "@id": "https://jargon.sh/user/test/Test/v/working/artefacts/jsonld/test.jsonld#Person",
      "@context": {
        "@version": 1.1,
        "name": {
          "@id": "https://jargon.sh/user/test/Test/v/working/artefacts/jsonld/test.jsonld#Person.name",
          "@type": "xsd:string"
        }
      }
    }
  }
}
`

    var sample = `
{
  "@context": [
    {
      "@version": 1.1
    },
    "https://www.w3.org/ns/odrl.jsonld",
    {
      "issuedBy": {
        "@id": "xsd:string",
        "@context": {
          "name": "xsd:string"
        }
      },
      "product": {
        "@id": "xsd:string",
        "@context": {
          "productId": "xsd:string",
          "productClass": "xsd:string",
          "weight": "xsd:string",
          "image": "xsd:string",
          "description": "xsd:string",
          "manufacturer": {
            "@id": "xsd:string",
            "@context": {
              "name": "xsd:string"
            }
          }
        }
      },
      "batch": {
        "@id": "xsd:string",
        "@context": {
          "batchId": "xsd:string",
          "manufacturedAt": {
            "@id": "xsd:string",
            "@context": {
              "name": "xsd:string"
            }
          },
          "operatedBy": {
            "@id": "xsd:string",
            "@context": {
              "name": "xsd:string"
            }
          },
          "manufacturedDate": "xsd:string",
          "batchQrCode": "xsd:string",
          "provenance": {
            "@id": "xsd:string",
            "@container": "@list",
            "@context": [
              {
                "@id": "xsd:string",
                "@context": {
                  "country": "xsd:string",
                  "percentage": "xsd:integer"
                }
              }
            ]
          },
          "sustainabilityInfo": {
            "@id": "xsd:string",
            "@container": "@list",
            "@context": [
              {
                "@id": "xsd:string",
                "@context": {
                  "Topic": "xsd:string",
                  "Criteria": "xsd:string",
                  "Evidence": "xsd:string",
                  "metric": {
                    "@id": "xsd:string",
                    "@container": "@list",
                    "@context": [
                      {
                        "@id": "xsd:string",
                        "@context": {
                          "Metric": "xsd:string",
                          "Value": "xsd:integer",
                          "Unit": "xsd:string"
                        }
                      }
                    ]
                  },
                  "compliance": "xsd:boolean"
                }
              }
            ]
          },
          "traceabilityInfo": {
            "@id": "xsd:string",
            "@container": "@list",
            "@context": [
              {
                "@id": "xsd:string",
                "@context": {
                  "EventReference": "xsd:string",
                  "EventType": "xsd:string"
                }
              }
            ]
          }
        }
      },
      "sustainabilityScore": "xsd:integer",
      "trustScore": "xsd:integer"
    }
  ]
}
`

})
