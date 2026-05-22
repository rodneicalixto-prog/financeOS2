// =============================================================================
// Cliente fino da Vercel API — usado pelo /api/bootstrap.
// -----------------------------------------------------------------------------
// O VERCEL_TOKEN (fornecido pelo aluno no step 2) tem escopo de gerenciar o
// projeto, então pode setar envs e disparar redeploy. É descartado após o
// bootstrap — não persiste em app_settings.
// =============================================================================

const BASE = 'https://api.vercel.com';

export class VercelError extends Error {
  constructor(public status: number, public body: string, public endpoint: string) {
    super(`Vercel API ${status} em ${endpoint}: ${body}`);
  }
}

async function vercelFetch(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export interface VercelProject {
  id: string;
  name: string;
  framework?: string;
  link?: { type?: string; repo?: string; repoId?: number };
  latestDeployments?: Array<{ id: string; url: string; readyState: string }>;
}

export async function getProjectByDomain(token: string, domain: string): Promise<VercelProject> {
  // Tenta primeiro como nome de projeto (ex: my-app), depois lista e match por domain.
  const cleaned = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  // Lista projetos
  const list = await vercelFetch(token, 'GET', `/v9/projects?limit=100`);
  if (!list.ok) throw new VercelError(list.status, await list.text(), '/v9/projects');
  const data = (await list.json()) as { projects: VercelProject[] };
  // Match por nome igual ao subdomínio ou por algum domínio listado
  const subdomain = cleaned.split('.')[0];
  const found = data.projects.find((p) => p.name === subdomain || p.name === cleaned);
  if (!found) {
    throw new VercelError(
      404,
      `Projeto "${subdomain}" não encontrado. Confira o VERCEL_TOKEN e tente novamente.`,
      '/v9/projects',
    );
  }
  return found;
}

export async function getProjectById(token: string, id: string): Promise<VercelProject> {
  const res = await vercelFetch(token, 'GET', `/v9/projects/${id}`);
  if (!res.ok) throw new VercelError(res.status, await res.text(), `/v9/projects/${id}`);
  return (await res.json()) as VercelProject;
}

export async function upsertEnv(
  token: string,
  projectId: string,
  key: string,
  value: string,
): Promise<void> {
  const res = await vercelFetch(token, 'POST', `/v10/projects/${projectId}/env?upsert=true`, {
    key,
    value,
    type: 'encrypted',
    target: ['production', 'preview', 'development'],
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new VercelError(res.status, txt, `/v10/projects/${projectId}/env`);
  }
}

export interface DeploymentResult {
  id: string;
  url: string;
  readyState: string;
}

export async function triggerRedeploy(
  token: string,
  project: VercelProject,
): Promise<DeploymentResult> {
  // Pega o último deployment para reaproveitar o git ref. Se não houver,
  // a única opção é orientar o aluno a fazer "Redeploy" manual.
  const last = project.latestDeployments?.[0];
  if (!last) {
    throw new VercelError(
      404,
      'Projeto não tem deployment anterior. Faça o primeiro Deploy manualmente em vercel.com/dashboard e reabra /setup.',
      '/v13/deployments',
    );
  }
  const res = await vercelFetch(token, 'POST', `/v13/deployments`, {
    name: project.name,
    target: 'production',
    deploymentId: last.id,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new VercelError(res.status, txt, '/v13/deployments');
  }
  const data = (await res.json()) as DeploymentResult;
  return data;
}

export async function getDeployment(token: string, id: string): Promise<DeploymentResult> {
  const res = await vercelFetch(token, 'GET', `/v13/deployments/${id}`);
  if (!res.ok) throw new VercelError(res.status, await res.text(), `/v13/deployments/${id}`);
  return (await res.json()) as DeploymentResult;
}
