import type { GpsSignalDTO } from "@move/shared";

export interface ISignalFilter {
  readonly name: string;
  apply(signal: GpsSignalDTO): Promise<void>;
}
