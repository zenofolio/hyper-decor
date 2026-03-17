import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperController,
  Get,
  Post,
  Body,
  Query,
  Output,
  createApplication,
} from "../src";
import { TransformContext } from "../src/__internals/transform/transform.registry";
import { Agent, request } from "undici";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";

const IdentityTransformer = {
  transform: ({ data }: TransformContext) => data,
  getOpenApiSchema: () => ({ type: "object" }),
};

const SimpleSchema = { type: "object" };

@HyperController("/bench")
class BenchController {
  @Get("/raw")
  raw(req: any, res: any) {
    res.json({ ok: true });
  }

  @Post("/transform")
  @Output(SimpleSchema)
  transform(
    @Body(SimpleSchema) body: any,
    @Query("id", SimpleSchema) id: any
  ) {
    return { ok: true, id, body };
  }
}

@HyperModule({
  controllers: [BenchController],
})
class BenchModule { }

@HyperApp({
  modules: [BenchModule],
  options: {
    max_body_buffer: 1024 * 1024 * 100,
  },
})
class BenchApp { }

type BenchOptions = {
  name: string;
  method: "GET" | "POST";
  path: string;
  body?: any;
  iterations: number;
  concurrency: number;
  connections: number;
  pipelining?: number;
};

type BenchResult = {
  name: string;
  iterations: number;
  concurrency: number;
  connections: number;
  pipelining: number;
  totalMs: number;
  reqPerSec: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  success: number;
  errors: number;
  memBeforeMB: number;
  memAfterMB: number;
  memDiffMB: number;
  rssBeforeMB: number;
  rssAfterMB: number;
  rssDiffMB: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  eventLoopMeanMs: number;
  eventLoopMaxMs: number;
};

