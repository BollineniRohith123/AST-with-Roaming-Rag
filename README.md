# AST Analysis System with RAG Integration

A comprehensive system for analyzing Java and Spark codebases, extracting detailed metadata about data pipelines, and providing an interactive UI with flow charts, diagrams, and natural language querying capabilities.

## Features

- **AST Analysis**: Extract detailed information from Java and Spark programs
- **Code Structure Visualization**: Browse files, classes, methods, and their relationships
- **Data Flow Visualization**: Interactive flow charts showing data sources, transformations, and sinks
- **Chat with Codebase**: Query the codebase using natural language via a roaming RAG approach
- **GitHub Integration**: Clone and analyze repositories seamlessly

## System Architecture

The system consists of several components:

- **Frontend**: Next.js application with TypeScript and Tailwind CSS
- **Backend**: Node.js API server with Express
- **Java Parser**: Java service using JavaParser for AST analysis
- **Database**: PostgreSQL for metadata storage
- **RAG**: Ollama with LLaMA 3.3 1B model and Nomic embeddings

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Java 11+ and Maven (for local development)
- PostgreSQL (for local development)
- Ollama (for local development)

## Quick Start with Docker

The easiest way to run the complete system is using Docker Compose:

```bash
# Clone this repository
git clone https://github.com/yourusername/ast-analysis-system.git
cd ast-analysis-system

# Make the setup script executable
chmod +x setup.sh

# Run the setup script
./setup.sh
```

This will:
1. Build the Java parser
2. Set up the database
3. Pull required Ollama models
4. Start all services

Once setup is complete, you can access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api

## Manual Setup

### Java Parser

```bash
cd java-parser
mvn clean package
mkdir -p ../backend/lib
cp target/java-parser-1.0-SNAPSHOT-jar-with-dependencies.jar ../backend/lib/java-parser.jar
```

### Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE ast_analysis;"

# Set up schema
cd backend
node scripts/setup-db.js
```

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
npm install
npm start
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your configuration
npm install
npm run dev
```

### Ollama

```bash
# Install Ollama: https://ollama.com/
ollama pull llama3.3:1b
ollama pull nomic-embed-text
```

## Usage

1. **Add a Repository**: Enter a GitHub URL to clone and analyze a repository
2. **Browse Code Structure**: Navigate through files, classes, and methods
3. **View Data Flow**: See the data pipeline visualized as a flow chart
4. **Chat with Codebase**: Ask questions about the code in natural language

## Development

### Backend API Development

```bash
cd backend
npm run dev
```

### Frontend Development

```bash
cd frontend
npm run dev
```

### Java Parser Development

```bash
cd java-parser
mvn clean package
```

## System Design Details

### AST Analysis

The system uses JavaParser to parse Java and Spark code into Abstract Syntax Trees, which are then analyzed to extract:

- Classes, methods, and fields
- Data sources (tables, files, etc.)
- Transformations (filters, maps, joins, etc.)
- Data sinks (output tables, files, etc.)

### Roaming RAG Approach

Instead of using a traditional vector database, the system employs a roaming RAG approach where the LLaMA 3.3 1B model navigates the codebase hierarchically using tools:

1. `list_files()`: Get all files in the repository
2. `get_file_structure()`: Get classes and methods in a file
3. `get_method_code()`: Get the code of a specific method
4. `get_spark_data_flow()`: Get Spark data flow information for a file
5. `search_code()`: Search for code using keywords

This approach allows for more precise and contextual responses to user queries.

## License

MIT