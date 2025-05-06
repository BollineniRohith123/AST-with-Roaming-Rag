package com.astanalyzer.parser;

import com.github.javaparser.JavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.expr.NameExpr;
import com.github.javaparser.ast.expr.VariableDeclarationExpr;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;

import java.io.File;
import java.io.FileInputStream;
import java.util.*;

/**
 * Parser for Spark-specific code patterns.
 */
public class SparkParser {

    private static final Set<String> SPARK_SOURCES = new HashSet<>(Arrays.asList(
            "read", "readStream", "readText", "csv", "json", "parquet", "orc", "jdbc"
    ));
    
    private static final Set<String> SPARK_TRANSFORMS = new HashSet<>(Arrays.asList(
            "select", "filter", "where", "groupBy", "agg", "join", "withColumn", "map", 
            "flatMap", "reduce", "transform", "sort", "orderBy", "limit", "dropDuplicates",
            "union", "intersect", "subtract", "cache", "persist", "unpersist", "repartition",
            "coalesce", "sample", "rdd", "toDF", "createOrReplaceTempView", "window"
    ));
    
    private static final Set<String> SPARK_SINKS = new HashSet<>(Arrays.asList(
            "write", "writeStream", "save", "saveAsTable", "insertInto", "csv", "json", "parquet", 
            "orc", "jdbc", "text", "format", "mode", "option", "options", "partitionBy", "bucketBy"
    ));
    
    /**
     * Check if a file contains Spark code.
     */
    public boolean isSparkFile(File file) {
        try (FileInputStream in = new FileInputStream(file)) {
            CompilationUnit cu = new JavaParser().parse(in).getResult().orElseThrow();
            
            // Check for Spark imports
            for (var importDecl : cu.getImports()) {
                String importName = importDecl.getNameAsString();
                if (importName.startsWith("org.apache.spark") || 
                    importName.contains("SparkSession") ||
                    importName.contains("DataFrame") ||
                    importName.contains("Dataset")) {
                    return true;
                }
            }
            
            // Check for Spark API usage
            SparkUsageVisitor visitor = new SparkUsageVisitor();
            cu.accept(visitor, null);
            return visitor.hasSparkCode();
            
        } catch (Exception e) {
            return false;
        }
    }
    
    /**
     * Parse a Spark file to extract Spark-specific metadata.
     */
    public Map<String, Object> parseSparkFile(File file) {
        try (FileInputStream in = new FileInputStream(file)) {
            CompilationUnit cu = new JavaParser().parse(in).getResult().orElseThrow();
            
            Map<String, Object> sparkMetadata = new HashMap<>();
            
            // Extract data sources
            DataSourceVisitor sourceVisitor = new DataSourceVisitor();
            cu.accept(sourceVisitor, null);
            sparkMetadata.put("sources", sourceVisitor.getSources());
            
            // Extract transformations
            TransformationVisitor transformVisitor = new TransformationVisitor();
            cu.accept(transformVisitor, null);
            sparkMetadata.put("transformations", transformVisitor.getTransformations());
            
            // Extract data sinks
            DataSinkVisitor sinkVisitor = new DataSinkVisitor();
            cu.accept(sinkVisitor, null);
            sparkMetadata.put("sinks", sinkVisitor.getSinks());
            
            return sparkMetadata;
        } catch (Exception e) {
            Map<String, Object> errorMetadata = new HashMap<>();
            errorMetadata.put("error", e.getMessage());
            return errorMetadata;
        }
    }
    
    private static class SparkUsageVisitor extends VoidVisitorAdapter<Void> {
        private boolean hasSparkCode = false;
        
        @Override
        public void visit(MethodCallExpr n, Void arg) {
            String methodName = n.getNameAsString();
            
            // Check if method is a common Spark API call
            if (SPARK_SOURCES.contains(methodName) || SPARK_TRANSFORMS.contains(methodName) || 
                SPARK_SINKS.contains(methodName) || methodName.equals("builder") || 
                methodName.equals("getOrCreate") || methodName.equals("sparkContext")) {
                hasSparkCode = true;
            }
            
            super.visit(n, arg);
        }
        
