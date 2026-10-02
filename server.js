// Serves the onboarding prototype. Railway sets PORT; it defaults to 3000 locally.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
// The page is written without a doctype, so add one to keep browsers in standards mode
const page = "<!doctype html>\n" + fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const headers = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

http
  .createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      return res.end();
    }
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : page);
  })
  .listen(PORT, () => console.log(`Onboarding prototype running on port ${PORT}`));
