import { useEffect, useState } from 'react';
import { Code2, Database, Play, Server, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface ApiSpecPayload {
  openapi: unknown;
  postgresDdl: string;
  entitiesCount: number;
}

export function ArchitectureDocs() {
  const [spec, setSpec] = useState<ApiSpecPayload | null>(null);
  const [healthOutput, setHealthOutput] = useState<string>('');

  useEffect(() => {
    fetch('/api/spec')
      .then((r) => r.json())
      .then((data) => setSpec(data))
      .catch(() => setSpec(null));
  }, []);

  const testHealthEndpoint = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthOutput(JSON.stringify(data, null, 2));
      toast.success('API /api/health 200 OK');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Health check failed');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
            Architecture, Schema, ERD &amp; REST API
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Firestore Blueprint · PostgreSQL DDL · OpenAPI 3.0.3 · RBAC
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={testHealthEndpoint}>
          <Play className="h-3.5 w-3.5" />
          <span>/api/health</span>
        </Button>
      </div>

      {healthOutput && (
        <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-950 p-3 font-mono-num text-[11px] text-cyan-300 dark:border-slate-800">
          {healthOutput}
        </pre>
      )}

      <Tabs defaultValue="erd">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="erd">ERD (10 Entities)</TabsTrigger>
          <TabsTrigger value="schema">SQL &amp; Firestore Schema</TabsTrigger>
          <TabsTrigger value="api">OpenAPI Spec</TabsTrigger>
          <TabsTrigger value="ops">Security &amp; Ops</TabsTrigger>
        </TabsList>

        <TabsContent value="erd" className="mt-2.5">
          <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Database className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
              <span>Entity Relationship Diagram</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 text-[12px]">
              <div className="rounded-md border border-slate-200 p-2.5 dark:border-slate-800">
                <div className="font-mono-num font-bold text-[#0B2B5B] dark:text-cyan-400">departments (1) ──&lt; (N) users</div>
                <p className="mt-1 text-[11px] text-slate-500">12 factory departments linked to user profiles.</p>
              </div>
              <div className="rounded-md border border-slate-200 p-2.5 dark:border-slate-800">
                <div className="font-mono-num font-bold text-[#0B2B5B] dark:text-cyan-400">campaigns (1) ──&lt; (N) questions</div>
                <p className="mt-1 text-[11px] text-slate-500">Conditional dynamic questions per campaign.</p>
              </div>
              <div className="rounded-md border border-slate-200 p-2.5 dark:border-slate-800">
                <div className="font-mono-num font-bold text-[#0B2B5B] dark:text-cyan-400">campaigns (1) ──&lt; (N) responses</div>
                <p className="mt-1 text-[11px] text-slate-500">Verified campaignId &amp; terminal state locking.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schema" className="mt-2.5">
          <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Code2 className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
              <span>PostgreSQL 16 DDL</span>
            </div>
            <pre className="max-h-[400px] overflow-auto rounded-md bg-slate-950 p-3 font-mono-num text-[11px] text-slate-200">
              {spec?.postgresDdl || 'Loading...'}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="api" className="mt-2.5">
          <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Server className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
              <span>OpenAPI 3.0.3</span>
            </div>
            <pre className="max-h-[400px] overflow-auto rounded-md bg-slate-950 p-3 font-mono-num text-[11px] text-cyan-200">
              {spec ? JSON.stringify(spec.openapi, null, 2) : 'Loading...'}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="ops" className="mt-2.5">
          <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2 text-[12px] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Shield className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
              <span>RBAC &amp; Security</span>
            </div>
            <ul className="list-disc space-y-1 pl-4 text-slate-600 dark:text-slate-300">
              <li>Verified Google Auth required for Firestore persistence; anonymous draft &amp; submission supported via campaign policy.</li>
              <li>Hardened Firestore security rules validate schema keys and isolate PII.</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
