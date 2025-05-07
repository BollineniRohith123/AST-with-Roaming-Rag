// API client utility for communicating with the backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api'; // Updated to port 3005

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
  private cache: Map<string, {data: any, timestamp: number}>;
  private cacheLifetime: number = 30000; // 30 seconds cache lifetime

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.abortControllers = new Map();
    this.cache = new Map();

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
    requestId?: string,
    useCache: boolean = true
  ): Promise<T> {
    // For GET requests, check cache if useCache is true
    const isGetRequest = !options.method || options.method === 'GET';
    const cacheKey = `${endpoint}-${JSON.stringify(options.body || {})}`;
    
    if (isGetRequest && useCache && this.cache.has(cacheKey)) {
      const cachedData = this.cache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp) < this.cacheLifetime) {
        console.log(
          `%c[API] ${options.method || 'GET'} ${this.baseUrl}${endpoint} %c(CACHE HIT)`,
          'color: #22c55e; font-weight: bold',
          'color: gray'
        );
        return cachedData.data as T;
      }
    }

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

      // Always log API requests to help with debugging
      console.log(
        `%c[API] ${options.method || 'GET'} ${url} %c(${duration}ms)`,
        'color: #0070f3; font-weight: bold',
        'color: gray'
      );

      // Handle HTTP errors
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        let details = '';

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          details = errorData.details || '';
        } catch (error: any) {
          // Clean up the controller
          this.abortControllers.delete(id);

          // Log all errors for debugging
          console.error('%c[API] Error:', 'color: #ff0000', error);
          console.error(`%c[API] Request: ${options.method || 'GET'} ${url}`, 'color: #ff6600');

          // Ignore AbortError (request was canceled)
          if (error.name === 'AbortError') {
            throw {
              status: 499, // Client Closed Request
              message: 'Request was canceled',
            } as ApiError;
          }

          // Re-throw API errors
          if (error.status) {
            throw error;
          }

          // For network errors, provide more specific information
          if (error instanceof TypeError && error.message.includes('fetch')) {
            console.error('%c[API] Network Error: Check if backend server is running at ' + this.baseUrl, 'color: #ff0000');
            throw {
              status: 0,
              message: 'Network error: Cannot connect to the backend server',
              details: 'Please ensure the backend server is running at ' + this.baseUrl
            } as ApiError;
          }

          // For other errors (network issues, etc.)
          throw {
            status: 0,
            message: error.message || 'Unknown error occurred',
            details: JSON.stringify(error, Object.getOwnPropertyNames(error))
          } as ApiError;
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

      // Store in cache for GET requests
      const isGetRequest = !options.method || options.method === 'GET';
      if (isGetRequest && useCache) {
        const cacheKey = `${endpoint}-${JSON.stringify(options.body || {})}`;
        this.cache.set(cacheKey, {
          data: jsonData,
          timestamp: Date.now()
        });
        
        // Log cache storage
        console.log(
          `%c[API] ${options.method || 'GET'} ${this.baseUrl}${endpoint} %c(CACHED)`,
          'color: #0070f3; font-weight: bold',
          'color: gray'
        );
      }

      // Always log API responses to help with debugging
      console.log('%c[API] Response:', 'color: #00b300', jsonData);

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

      // Handle network errors with more detailed diagnostics
      if (error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('Network request failed'))) {
        console.error(`%c[API] Network Error: Could not connect to backend at ${this.baseUrl}`, 'color: #ff0000; font-weight: bold');
        console.error(`%c[API] Please ensure the backend server is running on port 3005`, 'color: #ff6600');
        
        throw {
          status: 0,
          message: 'Network error: Cannot connect to the backend server',
          details: `Please ensure the backend server is running at ${this.baseUrl} (port 3005)`
        };
      }
      
      // Handle empty error objects or missing properties
      if (typeof error === 'object' && (!error.status || !error.message)) {
        // Check if this is a Java parser related endpoint
        if (endpoint.includes('dataflow') || endpoint.includes('classes')) {
          throw {
            status: 500,
            message: 'Java parsing error',
            details: 'The Java parser might be missing or encountering issues. Check if the Java parser JAR is available in the backend.',
          };
        } else {
          throw {
            status: error.status || 500,
            message: error.message || 'Unknown API error',
            details: error.details || 'No additional details available',
          };
        }
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
    try {
      return await this.request<Repository[]>('/repositories');
    } catch (error: any) {
      // If we hit rate limit, return empty array instead of throwing
      if (error.status === 429) {
        console.warn('Rate limit hit, returning empty repositories array');
        return [];
      }
      throw error;
    }
  }

  async getRepository(id: number | string): Promise<Repository> {
    // Ensure id is a valid number
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    
    // Validate that the ID is a valid number
    if (isNaN(numericId)) {
      throw {
        status: 400,
        message: 'Invalid repository ID',
        details: 'Repository ID must be a valid number'
      } as ApiError;
    }

    // Re-throw API errors
    if (error.status) {
      throw error;
    }

    // For network errors, provide more specific information
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('%c[API] Network Error: Check if backend server is running at ' + this.baseUrl, 'color: #ff0000');
      throw {
        status: 0,
        message: 'Network error: Cannot connect to the backend server',
        details: 'Please ensure the backend server is running at ' + this.baseUrl
      } as ApiError;
    }

    // For other errors (network issues, etc.)
    throw {
      status: 0,
      message: error.message || 'Unknown error occurred',
      details: JSON.stringify(error, Object.getOwnPropertyNames(error))
    } as ApiError;
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

