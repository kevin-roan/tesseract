# Test runner images for infra/tests (built by infra/tests/run, never pushed).
#   bats          Debian + bats-core, its helper libraries, kcov and shellcheck; also has
#                 the dev user (uid 1000) so theone-entrypoint runs in it unchanged.
#   sandbox-bats  the real sandbox image plus the same bats install, for the entrypoint
#                 suite against the image's own tools and templates.
ARG DEBIAN_IMAGE=debian:trixie-slim
ARG SANDBOX_IMAGE=theone/sandbox:latest

FROM ${DEBIAN_IMAGE} AS bats
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bats bats-assert bats-support bats-file kcov shellcheck python3 jq procps ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 1000 dev \
 && useradd --uid 1000 --gid dev --create-home --shell /bin/bash dev

FROM ${SANDBOX_IMAGE} AS sandbox-bats
USER root
COPY --from=bats /usr/bin/bats /usr/bin/bats
COPY --from=bats /usr/lib/bats-core /usr/lib/bats-core
COPY --from=bats /usr/libexec/bats-core /usr/libexec/bats-core
COPY --from=bats /usr/lib/bats /usr/lib/bats
ENTRYPOINT []
