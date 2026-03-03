#!/usr/bin/env node
/**
 * Whoop MCP Server
 * 
 * Provides access to Whoop health data via Model Context Protocol
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
const WHOOP_AUTH_URL = 'https://api.whoop.com/oauth/oauth2/token';

interface WhoopConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  tokenExpiry?: number;
}

class WhoopMCPServer {
  private server: Server;
  private config: WhoopConfig;

  constructor() {
    this.config = {
      clientId: process.env.WHOOP_CLIENT_ID || '',
      clientSecret: process.env.WHOOP_CLIENT_SECRET || '',
    };

    if (!this.config.clientId || !this.config.clientSecret) {
      console.error('ERROR: WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables are required');
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

  private async getAccessToken(): Promise<string> {
    if (this.config.accessToken && this.config.tokenExpiry && Date.now() < this.config.tokenExpiry) {
      return this.config.accessToken;
    }

    const response = await fetch(WHOOP_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'read:recovery read:sleep read:workout read:cycles read:profile',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whoop OAuth error: ${response.status} ${error}`);
    }

    const data: any = await response.json();
    this.config.accessToken = data.access_token || "";
    this.config.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

    return this.config.accessToken;
  }

  private async fetchWhoop(endpoint: string): Promise<any> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${WHOOP_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whoop API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  private setupHandlers() {
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

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri.toString();

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

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_recovery',
          description: 'Get recovery data for a specific date range',
          inputSchema: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'Start date (ISO 8601)' },
              end: { type: 'string', description: 'End date (ISO 8601)' },
              limit: { type: 'number', description: 'Max records (default: 7)' },
            },
          },
        },
        {
          name: 'get_sleep',
          description: 'Get sleep data for a specific date range',
          inputSchema: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'Start date (ISO 8601)' },
              end: { type: 'string', description: 'End date (ISO 8601)' },
              limit: { type: 'number', description: 'Max records (default: 7)' },
            },
          },
        },
        {
          name: 'get_workouts',
          description: 'Get workout and strain data',
          inputSchema: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'Start date (ISO 8601)' },
              end: { type: 'string', description: 'End date (ISO 8601)' },
              limit: { type: 'number', description: 'Max records (default: 7)' },
            },
          },
        },
        {
          name: 'get_hrv',
          description: 'Get heart rate variability data',
          inputSchema: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'Start date (ISO 8601)' },
              end: { type: 'string', description: 'End date (ISO 8601)' },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const params = args as any || {};

      switch (name) {
        case 'get_recovery': {
          const query = new URLSearchParams();
          if (params.start) query.append('start', params.start);
          if (params.end) query.append('end', params.end);
          if (params.limit) query.append('limit', params.limit.toString());

          const data = await this.fetchWhoop(`/recovery?${query.toString()}`);
          return {
            content: [{ type: 'text', text: JSON.stringify(data.records || [], null, 2) }],
          };
        }

        case 'get_sleep': {
          const query = new URLSearchParams();
          if (params.start) query.append('start', params.start);
          if (params.end) query.append('end', params.end);
          if (params.limit) query.append('limit', params.limit.toString());

          const data = await this.fetchWhoop(`/activity/sleep?${query.toString()}`);
          return {
            content: [{ type: 'text', text: JSON.stringify(data.records || [], null, 2) }],
          };
        }

        case 'get_workouts': {
          const query = new URLSearchParams();
          if (params.start) query.append('start', params.start);
          if (params.end) query.append('end', params.end);
          if (params.limit) query.append('limit', params.limit.toString());

          const data = await this.fetchWhoop(`/activity/workout?${query.toString()}`);
          return {
            content: [{ type: 'text', text: JSON.stringify(data.records || [], null, 2) }],
          };
        }

        case 'get_hrv': {
          const query = new URLSearchParams();
          if (params.start) query.append('start', params.start);
          if (params.end) query.append('end', params.end);

          const data = await this.fetchWhoop(`/cycle?${query.toString()}`);
          const hrvData = data.records?.map((cycle: any) => ({
            created_at: cycle.created_at,
            hrv_rmssd_milli: cycle.score?.hrv_rmssd_milli,
            resting_heart_rate: cycle.score?.resting_heart_rate,
          }));

          return {
            content: [{ type: 'text', text: JSON.stringify(hrvData || [], null, 2) }],
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
