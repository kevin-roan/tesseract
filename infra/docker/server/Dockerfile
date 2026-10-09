# syntax=docker/dockerfile:1

# Tesseract server container: a systemd machine that runs under sysbox-runc. Build context = this directory:
#   docker build -t tesseract/server:dev infra/docker/server
# Runs its own Docker daemon and joins the tailnet as its own node with Tailscale SSH.

ARG DEBIAN_IMAGE=debian:trixie-slim

FROM ${DEBIAN_IMAGE}
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ARG DEBIAN_FRONTEND=noninteractive
ARG TESSERACT_IMAGE_VERSION=1

LABEL dev.tesseract.role=server \
      dev.tesseract.image-version=${TESSERACT_IMAGE_VERSION}

ENV LANG=C.UTF-8 TZ=UTC container=docker

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      systemd systemd-sysv dbus ca-certificates curl gnupg iproute2 iputils-ping \
      less nano vim-tiny sudo procps htop git rsync unzip jq locales tzdata \
      docker.io docker-cli docker-compose containerd \
 && install -d -m 0755 /usr/share/keyrings \
 && curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.noarmor.gpg -o /usr/share/keyrings/tailscale-archive-keyring.gpg \
 && curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.tailscale-keyring.list -o /etc/apt/sources.list.d/tailscale.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends tailscale \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN systemctl mask \
      systemd-firstboot.service systemd-udevd.service systemd-modules-load.service \
      sys-kernel-config.mount sys-kernel-debug.mount sys-kernel-tracing.mount tmp.mount getty@tty1.service \
 && rm -f /etc/machine-id /var/lib/dbus/machine-id && touch /etc/machine-id

COPY rootfs/ /
RUN chmod 0755 /usr/local/sbin/tesseract-tailnet-up \
 && install -d -m 0700 /etc/tesseract \
 && systemctl enable docker.service containerd.service tailscaled.service tesseract-tailnet.service

STOPSIGNAL SIGRTMIN+3
ENTRYPOINT ["/sbin/init"]
