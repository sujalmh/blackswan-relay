import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Final walkthrough video — 90s, 6 slides live on Sepolia (docs/HACKATHON_DEMO.md §5, SLIDES:38-45)
// Covers: 00 Thesis → 01 Danger (openRound) → 02 Commit 3× hash-only → 03 Reveal toggle → 04 Settle honest + cheats → 05 Verify
// Records via Playwright recordVideo (per prompt), size 1920x1080 (bigger), placed at docs/demo-90s.mp4
// Smooth scroll helper shows pages that exceed viewport height.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(__dirname, "test-results");
const docsOut = path.resolve(projectRoot, "docs/demo-90s.mp4");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.on("console", (m) => console.log(`BROWSER ${m.type()}: ${m.text()}`));

const url = "http://localhost:3000";
console.log(`Opening ${url} ...`);
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

// Helper: wait a beat for video smoothness
const beat = (ms) => page.waitForTimeout(ms);

// Smooth-scroll helper: if page height exceeds viewport, scroll top → bottom → top with smooth behavior
async function smoothScrollPage(label = "page") {
  const { needs, scrollHeight, viewportH } = await page.evaluate(() => ({
    needs: document.documentElement.scrollHeight > window.innerHeight * 1.15,
    scrollHeight: document.documentElement.scrollHeight,
    viewportH: window.innerHeight,
  }));
  if (!needs) return;
  console.log(`${label}: scrolling ${scrollHeight}px vs viewport ${viewportH}px (smooth)`);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await beat(400);
  // Scroll to bottom smoothly
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
  // Wait for smooth scroll to complete (~800ms + distance factor)
  await beat(1200);
  // Hold bottom view briefly for video
  await beat(800);
  // Scroll back to top smoothly for next interaction
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await beat(1000);
}

// --- 00 Thesis (15s) — "A rescue that doesn't leak the price." — expand Sepolia deployments proof ---
console.log("00 Thesis — cover (1920×1080) — expanding Sepolia deployments proof");
await beat(1500);
await page.evaluate(() => { document.querySelectorAll("details").forEach(d=>{ if(d.textContent.includes("Etherscan proof — deployments")||d.textContent.includes("Etherscan proof — deployments")) d.open=true; }); });
await beat(800);
await smoothScrollPage("00 Thesis");
await beat(800);
// Click "See the rescue" to go to next slide (or Next)
await page.getByRole("button", { name: /See the rescue/ }).click().catch(async () => {
  await page.getByRole("button", { name: /^Next$/ }).click();
});
await beat(1000);

// --- 01 Danger (12s) — vault 0.92, open round — FIX: wait for ● Round open and expand proof ---
console.log("01 Danger — openRound (fresh run, expand Sepolia proof)");
await beat(1200);
const openBtn = page.getByRole("button", { name: /Open round/ });
await openBtn.waitFor({ state: "visible", timeout: 8000 });
await beat(500);
console.log("Clicking Open round — need 600 (3-wallet real escrow v2 will be shown later)");
await openBtn.click();
console.log("Waiting for ● Round open result (was previously skipped)...");
try {
  await page.waitForFunction(() => document.body.innerText.includes("● Round open"), null, { timeout: 12000 });
  console.log("✓ vault open confirmed: ● Round open visible");
} catch {
  console.log("vault open timeout — fallback wait 3500ms");
  await beat(3500);
}
await beat(1000);
// Expand Sepolia openRound proof for all-pages requirement
await page.evaluate(() => {
  document.querySelectorAll("details").forEach(d=>{ if(d.textContent.includes("Etherscan proof — openRound")) d.open=true; });
});
await beat(800);
try {
  const txt = await page.evaluate(() => document.body.innerText);
  console.log("After open — has Round open?", txt.includes("● Round open"), "has Etherscan proof expanded?", txt.includes("Etherscan proof — openRound"));
} catch {}
await beat(500);
await smoothScrollPage("01 Danger");
await beat(800);
// Next to commit (check enabled)
const nextBtn1 = page.getByRole("button", { name: /^Next$/ });
console.log("Next enabled after open?", !(await nextBtn1.isDisabled().catch(()=>true)));
await nextBtn1.click().catch(()=>{});
await beat(800);

