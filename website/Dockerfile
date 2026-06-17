# syntax=docker/dockerfile:1

# ---------- build stage: minify + inline + self-host fonts + precompress ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY build.mjs ./
COPY src ./src
RUN node build.mjs

# ---------- runtime: unprivileged nginx serving static from RAM-backed cache ----------
FROM nginxinc/nginx-unprivileged:1-alpine
# Remove the stock default server, drop in ours.
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
# The site lives under /syncdeck so it can be mounted at sidrelabs.com/syncdeck.
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html/syncdeck

EXPOSE 8080
# Image already runs as uid 101 (nginx) and starts nginx in the foreground.
