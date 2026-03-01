# IberonKit LiveKit (Self-Hosted)

This folder contains a self-hosted LiveKit deployment using Docker Compose.

## Included

- `docker-compose.yml`: LiveKit server + Redis.
- `livekit.yaml`: LiveKit runtime config.
- `.env.example`: API key/secret template.
- `scripts/bootstrap.sh`: one-command setup + deployment.

## Quick Start

1. Open a terminal in this folder:

```bash
cd /Users/master/Downloads/ubiquitous-waffle-dev/IberonKit
```

2. Bootstrap and deploy:

```bash
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh
```

The script creates `.env` (if missing), pulls images, and starts the stack.

## Endpoints and Ports

- Signal URL: `ws://localhost:7880`
- TCP fallback: `7881`
- RTC UDP: `50000-50100/udp`

## Manage

```bash
docker compose ps
docker compose logs -f livekit
docker compose down
```

## Production Notes

- Set `rtc.use_external_ip: true` in `livekit.yaml` for public cloud hosts.
- Add TURN settings in `livekit.yaml` for better connectivity.
- Put `7880` behind TLS (`wss://`) with a reverse proxy/load balancer.
