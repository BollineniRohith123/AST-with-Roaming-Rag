FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

# Copy only the POM file first
COPY pom.xml .

# Download dependencies (this layer will be cached if pom.xml doesn't change)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src/ ./src/

# Build the application
RUN mvn package -DskipTests

# Copy the JAR to output directory
RUN mkdir -p /app/output && \
    cp target/java-parser-jar-with-dependencies.jar /app/output/java-parser.jar

# Base image with JRE only for smaller image size
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy the JAR file
COPY --from=build /app/output/java-parser.jar /app/java-parser.jar

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD java -jar /app/java-parser.jar -h || exit 1

# Default command (this container serves as a build step, no need to run anything)
CMD ["echo", "Java parser built successfully"]