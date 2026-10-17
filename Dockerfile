# The demo data ships inside the image: every restart or deploy starts again from the committed state.
# The build runs on the host platform (Next's SWC crashes under QEMU); only sharp needs the linux/x64 binaries.
FROM --platform=$BUILDPLATFORM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN cd .next/standalone/node_modules/@img \
 && for pkg in sharp-linux-x64@0.35.4 sharp-libvips-linux-x64@1.3.3; do \
      name=${pkg%@*}; mkdir -p $name && npm pack --silent @img/$pkg | xargs -I{} tar -xzf {} -C $name --strip-components=1 && rm -f *.tgz; \
    done

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8788 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/data ./data
COPY --from=build --chown=node:node /app/assets ./assets
COPY --from=build --chown=node:node /app/demo ./demo
USER node
EXPOSE 8788
CMD ["node", "server.js"]
