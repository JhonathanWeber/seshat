import { describe, expect, it, beforeAll, afterAll } from "bun:test";

describe("TOON API End-to-End Tests", () => {
    const API_URL = "http://localhost:3333/api/v1/analytics";

    it("should return JSON format when format is 'json'", async () => {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "summary", format: "json" }),
        });

        const body = await res.json();
        expect(res.status).toBe(200);
        expect(typeof body.data).not.toBe("string");
        expect(body.data.type).toBe("summary");
    });

    it("should return TOON string when format is 'toon' (default)", async () => {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "summary" }), // Should default to 'toon'
        });

        const body = await res.json();
        expect(res.status).toBe(200);
        expect(typeof body.data).toBe("string");
        expect(body.data).toContain("type: summary");
    });

    it("should return TOON string when format is explicitly 'toon'", async () => {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "summary", format: "toon" }),
        });

        const body = await res.json();
        expect(res.status).toBe(200);
        expect(typeof body.data).toBe("string");
        expect(body.data).toContain("type: summary");
    });
});
