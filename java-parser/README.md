# Java Parser Service for AST Analysis

This service parses Java and Spark code to extract Abstract Syntax Tree (AST) information, identifying code structures, data sources, transformations, and sinks.

## Features

- Java code parsing using JavaParser
- Spark-specific pattern detection
- Data flow identification
- Output in JSON format

## Building

Build with Maven:

```bash
mvn clean package
```

This creates a JAR file with dependencies in the `target` directory: `java-parser-1.0-SNAPSHOT-jar-with-dependencies.jar`

## Usage

```bash
# Parse a single file
java -jar target/java-parser-1.0-SNAPSHOT-jar-with-dependencies.jar -f path/to/file.java

# Parse all Java files in a directory
java -jar target/java-parser-1.0-SNAPSHOT-jar-with-dependencies.jar -d path/to/directory

# Save output to a file
java -jar target/java-parser-1.0-SNAPSHOT-jar-with-dependencies.jar -d path/to/directory -o results.json
```

## Output Format

The parser outputs JSON with the following structure:

```json
[
  {
    "file": "/path/to/file.java",
    "package": "com.example",
    "imports": ["import java.util.List", "..."],
    "classes": [
      {
        "name": "ExampleClass",
        "isInterface": false,
        "extends": ["BaseClass"],
        "implements": ["Interface1", "Interface2"],
        "methods": [
          {
            "name": "methodName",
            "returnType": "String",
            "isPublic": true,
            "isStatic": false,
            "parameters": [
              {"name": "param1", "type": "int"}
            ],
            "body": "method body content...",
            "methodCalls": ["otherMethod", "..."],
            "variables": [
              {"name": "localVar", "type": "String", "initialValue": "\"value\""}
            ]
          }
        ],
        "fields": [
          {"name": "fieldName", "type": "int", "isPublic": false, "isStatic": false}
        ]
      }
    ],
    "sparkMetadata": {
      "sources": [
        {"type": "csv", "argument": "\"data.csv\"", "scope": "spark"}
      ],
      "transformations": [
        {"type": "filter", "arguments": ["col(\"age\").gt(20)"], "dataframe": "df"}
      ],
      "sinks": [
        {"type": "write", "arguments": [], "dataframe": "result"}
      ]
    }
  }
]
```