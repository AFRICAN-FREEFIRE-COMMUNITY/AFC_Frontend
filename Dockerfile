FROM node:18-alpine
ENV PORT 3000
# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
# Installing dependencies
COPY package*.json /usr/src/app/
RUN pnpm install
# Copying source files
COPY . /usr/src/app
# Building app
RUN pnpm run build
EXPOSE 3000
# Running the app
CMD "pnpm" "run" "start"
