#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed."
  exit 1
fi

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
elif docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  echo "docker compose is required but not installed."
  exit 1
fi

# Fallback for environments where Docker credential helpers are configured
# but the helper binary is unavailable.
if ! command -v docker-credential-desktop >/dev/null 2>&1; then
  export DOCKER_CONFIG="$ROOT_DIR/.docker-config"
  mkdir -p "$DOCKER_CONFIG"
  if [[ ! -f "$DOCKER_CONFIG/config.json" ]]; then
    cat > "$DOCKER_CONFIG/config.json" <<EOF
{}
EOF
  fi
fi

if [[ ! -f .env ]]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl is required to generate LIVEKIT_API_SECRET."
    exit 1
  fi

  SECRET="$(openssl rand -hex 32)"
  cat > .env <<EOF
LIVEKIT_API_KEY=iberonkit-devkey
LIVEKIT_API_SECRET=${SECRET}
EOF
  echo "Created .env with generated API credentials."
fi

"${COMPOSE[@]}" pull
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps

echo
echo "LiveKit is running."
echo "Signal URL: ws://localhost:7880"