// Store in cache for GET requests
const isGetRequest = !options.method || options.method === 'GET';
if (isGetRequest && useCache) {
  const cacheKey = `${endpoint}-${JSON.stringify(options.body || {})}`;
  this.cache.set(cacheKey, {
    data: jsonData,
    timestamp: Date.now()
  });
  
  // Log cache storage
  console.log(
    `%c[API] ${options.method || 'GET'} ${this.baseUrl}${endpoint} %c(CACHED)`,
    'color: #0070f3; font-weight: bold',
    'color: gray'
  );
}

// Always log API responses to help with debugging
console.log('%c[API] Response:', 'color: #00b300', jsonData);

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

  // Handle network errors with more detailed diagnostics
  if (error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('Network request failed'))) {
    console.error(`%c[API] Network Error: Could not connect to backend at ${this.baseUrl}`, 'color: #ff0000; font-weight: bold');
    console.error(`%c[API] Please ensure the backend server is running on port 3005`, 'color: #ff6600');
    
    throw {
      status: 0,
      message: 'Network error: Cannot connect to the backend server',
      details: `Please ensure the backend server is running at ${this.baseUrl} (port 3005)`
    };
  }
  
  // Handle empty error objects or missing properties
  if (typeof error === 'object' && (!error.status || !error.message)) {
    // Check if this is a Java parser related endpoint
    if (endpoint.includes('dataflow') || endpoint.includes('classes')) {
      throw {
        status: 500,
        message: 'Java parsing error',
        details: 'The Java parser might be missing or encountering issues. Check if the Java parser JAR is available in the backend.',
      };
    } else {
      throw {
        status: error.status || 500,
        message: error.message || 'Unknown API error',
        details: error.details || 'No additional details available',
      };
    }
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

// Clear cache for specific endpoint or all cache if no endpoint provided
clearCache(endpoint?: string): void {
  if (endpoint) {
    // Clear all entries that start with this endpoint
    for (const key of this.cache.keys()) {
      if (key.startsWith(endpoint)) {
        this.cache.delete(key);
      }
    }
    console.log(`%c[API] Cache cleared for endpoint: ${endpoint}`, 'color: #9333ea; font-weight: bold');
  } else {
    // Clear all cache
    this.cache.clear();
    console.log('%c[API] All cache cleared', 'color: #9333ea; font-weight: bold');
  }
}

// Repository endpoints
async getRepositories(): Promise<Repository[]> {
  return this.request<Repository[]>('/repositories');
}

async getRepository(id: number, useCache: boolean = true): Promise<Repository> {
  const endpoint = `/repositories/${id}`;
  return this.request<Repository>(endpoint, {}, endpoint, useCache);
}

async createRepository(url: string, name: string, description: string = ''): Promise<Repository> {
  return this.request<Repository>('/repositories', {
    method: 'POST',
    body: JSON.stringify({ url, name, description }),
  });
}

async deleteRepository(id: number): Promise<void> {
  return this.request<void>(`/repositories/${id}`, {
    method: 'DELETE',
  });
}

// Files endpoints
async getFiles(repositoryId: number, useCache: boolean = true): Promise<File[]> {
  const endpoint = `/repositories/${repositoryId}/files`;
  return this.request<File[]>(endpoint, {}, endpoint, useCache);
}

async getFile(id: number): Promise<File> {
  return this.request<File>(`/files/${id}`);
}

// Classes endpoints
async getClasses(fileId: number | string): Promise<Class[]> {
  // Ensure fileId is a valid number
  const numericId = typeof fileId === 'string' ? parseInt(fileId, 10) : fileId;
  
  // Validate that the ID is a valid number
  if (isNaN(numericId)) {
    throw {
      status: 400,
      message: 'Invalid file ID',
      details: 'File ID must be a valid number'
    } as ApiError;
  }
  
  return this.request<Class[]>(`/files/${numericId}/classes`);
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
  // Ensure classId is a valid number
  const numericId = typeof classId === 'string' ? parseInt(classId as string, 10) : classId;
  
  // Validate that the ID is a valid number
  if (isNaN(numericId)) {
    throw {
      status: 400,
      message: 'Invalid class ID',
      details: 'Class ID must be a valid number'
    } as ApiError;
  }
  
  return this.request<Field[]>(`/classes/${numericId}/fields`);
}

// Data flow endpoints
async getDataFlow(repoId: number | string): Promise<DataFlow> {
  // Ensure repoId is a valid number
  const numericId = typeof repoId === 'string' ? parseInt(repoId, 10) : repoId;
  
  // Validate that the ID is a valid number
  if (isNaN(numericId)) {
    throw {
      status: 400,
      message: 'Invalid repository ID',
      details: 'Repository ID must be a valid number'
    } as ApiError;
  }
  
  return this.request<DataFlow>(`/repositories/${numericId}/dataflow`);
}

async searchCode(repoId: number | string, query: string): Promise<SearchResults> {
  // Ensure repoId is a valid number
  const numericId = typeof repoId === 'string' ? parseInt(repoId, 10) : repoId;
  
  // Validate that the ID is a valid number
  if (isNaN(numericId)) {
    throw {
      status: 400,
      message: 'Invalid repository ID',
      details: 'Repository ID must be a valid number'
    } as ApiError;
  }
  
  return this.request<SearchResults>(
    `/repositories/${numericId}/search?q=${encodeURIComponent(query)}`,
    {},
    `search-${numericId}-${query.substring(0, 20)}`
  );
}

// Chat endpoint
async chatWithCodebase(repoId: number | string, query: string): Promise<ChatResponse> {
  // Ensure repoId is a valid number
  const numericId = typeof repoId === 'string' ? parseInt(repoId, 10) : repoId;
  
  // Validate that the ID is a valid number
  if (isNaN(numericId)) {
    throw {
      status: 400,
      message: 'Invalid repository ID',
      details: 'Repository ID must be a valid number'
    } as ApiError;
  }
  
  return this.request<ChatResponse>(
    `/repositories/${numericId}/chat`,
    {
      method: 'POST',
      body: JSON.stringify({ query }),
    },
    `chat-${numericId}`
  );
}
    const numericId = typeof repoId === 'string' ? parseInt(repoId, 10) : repoId;
    
    // Validate that the ID is a valid number
    if (isNaN(numericId)) {
      throw {
        status: 400,
        message: 'Invalid repository ID',
        details: 'Repository ID must be a valid number'
      } as ApiError;
    }
    
    return this.request<File[]>(`/repositories/${numericId}/files`);
  }

  async getFile(id: number): Promise<File> {
    return this.request<File>(`/files/${id}`);
  }

  // Classes endpoints
  async getClasses(fileId: number | string): Promise<Class[]> {
    // Ensure fileId is a valid number
    const numericId = typeof fileId === 'string' ? parseInt(fileId, 10) : fileId;
    
    // Validate that the ID is a valid number
    if (isNaN(numericId)) {
      throw {
        status: 400,
        message: 'Invalid file ID',
        details: 'File ID must be a valid number'
      } as ApiError;
    }
    
    return this.request<Class[]>(`/files/${numericId}/classes`);
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
    // Ensure classId is a valid number
    const numericId = typeof classId === 'string' ? parseInt(classId as string, 10) : classId;
    
    // Validate that the ID is a valid number
    if (isNaN(numericId)) {
      throw {
        status: 400,
        message: 'Invalid class ID',
        details: 'Class ID must be a valid number'
      } as ApiError;
    }
    
    return this.request<Field[]>(`/classes/${numericId}/fields`);
  }

  // Data flow endpoints
  async getDataFlow(repoId: number | string): Promise<DataFlow> {
    // Ensure repoId is a valid number
    const numericId = typeof repoId === 'string' ? parseInt(repoId, 10) : repoId;
    
    // Validate that the ID is a valid number
    if (isNaN(numericId)) {
      throw {
        status: 400,
        message: 'Invalid repository ID',
        details: 'Repository ID must be a valid number'
      } as ApiError;
    }
    
    return this.request<DataFlow>(`/repositories/${numericId}/dataflow`);
  }
  async searchCode(repoId: number | string, query: string): Promise<SearchResults> {
    // Ensure repoId is a valid number
    const numericId = typeof repoId === 'string' ? parseInt(repoId, 10) : repoId;
    
    // Validate that the ID is a valid number
    if (isNaN(numericId)) {
      throw {
        status: 400,
        message: 'Invalid repository ID',
        details: 'Repository ID must be a valid number'
      } as ApiError;
    }
    
    return this.request<SearchResults>(
      `/repositories/${numericId}/search?q=${encodeURIComponent(query)}`,
      {},
      `search-${numericId}-${query.substring(0, 20)}`
    );
  }

  // Chat endpoint
  async chatWithCodebase(repoId: number | string, query: string): Promise<ChatResponse> {
    // Ensure repoId is a valid number
    const numericId = typeof repoId === 'string' ? parseInt(repoId, 10) : repoId;
    
    // Validate that the ID is a valid number
    if (isNaN(numericId)) {
      throw {
        status: 400,
        message: 'Invalid repository ID',
        details: 'Repository ID must be a valid number'
      } as ApiError;
    }
    
    return this.request<ChatResponse>(
      `/repositories/${numericId}/chat`,
      {
        method: 'POST',
        body: JSON.stringify({ query }),
      },
      `chat-${numericId}`
    );
  }
}

// Export a singleton instance
export const api = new ApiClient();
export default api;