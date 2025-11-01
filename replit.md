# Vibe Mermaid

## Overview

Vibe Mermaid is a browser-based diagram creation tool that enables users to generate and modify diagrams through natural language conversation. The application combines AI-powered chat (via OpenAI-compatible APIs) with dual rendering systems: standard Mermaid.js for flowcharts and sequence diagrams, plus a custom D3.js-based renderer for interactive mindmaps. Users can speak or type diagram descriptions, iteratively refine visualizations, and export to multiple formats (SVG, PNG, .mmd).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Single-Page Application (SPA)**: Pure vanilla JavaScript architecture with no framework dependencies. The application runs entirely client-side with state persistence via localStorage.

**Component Structure**:
- `/index.html` - Main UI shell with header controls, dual-pane layout (chat/preview), tab system, and modal dialogs
- `/src/app.js` - Core application controller managing state, UI events, chat flow, and zoom controls
- `/styles.css` - Complete styling system with CSS variables for theming, glassmorphism effects, and responsive layouts

**State Management**: Centralized state object in `app.js` storing:
- User settings (API credentials, model selection)
- Current diagram code and type detection
- Chat conversation history
- Theme preferences (UI theme and Mermaid theme are independent)
- Diagram naming for export operations

**Design Decisions**:
- **Why vanilla JS**: Minimizes bundle size, eliminates build complexity, ensures instant loading
- **Why localStorage**: Enables offline-first capability and privacy (API keys never leave browser)
- **Why dual themes**: Separates UI appearance from diagram output, allowing dark UI with light diagrams

### Rendering Architecture

**Dual Renderer System**: The application intelligently routes diagram types to appropriate renderers.

**Standard Mermaid Renderer** (`/src/mermaid.js`):
- Handles flowcharts, sequence diagrams, class diagrams, state diagrams, etc.
- Uses Mermaid.js v10 loaded via ES modules from CDN
- Supports 14 built-in themes (dark, default, forest, neutral, slate, ocean, emerald, sunset, rose, cyberpunk, grayscale, highcontrast, pastel, halloween)
- Configuration: `securityLevel: 'loose'` for maximum flexibility, `startOnLoad: false` for manual control

**Custom Mindmap Renderer** (`/src/mindmap-renderer.js`):
- Built with D3.js v7 for advanced layout control
- Implements balanced tree layout algorithm for hierarchical visualization
- Features: interactive zoom/pan, aligned box nodes, automatic text wrapping, collision detection
- Renders custom mindmap syntax (not standard Mermaid mindmap)

**Renderer Selection Logic**:
- Detects diagram type from first line of code
- Routes `mindmap` keyword to custom renderer
- Routes all other types to Mermaid.js
- Fallback handling for syntax errors

**Why dual renderers**: Mermaid's built-in mindmap lacks visual customization and layout control needed for production-quality hierarchical diagrams. Custom renderer enables precise positioning, balanced layouts, and brand-appropriate styling.

### AI Integration

**Provider Architecture** (`/src/provider.js`):
- OpenAI-compatible REST API client supporting any OpenAI-format endpoint
- JSON mode enforcement via `response_format: { type: 'json_object' }`
- Configurable endpoints: OpenAI, Azure OpenAI, local LLMs, proxy services

**Conversation Flow**:
1. System prompt establishes Vibe Mermaid persona and rules
2. Current diagram state included in each request as context
3. User message appended to conversation history
4. Response parsed as JSON containing `explanation` and `code` fields
5. New diagram code rendered, explanation shown in chat
6. Full conversation retained for context awareness

**Prompt Engineering**:
- System prompt defines output format (JSON with explanation + code)
- Instructs AI to build incrementally on existing diagram
- Handles both creation ("make a flowchart") and modification ("add a node")
- Includes examples for custom mindmap syntax

**Why JSON mode**: Ensures consistent response structure, simplifies parsing, prevents markdown formatting issues.

### Voice Input System

**Speech Recognition** (`/src/speech.js`):
- Uses Web Speech API (browser native)
- Continuous recognition with interim results for real-time feedback
- Visual indicator overlay during active listening
- Graceful degradation when API unavailable

