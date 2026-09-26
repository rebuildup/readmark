# readmark — Containerfile (NOT Dockerfile; per rebuildup/project-init
# stack discipline). Static-build-only image. The deployed artefact is the
# `dist/` produced by `bun run build`; this image serves it.
#
# Build:   podman build -t readmark:dev -f Containerfile .
# Run:     podman run --rm -p 8080:8080 readmark:dev
#
# No Python, no Node runtime in the production image — only a static-file
# server. Runtime secrets are NOT baked into the image; they are injected at
# deploy time by the platform (see docs/architecture.md).

FROM mirror.gcr.io/library/node:24.11.0-alpine AS build
WORKDIR /src

# Copy lockfile first for deterministic layer cache.
COPY package.json bun.lock* ./
RUN corepack disable && bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- runtime stage ---
FROM mirror.gcr.io/library/nginx:1.27-alpine AS runtime
COPY --from=build /src/dist /usr/share/nginx/html
COPY ./scripts/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1