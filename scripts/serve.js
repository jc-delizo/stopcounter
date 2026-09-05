import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT) || 43_817;
const host = process.env.HOST || "0.0.0.0";
const displayHost = host === "0.0.0.0" ? "localhost" : host;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
};
const publicFiles = new Set([
  "index.html",
  "index.css",
  "index.js",
  "lightning.js",
  "rain.js",
  "timer-core.js",
]);
const publicDirectories = ["fonts/", "images/"];

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
  const pathname =
    requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const relativePath = normalize(decodeURIComponent(pathname)).replace(
    /^[/\\]+/,
    "",
  );
  const filePath = join(root, relativePath);
  const isPublicAsset =
    publicFiles.has(relativePath) ||
    publicDirectories.some((directory) => relativePath.startsWith(directory));

  if (
    !isPublicAsset ||
    !filePath.startsWith(root) ||
    !existsSync(filePath) ||
    !statSync(filePath).isFile()
  ) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Stopcounter is available at http://${displayHost}:${port}`);
});