// --- 02 Commit (20s) — 3 rescuers pick 100/200/300, lock hash-only ---
console.log("02 Commit — 3× Commit privately (hash-only, no 012c)");
for (let id = 1; id <= 3; id++) {
  const denom = id === 1 ? "300" : id === 2 ? "200" : "100";
  const avatar = id === 1 ? "A" : id === 2 ? "B" : "C";
  console.log(`  Rescuer ${avatar} → ${denom}`);
  const card = page.locator(".rounded-2xl.border").filter({ hasText: `Rescuer ${avatar}` }).first();
  const denomBtn = card.getByRole("button", { name: denom, exact: true });
  if (await denomBtn.isVisible().catch(() => false)) {
    await denomBtn.click();
    await beat(400);
  }
  const commitBtn = card.getByRole("button", { name: /Commit privately/ });
  await commitBtn.waitFor({ state: "visible", timeout: 5000 }).catch(()=>{});
  await commitBtn.click();
  try {
    await card.getByText("COMMITTED").waitFor({ state: "visible", timeout: 8000 });
    console.log(`  Rescuer ${avatar} COMMITTED`);
  } catch { console.log(`  Rescuer ${avatar} wait timeout`); }
  await beat(1000);
  const hashText = await card.locator("text=On-chain lock:").textContent().catch(() => "");
  console.log(`  hash preview: ${(hashText || "").slice(0, 50)}`);
}
try {
  await page.waitForFunction(() => document.body.innerText.includes("600 / 600") || document.body.innerText.includes("3/3"), null, { timeout: 8000 });
  console.log("Aggregate 600/600 3/3 confirmed — all 3 COMMITTED");
} catch {
  console.log("commit count 600/600 timeout — still proceeding, checking COMMITTED count", await page.locator("text=COMMITTED").count());
}
await beat(1000);
// Expand Sepolia deposits proof for all-pages requirement
await page.evaluate(() => {
  document.querySelectorAll("details").forEach(d=>{ if(d.textContent.includes("Etherscan proof — 3 private deposits")||d.textContent.includes("Etherscan proof — 3 private")) d.open=true; });
});
await beat(800);
console.log("Expanded Etherscan proof — 3 private deposits (hash-only, 3x Transfer for real escrow v2)");
await beat(800);
await smoothScrollPage("02 Commit");
await beat(800);
// Next to reveal
await page.getByRole("button", { name: /^Next$/ }).click();
await beat(800);

// --- 03 Reveal (12s) — Private vs Public toggle ---
console.log("03 Reveal — Private • hashes only vs Public • amounts leaked");
await beat(1200);
// Stay on Private initially, let video capture green hashes-only (v2 real escrow)
await beat(1200);
// Ensure Private is selected (hash-only) and Sepolia proof expanded
await page.evaluate(() => {
  document.querySelectorAll("details").forEach(d=>{ if(d.textContent.includes("Etherscan proof")) d.open=true; });
});
await beat(800);
console.log("03 Reveal — Private • hashes only (expanded Sepolia CommitmentsRecorded)");
await beat(1000);
// Toggle to Public (red leaked) then back to Private for settle context
const publicBtn = page.getByRole("button", { name: /Public \(leaks\)|Public • amounts leaked/ }).first();
if (await publicBtn.isVisible().catch(() => false)) {
  await publicBtn.click();
  console.log("Toggled to Public • amounts leaked (red)");
  await beat(1800);
  // Back to Private
  const pb = page.getByRole("button", { name: /Private • hashes only/ });
  if (await pb.isVisible().catch(() => false)) {
    await pb.click();
    console.log("Back to Private • hashes only");
    await beat(1200);
  }
}
// Ensure CommitmentsRecorded proof stays expanded
await page.evaluate(() => {
  document.querySelectorAll("details").forEach(d=>{ if(d.textContent.includes("CommitmentsRecorded")||d.textContent.includes("Etherscan proof — Commitments")) d.open=true; });
});
await beat(800);
await smoothScrollPage("03 Reveal");
await beat(800);
await page.getByRole("button", { name: /^Next$/ }).click();
await beat(800);

