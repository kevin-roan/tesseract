# Server containers: setup

Design: [server-containers.md](../architecture/server-containers.md).

## 1. Install Sysbox (Linux host)

Follow https://github.com/nestybox/sysbox/blob/master/docs/user-guide/install-package.md.
On Arch, use the AUR package `sysbox-ce-bin`. Then check:

```sh
docker info --format '{{json .Runtimes}}' | grep sysbox-runc
tesseract containers doctor
```

## 2. Build the server image

```sh
tesseract containers build        # or Preferences → Containers → Build image
```

## 3. Tailscale

In the tailnet policy file, add the tag and allow only members to reach it:

```jsonc
"tagOwners": { "tag:tesseract-server": ["autogroup:admin"] },
"grants": [{ "src": ["autogroup:member"], "dst": ["tag:tesseract-server"], "ip": ["*"] }],
"ssh": [{ "action": "check", "src": ["autogroup:member"], "dst": ["tag:tesseract-server"], "users": ["root", "autogroup:nonroot"] }]
```

Don't add any grant with `tag:tesseract-server` as the source. Create a **reusable,
pre-approved** auth key tagged `tag:tesseract-server`, then save it:

```sh
tesseract containers tailscale-key < key.txt
```

## 4. Create a container and SSH in

```sh
tesseract containers create api --cpus 2 --memory 4096
tesseract containers ssh api      # prints: ssh root@api.<tailnet>.ts.net
```

Docker, Postgres and so on are installed inside the container as on any Debian server.

## 5. Publish a URL

Create the Cloudflare token (architecture note, "Cloudflare token") and connect it:

```sh
tesseract domains login < cf-token.txt
tesseract domains add app.example.com api 3000
```

The service must listen on `0.0.0.0:3000` inside the container. Remove a URL with
`tesseract domains rm app.example.com`. If Cloudflare or Docker state drifted, run
`tesseract domains sync`.
