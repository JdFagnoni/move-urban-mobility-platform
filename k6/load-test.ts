// k6 load tests — R2 (throughput), R5 (latency), R8 (concurrent users)
// Run: k6 run k6/load-test.ts

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    // R2 – sustained throughput
    throughput: {
      executor: "constant-arrival-rate",
      rate: 50,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
    // R8 – peak concurrent users
    peak_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 },
        { duration: "1m", target: 200 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  // R5 – p95 latency under 500ms
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV["BASE_URL"] ?? "http://localhost:3000";

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    "status 200": (r) => r.status === 200,
  });
  sleep(1);
}
