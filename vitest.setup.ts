import "@testing-library/jest-dom/vitest";
import { config } from "dotenv";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

config({ path: ".env.local" });

afterEach(() => {
  cleanup();
});
