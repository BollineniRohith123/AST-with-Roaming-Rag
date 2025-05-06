const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('../db');

/**
 * Run the Java parser on a file and return the results
 * 
 * @param {string} filePath Path to the Java file to parse
 * @param {string} javaParserPath Path to the Java parser JAR
 * @returns {Promise<Object>} Parsed AST data
 */
async function parseFile(filePath, javaParserPath) {
  return new Promise((resolve, reject) => {
    const javaProcess = spawn('java', [
      '-jar', 
      javaParserPath, 
      '-f', 
      filePath
    ]);
    
    let stdout = '';
    let stderr = '';
    
    javaProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    javaProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    javaProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Java parser exited with code ${code}`);
        console.error(`Stderr: ${stderr}`);
        reject(new Error(`Java parser failed with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse Java parser output: ${err.message}`));
      }
    });
  });
}

/**
 * Store parsed file data in the database
 * 
 * @param {Object} fileData Parsed file data
 * @param {number} repoId Repository ID
 */
async function storeFileData(fileData, repoId) {
  if (fileData.error) {
    console.error(`Error parsing file ${fileData.file}: ${fileData.error}`);
    return;
  }
  
  try {
    const fileName = path.basename(fileData.file);
    const filePath = fileData.file;
    const packageName = fileData.package || null;
    
    // Store the file
    const fileId = await db.storeFile(repoId, fileName, filePath, packageName);
    
    // Process classes
    for (const classInfo of fileData.classes || []) {
      const className = classInfo.name;
      const isInterface = classInfo.isInterface || false;
      const extendsClass = classInfo.extends || [];
      const implementsInterfaces = classInfo.implements || [];
      
      const classId = await db.storeClass(
        fileId, 
        className, 
        isInterface, 
        extendsClass, 
        implementsInterfaces
      );
      
      // Process methods
      for (const methodInfo of classInfo.methods || []) {
        const methodName = methodInfo.name;
        const returnType = methodInfo.returnType;
        const isPublic = methodInfo.isPublic;
        const isStatic = methodInfo.isStatic;
        const parameters = methodInfo.parameters || [];
        const body = methodInfo.body;
        
        const methodId = await db.storeMethod(
          classId,
          methodName,
          returnType,
          isPublic,
          isStatic,
          parameters,
          body
        );
        
        // Store method calls
        if (methodInfo.methodCalls && methodInfo.methodCalls.length > 0) {
          await db.storeMethodCalls(methodId, methodInfo.methodCalls);
        }
        
        // Store variables
        if (methodInfo.variables && methodInfo.variables.length > 0) {
          await db.storeVariables(methodId, methodInfo.variables);
        }
      }
      
      // Process fields
      for (const fieldInfo of classInfo.fields || []) {
        const fieldName = fieldInfo.name;
        const fieldType = fieldInfo.type;
        const isPublic = fieldInfo.isPublic;
        const isStatic = fieldInfo.isStatic;
        const initialValue = fieldInfo.initialValue;
        
        await db.storeField(
          classId,
          fieldName,
          fieldType,
          isPublic,
          isStatic,
          initialValue
        );
      }
    }
    
    // Process Spark metadata if present
    if (fileData.sparkMetadata) {
      // Process sources
      for (const source of fileData.sparkMetadata.sources || []) {
        await db.storeSparkSource(
          fileId,
          source.type,
          source.argument,
          source.scope
        );
      }
      
      // Process transformations
      for (const transform of fileData.sparkMetadata.transformations || []) {
        await db.storeSparkTransformation(
          fileId,
          transform.type,
          transform.arguments,
          transform.dataframe
        );
      }
      
      // Process sinks
      for (const sink of fileData.sparkMetadata.sinks || []) {
        await db.storeSparkSink(
          fileId,
          sink.type,
          sink.arguments,
          sink.dataframe
        );
      }
    }
    
    console.log(`Successfully stored data for file ${fileName}`);
    return fileId;
  } catch (error) {
    console.error(`Error storing file data for ${fileData.file}:`, error);
    throw error;
  }
}

/**
 * Process a repository by parsing all Java files and storing the data
 * 
 * @param {string} repoPath Path to the cloned repository
 * @param {number} repoId Repository ID in the database
 * @param {string} javaParserPath Path to the Java parser JAR
 */
async function processRepository(repoPath, repoId, javaParserPath) {
  try {
    // Find all Java files in the repository
    const javaFiles = require('../repository/cloner').findJavaFiles(repoPath);
    console.log(`Found ${javaFiles.length} Java files in repository`);
    
    // Parse and store each file
    for (const filePath of javaFiles) {
      try {
        console.log(`Parsing file: ${filePath}`);
        const fileData = await parseFile(filePath, javaParserPath);
        await storeFileData(fileData[0], repoId); // The Java parser returns an array
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        // Continue with the next file
      }
    }
    
    console.log(`Repository processing completed for ID ${repoId}`);
  } catch (error) {
    console.error('Error processing repository:', error);
    throw error;
  }
}

module.exports = {
  parseFile,
  storeFileData,
  processRepository,
};