# Whoop MCP Server

MCP server for accessing Whoop health data (recovery, sleep, strain, HRV) via the Model Context Protocol.

## Features

- **Recovery data**: Latest recovery score, HRV, resting heart rate
- **Sleep tracking**: Sleep duration, quality, stages, disturbances
- **Strain & workouts**: Daily strain, workout details, calories
- **HRV trends**: Heart rate variability over time

## Setup

### 1. Get Whoop API Key

1. Go to https://developer.whoop.com
2. Create an account / sign in
3. Create a new application
4. Copy your API key

### 2. Install

```bash
npm install
npm run build
```

### 3. Configure

Set your Whoop API key:

```bash
export WHOOP_API_KEY="your-api-key-here"
```

Or add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
echo 'export WHOOP_API_KEY="your-key"' >> ~/.zshrc
source ~/.zshrc
```

### 4. Test

```bash
npm start
```

## Usage with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whoop": {
      "command": "node",
      "args": ["/path/to/whoop-mcp-server/dist/index.js"],
      "env": {
        "WHOOP_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Restart Claude Desktop. Now you can ask:
- "What's my recovery score today?"
- "How did I sleep last night?"
- "Show me my strain for the past week"
- "What's my HRV trend?"

## Usage with OpenClaw

Coming soon - OpenClaw will support MCP servers directly.

## Available Resources

- `whoop://recovery/latest` - Latest recovery score and metrics
- `whoop://sleep/latest` - Latest sleep data
- `whoop://cycle/latest` - Latest physiological cycle
- `whoop://user/profile` - User profile information

## Available Tools

- `get_recovery` - Get recovery data for date range
- `get_sleep` - Get sleep data for date range
- `get_workouts` - Get workout/strain data
- `get_hrv` - Get HRV trends

## Example Queries

**"What's my recovery today?"**
→ Fetches latest recovery score, HRV, resting heart rate

**"How many hours did I sleep last week?"**
→ Fetches sleep data for past 7 days, sums duration

**"Show my strain trend for the month"**
→ Fetches workout data for past 30 days

**"Is my HRV improving?"**
→ Analyzes HRV trend over time

## API Reference

See Whoop API docs: https://developer.whoop.com/api

## License

MIT

## Author

Sujay Choubey
