import { SignalPipeline } from "./pipeline";
import { GeofenceFilter, ProlongedStopFilter, SpeedingFilter } from "./filters";

export const signalPipeline = new SignalPipeline();

signalPipeline.register(new GeofenceFilter());
signalPipeline.register(new ProlongedStopFilter());
signalPipeline.register(new SpeedingFilter());
