import type { InfraRuntimeAdapter } from '@ankhorage/contracts/infra';

import { infraAdapterDescriptor } from '../../../constants/infra.js';
import type { DockerComposeAdapterOptions } from '../../../types/dockerComposeRuntime.js';
import { createDockerComposeCliControlPlane } from '../adapters/createDockerComposeCliControlPlane.js';
import { destroyDockerComposeRuntimeAsync } from '../application/destroyDockerComposeRuntimeAsync.js';
import { ensureDockerComposeRuntimeAsync } from '../application/ensureDockerComposeRuntimeAsync.js';
import { getDockerComposeStatusAsync } from '../application/getDockerComposeStatusAsync.js';
import { planDockerComposeRuntimeAsync } from '../application/planDockerComposeRuntimeAsync.js';
import { suspendDockerComposeRuntimeAsync } from '../application/suspendDockerComposeRuntimeAsync.js';
import { validateDockerComposeRuntimeAsync } from '../application/validateDockerComposeRuntimeAsync.js';

/***
 * Create the canonical Docker Compose runtime adapter entrypoint.
 *
 * The default composition operates the local Docker CLI. Callers may inject a control plane for a
 * verified remote engine. Portable workloads become services, networks, volumes, configs and
 * execution-only secrets.
 *
 * @readme
 */
export function createInfraAdapter(
  options?: DockerComposeAdapterOptions,
): InfraRuntimeAdapter<'docker-compose'> {
  const resolved = options ?? { controlPlane: createDockerComposeCliControlPlane() };
  return {
    descriptor: infraAdapterDescriptor,
    validateAsync: (context, desired) =>
      validateDockerComposeRuntimeAsync(resolved, context, desired),
    planAsync: (context, desired) => planDockerComposeRuntimeAsync(resolved, context, desired),
    ensureAsync: (context, desired) => ensureDockerComposeRuntimeAsync(resolved, context, desired),
    statusAsync: (context, desired) => getDockerComposeStatusAsync(resolved, context, desired),
    suspendAsync: (context, desired) =>
      suspendDockerComposeRuntimeAsync(resolved, context, desired),
    destroyAsync: (context, desired, request) =>
      destroyDockerComposeRuntimeAsync(resolved, context, desired, request),
  };
}
