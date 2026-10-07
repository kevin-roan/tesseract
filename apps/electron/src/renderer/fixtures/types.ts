import type { MethodArgs, MethodName, MethodResult, ServiceName } from "../../shared/ipc";

export type IpcFixtureMethods = {
  [S in ServiceName]?: {
    [M in MethodName<S>]?: (...args: MethodArgs<S, M>) => MethodResult<S, M> | Promise<MethodResult<S, M>>;
  };
};

export interface HttpFixtureRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  params: string[];
  body: unknown;
}

export class FixtureReply {
  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly contentType = "application/json",
  ) {}
}

export interface HttpFixtureRoute {
  method: string;
  path: string | RegExp;
  respond(request: HttpFixtureRequest): unknown;
}

export interface SocketFixtureRoute {
  path: string | RegExp;
  frames(url: URL): unknown[];
}

export function defineIpcFixtures(methods: IpcFixtureMethods): IpcFixtureMethods {
  return methods;
}

export function defineHttpFixtures(routes: HttpFixtureRoute[]): HttpFixtureRoute[] {
  return routes;
}

export function defineSocketFixtures(routes: SocketFixtureRoute[]): SocketFixtureRoute[] {
  return routes;
}

export function reply(status: number, body: unknown): FixtureReply {
  return new FixtureReply(status, body);
}
