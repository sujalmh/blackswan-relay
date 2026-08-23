import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const url = "http://localhost:3000";
const outDir = path.resolve("frontend/screenshots");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("console", m => console.log(`BROWSER ${m.type()}: ${m.text()}`));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// Helper: bigger resolution, hide unwanted Etherscan links for cleaner submission, smooth-scroll page if tall
async function smoothScrollIfNeeded() {
  const { needs } = await page.evaluate(() => ({
    needs: document.documentElement.scrollHeight > window.innerHeight * 1.1,
  }));
  if (needs) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
    await page.waitForTimeout(1100);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.waitForTimeout(900);
  }
}
async function shot(name) {
  // EXPAND Sepolia sections for all pages (user requested) — ensure Etherscan proofs are visible
  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((d) => {
      if (d.textContent.includes("Etherscan proof") || d.textContent.includes("Etherscan")) {
        d.open = true;
        d.style.display = "";
        // also ensure summary is visible
        const s = d.querySelector("summary");
        if (s) s.style.display = "";
      }
    });
    document.querySelectorAll("pre").forEach((p) => {
      p.style.display = "";
    });
  });
  await page.waitForTimeout(400);
  // Smooth-scroll page that exceeds viewport before fullPage capture (shows below-screen content)
  await smoothScrollIfNeeded();
  // Extra wait to ensure expanded details are rendered
  await page.waitForTimeout(500);
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, fullPage: true });
  console.log("saved", p, "1920x1080 - Sepolia expanded");
  await page.waitForTimeout(200);
}

async function next() {
  const btn = page.getByRole("button", { name: /^Next$/ });
  await btn.click();
  await page.waitForTimeout(600);
}

console.log("slide 0 thesis");
await shot("00-cover.png");

await next();
console.log("slide 1 danger idle");
await shot("01-danger-idle.png");

// open round — ensure Sepolia proof expanded and result visible (fix: was skipped)
console.log("opening round");
const openBtn = page.getByRole("button", { name: /Open round/ });
await openBtn.waitFor({ state: "visible", timeout: 8000 });
await page.waitForTimeout(500);
await openBtn.click();
console.log("clicked Open round, waiting for ● Round open + Etherscan proof...");
try {
  await page.waitForFunction(() => document.body.innerText.includes("● Round open"), null, { timeout: 12000 });
  console.log("vault open confirmed: ● Round open visible");
} catch { console.log("vault open timeout, fallback wait"); await page.waitForTimeout(3500); }
await page.waitForTimeout(1000);
// Ensure Etherscan proof for openRound is expanded before shot
await page.evaluate(() => {
  document.querySelectorAll("details").forEach(d=>{ if(d.textContent.includes("openRound")||d.textContent.includes("Etherscan proof — openRound")) d.open=true; });
});
await page.waitForTimeout(800);
const afterOpenText = await page.evaluate(()=>document.body.innerText);
console.log("after open — has Round open?", afterOpenText.includes("● Round open"), "has Etherscan proof?", afterOpenText.includes("Etherscan proof — openRound"));
await page.waitForTimeout(500);
await shot("01-danger-open.png");
// Verify Next is enabled before proceeding
try {
  const nextAfterOpen = page.getByRole("button", { name: /^Next$/ });
  await nextAfterOpen.waitFor({ state: "visible", timeout: 5000 });
  const disabled = await nextAfterOpen.isDisabled().catch(()=>false);
  console.log("Next after open — disabled?", disabled, "waiting for enabled if needed");
  if (disabled) {
    await page.waitForFunction(() => { const b=document.evaluate(`//button[contains(.,'Next')]`,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue; return b && !b.disabled; }, null, {timeout:5000}).catch(()=>{});
  }
  await page.waitForTimeout(800);
} catch(e){ console.log("Next check after open failed", e.message?.slice(0,100)); }

await next();
console.log("slide 2 commit idle");
await shot("02-commit-idle.png");

// commit 3 rescuers
for (let id=1; id<=3; id++) {
  const denom = id===1?"300": id===2?"200":"100";
  console.log(`commit ${id} denom ${denom}`);
  const card = page.locator(".rounded-2xl.border").filter({ hasText: `Rescuer ${String.fromCharCode(64+id)}` }).first();
  await card.getByRole("button", { name: denom, exact: true }).click();
  await page.waitForTimeout(500);
  await card.getByRole("button", { name: /Commit privately/ }).click();
  // wait for this card to show COMMITTED or Committed
  try {
    await card.getByText("COMMITTED").waitFor({ state: "visible", timeout: 8000 });
    console.log(`card ${id} COMMITTED visible`);
  } catch { console.log(`card ${id} timeout, continuing`); await page.waitForTimeout(1500); }
  await page.waitForTimeout(800);
  console.log(`after ${id}`, await page.locator("text=COMMITTED").count(), "committed");
}
try {
  await page.waitForFunction(() => document.body.innerText.includes("3/3") || document.body.innerText.includes("600 / 600"), null, { timeout: 8000 });
  console.log("all 3 committed confirmed");
} catch { console.log("commit count timeout"); }
await page.waitForTimeout(800);
await shot("02-commit-done.png");

await next();
console.log("slide 3 reveal private");
await shot("03-reveal-private.png");
// toggle public
const publicBtn = page.getByRole("button", { name: /Public • amounts leaked/ });
await publicBtn.click();
await page.waitForTimeout(500);
await shot("03-reveal-public.png");
// back to private
const privateBtn = page.getByRole("button", { name: /Private • hashes only/ });
await privateBtn.click();
await page.waitForTimeout(400);

await next();
console.log("slide 4 settle awaiting");
await page.waitForTimeout(500);
console.log("settle text", await page.getByText(/Commit 1 more|Ready to settle|AWAITING/).first().textContent().catch(()=> "no text"));
await shot("04-settle-await.png");

// settle honestly — new label "Settle — prove & save vault"
const settleBtn = page.getByRole("button", { name: /Settle — prove/ });
console.log("settle disabled?", await settleBtn.isDisabled());
console.log("canSettle should be true if 3/3");
if (await settleBtn.isDisabled()) {
  console.log("settle disabled, trying to wait for enabled");
  try { await page.waitForFunction(() => { const b = document.evaluate(`//button[contains(.,'Settle — prove')]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; return b && !b.disabled; }, null, { timeout: 5000 }); } catch {}
  console.log("after wait disabled?", await settleBtn.isDisabled());
}
await settleBtn.click({ force: true });
await page.waitForTimeout(1200);
console.log("proving?", await page.getByText("Proving").count());
try {
  await page.waitForFunction(() => document.body.innerText.includes("RescueTargetMet"), null, { timeout: 10000 });
  console.log("honest found via waitForFunction");
} catch { console.log("honest timeout"); }
await page.waitForTimeout(800);
console.log("honest?", await page.getByText("RescueTargetMet").count());
await shot("04-settle-honest.png");

// cheat underfunded — new label "Try cheat: only 300"
const cheatUnder = page.getByRole("button", { name: /Try cheat: only 300/ });
await cheatUnder.click();
try { await page.waitForFunction(() => document.body.innerText.includes("Rejected — verifier"), null, { timeout: 8000 }); } catch {}
await page.waitForTimeout(500);
console.log("cheat under?", await page.getByText("Rejected — verifier").count());
await shot("04-settle-cheat-under.png");

// cheat reuse — new label "Try cheat: reuse lock"
const cheatReuse = page.getByRole("button", { name: /Try cheat: reuse lock/ });
await cheatReuse.click();
try { await page.waitForFunction(() => document.body.innerText.includes("NullifierReused"), null, { timeout: 8000 }); } catch {}
await page.waitForTimeout(500);
console.log("cheat reuse?", await page.getByText("NullifierReused").count());
await shot("04-settle-cheat-null.png");

// reset? go next to verify
await next();
console.log("slide 5 verify");
await shot("05-verify.png");

await browser.close();
console.log("done");