function bytesToMB(bytes: number) {
  return bytes / 1024 / 1024;
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function format(n: number, digits = 2) {
  return n.toFixed(digits);
}

async function consumeBody(body: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function singleRequest(baseUrl: string, opts: BenchOptions, agent: Agent) {
  const url = `${baseUrl}${opts.path}${opts.method === "POST" ? "?id=1" : ""}`;
  const started = performance.now();

  try {
    const res = await request(url, {
      method: opts.method,
      dispatcher: agent,
      headers: opts.body ? { "content-type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    const raw = await consumeBody(res.body);

    if (res.statusCode < 200 || res.statusCode >= 300) {
      return {
        ok: false,
        latencyMs: performance.now() - started,
        statusCode: res.statusCode,
        body: raw,
      };
    }

    try {
      JSON.parse(raw);
    } catch {
      return {
        ok: false,
        latencyMs: performance.now() - started,
        statusCode: res.statusCode,
        body: raw,
      };
    }

    return {
      ok: true,
      latencyMs: performance.now() - started,
      statusCode: res.statusCode,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: performance.now() - started,
      error,
    };
  }
}

async function runBench(baseUrl: string, opts: BenchOptions): Promise<BenchResult> {
  if (global.gc) global.gc();

  const agent = new Agent({
    connections: opts.connections,
    pipelining: opts.pipelining ?? 1,
    keepAliveTimeout: 10_000,
    keepAliveMaxTimeout: 10_000,
  });

  const eventLoop = monitorEventLoopDelay({ resolution: 10 });
  eventLoop.enable();

  const memBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();
  const start = performance.now();

  let success = 0;
  let errors = 0;
  const latencies: number[] = [];

  for (let i = 0; i < opts.iterations; i += opts.concurrency) {
    const batchSize = Math.min(opts.concurrency, opts.iterations - i);

    const batch = Array.from({ length: batchSize }, () =>
      singleRequest(baseUrl, opts, agent)
    );

    const results = await Promise.all(batch);

    for (const result of results) {
      latencies.push(result.latencyMs);
      if (result.ok) success++;
      else errors++;
    }
  }

  const totalMs = performance.now() - start;
  const cpuAfter = process.cpuUsage(cpuBefore);
  const memAfter = process.memoryUsage();

  eventLoop.disable();
  await agent.close();

  latencies.sort((a, b) => a - b);

  const avgMs =
    latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

  return {
    name: opts.name,
    iterations: opts.iterations,
    concurrency: opts.concurrency,
    connections: opts.connections,
    pipelining: opts.pipelining ?? 1,
    totalMs,
    reqPerSec: success / (totalMs / 1000),
    avgMs,
    minMs: latencies[0] ?? 0,
    maxMs: latencies[latencies.length - 1] ?? 0,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    success,
    errors,
    memBeforeMB: bytesToMB(memBefore.heapUsed),
    memAfterMB: bytesToMB(memAfter.heapUsed),
    memDiffMB: bytesToMB(memAfter.heapUsed - memBefore.heapUsed),
    rssBeforeMB: bytesToMB(memBefore.rss),
    rssAfterMB: bytesToMB(memAfter.rss),
    rssDiffMB: bytesToMB(memAfter.rss - memBefore.rss),
    cpuUserMs: cpuAfter.user / 1000,
    cpuSystemMs: cpuAfter.system / 1000,
    eventLoopMeanMs: eventLoop.mean / 1e6,
    eventLoopMaxMs: eventLoop.max / 1e6,
  };
}

function printResult(result: BenchResult) {
  console.log(`\n=== ${result.name} ===`);
  console.log(
    `iterations=${result.iterations} concurrency=${result.concurrency} connections=${result.connections} pipelining=${result.pipelining}`
  );
  console.log(`success=${result.success} errors=${result.errors}`);
  console.log(`total=${format(result.totalMs)} ms`);
  console.log(`throughput=${format(result.reqPerSec)} req/s`);
  console.log(
    `latency avg=${format(result.avgMs)} ms p50=${format(result.p50Ms)} ms p95=${format(result.p95Ms)} ms p99=${format(result.p99Ms)} ms min=${format(result.minMs)} ms max=${format(result.maxMs)} ms`
  );
  console.log(
    `cpu user=${format(result.cpuUserMs)} ms system=${format(result.cpuSystemMs)} ms`
  );
  console.log(
    `heap before=${format(result.memBeforeMB)} MB after=${format(result.memAfterMB)} MB diff=${format(result.memDiffMB)} MB`
  );
  console.log(
    `rss before=${format(result.rssBeforeMB)} MB after=${format(result.rssAfterMB)} MB diff=${format(result.rssDiffMB)} MB`
  );
  console.log(
    `eventLoop mean=${format(result.eventLoopMeanMs)} ms max=${format(result.eventLoopMaxMs)} ms`
  );
}

function printComparison(a: BenchResult, b: BenchResult) {
  const overheadMs = b.avgMs - a.avgMs;
  const overheadPct = a.avgMs > 0 ? ((b.avgMs - a.avgMs) / a.avgMs) * 100 : 0;
  const throughputPct =
    a.reqPerSec > 0 ? ((b.reqPerSec - a.reqPerSec) / a.reqPerSec) * 100 : 0;

  console.log(`\n--- Comparison: ${a.name} vs ${b.name} ---`);
  console.log(`avg latency overhead: ${format(overheadMs)} ms (${format(overheadPct)}%)`);
  console.log(`throughput delta: ${format(b.reqPerSec - a.reqPerSec)} req/s (${format(throughputPct)}%)`);
  console.log(`p95 delta: ${format(b.p95Ms - a.p95Ms)} ms`);
  console.log(`p99 delta: ${format(b.p99Ms - a.p99Ms)} ms`);
  console.log(`heap diff delta: ${format(b.memDiffMB - a.memDiffMB)} MB`);
  console.log(`rss diff delta: ${format(b.rssDiffMB - a.rssDiffMB)} MB`);
}

describe("Transformation Overhead Benchmark", () => {
  let app: any;
  const port = 3016;
  const baseUrl = `http://127.0.0.1:${port}`;

  beforeAll(async () => {
    app = await createApplication(BenchApp);
    app.useTransform(IdentityTransformer);
    await app.listen(port);
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    "should measure throughput, memory, cpu and compare real connection profiles",
    async () => {
      console.log("\n--- Warmup ---");
      await runBench(baseUrl, {
        name: "warmup-raw",
        method: "GET",
        path: "/bench/raw",
        iterations: 2000,
        concurrency: 50,
        connections: 10,
      });

      await runBench(baseUrl, {
        name: "warmup-transform",
        method: "POST",
        path: "/bench/transform",
        body: { name: "test" },
        iterations: 2000,
        concurrency: 50,
        connections: 10,
      });

      const profiles = [
        { concurrency: 50, connections: 1 },
        { concurrency: 100, connections: 10 },
        { concurrency: 200, connections: 50 },
        { concurrency: 1000, connections: 200 },
        { concurrency: 2000, connections: 100, pipelining: 10, name: "MAX PERFORMANCE" },
      ];

      for (const profile of profiles) {
        const iterations = profile.name === "MAX PERFORMANCE" ? 50000 : 10000;
        
        const raw = await runBench(baseUrl, {
          name: profile.name ? `raw ${profile.name}` : `raw c=${profile.concurrency} conn=${profile.connections}`,
          method: "GET",
          path: "/bench/raw",
          iterations,
          concurrency: profile.concurrency,
          connections: profile.connections,
          pipelining: profile.pipelining || 1,
        });

        const transformed = await runBench(baseUrl, {
          name: profile.name ? `transform ${profile.name}` : `transform c=${profile.concurrency} conn=${profile.connections}`,
          method: "POST",
          path: "/bench/transform",
          body: { name: "test" },
          iterations,
          concurrency: profile.concurrency,
          connections: profile.connections,
          pipelining: profile.pipelining || 1,
        });

        printResult(raw);
        printResult(transformed);
        printComparison(raw, transformed);

        expect(raw.errors).toBe(0);
        expect(transformed.errors).toBe(0);
      }
    },
    180_000
  );
});