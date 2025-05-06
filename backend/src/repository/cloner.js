const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const nodegit = require('nodegit');

/**
 * Clone a Git repository to a local directory
 * 
 * @param {string} url The URL of the Git repository to clone
 * @param {string} directory The local directory to clone into
 * @returns {Promise<string>} The path to the cloned repository
 */
async function cloneRepository(url, directory) {
  try {
    // Create the directory if it doesn't exist
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Extract repository name from URL
    const repoName = url.split('/').pop().replace('.git', '');
    const clonePath = path.join(directory, repoName);
    
    // Remove the directory if it already exists
    if (fs.existsSync(clonePath)) {
      fs.rmSync(clonePath, { recursive: true, force: true });
    }
    
    // Clone the repository
    console.log(`Cloning repository ${url} to ${clonePath}...`);
    await nodegit.Clone(url, clonePath);
    console.log(`Repository cloned successfully to ${clonePath}`);
    
    return { clonePath, repoName };
  } catch (error) {
    console.error('Error cloning repository:', error);
    throw error;
  }
}

/**
 * Find all Java files in a directory
 * 
 * @param {string} directory The directory to search in
 * @returns {string[]} Array of paths to Java files
 */
function findJavaFiles(directory) {
  const javaFiles = [];
  
  function searchDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Skip .git and node_modules directories
        if (file !== '.git' && file !== 'node_modules') {
          searchDirectory(filePath);
        }
      } else if (file.endsWith('.java') || file.endsWith('.scala')) {
        javaFiles.push(filePath);
      }
    }
  }
  
  searchDirectory(directory);
  return javaFiles;
}

module.exports = {
  cloneRepository,
  findJavaFiles,
};