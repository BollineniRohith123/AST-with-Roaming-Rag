'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../utils/api';
import { useApiPost } from '../hooks/useApi';
import { ErrorAlert } from './ui/error-alert';
import { Loading } from './ui/loading';

interface RepositoryFormProps {
  onSuccess?: () => void;
}

/**
 * Form component for adding a new repository
 */
export function RepositoryForm({ onSuccess }: RepositoryFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  
  // Use custom hook for API call
  const [createRepository, { isLoading, error: apiError }] = useApiPost(
    (data: { url: string }) => api.createRepository(data.url)
  );
  
  // Validate the URL as user types
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    
    // Simple URL validation
    try {
      const urlObj = new URL(newUrl);
      const isGitRepo = 
        urlObj.hostname.includes('github.com') || 
        urlObj.hostname.includes('gitlab.com') || 
        urlObj.hostname.includes('bitbucket.org');
      
      setIsValid(isGitRepo);
      setError(null);
    } catch (err) {
      setIsValid(false);
      if (newUrl && newUrl.length > 10) {
        setError('Please enter a valid URL');
      } else {
        setError(null);
      }
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const repository = await createRepository({ url });
      
      // Clear form
      setUrl('');
      
      // Call success callback or redirect
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/repositories/${repository.id}`);
      }
    } catch (err) {
      console.error('Error creating repository:', err);
      // Error is handled by the hook and displayed below
    }
  };
  
  // Build error message from API error
  const errorMessage = apiError
    ? (apiError as ApiError).message || 'Failed to add repository'
    : error;
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 my-4">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">Add New Repository</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="repository-url" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            GitHub Repository URL
          </label>
          
          <input
            id="repository-url"
            type="url"
            value={url}
            onChange={handleUrlChange}
            placeholder="https://github.com/username/repository"
            className={`
              w-full px-4 py-2 border rounded-md 
              focus:ring-2 focus:outline-none
              dark:bg-gray-700 dark:border-gray-600 dark:text-white
              ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
            `}
            required
            disabled={isLoading}
          />
          
          {error && !apiError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        
        {apiError && (
          <ErrorAlert 
            title="Error adding repository" 
            message={(apiError as ApiError).message || 'An error occurred'} 
            details={(apiError as ApiError).details}
          />
        )}
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className={`
              px-4 py-2 rounded-md text-white font-medium
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              ${
                isValid && !isLoading
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <div className="flex items-center">
                <Loading size="sm" />
                <span className="ml-2">Adding...</span>
              </div>
            ) : (
              'Add Repository'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RepositoryForm;