// --- 04 Settle (15s) — prove 8384B ZK 14-input bound, honest + cheats — expand Sepolia proof ---
console.log("04 Settle — Secret total 600 • proof 8384 bytes ZK 14-input bound (v2)");
await page.evaluate(() => { document.querySelectorAll("details").forEach(d=>{ if(d.textContent.includes("Etherscan proof — settle")||d.textContent.includes("Etherscan proof — reverts")) d.open=true; }); });
await beat(500);
await beat(1000);
// Show awaiting state briefly
await beat(1200);
const settleBtn = page.getByRole("button", { name: /Settle — prove & save vault/ });
await settleBtn.waitFor({ state: "visible", timeout: 5000 });
console.log(`Settle disabled? ${await settleBtn.isDisabled()}`);
await beat(800);
await settleBtn.click({ force: true });
console.log("Clicked Settle — proving...");
await beat(800);
// Wait for Proving spinner then RescueTargetMet
try {
  await page.waitForFunction(() => document.body.innerText.includes("Proving"), null, { timeout: 5000 });
  console.log("Proving visible");
} catch {}
await beat(1200);
try {
  await page.waitForFunction(() => document.body.innerText.includes("RescueTargetMet — round 1"), null, { timeout: 12000 });
  console.log("RescueTargetMet honest found");
} catch { console.log("Honest result wait timeout"); }
await beat(2000);
// Scroll to show Tx + Gas + One atomic tx
await page.evaluate(() => window.scrollTo({ top: 300, behavior: "smooth" }));
await beat(1200);
// Expand Etherscan proof for settle
const settleProof = page.getByText("Etherscan proof — settle (Sepolia)").first();
if (await settleProof.isVisible().catch(() => false)) {
  await settleProof.click();
  await beat(1500);
}
await smoothScrollPage("04 Settle honest");
await beat(500);
// Try cheat: only 300 (underfunded)
console.log("Cheat: Try cheat: only 300 → ProofLengthWrong");
const cheatUnder = page.getByRole("button", { name: /Try cheat: only 300/ });
if (await cheatUnder.isVisible().catch(() => false)) {
  await cheatUnder.click();
  try {
    await page.waitForFunction(() => document.body.innerText.includes("Rejected — verifier"), null, { timeout: 8000 });
    console.log("Cheat underfunded rejected shown");
  } catch {}
  await beat(1800);
  // Click back to honest? Just let it stay on rejected for video, then reset via clicking Settle again? For now keep rejected visible
  await beat(800);
}
// Cheat: reuse lock
console.log("Cheat: Try cheat: reuse lock → NullifierReused");
const cheatReuse = page.getByRole("button", { name: /Try cheat: reuse lock/ });
if (await cheatReuse.isVisible().catch(() => false)) {
  await cheatReuse.click();
  try {
    await page.waitForFunction(() => document.body.innerText.includes("NullifierReused"), null, { timeout: 8000 });
    console.log("Cheat reuse NullifierReused shown");
  } catch {}
  await beat(1800);
}
// Reset to honest for clean ending? Click Reset demo if exists
const resetBtn = page.getByRole("button", { name: /Reset demo/ });
if (await resetBtn.isVisible().catch(() => false)) {
  // Don't reset now; keep last cheat state briefly, then reset to show honest again
  await beat(800);
}
await smoothScrollPage("04 Settle cheat");
await beat(500);
await page.getByRole("button", { name: /^Next$/ }).click();
await beat(800);

// --- 05 Verify (12s) — checklist, don't trust us ---
console.log("05 Verify — Check it yourself on Etherscan");
await beat(1500);
// Expand full verification collapsible
const verifyProof = page.getByText("Etherscan proof — full Sepolia verification").first();
if (await verifyProof.isVisible().catch(() => false)) {
  await verifyProof.click();
  await beat(2000);
}
await smoothScrollPage("05 Verify");
await beat(500);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await beat(1500);
// Replay button hover for video end frame
const replayBtn = page.getByRole("button", { name: /Replay rescue/ });
if (await replayBtn.isVisible().catch(() => false)) {
  await replayBtn.hover();
  await beat(1200);
}

// Hold final frame for video tail
await beat(2000);

console.log("Closing context to save video...");
const videoPathBefore = await page.video().path().catch(() => null);
console.log("Video path (before close):", videoPathBefore);
await context.close();
await browser.close();

// After close, video is saved in outDir; find newest .webm
const files = fs.readdirSync(outDir).filter(f => f.endsWith(".webm") || f.endsWith(".mp4"));
console.log("Videos in outDir:", files);
let newest = null;
let newestTime = 0;
for (const f of files) {
  const full = path.join(outDir, f);
  const stat = fs.statSync(full);
  if (stat.mtimeMs > newestTime) { newestTime = stat.mtimeMs; newest = full; }
}
if (newest) {
  console.log(`Newest video: ${newest} (${(fs.statSync(newest).size/1024/1024).toFixed(2)} MB)`);
  // Copy to docs/demo-90s.mp4 (and .webm) for submission
  const docsMp4 = docsOut;
  const docsWebm = path.resolve(projectRoot, "docs/demo-90s.webm");
  fs.copyFileSync(newest, docsMp4);
  console.log(`Copied to ${docsMp4}`);
  // Also keep webm copy
  if (!newest.endsWith(".webm") || newest !== docsWebm) {
    try { fs.copyFileSync(newest, docsWebm); console.log(`Also copied to ${docsWebm}`); } catch {}
  }
  // Also print video info via ffprobe if available
  try {
    const { execSync } = await import("child_process");
    const info = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name -of default=noprint_wrappers=1 "${newest}" 2>&1 || echo "ffprobe not available"`).toString();
    console.log("ffprobe:", info.slice(0, 500));
  } catch {}
} else {
  console.log("No video found in", outDir);
}
