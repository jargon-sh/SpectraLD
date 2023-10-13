# SpectraLD 

A custom-rule linter for JSON-LD files, using the rule language of [spectral](https://github.com/stoplightio/spectral)
**
- **Custom Rulesets**: Create custom rules to lint JSON-LD **@graph** or **@context** files
- **Ready-to-use Rulesets**: Community driven interoperability rulesets for **Verifiable Credentials**

# Overview

- [🧰 Installation](#-installation)
- [💻 Usage](#-usage)
- [👏 Contributing](#-contributing)

## 🧰 Installation


```bash
git clone https://github.com/colugo/SpectraLD.git
cd SpectraLD
npm run build:cli
```


## 💻 Usage

### 0. Smokescreen test

Check the build worked with this:

```bash
node ./spectraLD.js -i samples/sample1.json -r samples/sample1.yml
```

Which should output the following:

```json
[
  {
    "code": "@context must have a version of 1.1",
    "message": "",
    "path": [ "@context", "@version" ],
    "severity": "warn"
  }
]
```


### 1. Create a local ruleset

Rulesets are written in YAML, and follow [spectral's structure](https://docs.stoplight.io/docs/spectral/01baf06bdd05a-create-a-ruleset)

**Note:** SpectraLD does not support Custom Functions

SpectraLD supports a subset of spectral's [Core Functions](https://docs.stoplight.io/docs/spectral/cb95cf0d26b83-core-functions), but not [schema, unreferencedReusableObject, xor, typedEnum]

### 2. Use SpectraLD specific Core Functions

#### equal

Checks the targetted value is equal `to` or `not` the provided value



NAME	DESCRIPTION	TYPE	REQUIRED?

| NAME | DESCRIPTION | TYPE | REQUIRED? |
| ---- | ----------- | ---- | --------- |
| to | value must match this | string | no |
| not | value must not match this | string | no |

Example

```yaml
@context must have a version of 1.1:
description: @context must have a version of 1.1 
severity: warn 
given: 
  - $.@context.*.@version
  - $.@context.@version
then: 
    function: equal 
    functionOptions:
      to: 1.1

```

### 3. Examine the results

SpectraLD will run the ruleset against the input and print the results to the console.
If there were any results with a severity of 'error', SpectraLD will return with a non-zero exit code. 

