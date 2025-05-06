package com.astanalyzer;

import com.astanalyzer.parser.JavaFileParser;
import com.astanalyzer.parser.SparkParser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.cli.*;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Main entry point for the AST Analysis Java Parser service.
 */
public class Main {
    public static void main(String[] args) {
        try {
            // Define command line options
            Options options = new Options();
            options.addOption(Option.builder("f")
                    .longOpt("file")
                    .desc("Single file to parse")
                    .hasArg()
                    .build());
            options.addOption(Option.builder("d")
                    .longOpt("directory")
                    .desc("Directory of files to parse")
                    .hasArg()
                    .build());
            options.addOption(Option.builder("o")
                    .longOpt("output")
                    .desc("Output file for results")
                    .hasArg()
                    .build());
            options.addOption("h", "help", false, "Print this help message");

            CommandLineParser parser = new DefaultParser();
            CommandLine cmd = parser.parse(options, args);

            if (cmd.hasOption("help")) {
                HelpFormatter formatter = new HelpFormatter();
                formatter.printHelp("java -jar parser.jar", options);
                return;
            }

            List<File> filesToParse = new ArrayList<>();

            // Parse a single file
            if (cmd.hasOption("file")) {
                File file = new File(cmd.getOptionValue("file"));
                if (file.exists() && file.isFile()) {
                    filesToParse.add(file);
                } else {
                    System.err.println("File does not exist: " + file.getAbsolutePath());
                    System.exit(1);
                }
            }

            // Parse a directory of files
            if (cmd.hasOption("directory")) {
                Path dirPath = Paths.get(cmd.getOptionValue("directory"));
                if (Files.exists(dirPath) && Files.isDirectory(dirPath)) {
                    filesToParse.addAll(Files.walk(dirPath)
                            .filter(path -> path.toString().endsWith(".java"))
                            .map(Path::toFile)
                            .collect(Collectors.toList()));
                } else {
                    System.err.println("Directory does not exist: " + dirPath);
                    System.exit(1);
                }
            }

            if (filesToParse.isEmpty()) {
                System.err.println("No files to parse. Please specify a file or directory.");
                System.exit(1);
            }

            // Process each file
            List<Map<String, Object>> results = new ArrayList<>();
            JavaFileParser javaParser = new JavaFileParser();
            SparkParser sparkParser = new SparkParser();

            for (File file : filesToParse) {
                Map<String, Object> fileMetadata = javaParser.parseFile(file);
                
                // Check if this is a Spark file and add Spark-specific metadata
                if (sparkParser.isSparkFile(file)) {
                    Map<String, Object> sparkMetadata = sparkParser.parseSparkFile(file);
                    fileMetadata.put("sparkMetadata", sparkMetadata);
                }
                
                results.add(fileMetadata);
            }

            // Output results
            ObjectMapper objectMapper = new ObjectMapper();
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(results);
            
            if (cmd.hasOption("output")) {
                Files.writeString(Paths.get(cmd.getOptionValue("output")), json);
            } else {
                System.out.println(json);
            }

        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}