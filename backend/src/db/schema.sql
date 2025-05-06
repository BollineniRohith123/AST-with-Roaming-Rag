-- Database schema for AST Analysis System

-- Files table stores information about each file
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    package_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Repositories table stores information about each GitHub repository
CREATE TABLE repositories (
    id SERIAL PRIMARY KEY,
    url VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    clone_path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes table stores information about each class or interface
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_interface BOOLEAN DEFAULT FALSE,
    extends_class VARCHAR(255)[],
    implements_interfaces VARCHAR(255)[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Methods table stores information about each method
CREATE TABLE methods (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    return_type VARCHAR(255),
    is_public BOOLEAN DEFAULT TRUE,
    is_static BOOLEAN DEFAULT FALSE,
    parameters JSONB,
    body TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Fields table stores information about class fields/variables
CREATE TABLE fields (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    is_static BOOLEAN DEFAULT FALSE,
    initial_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Method calls within methods
CREATE TABLE method_calls (
    id SERIAL PRIMARY KEY,
    method_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (method_id) REFERENCES methods(id) ON DELETE CASCADE
);

-- Variables within methods
CREATE TABLE variables (
    id SERIAL PRIMARY KEY,
    method_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    initial_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (method_id) REFERENCES methods(id) ON DELETE CASCADE
);

-- Spark sources (data inputs)
CREATE TABLE spark_sources (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL,
    type VARCHAR(255) NOT NULL,
    arguments TEXT,
    variable_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Spark transformations
CREATE TABLE spark_transformations (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL,
    type VARCHAR(255) NOT NULL,
    arguments JSONB,
    dataframe_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Spark sinks (data outputs)
CREATE TABLE spark_sinks (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL,
    type VARCHAR(255) NOT NULL,
    arguments JSONB,
    dataframe_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_files_repo_id ON files(repo_id);
CREATE INDEX idx_classes_file_id ON classes(file_id);
CREATE INDEX idx_methods_class_id ON methods(class_id);
CREATE INDEX idx_fields_class_id ON fields(class_id);
CREATE INDEX idx_method_calls_method_id ON method_calls(method_id);
CREATE INDEX idx_variables_method_id ON variables(method_id);
CREATE INDEX idx_spark_sources_file_id ON spark_sources(file_id);
CREATE INDEX idx_spark_transformations_file_id ON spark_transformations(file_id);
CREATE INDEX idx_spark_sinks_file_id ON spark_sinks(file_id);