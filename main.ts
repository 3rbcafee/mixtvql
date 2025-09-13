import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const allowedSites = ["https://tv.qanwatlive.com"];

serve(async (req: Request) => {
  const url = new URL(req.url);

  // التحقق من الـ origin/referer
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";

  if (
    !allowedSites.some(
      (site) => origin.startsWith(site) || referer.startsWith(site),
    )
  ) {
    return new Response("Access Denied", { status: 403 });
  }

  // التعامل مع preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": allowedSites[0],
        "access-control-allow-methods": "GET,HEAD,OPTIONS",
        "access-control-allow-headers": "*",
      },
    });
  }

  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  const response = await fetch(targetUrl, {
    redirect: "follow",
    headers: {
      "referer": "https://myco.io/",
      "origin": "https://myco.io/",
      "user-agent": req.headers.get("user-agent") || "",
    },
  });

  const contentType = response.headers.get("content-type") || "";

  // تعديل ملفات m3u8
  if (
    contentType.includes("application/vnd.apple.mpegurl") ||
    targetUrl.endsWith(".m3u8")
  ) {
    let text = await response.text();
    const base = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

    text = text.replace(/^(?!#)(.*)$/gm, (line) => {
      line = line.trim();
      if (!line) return line;
      if (line.startsWith("http")) {
        return `${url.origin}/?url=${encodeURIComponent(line)}`;
      } else {
        return `${url.origin}/?url=${encodeURIComponent(base + line)}`;
      }
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.set("content-type", "application/vnd.apple.mpegurl");
    newHeaders.set("access-control-allow-origin", allowedSites[0]);
    newHeaders.set("access-control-allow-headers", "*");
    newHeaders.set("access-control-allow-methods", "GET,HEAD,OPTIONS");

    return new Response(text, {
      status: response.status,
      headers: newHeaders,
    });
  }

  // باقي الملفات (زي .ts chunks)
  const newHeaders = new Headers(response.headers);
  newHeaders.set("access-control-allow-origin", allowedSites[0]);
  newHeaders.set("access-control-allow-headers", "*");
  newHeaders.set("access-control-allow-methods", "GET,HEAD,OPTIONS");

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
});
