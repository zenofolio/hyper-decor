import { fork } from "child_process";
import { resolve } from "path";
import { Redis } from "ioredis";

const workerPath = resolve(__dirname, "cron-worker.ts");
const REDIS_KEY = "bench:cron:total_executions";

async function runBench() {
  const redis = new Redis("redis://localhost:6379");
  await redis.del(REDIS_KEY);
  await redis.del("test:cron:dist:*"); // Clear possible old locks

  console.log("⚖️ Starting REAL DISTRIBUTED Cron Benchmark...");
  console.log("[Bench] Spawning 3 independent worker processes...");

  const testPrefix = `bench:cron:${Date.now()}`;
  const children = [];

  for (let i = 0; i < 3; i++) {
    const child = fork(workerPath, [], {
      execArgv: ["--require", "tsx/cjs"],
      env: {
        ...process.env,
        REDIS_PREFIX: testPrefix,
        CRON_NAME: "distributed_cron_test"
      }
    });
    children.push(child);
  }

  console.log("[Bench] Waiting for workers to start (5s)...");
  await new Promise(r => setTimeout(r, 5000));

  console.log("[Bench] 📊 Monitoring executions for 5 seconds...");
  
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const count = await redis.get(REDIS_KEY);
    process.stdout.write(`\r[Monitor] Total Global Executions: ${count || 0}   `);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("\n" + "=".repeat(40));
  const finalCount = parseInt((await redis.get(REDIS_KEY)) || "0");
  console.log("🏁 DISTRIBUTED CRON RESULTS");
  console.log("Total Cluster Executions:", finalCount);

  // If exclusion works, we should have around 5-6 executions (1 per second)
  // If it fails, we would have around 15-18 executions (3 per second)
  const success = finalCount >= 4 && finalCount <= 7;

  if (success) {
    console.log("✅ SUCCESS: Distributed cron strictly enforced (Only 1 instance at a time).");
  } else {
    console.log("❌ FAILURE: Exclusion failed or instances didn't run!");
    process.exit(1);
  }

  // Cleanup
  for (const child of children) {
    child.kill();
  }
  await redis.quit();
  process.exit(0);
}

runBench().catch(console.error);
