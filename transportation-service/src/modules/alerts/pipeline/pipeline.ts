import type { GpsSignalDTO } from "@move/shared";
import type { ISignalFilter } from "./filter.interface";

export class SignalPipeline {
  private readonly filters: ISignalFilter[] = [];

  register(filter: ISignalFilter): void {
    this.filters.push(filter);
    console.log(`[pipeline] Registered filter: ${filter.name}`);
  }

  async execute(signal: GpsSignalDTO): Promise<void> {
    const results = await Promise.allSettled(this.filters.map((filter) => filter.apply(signal)));

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === "rejected") {
        console.error(`[pipeline] Filter "${this.filters[i]!.name}" failed:`, result.reason);
      }
    }
  }

  getFilterNames(): string[] {
    return this.filters.map((f) => f.name);
  }
}
