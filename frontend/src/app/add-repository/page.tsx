import RepositoryForm from '@/components/repository-form';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, GitBranch } from 'lucide-react';

export default function AddRepositoryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/">
          <Button variant="outline" size="sm" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
          </Button>
        </Link>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">
            Add Repository for Analysis
          </h1>
          <p className="mt-2 text-gray-600 max-w-xl mx-auto">
            Enter a GitHub repository URL to analyze Java and Spark code with Abstract Syntax Tree parsing
            and extract detailed metadata about data pipelines.
          </p>
        </div>
        
        <div className="md:flex md:gap-8 md:items-start">
          <div className="md:w-1/2">
            <RepositoryForm />
          </div>
          
          <div className="mt-8 md:mt-0 md:w-1/2">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <GitBranch className="h-5 w-5 mr-2 text-blue-600" />
                About Repository Analysis
              </h2>
              
              <div className="space-y-4 text-gray-600">
                <p>
                  Our system performs deep analysis of Java and Spark codebases using Abstract Syntax Tree (AST) 
                  parsing to extract detailed information about:
                </p>
                
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <span className="font-medium text-gray-800">Code Structure:</span> Classes, interfaces, methods, 
                    fields, and their relationships
                  </li>
                  <li>
                    <span className="font-medium text-gray-800">Data Sources:</span> Tables, files, and external 
                    systems accessed by the code
                  </li>
                  <li>
                    <span className="font-medium text-gray-800">Transformations:</span> Data operations like 
                    filtering, mapping, joining, and aggregation
                  </li>
                  <li>
                    <span className="font-medium text-gray-800">Data Sinks:</span> Output destinations where 
                    processed data is stored
                  </li>
                </ul>
                
                <div className="bg-blue-50 p-4 rounded-md mt-4">
                  <h3 className="font-medium text-blue-800 mb-2">Processing Time</h3>
                  <p className="text-blue-700 text-sm">
                    Analysis time depends on repository size. Small repositories (10-50 files) typically complete 
                    in 1-2 minutes, while larger ones may take 5-10 minutes or more.
                  </p>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-medium text-gray-800 mb-2">Supported Languages & Frameworks</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">Java</span>
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">Spark</span>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">Scala</span>
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">MapReduce</span>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">Hadoop</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}