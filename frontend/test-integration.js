/**
 * Test script for verifying Java parser and RAG integration
 */
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const API_BASE_URL = 'http://localhost:3005/api';
const TEST_REPO_URL = 'https://github.com/apache/spark';
const TEST_REPO_NAME = 'Apache Spark Test';

// Test queries for the RAG system
const TEST_QUERIES = [
  "What are the main classes in this repository?",
  "Explain the data flow in this codebase",
  "How are Spark transformations implemented?",
  "What data sources does this application use?",
  "Summarize the main functionality of this code"
];

// Utility function for API requests
async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`${method} ${API_BASE_URL}${endpoint}`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error making API request to ${endpoint}:`, error);
    throw error;
  }
}

// Test repository creation
async function testCreateRepository() {
  console.log('\n=== Testing Repository Creation ===');
  
  try {
    const startTime = performance.now();
    const repository = await apiRequest('/repositories', 'POST', {
      url: TEST_REPO_URL,
      name: TEST_REPO_NAME,
      description: 'Test repository for integration testing'
    });
    const endTime = performance.now();
    
    console.log(`Repository created successfully in ${Math.round(endTime - startTime)}ms`);
    console.log(`Repository ID: ${repository.id}`);
    console.log(`Status: ${repository.status}`);
    
    return repository;
  } catch (error) {
    console.error('Failed to create repository:', error.message);
    
    // Try to get existing repository with the same name
    try {
      const repositories = await apiRequest('/repositories');
      const existingRepo = repositories.find(repo => repo.name === TEST_REPO_NAME);
      
      if (existingRepo) {
        console.log(`Using existing repository with ID: ${existingRepo.id}`);
        return existingRepo;
      }
    } catch (listError) {
      console.error('Failed to list repositories:', listError.message);
    }
    
    throw error;
  }
}

// Test file listing
async function testListFiles(repositoryId) {
  console.log('\n=== Testing File Listing ===');
  
  try {
    const startTime = performance.now();
    const files = await apiRequest(`/repositories/${repositoryId}/files`);
    const endTime = performance.now();
    
    console.log(`Retrieved ${files.length} files in ${Math.round(endTime - startTime)}ms`);
    
    if (files.length > 0) {
      console.log('Sample files:');
      files.slice(0, 5).forEach(file => {
        console.log(`- ${file.path} (ID: ${file.id})`);
      });
    }
    
    return files;
  } catch (error) {
    console.error('Failed to list files:', error.message);
    return [];
  }
}

// Test chat functionality
async function testChat(repositoryId) {
  console.log('\n=== Testing Chat Functionality ===');
  
  const results = [];
  
  for (const query of TEST_QUERIES) {
    console.log(`\nQuery: "${query}"`);
    
    try {
      const startTime = performance.now();
      const response = await apiRequest(`/repositories/${repositoryId}/chat`, 'POST', { query });
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      console.log(`Response received in ${latency}ms`);
      console.log('Response preview:', response.response.substring(0, 100) + '...');
      
      results.push({
        query,
        latency,
        success: true,
        responseLength: response.response.length
      });
    } catch (error) {
      console.error('Chat query failed:', error.message);
      
      results.push({
        query,
        latency: null,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

// Run all tests
async function runTests() {
  console.log('=== Starting Integration Tests ===');
  
  try {
    // Step 1: Create or get repository
    const repository = await testCreateRepository();
    
    // Step 2: List files
    const files = await testListFiles(repository.id);
    
    // Step 3: Test chat functionality
    const chatResults = await testChat(repository.id);
    
    // Print summary
    console.log('\n=== Test Summary ===');
    console.log(`Repository: ${repository.name} (ID: ${repository.id})`);
    console.log(`Files: ${files.length}`);
    
    console.log('\nChat Results:');
    let totalLatency = 0;
    let successCount = 0;
    
    chatResults.forEach(result => {
      console.log(`- Query: "${result.query.substring(0, 30)}${result.query.length > 30 ? '...' : ''}"`);
      console.log(`  Success: ${result.success ? 'Yes' : 'No'}`);
      
      if (result.success) {
        console.log(`  Latency: ${result.latency}ms`);
        console.log(`  Response Length: ${result.responseLength} characters`);
        totalLatency += result.latency;
        successCount++;
      } else {
        console.log(`  Error: ${result.error}`);
      }
    });
    
    if (successCount > 0) {
      console.log(`\nAverage Response Time: ${Math.round(totalLatency / successCount)}ms`);
    }
    console.log(`Success Rate: ${successCount}/${chatResults.length} (${Math.round(successCount / chatResults.length * 100)}%)`);
    
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

// Run the tests
runTests();
