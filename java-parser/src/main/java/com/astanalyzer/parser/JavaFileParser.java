package com.astanalyzer.parser;

import com.github.javaparser.JavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.VariableDeclarator;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;

import java.io.File;
import java.io.FileInputStream;
import java.util.*;

/**
 * Parses Java files and extracts class, method, variable, and method call information.
 */
public class JavaFileParser {

    /**
     * Parse a Java file and extract metadata.
     * 
     * @param file The Java file to parse
     * @return A map containing metadata about the file
     */
    public Map<String, Object> parseFile(File file) {
        try (FileInputStream in = new FileInputStream(file)) {
            CompilationUnit cu = new JavaParser().parse(in).getResult().orElseThrow();
            
            Map<String, Object> fileMetadata = new HashMap<>();
            fileMetadata.put("file", file.getAbsolutePath());
            
            // Extract package info
            cu.getPackageDeclaration().ifPresent(
                packageDecl -> fileMetadata.put("package", packageDecl.getNameAsString())
            );
            
            // Extract imports
            List<String> imports = new ArrayList<>();
            cu.getImports().forEach(importDecl -> imports.add(importDecl.getNameAsString()));
            fileMetadata.put("imports", imports);
            
            // Extract classes
            List<Map<String, Object>> classes = new ArrayList<>();
            cu.findAll(ClassOrInterfaceDeclaration.class).forEach(classDecl -> {
                Map<String, Object> classInfo = new HashMap<>();
                classInfo.put("name", classDecl.getNameAsString());
                classInfo.put("isInterface", classDecl.isInterface());
                
                // Get superclass and interfaces
                List<String> extensions = new ArrayList<>();
                classDecl.getExtendedTypes().forEach(ext -> extensions.add(ext.getNameAsString()));
                classInfo.put("extends", extensions);
                
                List<String> interfaces = new ArrayList<>();
                classDecl.getImplementedTypes().forEach(impl -> interfaces.add(impl.getNameAsString()));
                classInfo.put("implements", interfaces);
                
                // Get methods
                List<Map<String, Object>> methods = new ArrayList<>();
                classDecl.findAll(MethodDeclaration.class).forEach(methodDecl -> {
                    Map<String, Object> methodInfo = new HashMap<>();
                    methodInfo.put("name", methodDecl.getNameAsString());
                    methodInfo.put("returnType", methodDecl.getTypeAsString());
                    methodInfo.put("isPublic", methodDecl.isPublic());
                    methodInfo.put("isStatic", methodDecl.isStatic());
                    
                    // Get parameters
                    List<Map<String, Object>> parameters = new ArrayList<>();
                    methodDecl.getParameters().forEach(param -> {
                        Map<String, Object> paramInfo = new HashMap<>();
                        paramInfo.put("name", param.getNameAsString());
                        paramInfo.put("type", param.getTypeAsString());
                        parameters.add(paramInfo);
                    });
                    methodInfo.put("parameters", parameters);
                    
                    // Get method body if available
                    methodDecl.getBody().ifPresent(body -> {
                        methodInfo.put("body", body.toString());
                        
                        // Get method calls
                        List<String> methodCalls = new ArrayList<>();
                        body.findAll(MethodCallExpr.class).forEach(call -> {
                            methodCalls.add(call.getNameAsString());
                        });
                        methodInfo.put("methodCalls", methodCalls);
                        
                        // Get variables
                        List<Map<String, Object>> variables = new ArrayList<>();
                        body.findAll(VariableDeclarator.class).forEach(var -> {
                            Map<String, Object> varInfo = new HashMap<>();
                            varInfo.put("name", var.getNameAsString());
                            varInfo.put("type", var.getTypeAsString());
                            var.getInitializer().ifPresent(init -> varInfo.put("initialValue", init.toString()));
                            variables.add(varInfo);
                        });
                        methodInfo.put("variables", variables);
                    });
                    
                    methods.add(methodInfo);
                });
                classInfo.put("methods", methods);
                
                // Get class variables
                List<Map<String, Object>> fields = new ArrayList<>();
                classDecl.getFields().forEach(field -> {
                    field.getVariables().forEach(var -> {
                        Map<String, Object> fieldInfo = new HashMap<>();
                        fieldInfo.put("name", var.getNameAsString());
                        fieldInfo.put("type", var.getTypeAsString());
                        fieldInfo.put("isPublic", field.isPublic());
                        fieldInfo.put("isStatic", field.isStatic());
                        var.getInitializer().ifPresent(init -> fieldInfo.put("initialValue", init.toString()));
                        fields.add(fieldInfo);
                    });
                });
                classInfo.put("fields", fields);
                
                classes.add(classInfo);
            });
            fileMetadata.put("classes", classes);
            
            return fileMetadata;
        } catch (Exception e) {
            Map<String, Object> errorMetadata = new HashMap<>();
            errorMetadata.put("file", file.getAbsolutePath());
            errorMetadata.put("error", e.getMessage());
            return errorMetadata;
        }
    }
}