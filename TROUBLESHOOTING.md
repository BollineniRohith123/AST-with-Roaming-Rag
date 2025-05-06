# AST Analysis System Troubleshooting Guide

This guide helps you diagnose and fix common issues with the AST Analysis System.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Docker Errors](#docker-errors)
3. [Database Issues](#database-issues)
4. [Backend API Issues](#backend-api-issues)
5. [Frontend Issues](#frontend-issues)
6. [Java Parser Issues](#java-parser-issues)
7. [Ollama Issues](#ollama-issues)
8. [Repository Analysis Issues](#repository-analysis-issues)
9. [Chat Functionality Issues](#chat-functionality-issues)

## Installation Issues

### Setup script fails

**Symptoms**:
- Setup script (`setup.sh`) exits with an error
- Not all containers are running

**Solutions**:
1. Make sure you have Docker and Docker Compose installed:
   ```bash
   docker --version
   docker-compose --version
   ```

2. Check for port conflicts:
   ```bash
   lsof -i :8001
   lsof -i :3001
   lsof -i :5432
   lsof -i :11434
   ```
   If there are any services using these ports, stop them or change the ports in the `docker-compose.yml` file.

3. Manually run the setup steps:
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

### Permission errors

**Symptoms**:
- "Permission denied" errors during setup

**Solutions**:
1. Make sure the setup script is executable:
   ```bash
   chmod +x setup.sh
   ```

2. Run the script with sudo if Docker requires it:
   ```bash
   sudo ./setup.sh
   ```

## Docker Errors

### Containers not starting

**Symptoms**:
- `docker-compose ps` shows containers in a stopped or restarting state

**Solutions**:
1. Check the container logs:
   ```bash
   docker-compose logs [service-name]
   ```

2. Ensure Docker has enough resources allocated (especially memory for Ollama)

3. Try rebuilding and restarting:
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

### Out of disk space

**Symptoms**:
- "No space left on device" errors
- Docker containers failing to start

**Solutions**:
1. Clean up unused Docker resources:
   ```bash
   docker system prune -a
   ```

2. Remove existing volumes to start fresh (caution - this removes all data):
   ```bash
   docker-compose down -v
   ```

## Database Issues

### Connection errors

**Symptoms**:
- Backend logs show database connection errors
- Repository analysis fails with database errors

**Solutions**:
1. Check if the PostgreSQL container is running:
   ```bash
   docker-compose ps postgres
   ```

2. Check PostgreSQL logs:
   ```bash
   docker-compose logs postgres
   ```

3. Ensure database initialization was successful:
   ```bash
   docker-compose exec postgres psql -U postgres -d ast_analysis -c "\dt"
   ```

### Migration issues

**Symptoms**:
- "Relation does not exist" errors
- Missing tables or columns

**Solutions**:
1. Manually run the database initialization script:
   ```bash
   docker-compose exec postgres psql -U postgres -d ast_analysis -f /docker-entrypoint-initdb.d/init.sql
   ```

## Backend API Issues

### API not responding

**Symptoms**:
- "Connection refused" when accessing the API
- Frontend shows API connection errors

**Solutions**:
1. Check if the backend container is running:
   ```bash
   docker-compose ps backend
   ```

2. Check backend logs:
   ```bash
   docker-compose logs backend
   ```

3. Verify the API is accessible:
   ```bash
   curl http://localhost:3001/api/health
   ```

### Node.js errors

**Symptoms**:
- JavaScript errors in the backend logs
- API crashes with stack traces

**Solutions**:
1. Update dependencies:
   ```bash
   docker-compose exec backend npm install
   ```

2. Restart the backend:
   ```bash
   docker-compose restart backend
   ```

## Frontend Issues

### Frontend not loading

**Symptoms**:
- Blank page when accessing http://localhost:8001
- JavaScript console errors

**Solutions**:
1. Check if the frontend container is running:
   ```bash
   docker-compose ps frontend
   ```

2. Check frontend logs:
   ```bash
   docker-compose logs frontend
   ```

3. Ensure API URL is correctly set in the environment:
   ```bash
   docker-compose exec frontend env | grep NEXT_PUBLIC_API_URL
   ```

### UI rendering issues

**Symptoms**:
- Components not displaying properly
- Layout broken

**Solutions**:
1. Clear browser cache and reload

2. Try a different browser

3. Rebuild the frontend:
   ```bash
   docker-compose build frontend
   docker-compose up -d frontend
   ```

## Java Parser Issues

### Parser not running or crashing

**Symptoms**:
- "Java parser JAR not found" errors
- Repository analysis fails without parsing files

**Solutions**:
1. Check if the Java parser container is running:
   ```bash
   docker-compose ps java-parser
   ```

2. Check Java parser logs:
   ```bash
   docker-compose logs java-parser
   ```

3. Rebuild the Java parser:
   ```bash
   docker-compose build java-parser
   docker-compose up -d java-parser
   ```

### Out of memory errors

**Symptoms**:
- "OutOfMemoryError" in Java parser logs
- Parser crashes when processing large files

**Solutions**:
1. Increase memory allocation in `docker-compose.yml`:
   ```yaml
   java-parser:
     deploy:
       resources:
         limits:
           memory: 2G
   ```

## Ollama Issues

### Ollama not starting

**Symptoms**:
- Ollama container in a restart loop
- "Chat with codebase" feature not working

**Solutions**:
1. Check Ollama logs:
   ```bash
   docker-compose logs ollama
   ```

2. Ensure the Ollama model is downloaded:
   ```bash
   docker-compose exec ollama ollama list
   ```

3. Manually pull the model:
   ```bash
   docker-compose exec ollama ollama pull llama3.3:1b
   ```

### GPU issues

**Symptoms**:
- "No NVIDIA driver found" errors
- Ollama running in CPU mode (slow)

**Solutions**:
1. Install NVIDIA drivers and Docker GPU support:
   ```bash
   # Install NVIDIA Container Toolkit
   distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
   curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
   curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
   sudo systemctl restart docker
   ```

2. Verify GPU support:
   ```bash
   docker run --gpus all nvidia/cuda:11.0-base nvidia-smi
   ```

## Repository Analysis Issues

### Cloning fails

**Symptoms**:
- "Git clone failed" errors
- Repository status shows "error"

**Solutions**:
1. Check if the repository URL is valid and accessible

2. Ensure the system has network access to GitHub/GitLab

3. Try cloning manually:
   ```bash
   docker-compose exec backend git clone <repo-url> /tmp/test-repo
   ```

### Analysis fails

**Symptoms**:
- Repository status remains "processing" indefinitely
- Error messages in the repository status

**Solutions**:
1. Check backend logs for errors:
   ```bash
   docker-compose logs backend
   ```

2. Check Java parser logs:
   ```bash
   docker-compose logs java-parser
   ```

3. Try analyzing a simpler repository to isolate the issue

## Chat Functionality Issues

### Chat not responding

**Symptoms**:
- Chat interface shows loading indefinitely
- "Failed to process query" errors

**Solutions**:
1. Check if Ollama is running properly:
   ```bash
   docker-compose logs ollama
   ```

2. Ensure the model is loaded:
   ```bash
   docker-compose exec ollama ollama list
   ```

3. Try restarting the Ollama container:
   ```bash
   docker-compose restart ollama
   ```

### Poor response quality

**Symptoms**:
- Chat responses are generic or incorrect
- Model fails to understand code context

**Solutions**:
1. Make sure the repository has been fully analyzed (status should be "processed")

2. Check if all files were parsed correctly by viewing the Statistics tab

3. Try more specific questions or provide better context in your queries

## Additional Help

If you encounter issues not covered in this guide, please try the following:

1. Check all container logs for errors:
   ```bash
   docker-compose logs
   ```

2. Try a complete restart of all services:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. Verify system requirements:
   - Docker version 20.10.0 or later
   - Docker Compose version 2.0.0 or later
   - At least 8GB RAM (more recommended for Ollama)
   - At least 10GB free disk space

4. Check the GitHub repository for issues and updates