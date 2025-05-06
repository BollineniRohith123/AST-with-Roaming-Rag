'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApi } from '../hooks/useApi';
import { api, Repository } from '../utils/api';
import RepositoryForm from '../components/repository-form';
import RepositoryList from '../components/repository-list';
import { Loading } from '../components/ui/loading';
import { ErrorAlert } from '../components/ui/error-alert';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '../components/ui/card';
import { Code, Database, MessageSquare, GitBranch, FileSearch, ArrowRight } from 'lucide-react';

export default function Home() {
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Fetch repositories
  const { 
    data: repositories, 
    error, 
    isLoading, 
    refetch 
  } = useApi<Repository[]>(api.getRepositories.bind(api));
  
  // Toggle add form
  const toggleAddForm = () => {
    setShowAddForm(prev => !prev);
  };
  
  // Handle successful repository addition
  const handleRepositoryAdded = () => {
    setShowAddForm(false);
    refetch();
  };
  
  return (
    <main className="container mx-auto px-4 py-8">
      {/* Hero section */}
      <section className="py-12 px-4 mb-12 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-sm">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            AST-based Analysis System
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Analyze Java and Spark codebases to extract detailed insights and visualize data flow.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={toggleAddForm}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {showAddForm ? 'Hide Form' : 'Add Repository'}
            </button>
            
            <a
              href="https://github.com/username/ast-analysis-system"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              GitHub Project
            </a>
          </div>
        </div>
      </section>
      
      {/* Add repository form */}
      {showAddForm && (
        <section className="mb-12">
          <RepositoryForm onSuccess={handleRepositoryAdded} />
        </section>
      )}
      
      {/* Features section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Key Features
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card shadow="sm" hover>
            <CardContent className="pt-6">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <Code className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Code Analysis</CardTitle>
              <CardDescription className="mt-2">
                Extract detailed information from Java and Spark programs, including data flow, transformations, sources, and more.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card shadow="sm" hover>
            <CardContent className="pt-6">
              <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle>Data Visualization</CardTitle>
              <CardDescription className="mt-2">
                View extracted information in flow charts, diagrams, and tables for clear understanding of complex codebases.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card shadow="sm" hover>
            <CardContent className="pt-6">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Chat with Codebase</CardTitle>
              <CardDescription className="mt-2">
                Ask questions about the codebase in natural language using our RAG-powered AI assistant.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card shadow="sm" hover>
            <CardContent className="pt-6">
              <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <GitBranch className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle>GitHub Integration</CardTitle>
              <CardDescription className="mt-2">
                Seamlessly clone and analyze repositories from GitHub, GitLab, and other Git services.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card shadow="sm" hover>
            <CardContent className="pt-6">
              <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <FileSearch className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <CardTitle>Code Search</CardTitle>
              <CardDescription className="mt-2">
                Search across your entire codebase to find specific classes, methods, or code patterns.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card shadow="sm" hover>
            <CardContent className="pt-6">
              <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-indigo-600 dark:text-indigo-400">
                  <polyline points="16 3 21 3 21 8"></polyline>
                  <line x1="4" y1="20" x2="21" y2="3"></line>
                  <path d="M21 16v5h-5"></path>
                  <line x1="15" y1="15" x2="21" y2="21"></line>
                  <line x1="4" y1="4" x2="9" y2="9"></line>
                </svg>
              </div>
              <CardTitle>Local LLM Support</CardTitle>
              <CardDescription className="mt-2">
                Uses Ollama with LLaMA 3.3 1B model for privacy-preserving, offline code analysis.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>
      
      {/* Your repositories section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Your Repositories
        </h2>
        
        {isLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 flex justify-center">
            <Loading text="Loading repositories..." />
          </div>
        ) : error ? (
          <ErrorAlert
            title="Error loading repositories"
            message={error.message}
            variant="error"
          />
        ) : repositories && repositories.length > 0 ? (
          <RepositoryList repositories={repositories} onUpdate={refetch} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                No repositories yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Add your first repository to start analyzing Java and Spark code.
                Simply paste a GitHub URL to get started.
              </p>
              <button
                onClick={toggleAddForm}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 inline-flex items-center"
              >
                Add Repository
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        )}
      </section>
      
      {/* Footer */}
      <footer className="py-6 text-center border-t border-gray-200 dark:border-gray-700 mt-8">
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} AST Analysis System. All rights reserved.
        </p>
      </footer>
    </main>
  );
}