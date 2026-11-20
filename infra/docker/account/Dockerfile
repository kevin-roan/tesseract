# syntax=docker/dockerfile:1

# Tesseract account service (apps/account). Build context = repository root:
#   docker build -f infra/docker/account/Dockerfile -t tesseract/account:dev .
# Compiles a single binary with `bun build --compile` and runs it on a slim Debian base.

ARG BUN_IMAGE=oven/bun:1.4
ARG DEBIAN_IMAGE=debian:trixie-slim

FROM ${BUN_IMAGE} AS build
WORKDIR /src
COPY packages/protocol packages/protocol
COPY apps/account apps/account
RUN printf '{"name":"tesseract-account-build","private":true,"workspaces":["apps/account","packages/protocol"]}\n' > package.json \
 && bun install --production --ignore-scripts \
 && cd apps/account \
 && bun build src/index.ts --compile --minify --sourcemap --outfile /out/tesseract-account

FROM ${DEBIAN_IMAGE}
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && apt-get clean && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 7800 --home-dir /var/lib/tesseract-account --create-home tesseract
COPY --from=build /out/tesseract-account /usr/local/bin/tesseract-account
LABEL dev.tesseract.role=account
ENV ACCOUNT_PORT=7800 ACCOUNT_DATA_DIR=/var/lib/tesseract-account
USER tesseract
VOLUME /var/lib/tesseract-account
EXPOSE 7800
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -fsS http://127.0.0.1:7800/v1/health || exit 1
ENTRYPOINT ["/usr/local/bin/tesseract-account"]
