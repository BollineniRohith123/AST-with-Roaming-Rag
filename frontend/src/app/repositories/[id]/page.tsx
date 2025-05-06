'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GitBranch, FileCode, FileSpreadsheet, MessageSquare } from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { api } from '../../../utils/api';
import { Loading } from '../../../components/ui/loading';
import { ErrorAlert } from '../../../components/ui/error-alert';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from '../../../components/ui/card';
import RepositoryStats from '../../../components/repository-stats';
import DataFlowDiagram from '../../../components/data-flow-diagram';
import CodeBrowser from '../../../components/code-browser';
import ChatInterface from '../../../components/chat-interface';

type Tab = 'stats' | 'dataflow' | 'code' | 'chat';

export default function RepositoryPage() {
  const params = useParams();
  const repositoryId = parseInt(params.id as string, 10);
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  
  // Fetch repository data
  const { 
    data: repository,
    error,
    isLoading 
  } = useApi(api.getRepository.bind(api), [repositoryId], true, `repository-${repositoryId}`);
  
  // Handle tab change
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Link 
            href="/" 
            className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to repositories
          </Link>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 flex justify-center">
          <Loading text="Loading repository..." size="lg" />
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Link 
            href="/" 
            className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to repositories
          </Link>
        </div>
        <Card>
          <CardContent className="py-8">
            <ErrorAlert
              title="Error loading repository"
              message={error.message}
              details="The repository might not exist or an error occurred while fetching it."
            />
            <div className="mt-4 text-center">
              <Link 
                href="/" 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Return to home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Repository not found
  if (!repository) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Link 
            href="/" 
            className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to repositories
          </Link>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
              Repository Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The repository you are looking for does not exist or has been removed.
            </p>
            <Link 
              href="/" 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header with back button */}
      <div className="flex items-center mb-8">
        <Link 
          href="/" 
          className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to repositories
        </Link>
      </div>
      
      {/* Repository title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
          <GitBranch className="h-8 w-8 mr-2 text-blue-600 dark:text-blue-400" />
          {repository.name}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {repository.url}
        </p>
      </div>
      
      {/* Status banner for processing repositories */}
      {repository.status === 'processing' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 rounded-md dark:bg-yellow-900/20 dark:border-yellow-600">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                This repository is currently being processed. Some features may be limited until processing is complete.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Error banner for failed repositories */}
      {repository.status === 'error' && (
        <ErrorAlert
          title="Repository Analysis Failed"
          message="There was an error analyzing this repository."
          details={repository.status_message || "Please check the repository URL and try again."}
        />
      )}
      
      {/* Tab navigation */}
      <div className="mb-8 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('stats')}
            className={`
              flex items-center py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'stats'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500'}
            `}
          >
            <FileSpreadsheet className="h-5 w-5 mr-2" />
            Statistics
          </button>
          
          <button
            onClick={() => handleTabChange('dataflow')}
            className={`
              flex items-center py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'dataflow'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500'}
            `}
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 10C10.1046 10 11 9.10457 11 8C11 6.89543 10.1046 6 9 6C7.89543 6 7 6.89543 7 8C7 9.10457 7.89543 10 9 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 2V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 5"/>
              <path d="M9 10V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 18H13C14.1 18 15 17.1 15 16V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Data Flow
          </button>
          
          <button
            onClick={() => handleTabChange('code')}
            className={`
              flex items-center py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'code'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500'}
            `}
          >
            <FileCode className="h-5 w-5 mr-2" />
            Code Browser
          </button>
          
          <button
            onClick={() => handleTabChange('chat')}
            className={`
              flex items-center py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'chat'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500'}
            `}
          >
            <MessageSquare className="h-5 w-5 mr-2" />
            Chat
          </button>
        </nav>
      </div>
      
      {/* Tab content */}
      <div className="mb-8">
        {activeTab === 'stats' && (
          <RepositoryStats repositoryId={repositoryId} />
        )}
        
        {activeTab === 'dataflow' && (
          <DataFlowDiagram repositoryId={repositoryId} />
        )}
        
        {activeTab === 'code' && (
          <CodeBrowser repositoryId={repositoryId} />
        )}
        
        {activeTab === 'chat' && (
          <ChatInterface repositoryId={repositoryId} />
        )}
      </div>
    </div>
  );
}