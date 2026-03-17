const path = require("path");
try {
    const src = require.resolve("./src");
    console.log("Resolved ./src to:", src);
} catch (e) {
    console.log("./src not resolvable via require.resolve");
}

import("./src/index.ts").then(m => {
    console.log("Imported ./src/index.ts successfully");
}).catch(e => {
    console.error("Failed to import ./src/index.ts:", e.message);
});
