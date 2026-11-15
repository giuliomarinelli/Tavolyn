import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import WebSocket from "ws";

// Run against `npm run preview`, without any production instrumentation.
const origin = "http://127.0.0.1:8787";
const inspector = "http://127.0.0.1:9229";
const requests = 100;
const targets = await (await fetch(`${inspector}/json`)).json();
const target = targets.find((entry) => entry.webSocketDebuggerUrl);
if (!target) {
  throw new Error("Inspector non disponibile: avviare npm run preview.");
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener(
    "error",
    () => reject(new Error("Connessione inspector fallita.")),
    { once: true },
  );
});

let commandId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const command = pending.get(message.id);
  if (command) {
    pending.delete(message.id);
    clearTimeout(command.timeout);
    if (message.error) command.reject(new Error(message.error.message));
    else command.resolve(message.result);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++commandId;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout inspector: ${method}`));
    }, 15_000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });

const request = async (path) => {
  const start = performance.now();
  const response = await fetch(`${origin}${path}`, { redirect: "error" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  await response.arrayBuffer();
  return performance.now() - start;
};

try {
  await mkdir(".wrangler/benchmarks", { recursive: true });
  await send("Profiler.enable");
  await send("Profiler.setSamplingInterval", { interval: 100 });

  for (const [name, path] of [
    ["page-ssr", "/"],
    ["health", "/api/health"],
  ]) {
    const firstRequestMs = await request(path);
    for (let index = 0; index < 10; index++) await request(path);

    await send("Profiler.start");
    const durations = [];
    for (let index = 0; index < requests; index++) {
      durations.push(await request(path));
    }
    const { profile } = await send("Profiler.stop");
    await writeFile(
      `.wrangler/benchmarks/${name}.cpuprofile`,
      JSON.stringify(profile),
    );

    // Sampling is an estimate of local V8 activity, not Cloudflare billed CPU.
    const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
    let activeUs = 0;
    for (let index = 0; index < (profile.samples?.length ?? 0); index++) {
      if (
        nodes.get(profile.samples[index])?.callFrame.functionName !== "(idle)"
      ) {
        activeUs += profile.timeDeltas[index];
      }
    }
    durations.sort((left, right) => left - right);
    console.log(
      JSON.stringify({
        route: path,
        requests,
        firstRequestWallMs: +firstRequestMs.toFixed(2),
        warmWallMedianMs: +durations[49].toFixed(2),
        warmWallP95Ms: +durations[94].toFixed(2),
        sampledActiveMsPerRequest: +(activeUs / 1000 / requests).toFixed(2),
        samples: profile.samples?.length ?? 0,
        note: "Profilo locale campionato; non certifica il budget CPU cloud.",
      }),
    );
  }
} finally {
  socket.terminate();
}
