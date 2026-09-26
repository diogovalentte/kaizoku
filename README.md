# <img width="32px" src="./public/kaizoku.png" alt="Kaizoku"></img> Kaizoku

Kaizoku is self-hosted manga downloader.

## Changes in this fork

This is a fork of [oae/kaizoku](https://github.com/oae/kaizoku), which is archived upstream. It changes the following:

### Image

- The image is published to `ghcr.io/diogovalentte/kaizoku` instead of Docker Hub and `ghcr.io/oae/kaizoku`. To use it, set `image: ghcr.io/diogovalentte/kaizoku:latest` in the docker-compose file below.
- Each build is tagged `latest`, `mangal-<mangal version>` and, when built from a git tag, the tag name (e.g. `v1.6.1.6`).
- The multi-arch build (`linux/amd64`, `linux/arm64`) is kept, but with `provenance: false`.

### mangal

- The image ships the [diogovalentte/mangal](https://github.com/diogovalentte/mangal) fork instead of [metafates/mangal](https://github.com/metafates/mangal).
- The mangal version is a Docker build arg, `MANGAL_VERSION` (default `v4.0.6-3`), instead of being hardcoded in the Dockerfile.
- Custom mangal Lua sources go in `/config/.config/mangal/sources` inside the container.

### Build and release

- release-please was removed. The `release-please` workflow now builds and pushes the image when:
  - a git tag is pushed;
  - it is run manually (`workflow_dispatch`), with an optional `mangal_version` input;
  - a mangal release sends a `repository_dispatch` event of type `mangal-release` (payload field `mangal_version`).
- When no version is given, the build uses the latest release of `diogovalentte/mangal`.
- After pushing the image, the workflow sends a signed webhook to redeploy the stack (`WEBHOOK_SERVER` and `WEBHOOK_SERVER_SECRET` secrets). The registry login uses the `GH_TOKEN` secret.
- To build with another mangal version:

```bash
gh workflow run release-please.yml -R diogovalentte/kaizoku -f mangal_version=v4.0.6-3
```

- pnpm is pinned to `9.12.3` in the workflows and the Dockerfile, because the latest pnpm fails the install with `ERR_PNPM_IGNORED_BUILDS`.

### Application

- Mangas no longer need an Anilist page to be added to the library. Upstream only adds mangas found on Anilist, and sometimes picks the wrong page when several mangas share the same name. The mangal calls no longer pass `--include-anilist-manga`, and the metadata update runs `mangal inline update` instead of `mangal inline anilist update`.
- The Kavita integration uses the newer Kavita API endpoints (`/api/Library/libraries` and `/api/Series/v2`).
- Prisma no longer logs every query, only errors and warnings.
- The Dockerfile makes `/etc/services.d/kaizoku/run` executable.

![Home Page](https://i.imgur.com/KT9LrtX.png)

|                   Detail Page                   |                   Search                   |
| :---------------------------------------------: | :----------------------------------------: |
| ![Detail Page](https://i.imgur.com/uWgZ9KA.png) | ![Search](https://i.imgur.com/XP4coVD.png) |

## Deployment

You can deploy Kaizoku with following docker-compose file

```yaml
version: '3'

volumes:
  db:
  redis:

services:
  app:
    container_name: kaizoku
    image: ghcr.io/oae/kaizoku:latest
    environment:
      - DATABASE_URL=postgresql://kaizoku:kaizoku@db:5432/kaizoku
      - KAIZOKU_PORT=3000
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - PUID=<host user puid>
      - PGID=<host user guid>
      - TZ=Europe/Istanbul
    volumes:
      - <path_to_library>:/data
      - <path_to_config>:/config
      - <path_to_logs>:/logs
    depends_on:
      db:
        condition: service_healthy
    ports:
      - '3000:3000'
  redis:
    image: redis:7-alpine
    volumes:
      - redis:/data
  db:
    image: postgres:alpine
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U kaizoku']
      interval: 5s
      timeout: 5s
      retries: 5
    environment:
      - POSTGRES_USER=kaizoku
      - POSTGRES_DB=kaizoku
      - POSTGRES_PASSWORD=kaizoku
    volumes:
      - db:/var/lib/postgresql/data
```

## Development

### Requirements

- node 18
- pnpm
- docker
- [mangal](https://github.com/metafates/mangal)

### Start the Kaizoku

```bash
git clone https://github.com/oae/kaizoku.git
cd ./kaizoku/
cp .env.example .env
pnpm i
docker compose up -d redis db
pnpm prisma migrate deploy
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the page.

## Credits

Kaizoku uses amazing [mangal](https://github.com/metafates/mangal) by [@metafates](https://github.com/metafates) as it's downloader.
