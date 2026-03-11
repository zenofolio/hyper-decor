#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

try {
  // Resolve where uWebSockets.js is actually installed
  const mainModuleFile = require.resolve('uWebSockets.js');
  // Usually this points to the root directory where the files are
  const uwsDir = path.dirname(mainModuleFile);
  
  // Construct the expected binary name for THIS machine
  const expectedBinary = 'uws_' + process.platform + '_' + process.arch + '_' + process.versions.modules + '.node';
  
  console.log(`[HyperDecor] Analyzing uWebSockets.js native binaries...`);
  console.log(`[HyperDecor] Target environment: ${process.platform} ${process.arch} (Node ABI ${process.versions.modules})`);
  console.log(`[HyperDecor] Expected binary: ${expectedBinary}`);

  const files = fs.readdirSync(uwsDir);
  let deletedCount = 0;
  let savedSpace = 0;

  files.forEach((file) => {
    // We only care about .node files
    if (!file.endsWith('.node')) return;

    // If it's NOT the exact binary we need, delete it
    if (file !== expectedBinary) {
      const filePath = path.join(uwsDir, file);
      const stat = fs.statSync(filePath);
      savedSpace += stat.size;
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  });

  if (deletedCount > 0) {
    const mbSaved = (savedSpace / 1024 / 1024).toFixed(2);
    console.log(`[HyperDecor] ✅ Cleaned up ${deletedCount} unused native binaries.`);
    console.log(`[HyperDecor] 💾 Freed up ${mbSaved} MB of disk space in node_modules!`);
  } else {
    // Make sure the expected one actually exists
    if (!fs.existsSync(path.join(uwsDir, expectedBinary))) {
      console.warn(`[HyperDecor] ⚠️ The expected native binary (${expectedBinary}) was NOT found! uWebSockets.js might not work.`);
    } else {
      console.log(`[HyperDecor] ✨ No unnecessary binaries found. Everything is already optimized.`);
    }
  }

} catch (err) {
  if (err.code === 'MODULE_NOT_FOUND') {
    console.error(`[HyperDecor] ❌ uWebSockets.js is not installed locally. Skipping cleanup.`);
  } else {
    console.error(`[HyperDecor] ❌ Error cleaning uWebSockets binaries:`, err.message);
  }
  process.exit(1);
}