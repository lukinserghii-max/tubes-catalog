const base = process.env.CATALOG_URL || "http://localhost:3210";
const post = (body, headers = {}) => fetch(`${base}/api/assistant`, { method: "POST", headers, body });
const expectStatus = async (response, expected, label) => {
  if (response.status !== expected) throw new Error(`${label}: очікувався ${expected}, отримано ${response.status}: ${await response.text()}`);
};

await expectStatus(await post("{}", { "Content-Type": "text/plain", "X-Real-IP": "test-content-type" }), 415, "Content-Type");
await expectStatus(await post(JSON.stringify({}), { "Content-Type": "application/json", "X-Real-IP": "test-empty" }), 400, "Порожнє питання");
await expectStatus(await post(JSON.stringify({ message: "x".repeat(2100) }), { "Content-Type": "application/json", "X-Real-IP": "test-long-message" }), 413, "Довге питання");
await expectStatus(await post(JSON.stringify({ message: "x".repeat(5000) }), { "Content-Type": "application/json", "X-Real-IP": "test-large-body" }), 413, "Велике тіло");

for (let index = 0; index < 12; index += 1) {
  const response = await post(JSON.stringify({ message: "тест" }), { "Content-Type": "application/json", "X-Real-IP": "test-rate-limit" });
  if (response.status !== 200) throw new Error(`Rate limit спрацював зарано на запиті ${index + 1}: ${response.status}`);
}
const limited = await post(JSON.stringify({ message: "тест" }), { "Content-Type": "application/json", "X-Real-IP": "test-rate-limit" });
await expectStatus(limited, 429, "Rate limit");
if (limited.headers.get("retry-after") !== "60") throw new Error("Відсутній Retry-After для 429");
console.log("OK: 415 для не-JSON, 400 для порожнього запиту, 413 для завеликого тіла/повідомлення, 429 після 12 запитів");
