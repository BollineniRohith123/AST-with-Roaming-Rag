'use client';

import Link from 'next/link';
import { Repository } from '@/utils/api';
import useApi from '@/hooks/useApi';
import api from '@/utils/api';
import Loading, { Skeleton } from '@/components/ui/loading';
import ErrorAlert from '@/components/ui/error-alert';
import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';

export default function RepositoryList() {
  // Fetch repositories using our custom hook
  const { data: repositories, isLoading, error, refresh } = useApi<Repository[]>(
    api.getRepositories,
    [],
    { autoExecute: true }
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Your Repositories</h2>
        <Button 
          variant="outline" 
          size="sm"
          disabled={isLoading}
          onClick={refresh}
          className="flex items-center gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
      
      {error && (
        <ErrorAlert
          error={error}
          onRetry={refresh}
          className="mb-4"
        />
      )}
      
      <div className="space-y-4">
        {isLoading ? (
          // Loading skeletons
          <>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </>
        ) : repositories && repositories.length > 0 ? (
          // Repository list
          repositories.map((repo) => (
            <Link 
              key={repo.id} 
              href={`/repositories/${repo.id}`}
              className="block p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex justify-between">
                <div>
                  <h3 className="text-lg font-medium">{repo.name}</h3>
                  <p className="text-sm text-gray-600 mt-1 break-all">{repo.url}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Added on {new Date(repo.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  {repo.status && (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      repo.status === 'processed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {repo.status === 'processed' ? 'Ready' : 'Processing'}
                    </span>
                  )}
                  {repo.fileCount !== undefined && (
                    <span className="text-xs text-gray-500 mt-1">
                      {repo.fileCount} files analyzed
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))
        ) : (
          // Empty state
          <div className="bg-blue-50 p-6 rounded-md text-center">
            <p className="text-blue-700 mb-4">No repositories found. Add one to get started!</p>
            <Link href="/add-repository">
              <Button>Add Repository</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}