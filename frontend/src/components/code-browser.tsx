'use client';

import { useState, useEffect } from 'react';
import api, { File, Class, Method } from '@/utils/api';
import useApi from '@/hooks/useApi';
import Loading, { Skeleton } from '@/components/ui/loading';
import ErrorAlert from '@/components/ui/error-alert';
import { Button } from '@/components/ui/button';
import { Search, File as FileIcon, RefreshCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface CodeBrowserProps {
  repositoryId: number;
}

export default function CodeBrowser({ repositoryId }: CodeBrowserProps) {
  // State for selected items
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<number | null>(null);
  
  // State for search
  const [fileSearch, setFileSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [methodSearch, setMethodSearch] = useState('');
  
  // Fetch files
  const { 
    data: files, 
    isLoading: isLoadingFiles, 
    error: filesError,
    refresh: refreshFiles
  } = useApi<File[]>(
    () => api.getFiles(repositoryId),
    [],
    { autoExecute: true }
  );
  
  // Fetch classes when a file is selected
  const {
    data: classes,
    isLoading: isLoadingClasses,
    error: classesError,
    execute: fetchClasses,
    reset: resetClasses
  } = useApi<Class[]>(
    (fileId: number) => api.getClasses(fileId),
    []
  );
  
  // Fetch methods when a class is selected
  const {
    data: methods,
    isLoading: isLoadingMethods,
    error: methodsError,
    execute: fetchMethods,
    reset: resetMethods
  } = useApi<Method[]>(
    (classId: number) => api.getMethods(classId),
    []
  );
  
  // Selected method content
  const [methodContent, setMethodContent] = useState<string | null>(null);
  
  // Effect to fetch classes when a file is selected
  useEffect(() => {
    if (selectedFile) {
      fetchClasses(selectedFile);
      // Reset downstream selections
      setSelectedClass(null);
      setSelectedMethod(null);
      setMethodContent(null);
      resetMethods();
    } else {
      resetClasses();
    }
  }, [selectedFile, fetchClasses, resetClasses, resetMethods]);
  
  // Effect to fetch methods when a class is selected
  useEffect(() => {
    if (selectedClass) {
      fetchMethods(selectedClass);
      // Reset method selection
      setSelectedMethod(null);
      setMethodContent(null);
    } else {
      resetMethods();
    }
  }, [selectedClass, fetchMethods, resetMethods]);
  
  // Effect to set method content when a method is selected
  useEffect(() => {
    if (selectedMethod && methods) {
      const method = methods.find(m => m.id === selectedMethod);
      if (method) {
        setMethodContent(method.body);
      }
    } else {
      setMethodContent(null);
    }
  }, [selectedMethod, methods]);
  
  // Filter files based on search
  const filteredFiles = files ? files.filter(file => 
    fileSearch === '' || file.name.toLowerCase().includes(fileSearch.toLowerCase())
  ) : [];
  
  // Filter classes based on search
  const filteredClasses = classes ? classes.filter(cls => 
    classSearch === '' || cls.name.toLowerCase().includes(classSearch.toLowerCase())
  ) : [];
  
  // Filter methods based on search
  const filteredMethods = methods ? methods.filter(method => 
    methodSearch === '' || method.name.toLowerCase().includes(methodSearch.toLowerCase())
  ) : [];

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      {/* Files list */}
      <div className="lg:w-1/4 border rounded-lg p-4 bg-white shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">Files</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refreshFiles}
            disabled={isLoadingFiles}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
        
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
          <ErrorAlert error={filesError} onRetry={refreshFiles} />
        ) : isLoadingFiles ? (
          <div className="animate-pulse space-y-2">
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} className="h-6 rounded" />
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          fileSearch ? (
            <p className="text-gray-500 text-sm">No files match your search</p>
          ) : (
            <p className="text-gray-500 text-sm">No files found in this repository</p>
          )
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y">
            {filteredFiles.map((file) => (
              <li 
                key={file.id}
                className={`p-2 cursor-pointer hover:bg-gray-100 rounded flex items-center ${
                  selectedFile === file.id ? 'bg-blue-50 text-blue-600' : ''
                }`}
                onClick={() => setSelectedFile(file.id)}
              >
                <FileIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">{file.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Classes list */}
      <div className="lg:w-1/4 border rounded-lg p-4 bg-white shadow-sm">
        <h3 className="font-bold mb-2">Classes</h3>
        
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
              <Skeleton key={index} className="h-6 rounded" />
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
                className={`p-2 cursor-pointer hover:bg-gray-100 rounded ${
                  selectedClass === cls.id ? 'bg-blue-50 text-blue-600' : ''
                }`}
                onClick={() => setSelectedClass(cls.id)}
              >
                <div className="flex items-center">
                  <span className={`mr-2 h-2 w-2 rounded-full ${cls.is_interface ? 'bg-purple-500' : 'bg-green-500'}`}></span>
                  <span className="truncate">{cls.name}</span>
                </div>
                {cls.is_interface && <div className="text-xs text-blue-600 ml-4">Interface</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Methods list */}
      <div className="lg:w-1/4 border rounded-lg p-4 bg-white shadow-sm">
        <h3 className="font-bold mb-2">Methods</h3>
        
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
                className={`p-2 cursor-pointer hover:bg-gray-100 rounded ${
                  selectedMethod === method.id ? 'bg-blue-50 text-blue-600' : ''
                }`}
                onClick={() => setSelectedMethod(method.id)}
              >
                <div>{method.name}</div>
                <div className="text-xs text-gray-600 flex gap-2">
                  <span className={method.is_public ? 'text-green-600' : 'text-red-600'}>
                    {method.is_public ? 'public' : 'private'}
                  </span>
                  {method.is_static && <span className="text-blue-600">static</span>}
                  <span>{method.return_type}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Method content */}
      <div className="flex-1 border rounded-lg p-4 bg-white shadow-sm">
        <h3 className="font-bold mb-2">Code</h3>
        
        {!selectedMethod ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-lg bg-gray-50 text-gray-500">
            <FileIcon className="h-12 w-12 text-gray-300 mb-2" />
            <p>Select a method to view code</p>
          </div>
        ) : isLoadingMethods ? (
          <div className="animate-pulse space-y-1">
            {[...Array(10)].map((_, index) => (
              <Skeleton key={index} className="h-4 rounded" />
            ))}
          </div>
        ) : (
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm h-96 font-mono">
            {methodContent}
          </pre>
        )}
      </div>
    </div>
  );
}