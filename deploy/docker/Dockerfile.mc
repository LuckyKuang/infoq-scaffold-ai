FROM node:24.18.0 AS download
ARG TARGETARCH
RUN TARGETARCH="$TARGETARCH" node --input-type=module - <<'NODE'
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const release = 'RELEASE.2025-08-13T08-35-41Z';
const hashes = {
  amd64: '01f866e9c5f9b87c2b09116fa5d7c06695b106242d829a8bb32990c00312e891',
  arm64: '14c8c9616cfce4636add161304353244e8de383b2e2752c0e9dad01d4c27c12c',
};
const arch = process.env.TARGETARCH;
if (!hashes[arch]) throw new Error(`Unsupported mc target architecture: ${arch}`);
fs.mkdirSync('/out/licenses', {recursive: true});
const files = [
  [`https://github.com/minio/mc/releases/download/${release}/mc.linux-${arch}.${release}`, '/out/mc', hashes[arch], 64 * 1024 * 1024],
  [`https://raw.githubusercontent.com/minio/mc/${release}/LICENSE`, '/out/licenses/LICENSE', '0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0', 1024 * 1024],
  [`https://raw.githubusercontent.com/minio/mc/${release}/CREDITS`, '/out/licenses/CREDITS', '4ead58181c478e2f449d5778165684f4fceb1e7b8b3ee150051c8e7adfe4f337', 1024 * 1024],
];
for (const [url, file, sha256, limit] of files) {
  const response = await fetch(url, {signal: AbortSignal.timeout(90000)});
  if (!response.ok) throw new Error(`mc download failed: HTTP ${response.status} (${file})`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error(`mc download too large: ${file}`);
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error(`mc SHA256 mismatch: ${file}`);
  fs.writeFileSync(file, bytes, {mode: file === '/out/mc' ? 0o755 : 0o644});
}
NODE

FROM busybox:1.37.0
LABEL org.opencontainers.image.title="InfoQ MinIO policy tool" \
      org.opencontainers.image.source="https://github.com/minio/mc" \
      org.opencontainers.image.version="RELEASE.2025-08-13T08-35-41Z" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      cc.infoq.tool="minio-policy" \
      cc.infoq.mc.recipe="1"
COPY --from=download /out/mc /usr/local/bin/mc
COPY --from=download /out/licenses /licenses/minio-mc
ENTRYPOINT ["mc"]
