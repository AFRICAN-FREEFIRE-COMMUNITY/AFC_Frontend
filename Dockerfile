FROM node:20-alpine
ENV PORT=3000
# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
# Installing dependencies
COPY package*.json pnpm-lock.yaml* /usr/src/app/
RUN pnpm install --frozen-lockfile
# Copying source files
COPY . /usr/src/app
# Building app
RUN pnpm run build
EXPOSE 3000
# Running the app
CMD ["pnpm", "run", "start"]
