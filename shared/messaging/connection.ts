import { connect } from "amqplib";
import { assertTopology } from "./topology";
import { describeError, logMessaging } from "./log";

type AmqpConnection = Awaited<ReturnType<typeof connect>>;
export type ConfirmChannel = Awaited<ReturnType<AmqpConnection["createConfirmChannel"]>>;
export type Channel = Awaited<ReturnType<AmqpConnection["createChannel"]>>;

export type ReconnectListener = () => void | Promise<void>;

const RABBITMQ_URL = process.env["RABBITMQ_URL"] ?? "amqp://move:move_secret@localhost:5672";
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export class MessagingUnavailableError extends Error {
  constructor() {
    super("RabbitMQ connection is not available");
    this.name = "MessagingUnavailableError";
  }
}

const reconnectListeners = new Set<ReconnectListener>();
let connection: AmqpConnection | null = null;
let publishChannel: ConfirmChannel | null = null;
let supervisorRunning = false;

export function onReconnect(listener: ReconnectListener): void {
  reconnectListeners.add(listener);
}

export function isConnected(): boolean {
  return connection !== null;
}

export function startMessaging(): void {
  if (supervisorRunning) {
    return;
  }
  supervisorRunning = true;
  void superviseConnection();
}

export function getPublishChannel(): ConfirmChannel {
  if (publishChannel === null) {
    throw new MessagingUnavailableError();
  }
  return publishChannel;
}

export async function createConsumerChannel(prefetch: number): Promise<Channel> {
  if (connection === null) {
    throw new MessagingUnavailableError();
  }
  const channel = await connection.createChannel();
  await channel.prefetch(prefetch);
  return channel;
}

async function superviseConnection(): Promise<void> {
  let attempt = 0;
  for (;;) {
    try {
      const established = await connect(RABBITMQ_URL);
      attempt = 0;
      connection = established;
      publishChannel = await createPublishChannel(established);
      logMessaging("info", "connection_established", {});
      await notifyReconnect();
      await waitForClose(established);
      logMessaging("error", "connection_closed", {});
    } catch (error) {
      logMessaging("error", "connection_failed", { error: describeError(error) });
    }
    connection = null;
    publishChannel = null;
    attempt += 1;
    await delay(backoffDelay(attempt));
  }
}

async function createPublishChannel(established: AmqpConnection): Promise<ConfirmChannel> {
  const channel = await established.createConfirmChannel();
  await assertTopology(channel);
  return channel;
}

function waitForClose(established: AmqpConnection): Promise<void> {
  return new Promise<void>((resolve) => {
    established.once("error", () => undefined);
    established.once("close", () => resolve());
  });
}

async function notifyReconnect(): Promise<void> {
  for (const listener of reconnectListeners) {
    try {
      await listener();
    } catch (error) {
      logMessaging("error", "reconnect_listener_failed", { error: describeError(error) });
    }
  }
}

function backoffDelay(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
