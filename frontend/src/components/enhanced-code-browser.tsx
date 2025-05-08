'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Loading } from './ui/loading';
import { ErrorAlert } from './ui/error-alert';
import { Input } from './ui/input';
import { Search } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface EnhancedCodeBrowserProps {
  repositoryId: number;
}

export default function EnhancedCodeBrowser({ repositoryId }: EnhancedCodeBrowserProps) {
  // Files state
  const [files, setFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [filesError, setFilesError] = useState<Error | null>(null);
  const [fileSearch, setFileSearch] = useState('');

  // Classes state
  const [classes, setClasses] = useState<any[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [classesError, setClassesError] = useState<Error | null>(null);
  const [classSearch, setClassSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<number | null>(null);

  // Methods state
  const [methods, setMethods] = useState<any[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [methodsError, setMethodsError] = useState<Error | null>(null);
  const [methodSearch, setMethodSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<number | null>(null);

  // Method content state
  const [selectedMethod, setSelectedMethod] = useState<number | null>(null);
  const [methodContent, setMethodContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<Error | null>(null);

  // Debug: Log the component mount
  useEffect(() => {
    console.log(`EnhancedCodeBrowser mounted with repository ID: ${repositoryId}`);
    if (repositoryId) {
      fetchFiles();
    } else {
      console.error("Repository ID is missing");
    }

    // Cleanup
    return () => {
      console.log("EnhancedCodeBrowser unmounted");
      setFiles([]);
      setClasses([]);
      setMethods([]);
      setMethodContent(null);
    };
  }, [repositoryId]);

  // Fetch files for the repository
  const fetchFiles = async () => {
    try {
      console.log(`Fetching files for repository: ${repositoryId}`);
      setIsLoadingFiles(true);
      setFilesError(null);

      const response = await api.getFiles(repositoryId);
      console.log('Files response:', response);

      setFiles(response || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      setFilesError(error as Error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Fetch classes for a file
  const fetchClasses = async (fileId: number) => {
    try {
      console.log(`Fetching classes for file: ${fileId}`);
      setIsLoadingClasses(true);
      setClassesError(null);
      setSelectedFile(fileId);
      setSelectedClass(null);
      setMethods([]);
      setSelectedMethod(null);
      setMethodContent(null);

      const response = await api.getClasses(fileId);
      console.log('Classes response:', response);

      setClasses(response || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
      setClassesError(error as Error);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  // Fetch methods for a class
  const fetchMethods = async (classId: number) => {
    try {
      console.log(`Fetching methods for class: ${classId}`);
      setIsLoadingMethods(true);
      setMethodsError(null);
      setSelectedClass(classId);
      setSelectedMethod(null);
      setMethodContent(null);

      const response = await api.getMethods(classId);
      console.log('Methods response:', response);

      setMethods(response || []);
    } catch (error) {
      console.error('Error fetching methods:', error);
      setMethodsError(error as Error);
    } finally {
      setIsLoadingMethods(false);
    }
  };

  // Fetch method content
  const fetchMethodContent = async (methodId: number) => {
    try {
      console.log(`Fetching content for method: ${methodId}`);
      setIsLoadingContent(true);
      setContentError(null);
      setSelectedMethod(methodId);

      const response = await api.getMethodContent(methodId);
      console.log('Method content response:', response);

      setMethodContent(response?.content || null);
    } catch (error) {
      console.error('Error fetching method content:', error);
      setContentError(error as Error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Filter files by search term
  const filteredFiles = files.filter(file =>
    file.path.toLowerCase().includes(fileSearch.toLowerCase())
  );

  // Filter classes by search term
  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(classSearch.toLowerCase())
  );

  // Filter methods by search term
  const filteredMethods = methods.filter(method =>
    method.name.toLowerCase().includes(methodSearch.toLowerCase())
  );

  // Handle retry for file loading
  const handleRetryFiles = () => {
    fetchFiles();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Files panel */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-2">Files</h2>

        <div className="relative mb-3">
          <Input
            type="text"
            placeholder="Search files..."
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            className="pl-8"
          />
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
        </div>

        {filesError ? (
          <ErrorAlert
            error={filesError}
            onRetry={handleRetryFiles}
          />
        ) : isLoadingFiles ? (
          <div className="animate-pulse space-y-2">
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} className="h-10 rounded" />
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          fileSearch ? (
            <p className="text-gray-500 text-sm">No files match your search</p>
          ) : (
            <p className="text-gray-500 text-sm">No files found in this repository</p>
          )
        ) : (
          <ul className="max-h-96 overflow-y-auto divide-y">
            {filteredFiles.map((file) => (
              <li
                key={file.id}
                className={`p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${
                  selectedFile === file.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
                }`}
                onClick={() => fetchClasses(file.id)}
              >
                <div className="truncate text-sm">{file.path}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Classes panel */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-2">Classes</h2>

        <div className="relative mb-3">
          <Input
            type="text"
            placeholder="Search classes..."
            value={classSearch}
            onChange={(e) => setClassSearch(e.target.value)}
            className="pl-8"
            disabled={!selectedFile}
          />
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
        </div>

        {!selectedFile ? (
          <p className="text-gray-500 text-sm">Select a file to view classes</p>
        ) : classesError ? (
          <ErrorAlert
            error={classesError}
            onRetry={() => fetchClasses(selectedFile)}
          />
        ) : isLoadingClasses ? (
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} className="h-12 rounded" />
            ))}
          </div>
        ) : filteredClasses.length === 0 ? (
          classSearch ? (
            <p className="text-gray-500 text-sm">No classes match your search</p>
          ) : (
            <p className="text-gray-500 text-sm">No classes found in this file</p>
          )
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y">
            {filteredClasses.map((cls) => (
              <li
                key={cls.id}
                className={`p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${
                  selectedClass === cls.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
                }`}
                onClick={() => fetchMethods(cls.id)}
              >
                <div>{cls.name}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 flex gap-2">
                  <span>{cls.type}</span>
                  {cls.extends && <span>extends {cls.extends}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Methods panel */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-2">Methods</h2>

        <div className="relative mb-3">
          <Input
            type="text"
            placeholder="Search methods..."
            value={methodSearch}
            onChange={(e) => setMethodSearch(e.target.value)}
            className="pl-8"
            disabled={!selectedClass}
          />
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
        </div>

        {!selectedClass ? (
          <p className="text-gray-500 text-sm">Select a class to view methods</p>
        ) : methodsError ? (
          <ErrorAlert
            error={methodsError}
            onRetry={() => fetchMethods(selectedClass)}
          />
        ) : isLoadingMethods ? (
          <div className="animate-pulse space-y-2">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-12 rounded" />
            ))}
          </div>
        ) : filteredMethods.length === 0 ? (
          methodSearch ? (
            <p className="text-gray-500 text-sm">No methods match your search</p>
          ) : (
            <p className="text-gray-500 text-sm">No methods found in this class</p>
          )
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y">
            {filteredMethods.map((method) => (
              <li
                key={method.id}
                className={`p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${
                  selectedMethod === method.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
                }`}
                onClick={() => fetchMethodContent(method.id)}
              >
                <div>{method.name}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 flex gap-2">
                  <span className={method.is_public ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {method.is_public ? 'public' : 'private'}
                  </span>
                  {method.is_static && <span className="text-blue-600 dark:text-blue-400">static</span>}
                  <span>{method.return_type}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Method content panel */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-2">Method Details</h2>

        {!selectedMethod ? (
          <p className="text-gray-500 text-sm">Select a method to view details</p>
        ) : contentError ? (
          <ErrorAlert
            error={contentError}
            onRetry={() => fetchMethodContent(selectedMethod)}
          />
        ) : isLoadingContent ? (
          <div className="animate-pulse space-y-2">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded">
            {methodContent ? (
              <SyntaxHighlighter
                language="java"
                style={typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? vscDarkPlus : vs}
                customStyle={{ margin: 0, borderRadius: '0.375rem' }}
                showLineNumbers={true}
                wrapLongLines={false}
              >
                {methodContent}
              </SyntaxHighlighter>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-900 p-3 text-sm text-gray-500 dark:text-gray-400">
                No content available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
