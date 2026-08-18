import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

export interface MetricsRegistry {
  totalRequests: number;
  statusCounts: Record<string, number>;
  routeLatencies: Record<string, { count: number; totalMs: number }>;
}

const registry: MetricsRegistry = {
  totalRequests: 0,
  statusCounts: {},
  routeLatencies: {},
};

const metricsPluginAsync: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Hook to record latency and status code
  fastify.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url || request.url.split('?')[0];
    const status = reply.statusCode.toString();
    const duration = reply.elapsedTime;

    registry.totalRequests++;
    registry.statusCounts[status] = (registry.statusCounts[status] || 0) + 1;

    if (!registry.routeLatencies[route]) {
      registry.routeLatencies[route] = { count: 0, totalMs: 0 };
    }
    registry.routeLatencies[route].count++;
    registry.routeLatencies[route].totalMs += duration;
  });

  // Expose Prometheus-compatible /metrics endpoint
  fastify.get('/metrics', async (_req, reply) => {
    const mem = process.memoryUsage();
    const uptimeSec = process.uptime();

    let output = `# HELP http_requests_total Total number of HTTP requests processed\n`;
    output += `# TYPE http_requests_total counter\n`;
    output += `http_requests_total ${registry.totalRequests}\n\n`;

    output += `# HELP http_requests_by_status_total HTTP requests partitioned by status code\n`;
    output += `# TYPE http_requests_by_status_total counter\n`;
    for (const [status, count] of Object.entries(registry.statusCounts)) {
      output += `http_requests_by_status_total{status="${status}"} ${count}\n`;
    }
    output += `\n`;

    output += `# HELP http_request_duration_ms_avg Average HTTP request duration in milliseconds\n`;
    output += `# TYPE http_request_duration_ms_avg gauge\n`;
    for (const [route, stats] of Object.entries(registry.routeLatencies)) {
      const avg = stats.count > 0 ? (stats.totalMs / stats.count).toFixed(2) : '0';
      output += `http_request_duration_ms_avg{route="${route}"} ${avg}\n`;
    }
    output += `\n`;

    output += `# HELP process_uptime_seconds Process uptime in seconds\n`;
    output += `# TYPE process_uptime_seconds gauge\n`;
    output += `process_uptime_seconds ${uptimeSec.toFixed(2)}\n\n`;

    output += `# HELP process_heap_bytes Process heap memory usage in bytes\n`;
    output += `# TYPE process_heap_bytes gauge\n`;
    output += `process_heap_bytes ${mem.heapUsed}\n`;

    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(output);
  });
};

export const metricsPlugin = fp(metricsPluginAsync, {
  name: 'metrics-plugin',
});
