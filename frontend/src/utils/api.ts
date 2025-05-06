// API client utility for communicating with the backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Types
export interface Repository {
  id: number;
  url: string;
  name: string;
  clone_path: string;
  created_at: string;
  status?: 'processing' | 'processed' | 'error';
  status_message?: string;
  fileCount?: number;
}

export interface File {
  id: number;
  repo_id: number;
  name: string;
  path: string;
  package_name: string | null;
  created_at: string;
}

export interface Class {
  id: number;
  file_id: number;
  name: string;
  is_interface: boolean;
  extends_class: string[];
  implements_interfaces: string[];
  created_at: string;
}

export interface Method {
  id: number;
  class_id: number;
  name: string;
  return_type: string;
  is_public: boolean;
  is_static: boolean;
  parameters: any[];
  body: string;
  created_at: string;
}

export interface Field {
  id: number;
  class_id: number;
  name: string;
  type: string;
  is_public: boolean;
  is_static: boolean;
  initial_value: string | null;
  created_at: string;
}

export interface SparkSource {
  id: number;
  file_id: number;
  type: string;
  arguments: string;
  variable_name: string | null;
  created_at: string;
}

export interface SparkTransformation {
  id: number;
  file_id: number;
  type: string;
  arguments: any[];
  dataframe_name: string | null;
  created_at: string;
}

export interface SparkSink {
  id: number;
  file_id: number;
  type: string;
  arguments: any[];
  dataframe_name: string | null;
  created_at: string;
}

export interface DataFlow {
  sources: SparkSource[];
  transformations: SparkTransformation[];
  sinks: SparkSink[];
}

export interface SearchResults {
  methods: {
    id: number;
    name: string;
    body: string;
    class_name: string;
    file_name: string;
  }[];
  classes: {
    id: number;
    name: string;
    file_name: string;
  }[];
  files: {
    id: number;
    name: string;
    path: string;
  }[];
}

export interface ChatRequest {
  query: string;
}

export interface ChatResponse {
  response: string;
}

export interface ApiError {
  status: number;
  message: string;
  details?: string;
}

// API client class
class ApiClient {
  private baseUrl: string;
  private abortControllers: Map<string, AbortController>;
  private authToken?: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.abortControllers = new Map();
    
    // Get auth token from localStorage if available
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('auth_token') || undefined;
    }
  }

  // Set auth token
  setAuthToken(token: string | null) {
    if (token) {
      this.authToken = token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', token);
      }
    } else {
      this.authToken = undefined;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
      }
    }
  }

  // Helper method for HTTP requests
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}, 
    requestId?: string
  ): Promise<T> {
    // Generate a unique ID for this request if not provided
    const id = requestId || `${endpoint}-${Date.now()}`;
    
    // Create an AbortController for this request
    const controller = new AbortController();
    
    // Cancel any previous request with the same ID
    if (requestId && this.abortControllers.has(requestId)) {
      this.abortControllers.get(requestId)?.abort();
    }
    
    // Store the controller
    this.abortControllers.set(id, controller);
    
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      // Create headers with auth token if available
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      // Start timer to track request duration
      const startTime = performance.now();
      
      // Execute the request
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      
      // Calculate request duration
      const duration = Math.round(performance.now() - startTime);
      
      // Log request in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `%c[API] ${options.method || 'GET'} ${url} %c(${duration}ms)`,
          'color: #0070f3; font-weight: bold',
          'color: gray'
        );
      }
      
      // Handle HTTP errors
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        let details = '';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          details = errorData.details || '';
        } catch (e) {
          // If the response is not JSON, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        
        const error: ApiError = {
          status: response.status,
          message: errorMessage,
          details: details || undefined,
        };
        
        throw error;
      }
      
      // Check if response is empty
      const contentType = response.headers.get('content-type');
      
      if (!contentType?.includes('application/json')) {
        if (response.status === 204) {
          // For No Content responses, return empty object
          return {} as T;
        }
        throw new Error(`Unexpected content type: ${contentType}`);
      }
      
      // Parse response as JSON
      const jsonData = await response.json();
      
      // Log response in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('%c[API] Response:', 'color: #00b300', jsonData);
      }
      
      return jsonData;
    } catch (error: any) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log(`%c[API] Request to ${endpoint} was aborted`, 'color: orange');
        throw { status: 0, message: 'Request was aborted' };
      }
      
      // Log error in development mode
      if (process.env.NODE_ENV === 'development') {
        console.error('%c[API] Error:', 'color: red', error);
      }
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw {
          status: 0,
          message: 'Network error. Please check your connection.',
        };
      }
      
      // Rethrow the error
      throw error;
    } finally {
      // Clean up the controller
      this.abortControllers.delete(id);
    }
  }

  // Cancel a specific request
  cancelRequest(requestId: string): void {
    if (this.abortControllers.has(requestId)) {
      this.abortControllers.get(requestId)?.abort();
      this.abortControllers.delete(requestId);
    }
  }

  // Cancel all pending requests
  cancelAllRequests(): void {
    this.abortControllers.forEach(controller => {
      controller.abort();
    });
    this.abortControllers.clear();
  }

  // Check API health
  async healthCheck(): Promise<{ status: string; version?: string; uptime?: number }> {
    return this.request<{ status: string; version?: string; uptime?: number }>('/health');
  }

  // Repository endpoints
  async getRepositories(): Promise<Repository[]> {
    return this.request<Repository[]>('/repositories');
  }

  async getRepository(id: number): Promise<Repository> {
    return this.request<Repository>(`/repositories/${id}`);
  }

  async createRepository(url: string): Promise<Repository> {
    return this.request<Repository>('/repositories', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async deleteRepository(id: number): Promise<void> {
    return this.request<void>(`/repositories/${id}`, {
      method: 'DELETE',
    });
  }

  // Files endpoints
  async getFiles(repoId: number): Promise<File[]> {
    return this.request<File[]>(`/repositories/${repoId}/files`);
  }

  async getFile(id: number): Promise<File> {
    return this.request<File>(`/files/${id}`);
  }

  // Classes endpoints
  async getClasses(fileId: number): Promise<Class[]> {
    return this.request<Class[]>(`/files/${fileId}/classes`);
  }

  async getClass(id: number): Promise<Class> {
    return this.request<Class>(`/classes/${id}`);
  }

  // Methods endpoints
  async getMethods(classId: number): Promise<Method[]> {
    return this.request<Method[]>(`/classes/${classId}/methods`);
  }

  async getMethod(id: number): Promise<Method> {
    return this.request<Method>(`/methods/${id}`);
  }

  // Fields endpoints
  async getFields(classId: number): Promise<Field[]> {
    return this.request<Field[]>(`/classes/${classId}/fields`);
  }

  // Data flow endpoints
  async getDataFlow(repoId: number): Promise<DataFlow> {
    return this.request<DataFlow>(
      `/repositories/${repoId}/dataflow`,
      {},
      `dataflow-${repoId}`
    );
  }

  // Search endpoint
  async searchCode(repoId: number, query: string): Promise<SearchResults> {
    return this.request<SearchResults>(
      `/repositories/${repoId}/search?q=${encodeURIComponent(query)}`,
      {},
      `search-${repoId}`
    );
  }

  // Chat endpoint
  async chatWithCodebase(repoId: number, query: string): Promise<ChatResponse> {
    return this.request<ChatResponse>(
      `/repositories/${repoId}/chat`,
      {
        method: 'POST',
        body: JSON.stringify({ query }),
      },
      `chat-${repoId}`
    );
  }
}

// Export a singleton instance
export const api = new ApiClient();
export default api;