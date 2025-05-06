'use client';

import { useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { api, Repository, File, DataFlow } from '../utils/api';
import { Loading } from './ui/loading';
import { ErrorAlert } from './ui/error-alert';
import { File as FileIcon, Code, Folder, GitBranch } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface RepositoryStatsProps {
  repositoryId: number;
}

export function RepositoryStats({ repositoryId }: RepositoryStatsProps) {
  // Fetch repository data
  const { 
    data: repository,
    error: repoError,
    isLoading: repoLoading
  } = useApi<Repository>(api.getRepository.bind(api), [repositoryId], true, `repository-${repositoryId}`);

  // Fetch files data
  const {
    data: files,
    error: filesError,
    isLoading: filesLoading
  } = useApi<File[]>(api.getFiles.bind(api), [repositoryId], true, `files-${repositoryId}`);

  // Fetch data flow information
  const {
    data: dataFlow,
    error: dataFlowError,
    isLoading: dataFlowLoading
  } = useApi<DataFlow>(api.getDataFlow.bind(api), [repositoryId], true, `dataflow-${repositoryId}`);

  // Calculate file type statistics
  const fileStats = useMemo(() => {
    if (!files) return null;

    // Count file types
    const stats: Record<string, number> = {};
    files.forEach(file => {
      const ext = file.name.split('.').pop() || 'unknown';
      stats[ext] = (stats[ext] || 0) + 1;
    });

    // Sort by count (descending)
    const sortedStats = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {} as Record<string, number>);

    return sortedStats;
  }, [files]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!fileStats) return null;

    // Get top 5 file types, group the rest as "Other"
    const entries = Object.entries(fileStats);
    const topEntries = entries.slice(0, 5);
    const otherEntries = entries.slice(5);
    
    const labels = [...topEntries.map(([ext]) => ext)];
    const data = [...topEntries.map(([, count]) => count)];
    
    // Add "Other" category if needed
    if (otherEntries.length > 0) {
      labels.push('Other');
      data.push(otherEntries.reduce((sum, [, count]) => sum + count, 0));
    }

    // Chart colors
    const backgroundColors = [
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 99, 132, 0.8)',
      'rgba(255, 206, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)',
    ];

    return {
      labels,
      datasets: [
        {
          label: 'File Types',
          data,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
          borderWidth: 1,
        },
      ],
    };
  }, [fileStats]);

  // Calculate overall statistics
  const stats = useMemo(() => {
    if (!repository || !files || !dataFlow) return null;

    return {
      totalFiles: files.length,
      javaFiles: files.filter(file => file.name.endsWith('.java')).length,
      sparkSources: dataFlow.sources.length,
      sparkTransformations: dataFlow.transformations.length,
      sparkSinks: dataFlow.sinks.length,
      packages: new Set(files.map(file => file.package_name).filter(Boolean)).size,
    };
  }, [repository, files, dataFlow]);

  // Show loading state
  if (repoLoading || filesLoading || dataFlowLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <Loading text="Loading repository statistics..." />
      </div>
    );
  }

  // Show error state
  if (repoError || filesError || dataFlowError) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <ErrorAlert
          title="Error loading repository statistics"
          message="Failed to load repository data"
          details={(repoError || filesError || dataFlowError)?.message}
        />
      </div>
    );
  }

  // If data is not available yet
  if (!repository || !files || !dataFlow || !stats) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center text-gray-500 dark:text-gray-400">
        No repository statistics available
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
        Repository Statistics
      </h2>
      
      {/* Repository info */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
          <GitBranch className="inline mr-2 h-5 w-5" />
          {repository.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Status: <span className={`font-medium ${
            repository.status === 'processed' 
              ? 'text-green-600 dark:text-green-400' 
              : repository.status === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-yellow-600 dark:text-yellow-400'
          }`}>
            {repository.status || 'Unknown'}
          </span>
        </p>
        {repository.status_message && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">
            {repository.status_message}
          </p>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Added: {new Date(repository.created_at).toLocaleDateString()}
        </p>
      </div>
      
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <FileIcon className="h-5 w-5 text-blue-500 mr-2" />
            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Files
            </h4>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-800 dark:text-blue-200">
            {stats.totalFiles}
          </p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <Code className="h-5 w-5 text-green-500 mr-2" />
            <h4 className="text-sm font-medium text-green-700 dark:text-green-300">
              Java Files
            </h4>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-800 dark:text-green-200">
            {stats.javaFiles}
          </p>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <Folder className="h-5 w-5 text-purple-500 mr-2" />
            <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Packages
            </h4>
          </div>
          <p className="mt-2 text-2xl font-bold text-purple-800 dark:text-purple-200">
            {stats.packages}
          </p>
        </div>
      </div>
      
      {/* Spark data flow stats */}
      {(stats.sparkSources > 0 || stats.sparkTransformations > 0 || stats.sparkSinks > 0) && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            Spark Data Flow
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-center">
              <h4 className="text-xs font-medium text-green-700 dark:text-green-300">
                Sources
              </h4>
              <p className="mt-1 text-xl font-bold text-green-800 dark:text-green-200">
                {stats.sparkSources}
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center">
              <h4 className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Transformations
              </h4>
              <p className="mt-1 text-xl font-bold text-blue-800 dark:text-blue-200">
                {stats.sparkTransformations}
              </p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg text-center">
              <h4 className="text-xs font-medium text-purple-700 dark:text-purple-300">
                Sinks
              </h4>
              <p className="mt-1 text-xl font-bold text-purple-800 dark:text-purple-200">
                {stats.sparkSinks}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* File type distribution chart */}
      {chartData && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
            File Type Distribution
          </h3>
          <div className="w-full max-w-xs mx-auto">
            <Doughnut 
              data={chartData} 
              options={{
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      color: 'rgb(107, 114, 128)',
                      font: {
                        size: 12
                      }
                    }
                  },
                  tooltip: {
                    callbacks: {
                      label: function(context) {
                        const label = context.label || '';
                        const value = context.raw as number;
                        const total = (context.dataset.data as number[]).reduce((sum, val) => sum + (val as number), 0);
                        const percentage = Math.round((value / total) * 100);
                        return `${label}: ${value} (${percentage}%)`;
                      }
                    }
                  }
                },
                maintainAspectRatio: true,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default RepositoryStats;