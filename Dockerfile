# Use a Node.js base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install application dependencies
RUN npm install

# Install elastic-apm-node
RUN npm install elastic-apm-node --save

# Copy the rest of the application code
COPY . .

# Expose the port your application will run on
EXPOSE 3735 

# Define environment variables for APM Server
#ENV APM_SERVER_URL=http://0.0.0.0:8200

# Start your Node.js application
CMD ["node", "index.js"]