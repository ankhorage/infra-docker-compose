import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const packageName = '@ankhorage/infra-docker-compose';
const providerId = 'docker-compose';
const repositoryRoot = new URL('..', import.meta.url).pathname;
const consumerDirectory = mkdtempSync(join(tmpdir(), 'ankhorage-infra-docker-compose-consumer-'));
let archivePath: string | undefined;

try {
  const packOutput = execFileSync('bun', ['pm', 'pack'], { cwd: repositoryRoot, encoding: 'utf8' });
  const archiveName = /(?:^|\n)([^\n]+\.tgz)(?:\n|$)/.exec(packOutput)?.[1];
  if (archiveName === undefined) throw new Error(`Packing ${packageName} produced no archive.`);

  archivePath = join(repositoryRoot, archiveName);
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        [packageName]: `file:${archivePath}`,
        '@ankhorage/contracts': '^26.2.2',
      },
    }),
  );
  writeFileSync(
    join(consumerDirectory, 'consumer.ts'),
    `import type { DockerComposeAdapterOptions } from '${packageName}';\nconst options: DockerComposeAdapterOptions | undefined = undefined;\nvoid options;\n`,
  );
  execFileSync(
    'bun',
    [
      'install',
      '--ignore-scripts',
      '--cache-dir',
      join(tmpdir(), 'infra-docker-compose-bun-cache'),
    ],
    {
      cwd: consumerDirectory,
      stdio: 'inherit',
    },
  );
  const runtimeAssertion = `
    const adapter = await import('${packageName}');
    const contracts = await import('@ankhorage/contracts/infra');
    const packageMetadata = await import('${packageName}/package.json', { with: { type: 'json' } });
    if (packageMetadata.default.name !== '${packageName}') throw new Error('Incorrect package identity');
    const dependencyRanges = Object.values({ ...packageMetadata.default.dependencies, ...packageMetadata.default.optionalDependencies, ...packageMetadata.default.peerDependencies });
    if (dependencyRanges.some((range) => /^(workspace:|file:|link:)/.test(range))) throw new Error('Adapter package contains a non-public dependency protocol');
    if (typeof adapter.createInfraAdapter !== 'function') throw new Error('Missing adapter factory');
    if (adapter.infraAdapterDescriptor.id !== '${providerId}') throw new Error('Provider identity drift');
    if (!contracts.isInfraAdapterDescriptor(adapter.infraAdapterDescriptor)) throw new Error('Invalid adapter descriptor');
    if (JSON.stringify(adapter.infraAdapterDescriptor) !== JSON.stringify(contracts.INFRA_ADAPTER_CATALOG['${providerId}'])) throw new Error('Descriptor catalog drift');
    const adapterInstance = adapter.createInfraAdapter({ controlPlane: {} });
    if (adapterInstance.descriptor !== adapter.infraAdapterDescriptor) throw new Error('Factory lifecycle identity drift');
    if (!['validateAsync', 'planAsync', 'ensureAsync', 'statusAsync', 'suspendAsync', 'destroyAsync'].every((method) => typeof adapterInstance[method] === 'function')) throw new Error('Incomplete safe runtime lifecycle');
  `;
  execFileSync('bun', ['--eval', runtimeAssertion], { cwd: consumerDirectory, stdio: 'inherit' });
  execFileSync('node', ['--input-type=module', '--eval', runtimeAssertion], {
    cwd: consumerDirectory,
    stdio: 'inherit',
  });
  execFileSync(
    join(repositoryRoot, 'node_modules/.bin/tsc'),
    [
      '--noEmit',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      'consumer.ts',
    ],
    { cwd: consumerDirectory, stdio: 'inherit' },
  );
} finally {
  rmSync(consumerDirectory, { recursive: true, force: true });
  if (archivePath !== undefined) rmSync(archivePath, { force: true });
}
