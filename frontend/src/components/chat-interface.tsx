'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../utils/api';
import { ErrorAlert } from './ui/error-alert';
import { Loading } from './ui/loading';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

interface ChatInterfaceProps {
  repositoryId: number;
}

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export function ChatInterface({ repositoryId }: ChatInterfaceProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sample messages to help the user understand what they can ask
  const sampleQueries = [
    'What are the main classes in this repository?',
    'Explain the data flow in this codebase',
    'How are Spark transformations implemented?',
    'What data sources does this application use?',
    'Summarize the main functionality of this code'
  ];

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [query]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem(`chat-history-${repositoryId}`);
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      } catch (err) {
        console.error('Failed to parse saved chat history:', err);
      }
    }
  }, [repositoryId]);

  // Save chat history to localStorage when messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`chat-history-${repositoryId}`, JSON.stringify(messages));
    }
  }, [messages, repositoryId]);

  // Handle query submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Don't submit empty queries
    if (!query.trim()) return;

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: query,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);
    setError(null);

    try {
      // Send query to API
      const response = await api.chatWithCodebase(repositoryId, query);

      // Add assistant message to chat
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        content: response.response,
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keypresses (Ctrl+Enter to submit)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit(e);
    }
  };

  // Clear chat history
  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem(`chat-history-${repositoryId}`);
  };

  // Add sample query to input
  const handleSampleQuery = (query: string) => {
    setQuery(query);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-md">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
          Chat with Codebase
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Ask questions about the repository and get answers based on the code analysis
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Welcome to Code Chat
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Ask questions about this repository to understand the codebase better.
              <br />
              The AI will analyze the code and provide insights.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-2xl">
              {sampleQueries.map((query, index) => (
                <button
                  key={index}
                  onClick={() => handleSampleQuery(query)}
                  className="text-left p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  "{query}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-100 dark:bg-blue-800 dark:text-blue-50 text-blue-900'
                    : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-100 text-gray-800'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose dark:prose-invert max-w-none prose-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({node, inline, className, children, ...props}) {
                          const match = /language-(\w+)/.exec(className || '');
                          const language = match ? match[1] : 'java'; // Default to Java for code blocks

                          return !inline ? (
                            <SyntaxHighlighter
                              style={typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? vscDarkPlus : vs}
                              language={language}
                              PreTag="div"
                              showLineNumbers={true}
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
                <div
                  className={`text-xs mt-1 ${
                    message.role === 'user'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-4 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center space-x-3">
                <Loading size="sm" />
                <div className="space-y-2">
                  <p className="text-gray-700 dark:text-gray-300 text-sm">Analyzing your query...</p>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    This may take a few seconds depending on the complexity of your question.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <h4 className="text-red-800 dark:text-red-400 font-medium mb-1">Failed to get response</h4>
              <p className="text-red-700 dark:text-red-300 text-sm mb-2">{error.message}</p>
              {error.message.includes('ECONNREFUSED') && (
                <p className="text-red-600 dark:text-red-200 text-xs">
                  The backend server appears to be offline. Please make sure it's running at http://localhost:3005.
                </p>
              )}
              {error.message.includes('timed out') && (
                <p className="text-red-600 dark:text-red-200 text-xs">
                  The request took too long to process. This might be due to high server load or a complex query.
                  Try a simpler question or try again later.
                </p>
              )}
              <button
                onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                className="mt-2 text-xs bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about the code..."
              className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none min-h-[80px]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className={`absolute right-3 bottom-3 p-2 rounded-full ${
                isLoading || !query.trim()
                  ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
              } text-white`}
              title="Send message (Ctrl+Enter)"
            >
              <Send size={18} />
            </button>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
            <span>Press Ctrl+Enter to send</span>
            <button
              type="button"
              onClick={handleClearChat}
              className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Clear chat history"
            >
              <RefreshCw size={14} className="mr-1" />
              Clear chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChatInterface;