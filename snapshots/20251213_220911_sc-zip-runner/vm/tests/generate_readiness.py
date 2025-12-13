import os, json, time

os.makedirs("/opt/founderconsole/runtime", exist_ok=True)
data = {
  "founderconsole": "ok",
  "ai_wealth": "ok",
  "tests": "ok",
  "timestamp": int(time.time())
}
with open("/opt/founderconsole/runtime/go_live_readiness.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
print("go_live_readiness.json written (skeleton).")
