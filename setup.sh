#!/bin/bash

# AST Analysis System Setup Script
# This script sets up the AST Analysis System by building the Java parser,
# installing dependencies, and initializing the database.

set -e  # Exit on error

# Print colored text
print_color() {
  local color=$1
  local text=$2
  
  case $color in
    "green") echo -e "\033[0;32m$text\033[0m" ;;
    "red") echo -e "\033[0;31m$text\033[0m" ;;
    "yellow") echo -e "\033[0;33m$text\033[0m" ;;
    "blue") echo -e "\033[0;34m$text\033[0m" ;;
    *) echo "$text" ;;
  esac
}

# Check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
  print_color "blue" "Checking prerequisites..."
  
  # Check Docker
  if ! command_exists docker; then
    print_color "red" "Docker is not installed. Please install Docker and try again."
    print_color "yellow" "Visit https://docs.docker.com/get-docker/ for installation instructions."
    exit 1
  fi
  
  # Check Docker Compose
  if ! command_exists docker-compose; then
    print_color "red" "Docker Compose is not installed. Please install Docker Compose and try again."
    print_color "yellow" "Visit https://docs.docker.com/compose/install/ for installation instructions."
    exit 1
  fi
  
  # Check if port 8001 is available
  if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null ; then
    print_color "red" "Port 8001 is already in use. Please free up this port before continuing."
    exit 1
  fi
  
  # Check if port 3001 is available
  if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    print_color "red" "Port 3001 is already in use. Please free up this port before continuing."
    exit 1
  fi
  
  print_color "green" "All prerequisites are met!"
}

# Create necessary directories
create_directories() {
  print_color "blue" "Creating necessary directories..."
  
  mkdir -p repos
  mkdir -p backend/logs
  mkdir -p database
  
  print_color "green" "Directories created!"
}

# Create database initialization script
create_db_init_script() {
  print_color "blue" "Creating database initialization script..."
  
  cat > database/init.sql << 'EOF'
-- Initialize database schema for AST Analysis System

-- Create tables
CREATE TABLE IF NOT EXISTS repositories (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  clone_path TEXT NOT NULL,
  status TEXT DEFAULT 'processing',
  status_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  package_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_interface BOOLEAN DEFAULT FALSE,
  extends_class TEXT[],
  implements_interfaces TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS methods (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  return_type TEXT NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  is_static BOOLEAN DEFAULT FALSE,
  parameters JSONB,
  body TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fields (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  is_static BOOLEAN DEFAULT FALSE,
  initial_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spark_sources (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  arguments TEXT,
  variable_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spark_transformations (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  arguments JSONB,
  dataframe_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spark_sinks (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  arguments JSONB,
  dataframe_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_files_repo_id ON files(repo_id);
CREATE INDEX IF NOT EXISTS idx_classes_file_id ON classes(file_id);
CREATE INDEX IF NOT EXISTS idx_methods_class_id ON methods(class_id);
CREATE INDEX IF NOT EXISTS idx_fields_class_id ON fields(class_id);
CREATE INDEX IF NOT EXISTS idx_spark_sources_file_id ON spark_sources(file_id);
CREATE INDEX IF NOT EXISTS idx_spark_transformations_file_id ON spark_transformations(file_id);
CREATE INDEX IF NOT EXISTS idx_spark_sinks_file_id ON spark_sinks(file_id);

-- Create functions and triggers for full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Function to update or insert into the search index
CREATE OR REPLACE FUNCTION update_method_search_index() RETURNS TRIGGER AS $$
BEGIN
  -- Create combined text for search
  NEW.search_text := 
    NEW.name || ' ' || 
    NEW.return_type || ' ' || 
    COALESCE(NEW.body, '');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add search_text column to methods if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'methods' AND column_name = 'search_text'
  ) THEN
    ALTER TABLE methods ADD COLUMN search_text TEXT;
    
    -- Create index on search_text
    CREATE INDEX IF NOT EXISTS idx_methods_search_text ON methods USING GIN (search_text gin_trgm_ops);
    
    -- Create trigger for updating search_text
    CREATE TRIGGER methods_search_update
      BEFORE INSERT OR UPDATE ON methods
      FOR EACH ROW
      EXECUTE FUNCTION update_method_search_index();
      
    -- Update existing records
    UPDATE methods SET search_text = 
      name || ' ' || 
      return_type || ' ' || 
      COALESCE(body, '');
  END IF;
END;
$$;

EOF
  
  print_color "green" "Database initialization script created!"
}

# Pull Ollama models
pull_ollama_models() {
  print_color "blue" "Checking if Ollama is available to pull models..."
  
  # Check if Ollama is installed locally
  if command_exists ollama; then
    print_color "blue" "Pulling Ollama models (this might take a while)..."
    
    # Pull LLaMA 3.3 1B model
    print_color "yellow" "Pulling LLaMA 3.3 1B model..."
    ollama pull llama3.3:1b
    
    print_color "green" "Ollama models pulled successfully!"
  else
    print_color "yellow" "Ollama not found locally. Models will be pulled when the container starts."
    print_color "yellow" "Note: This will delay the first startup of the system."
  fi
}

# Build and start the containers
build_and_start_containers() {
  print_color "blue" "Building and starting Docker containers..."
  
  docker-compose build
  docker-compose up -d
  
  print_color "green" "Docker containers started successfully!"
}

# Print final instructions
print_instructions() {
  print_color "green" "==================================================="
  print_color "green" " AST Analysis System Setup Complete"
  print_color "green" "==================================================="
  print_color "blue" "The system is now running at:"
  print_color "yellow" "  * Frontend: http://localhost:8001"
  print_color "yellow" "  * Backend API: http://localhost:3001/api"
  print_color "blue" "You can now add repositories and start analyzing code!"
  print_color "yellow" "Note: The first startup might take a few minutes as the Ollama model is downloaded."
  print_color "green" "==================================================="
}

# Handle cleanup on script exit
cleanup() {
  if [ $? -ne 0 ]; then
    print_color "red" "Setup failed. Cleaning up..."
    print_color "yellow" "You may need to run 'docker-compose down' to clean up any containers that were started."
  fi
}

# Main function
main() {
  trap cleanup EXIT
  
  print_color "blue" "Starting AST Analysis System setup..."
  
  # Check prerequisites
  check_prerequisites
  
  # Create necessary directories
  create_directories
  
  # Create database initialization script
  create_db_init_script
  
  # Pull Ollama models if possible
  pull_ollama_models
  
  # Build and start containers
  build_and_start_containers
  
  # Print final instructions
  print_instructions
}

# Run the main function
main