FROM node:20-alpine
ENV PORT=3000
# Install pnpm
# Pin pnpm to the exact version that generated pnpm-lock.yaml (lockfileVersion 9.0). `pnpm@latest`
# drifted to pnpm 11, which requires Node >= 22.13 (uses the node:sqlite builtin) and crashes on this
# node:20-alpine base with ERR_UNKNOWN_BUILTIN_MODULE. Pinning keeps the build deterministic + on Node 20.
RUN corepack enable && corepack prepare pnpm@10.33.1 --activate
# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
# Installing dependencies
# pnpm-workspace.yaml carries the `overrides` block (pnpm 10 stores overrides there, not in
# package.json). The lockfile records those overrides, so a --frozen-lockfile install fails with
# ERR_PNPM_LOCKFILE_CONFIG_MISMATCH unless this file is present in the build context too.
COPY package*.json pnpm-lock.yaml* pnpm-workspace.yaml* /usr/src/app/
RUN pnpm install --frozen-lockfile
# Copying source files
COPY . /usr/src/app
# Building app
RUN pnpm run build
EXPOSE 3000
# Running the app
CMD ["pnpm", "run", "start"]
