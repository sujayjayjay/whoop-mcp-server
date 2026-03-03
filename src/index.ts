#!/usr/bin/env node
/**
 * Whoop MCP Server
 * 
 * Provides access to Whoop health data via Model Context Protocol
 * 
 * Resources:
 * - whoop://recovery - Latest recovery score and metrics
 * - whoop://sleep - Latest sleep data
 * - whoop://strain - Latest strain and workout data
 * - whoop://cycle - Latest physiological cycle
 * 
 * Tools:
 * - get_recovery - Get recovery data for specific date range
 * - get_sleep - Get sleep data for specific date range
 * - get_workouts - Get workout/strain data
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const WHOOP_API_BASE = 'https://api.whoop.com/developer/v1';

interface WhoopConfig {
  apiKey: string;
}

class WhoopMCPServer {
  private server: Server;
  private config: WhoopConfig;

  constructor() {
    this.config = {
      apiKey: process.env.WHOOP_API_KEY || '',
    };

    if (!this.config.apiKey) {
      console.error('ERROR: WHOOP_API_KEY environment variable is required');
      process.exit(1);
    }

    this.server = new Server(
      {
        name: 'whoop-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private async fetchWhoop(endpoint: string): Promise<any> {
    const response = await fetch(`${WHOOP_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Whoop API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private setupHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'whoop://recovery/latest',
          name: 'Latest Recovery',
          description: 'Most recent recovery score and metrics',
          mimeType: 'application/json',
        },
        {
          uri: 'whoop://sleep/latest',
          name: 'Latest Sleep',
          description: 'Most recent sleep data',
          mimeType: 'application/json',
        },
        {
          uri: 'whoop://cycle/latest',
          name: 'Latest Cycle',
          description: 'Most recent physiological cycle data',
          mimeType: 'application/json',
        },
        {
          uri: 'whoop://user/profile',
          name: 'User Profile',
          description: 'Whoop user profile information',
          mimeType: 'application/json',
        },
      ],
    }));

    // Read resource contents
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      switch (uri) {
        case 'whoop://recovery/latest': {
          const data = await this.fetchWhoop('/recovery');
          const latest = data.records?.[0];
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(latest || {}, null, 2),
              },
            ],
          };
        }

        case 'whoop://sleep/latest': {
          const data = await this.fetchWhoop('/activity/sleep');
          const latest = data.records?.[0];
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(latest || {}, null, 2),
              },
            ],
          };
        }

        case 'whoop://cycle/latest': {
          const data = await this.fetchWhoop('/cycle');
          const latest = data.records?.[0];
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(latest || {}, null, 2),
              },
            ],
          };
        }

        case 'whoop://user/profile': {
          const data = await this.fetchWhoop('/user/profile/basic');
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_recovery',
          description: 'Get recovery data for a specific date range',
          inputSchema: {
            type: 'object',
            properties: {
              start: {
                type: 'string',
                description: 'Start date (ISO 8601 format, e.g. 2024-01-01T00:00:00Z)',
              },
              end: {
                type: 'string',
                description: 'End date (ISO 8601 format)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of records to return (default: 7)',
              },
            },
          },
        },
        {
          name: 'get_sleep',
          description: 'Get sleep data for a specific date range',
          inputSchema: {
            type: 'object',
            properties: {
              start: {
                type: 'string',
                description: 'Start date (ISO 8601 format)',
              },
              end: {
                type: 'string',
                description: 'End date (ISO 8601 format)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of records to return (default: 7)',
              },
            },
          },
        },
        {
          name: 'get_workouts',
          description: 'Get workout and strain data',
          inputSchema: {
            type: 'object',
            properties: {
              start: {
                type: 'string',
                description: 'Start date (ISO 8601 format)',
              },
              end: {
                type: 'string',
                description: 'End date (ISO 8601 format)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of records to return (default: 7)',
              },
            },
          },
        },
        {
          name: 'get_hrv',
          description: 'Get heart rate variability data',
          inputSchema: {
            type: 'object',
            properties: {
              start: {
                type: 'string',
                description: 'Start date (ISO 8601 format)',
              },
              end: {
                type: 'string',
                description: 'End date (ISO 8601 format)',
              },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_recovery': {
          const params = new URLSearchParams();
          if (args.start) params.append('start', args.start);
          if (args.end) params.append('end', args.end);
          if (args.limit) params.append('limit', args.limit.toString());

          const data = await this.fetchWhoop(`/recovery?${params.toString()}`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(data.records || [], null, 2),
              },
            ],
          };
        }

        case 'get_sleep': {
          const params = new URLSearchParams();
          if (args.start) params.append('start', args.start);
          if (args.end) params.append('end', args.end);
          if (args.limit) params.append('limit', args.limit.toString());

          const data = await this.fetchWhoop(`/activity/sleep?${params.toString()}`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(data.records || [], null, 2),
              },
            ],
          };
        }

        case 'get_workouts': {
          const params = new URLSearchParams();
          if (args.start) params.append('start', args.start);
          if (args.end) params.append('end', args.end);
          if (args.limit) params.append('limit', args.limit.toString());

          const data = await this.fetchWhoop(`/activity/workout?${params.toString()}`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(data.records || [], null, 2),
              },
            ],
          };
        }

        case 'get_hrv': {
          const params = new URLSearchParams();
          if (args.start) params.append('start', args.start);
          if (args.end) params.append('end', args.end);

          const data = await this.fetchWhoop(`/cycle?${params.toString()}`);
          // Extract HRV from cycle data
          const hrvData = data.records?.map((cycle: any) => ({
            created_at: cycle.created_at,
            hrv_rmssd_milli: cycle.score?.hrv_rmssd_milli,
            resting_heart_rate: cycle.score?.resting_heart_rate,
          }));

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(hrvData || [], null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Whoop MCP server running on stdio');
  }
}

const server = new WhoopMCPServer();
server.start().catch(console.error);
