import { fork } from "child_process";
import { resolve } from "path";
import { Redis } from "ioredis";

const workerPath = resolve(__dirname, "cron-worker.ts");
const REDIS_KEY = "bench:cron:total_executions";
const ACTIVE_BUCKETS = "bench:cron:active_buckets";
const BUCKET_PREFIX = "bench:cron:bucket";

async function runBench() {
  const redis = new Redis("redis://localhost:6379");
  await redis.del(REDIS_KEY);
  await redis.del(ACTIVE_BUCKETS);
  // Clear any old buckets
  const keys = await redis.keys(`${BUCKET_PREFIX}:*`);
  if (keys.length > 0) await redis.del(...keys);
  await redis.del("test:cron:dist:*"); 

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
  
  // ANALYZE OVERLAPS
  const buckets = await redis.smembers(ACTIVE_BUCKETS);
  let collisionDetected = false;
  
  console.log("🏁 DISTRIBUTED CRON ANALYSIS:");
  
  // Sort buckets for readable output
  buckets.sort();

  for (const bucket of buckets) {
    const pids = await redis.smembers(`${BUCKET_PREFIX}:${bucket}`);
    if (pids.length > 1) {
      console.log(`❌ COLLISION at bucket ${bucket}: Workers [${pids.join(", ")}] executed simultaneously!`);
      collisionDetected = true;
    } else {
      console.log(`✅ Bucket ${bucket}: Single execution by Worker ${pids[0]}`);
    }
  }

  const finalCount = parseInt((await redis.get(REDIS_KEY)) || "0");
  console.log("-".repeat(40));
  console.log("Total Cluster Executions:", finalCount);

  if (!collisionDetected && finalCount >= 4 && finalCount <= 12) {
    console.log("✅ SUCCESS: Distributed cron strictly enforced.");
  } else {
    if (collisionDetected) {
      console.log("❌ FAILURE: Mutual exclusion failed (detected overlaps).");
    } else {
      console.log("❌ FAILURE: Execution count outside expected range.");
    }
    
    // Cleanup
    for (const child of children) child.kill();
    await redis.quit();
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
