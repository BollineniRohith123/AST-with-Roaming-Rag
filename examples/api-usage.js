/**
 * API Usage Examples for AST Analysis System
 * 
 * This file demonstrates how to use the AST Analysis System API to:
 * 1. Add a repository
 * 2. Get repository information
 * 3. List files in a repository
 * 4. Get data flow information
 * 5. Search code
 * 6. Chat with the codebase
 * 
 * Requirements:
 * - Node.js 18+
 * - fetch (built into Node.js 18+)
 */

// API base URL
const API_BASE_URL = 'http://localhost:3001/api';

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Set default headers
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  try {
    console.log(`Making ${options.method || 'GET'} request to ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Example 1: Add a repository
 */
async function addRepository(url) {
  try {
    const repository = await apiRequest('/repositories', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    
    console.log('Repository added successfully:');
    console.log(repository);
    
    return repository;
  } catch (error) {
    console.error('Failed to add repository:', error.message);
  }
}

/**
 * Example 2: Get repository information
 */
async function getRepository(repositoryId) {
  try {
    const repository = await apiRequest(`/repositories/${repositoryId}`);
    
    console.log('Repository information:');
    console.log(repository);
    
    return repository;
  } catch (error) {
    console.error('Failed to get repository:', error.message);
  }
}

/**
 * Example 3: List files in a repository
 */
async function listFiles(repositoryId) {
  try {
    const files = await apiRequest(`/repositories/${repositoryId}/files`);
    
    console.log(`Found ${files.length} files in repository ${repositoryId}:`);
    files.forEach(file => {
      console.log(`- ${file.path} (${file.id})`);
    });
    
    return files;
  } catch (error) {
    console.error('Failed to list files:', error.message);
  }
}

/**
 * Example 4: Get data flow information
 */
async function getDataFlow(repositoryId) {
  try {
    const dataFlow = await apiRequest(`/repositories/${repositoryId}/dataflow`);
    
    console.log('Data flow information:');
    console.log(`- Sources: ${dataFlow.sources.length}`);
    console.log(`- Transformations: ${dataFlow.transformations.length}`);
    console.log(`- Sinks: ${dataFlow.sinks.length}`);
    
    // Print some details if available
    if (dataFlow.sources.length > 0) {
      console.log('\nSample source:');
      console.log(dataFlow.sources[0]);
    }
    
    if (dataFlow.transformations.length > 0) {
      console.log('\nSample transformation:');
      console.log(dataFlow.transformations[0]);
    }
    
    if (dataFlow.sinks.length > 0) {
      console.log('\nSample sink:');
      console.log(dataFlow.sinks[0]);
    }
    
    return dataFlow;
  } catch (error) {
    console.error('Failed to get data flow:', error.message);
  }
}

/**
 * Example 5: Search code
 */
async function searchCode(repositoryId, query) {
  try {
    const results = await apiRequest(`/repositories/${repositoryId}/search?q=${encodeURIComponent(query)}`);
    
    console.log(`Search results for "${query}":`);
    console.log(`- Methods: ${results.methods.length}`);
    console.log(`- Classes: ${results.classes.length}`);
    console.log(`- Files: ${results.files.length}`);
    
    // Print some results if available
    if (results.methods.length > 0) {
      console.log('\nSample method:');
      const method = results.methods[0];
      console.log(`${method.class_name}.${method.name} (${method.file_name})`);
    }
    
    return results;
  } catch (error) {
    console.error('Failed to search code:', error.message);
  }
}

/**
 * Example 6: Chat with codebase
 */
async function chatWithCodebase(repositoryId, query) {
  try {
    const response = await apiRequest(`/repositories/${repositoryId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ query })
    });
    
    console.log('Chat response:');
    console.log(response.response);
    
    return response;
  } catch (error) {
    console.error('Failed to chat with codebase:', error.message);
  }
}

/**
 * Run the examples
 */
async function runExamples() {
  try {
    // Example 1: Add a repository
    // Note: You may want to use an existing repository ID if you've already added one
    const repository = await addRepository('https://github.com/apache/spark');
    
    if (!repository) {
      console.log('Using example repository ID. Change this to your actual repository ID.');
      var repositoryId = 1; // Replace with an actual repository ID
    } else {
      var repositoryId = repository.id;
    }
    
    // Wait for a moment to allow the repository to be processed
    console.log('Waiting for 5 seconds to allow repository processing to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Example 2: Get repository information
    await getRepository(repositoryId);
    
    // Example 3: List files in a repository
    const files = await listFiles(repositoryId);
    
    // Example 4: Get data flow information
    await getDataFlow(repositoryId);
    
    // Example 5: Search code
    await searchCode(repositoryId, 'transform');
    
    // Example 6: Chat with codebase
    // Note: This requires the repository to be fully processed
    console.log('Note: Chat functionality requires the repository to be fully processed.');
    console.log('If the repository is still being processed, this example may fail.');
    await chatWithCodebase(repositoryId, 'What are the main classes in this codebase?');
  } catch (error) {
    console.error('Error running examples:', error.message);
  }
}

// Run the examples if this file is executed directly
if (require.main === module) {
  runExamples();
}

// Export the functions for use in other scripts
module.exports = {
  addRepository,
  getRepository,
  listFiles,
  getDataFlow,
  searchCode,
  chatWithCodebase
};