**Implementation Details**:
- `interimResults: true` shows partial transcription
- `continuous: true` allows multi-sentence input
- Text accumulated and inserted into chat input field
- User can edit transcription before sending

**Browser Support**: Chrome, Edge, Safari (with vendor prefixes). Feature detection disables button when unavailable.

### Export System

**Format Support**:
- **SVG**: Vector format from rendered diagram DOM
- **PNG**: Rasterized via canvas conversion with transparency
- **MMD**: Raw Mermaid/mindmap source code

**Export Flow**:
1. For SVG/PNG: Extract rendered SVG from DOM
2. For PNG: Create canvas, serialize SVG to data URL, draw to canvas, export as blob
3. Trigger browser download with filename from `diagram-name` input field
4. Filename sanitization to prevent path traversal

**Why SVG priority**: Maintains diagram quality at any scale, enables post-export editing in vector tools.

### Theme System

**Dual Theme Architecture**:
- **UI Theme**: Light/dark mode for application interface (independent toggle)
- **Diagram Theme**: 14 Mermaid themes for rendered output (dropdown menu)

**UI Theme Implementation**:
- CSS custom properties (`--bg`, `--fg`, `--primary`, etc.) defined in `:root`
- `[data-ui-theme]` attribute on root element switches variable sets
- Persistent via localStorage
- Smooth transitions for color changes

**Diagram Theme Implementation**:
- Passed to Mermaid initialization config
- Custom mindmap renderer uses hardcoded colors (could be enhanced)
- Theme selection persists across sessions

**Why separate themes**: Users may want dark editing environment with light diagram output (or vice versa) for presentation contexts.

## External Dependencies

### Third-Party Libraries

**Mermaid.js v10**:
- Source: `https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs`
- Purpose: Render flowcharts, sequence diagrams, and other standard diagram types
- Loaded: Dynamically imported ES module
- License: MIT

**D3.js v7**:
- Source: `https://unpkg.com/d3@7.8.5/dist/d3.min.js`
- Purpose: Custom mindmap rendering with tree layout algorithms
- Loaded: Script tag in HTML (synchronous)
- License: ISC

**Google Fonts**:
- Fonts: Inter (300, 400, 600, 800), JetBrains Mono (400, 600)
- Purpose: Typography for UI (Inter) and code editor (JetBrains Mono)
- Loaded: CSS link in HTML

### External APIs

**OpenAI-Compatible Chat API**:
- Default endpoint: `https://api.openai.com/v1/chat/completions`
- Configurable: User can specify custom base URL
- Authentication: Bearer token from user settings
- Models: User-selectable (default varies by provider)
- Rate limiting: Handled by provider, no client-side throttling
- Error handling: HTTP status checks with error message display

**Supported Providers**:
- OpenAI (platform.openai.com)
- Azure OpenAI (custom endpoints)
- Anthropic (via OpenAI-compatible proxy)
- Local LLMs (Ollama, LM Studio, etc. with OpenAI-compatible endpoints)

### Browser APIs

**Web Speech API**:
- `SpeechRecognition` / `webkitSpeechRecognition`
- Used for voice input functionality
- Fallback: Button disabled when unavailable
- Privacy: Processes speech client-side (browser implementation dependent)

**LocalStorage API**:
- Stores: User settings (API keys, model config), theme preferences, diagram state
- Persistence: Indefinite (until user clears browser data)
- Security: API keys stored unencrypted in localStorage (user browser only)

**Canvas API**:
- Used for PNG export (SVG to raster conversion)
- Transparent background support
- Resolution: Matches rendered diagram dimensions

### Data Storage

**Client-Side Only**: No server-side database or backend. All data persists in browser localStorage with keys:
- `mermaid_copilot_settings`: JSON object with API credentials and model selection
- `mermaid_ui_theme`: String ('light' or 'dark')
- `mermaid_theme`: String (Mermaid theme name)

**Privacy Implication**: User data never transmitted except API calls to configured chat endpoint. API keys visible to anyone with physical access to user's browser.