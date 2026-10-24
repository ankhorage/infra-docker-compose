import type { DockerComposeControlPlane } from '@ankhorage/infra-docker-compose';
import { createInfraAdapter, infraAdapterDescriptor } from '@ankhorage/infra-docker-compose';

declare const controlPlane: DockerComposeControlPlane;
const adapter = createInfraAdapter({ controlPlane });

console.log(infraAdapterDescriptor.id, adapter.descriptor.package);
