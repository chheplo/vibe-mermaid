# Mermaid Copilot

Create and edit diagrams through natural conversation. Just describe what you want, and watch your ideas transform into beautiful visualizations.

![Mermaid Copilot Screenshot](screenshot.png)

## The Conversational Way to Create Diagrams

Instead of learning complex syntax or fighting with drawing tools, simply **talk to your diagrams**:

- 🗣️ "Create a flowchart showing user login process"
- 🗣️ "Add a decision node for email verification"
- 🗣️ "Change the colors to match our brand"
- 🗣️ "Make it a mindmap instead"

Your diagrams evolve through natural conversation, making complex visualizations as easy as having a chat.

## Features

- **🎤 Voice Input** - Click the mic and speak your diagram into existence
- **💬 Natural Language** - No syntax to memorize, just describe what you want
- **🔄 Iterative Editing** - Refine through conversation: "move that node left", "add an arrow here"
- **🎨 Smart Suggestions** - The AI understands context and suggests improvements
- **✨ Instant Preview** - See changes as you describe them
- **🎯 Custom Mindmaps** - Beautiful hierarchical layouts with aligned boxes

## Getting Started

### 1. Open the App

No installation needed. Just open `index.html` in your browser or serve it locally:

```bash
python3 -m http.server 8080
```

### 2. Add Your API Key

Click **Settings** and add your OpenAI API key (or any OpenAI-compatible endpoint):
- OpenAI API keys from [platform.openai.com](https://platform.openai.com)
- Compatible with Azure OpenAI, Anthropic via proxy, or local LLMs
- Your key stays in your browser (localStorage)

### 3. Start Talking

Click the **microphone** button or type in the chat:

```
You: Create a mindmap about project planning
AI: I'll create a project planning mindmap for you...
You: Add risk management as a main branch
AI: I've added risk management to your mindmap...
You: Include mitigation strategies under risks
AI: Updated with mitigation strategies...
```

## Voice Commands Examples

### Creating Diagrams
- "Create a flowchart for user registration"
- "Make a mindmap about machine learning"
- "Draw a sequence diagram for API authentication"

### Editing and Refining
- "Change the start node color to blue"
- "Add a branch for error handling"
- "Connect the login node to dashboard"
- "Make the text bigger"
- "Simplify this diagram"

### Transforming
- "Convert this to a mindmap"
- "Turn it into a sequence diagram"
- "Make it horizontal instead of vertical"

## Supported Diagram Types

All Mermaid diagram types plus enhanced mindmaps:
- Flowcharts
- Mindmaps (with custom renderer)
- Sequence diagrams
- Class diagrams
- State diagrams
- Entity relationships
- Gantt charts
- Git graphs
- And more...

## Export Your Work

- **PNG** - High-resolution images
- **SVG** - Scalable vectors
- **MMD** - Mermaid source code

## Zero Build Philosophy

Pure HTML, CSS, and JavaScript. No npm, no webpack, no build steps. Just open and use.

## Browser Requirements

Any modern browser with:
- ES6 support
- Web Speech API (for voice input)
- LocalStorage (for settings)

## Privacy

- Your API key never leaves your browser
- All processing happens between your browser and your AI provider
- No telemetry, no tracking, no data collection

## Contributing

Keep it conversational. Keep it simple. No build tools.

## License

MIT

---

*Because creating diagrams should be as natural as having a conversation.*