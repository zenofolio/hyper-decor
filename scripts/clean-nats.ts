import { connect } from "nats";

async function clean() {
  console.log("🧹 Cleaning all NATS JetStream streams...");
  try {
    const nc = await connect({ servers: "nats://localhost:4222" });
    const jsm = await nc.jetstreamManager();
    const streams = await jsm.streams.list().next();
    
    for (const s of streams) {
      console.log(`[Clean] Deleting stream: ${s.config.name}`);
      await jsm.streams.delete(s.config.name);
    }
    
    await nc.close();
    console.log("✅ NATS Cleaned.");
  } catch (err) {
    console.error("❌ Failed to clean NATS:", err);
  }
}

clean();