        @Override
        public void visit(VariableDeclarationExpr n, Void arg) {
            n.getVariables().forEach(var -> {
                String type = var.getTypeAsString();
                if (type.contains("SparkSession") || type.contains("DataFrame") || 
                    type.contains("Dataset") || type.contains("RDD")) {
                    hasSparkCode = true;
                }
            });
            
            super.visit(n, arg);
        }
        
        public boolean hasSparkCode() {
            return hasSparkCode;
        }
    }
    
    private static class DataSourceVisitor extends VoidVisitorAdapter<Void> {
        private final List<Map<String, Object>> sources = new ArrayList<>();
        
        @Override
        public void visit(MethodCallExpr n, Void arg) {
            String methodName = n.getNameAsString();
            
            if (SPARK_SOURCES.contains(methodName)) {
                Map<String, Object> source = new HashMap<>();
                source.put("type", methodName);
                
                // Extract options and path if available
                n.getArguments().forEach(argExpr -> {
                    source.put("argument", argExpr.toString());
                });
                
                // Try to find the variable this source is assigned to
                Optional<NameExpr> scope = n.getScope().map(s -> s instanceof NameExpr ? (NameExpr) s : null)
                        .filter(Objects::nonNull);
                
                scope.ifPresent(s -> source.put("scope", s.getNameAsString()));
                
                sources.add(source);
            }
            
            super.visit(n, arg);
        }
        
        public List<Map<String, Object>> getSources() {
            return sources;
        }
    }
    
    private static class TransformationVisitor extends VoidVisitorAdapter<Void> {
        private final List<Map<String, Object>> transformations = new ArrayList<>();
        
        @Override
        public void visit(MethodCallExpr n, Void arg) {
            String methodName = n.getNameAsString();
            
            if (SPARK_TRANSFORMS.contains(methodName)) {
                Map<String, Object> transform = new HashMap<>();
                transform.put("type", methodName);
                
                // Extract arguments
                List<String> args = new ArrayList<>();
                n.getArguments().forEach(argExpr -> args.add(argExpr.toString()));
                transform.put("arguments", args);
                
                // Get the dataframe this is called on
                Optional<NameExpr> scope = n.getScope().map(s -> s instanceof NameExpr ? (NameExpr) s : null)
                        .filter(Objects::nonNull);
                
                scope.ifPresent(s -> transform.put("dataframe", s.getNameAsString()));
                
                transformations.add(transform);
            }
            
            super.visit(n, arg);
        }
        
        public List<Map<String, Object>> getTransformations() {
            return transformations;
        }
    }
    
    private static class DataSinkVisitor extends VoidVisitorAdapter<Void> {
        private final List<Map<String, Object>> sinks = new ArrayList<>();
        
        @Override
        public void visit(MethodCallExpr n, Void arg) {
            String methodName = n.getNameAsString();
            
            if (SPARK_SINKS.contains(methodName)) {
                Map<String, Object> sink = new HashMap<>();
                sink.put("type", methodName);
                
                // Extract arguments/options
                List<String> args = new ArrayList<>();
                n.getArguments().forEach(argExpr -> args.add(argExpr.toString()));
                sink.put("arguments", args);
                
                // Get the dataframe this is called on
                Optional<NameExpr> scope = n.getScope().map(s -> s instanceof NameExpr ? (NameExpr) s : null)
                        .filter(Objects::nonNull);
                
                scope.ifPresent(s -> sink.put("dataframe", s.getNameAsString()));
                
                sinks.add(sink);
            }
            
            super.visit(n, arg);
        }
        
        public List<Map<String, Object>> getSinks() {
            return sinks;
        }
    }
}