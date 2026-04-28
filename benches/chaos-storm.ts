import { spawn, ChildProcess } from "child_process";
import { connect, NatsConnection, JSONCodec } from "nats";
import path from "path";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const jc = JSONCodec();

async function runChaosStorm() {
  console.log("🚀 Starting NatsMQ Storm of Chaos...");
  
  const nc = await connect({ servers: "nats://localhost:4222" });
  const workerPath = path.join(__dirname, "chaos-worker.ts");
  const totalMessages = 500;
  const chaosDuration = 15000; // 15 seconds of pure anarchy
  
  const receivedIds = new Set<number>();
  const workers = new Map<number, ChildProcess>();

  // 1. Setup Stream
  const jsm = await nc.jetstreamManager();
  try { await jsm.streams.delete("STR_CHAOS"); } catch {}
  await jsm.streams.add({ name: "STR_CHAOS", subjects: ["chaos.jobs"] });
  const js = nc.jetstream();

  // 2. Stats Listener
  nc.subscribe("chaos.stats", {
    callback: (err, msg) => {
      if (err) return;
      const data = jc.decode(msg.data) as { jobId: number };
      receivedIds.add(data.jobId);
    }
  });

  // 3. Worker Spawner
  const spawnWorker = (id: number) => {
    const child = spawn("npx", ["tsx", workerPath], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      shell: true
    });

    child.stderr?.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Error")) console.error(`[Worker ${id} Error]: ${msg}`);
    });
    
    workers.set(id, child);
    return child;
  };

  console.log("[Orchestrator] Spawning 3 workers...");
  for (let i = 1; i <= 3; i++) spawnWorker(i);
  await delay(3000);

  let messagesPublished = 0;
  const stormActive = { value: true };

  // 4. Continuous Publisher (steady flow)
  const publisher = async () => {
    console.log(`[Orchestrator] Starting continuous flow...`);
    const startTime = Date.now();
    while (Date.now() - startTime < chaosDuration) {
      // Publicamos ráfaga cada segundo
      for (let i = 0; i < 25; i++) {
        messagesPublished++;
        await js.publish("chaos.jobs", jc.encode({ id: messagesPublished }));
      }
      await delay(1000);
      console.log(`[Orchestrator] Published total: ${messagesPublished}`);
    }
    stormActive.value = false;
    console.log(`[Orchestrator] Publishing ended. Total: ${messagesPublished}`);
  };

  // 5. THE REAL CHAOS MONKEY (Random kills every 3-4s)
  const chaosMonkey = async () => {
    while (stormActive.value) {
      const waitTime = Math.floor(Math.random() * 1000) + 3000; // 3-4 seconds
      await delay(waitTime);
      
      if (!stormActive.value) break;

      const idToKill = Math.floor(Math.random() * 3) + 1;
      const currentWorker = workers.get(idToKill);
      
      if (currentWorker) {
        console.log(`[Chaos Monkey] 💥 KILLING Worker ${idToKill} (Wait was ${waitTime}ms)...`);
        currentWorker.kill("SIGKILL");
        workers.delete(idToKill);
        
        // Reinicio inmediato
        await delay(500);
        console.log(`[Chaos Monkey] ♻️ RESTARTING Worker ${idToKill}...`);
        spawnWorker(idToKill);
      }
      
      console.log(`[Status] Processed: ${receivedIds.size} / Sent: ${messagesPublished}`);
    }
  };

  const pubPromise = publisher();
  const monkeyPromise = chaosMonkey();

  await Promise.all([pubPromise, monkeyPromise]);

  console.log("[Orchestrator] Storm ended. Waiting for final recovery...");
  let attempts = 0;
  let lastCount = 0;
  while (receivedIds.size < messagesPublished && attempts < 20) {
    await delay(1000);
    if (receivedIds.size === lastCount) attempts++;
    else attempts = 0;
    lastCount = receivedIds.size;
    console.log(`[Orchestrator] Final sync: ${receivedIds.size}/${messagesPublished}`);
  }

  for (const w of workers.values()) w.kill();
  await nc.close();

  if (receivedIds.size === messagesPublished) {
    console.log(`✅ CHAOS STORM PASSED: 100% Integrity (${messagesPublished}/${messagesPublished})`);
    process.exit(0);
  } else {
    console.error(`❌ CHAOS STORM FAILED: Only ${receivedIds.size}/${messagesPublished} messages processed.`);
    process.exit(1);
  }
}

runChaosStorm().catch(err => {
  console.error("Critical Failure:", err);
  process.exit(1);
});
