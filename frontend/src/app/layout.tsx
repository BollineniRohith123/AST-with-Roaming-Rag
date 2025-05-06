import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AST Analysis System',
  description: 'Analyze Java and Spark code with AST parsing and RAG integration',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex">
                <Link href="/" className="flex-shrink-0 flex items-center">
                  <h1 className="text-xl font-bold text-gray-900">AST Analysis</h1>
                </Link>
                <nav className="ml-6 flex space-x-8">
                  <Link 
                    href="/" 
                    className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Home
                  </Link>
                  <Link 
                    href="/add-repository" 
                    className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Add Repository
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </header>
        {children}
        <footer className="bg-white">
          <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <p className="text-center text-gray-500 text-sm">
              AST Analysis System with RAG Integration
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}