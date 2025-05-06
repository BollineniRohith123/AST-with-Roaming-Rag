#!/bin/bash

# AST Analysis System Test Script
# This script runs tests for the AST Analysis System components.

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

# Run tests for a specific component
run_tests() {
  local component=$1
  local test_command=$2
  
  print_color "blue" "Running tests for ${component}..."
  
  if [ -z "$test_command" ]; then
    print_color "red" "No test command specified for ${component}"
    return 1
  fi
  
  # Run the test command
  if eval "$test_command"; then
    print_color "green" "${component} tests passed!"
    return 0
  else
    print_color "red" "${component} tests failed!"
    return 1
  fi
}

# Check if containers are running
check_containers() {
  print_color "blue" "Checking if containers are running..."
  
  # Get the list of containers
  local containers=$(docker-compose ps -q)
  
  if [ -z "$containers" ]; then
    print_color "red" "No containers are running. Please run 'docker-compose up -d' first."
    return 1
  fi
  
  # Check if all required containers are running
  local required_containers=("ast-analysis-backend" "ast-analysis-frontend" "ast-analysis-java-parser" "ast-analysis-postgres" "ast-analysis-ollama")
  
  for container in "${required_containers[@]}"; do
    if ! docker ps | grep -q "$container"; then
      print_color "red" "${container} is not running!"
      return 1
    fi
  done
  
  print_color "green" "All required containers are running."
  return 0
}

# Test API endpoints
test_api() {
  print_color "blue" "Testing API endpoints..."
  
  # Test health endpoint
  local health_response=$(curl -s http://localhost:3001/api/health)
  
  if [[ "$health_response" == *"\"status\":\"ok\""* ]]; then
    print_color "green" "Health endpoint is working"
  else
    print_color "red" "Health endpoint failed: $health_response"
    return 1
  fi
  
  # Test repositories endpoint
  local repos_response=$(curl -s http://localhost:3001/api/repositories)
  
  if [[ "$repos_response" == "["* ]] || [[ "$repos_response" == "[]" ]]; then
    print_color "green" "Repositories endpoint is working"
  else
    print_color "red" "Repositories endpoint failed: $repos_response"
    return 1
  fi
  
  print_color "green" "API endpoints tests passed!"
  return 0
}

# Test frontend
test_frontend() {
  print_color "blue" "Testing frontend..."
  
  # Test if the frontend is accessible
  local frontend_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001)
  
  if [ "$frontend_response" -eq 200 ]; then
    print_color "green" "Frontend is accessible"
  else
    print_color "red" "Frontend returned status code: $frontend_response"
    return 1
  fi
  
  print_color "green" "Frontend tests passed!"
  return 0
}

# Run backend unit tests
run_backend_tests() {
  print_color "blue" "Running backend unit tests..."
  
  docker-compose exec -T backend npm test
  
  if [ $? -eq 0 ]; then
    print_color "green" "Backend unit tests passed!"
    return 0
  else
    print_color "red" "Backend unit tests failed!"
    return 1
  fi
}

# Main function
main() {
  print_color "blue" "Starting AST Analysis System tests..."
  
  # Check if containers are running
  if ! check_containers; then
    print_color "red" "Container check failed. Please ensure all containers are running."
    exit 1
  fi
  
  # Test API endpoints
  if ! test_api; then
    print_color "red" "API tests failed."
    exit 1
  fi
  
  # Test frontend
  if ! test_frontend; then
    print_color "red" "Frontend tests failed."
    exit 1
  fi
  
  # Run backend unit tests
  if ! run_backend_tests; then
    print_color "red" "Backend unit tests failed."
    exit 1
  fi
  
  # All tests passed
  print_color "green" "==================================================="
  print_color "green" " All AST Analysis System tests passed!"
  print_color "green" "==================================================="
}

# Run the main function
main