export class MindmapRenderer {
  constructor(container) {
    this.container = container;
    const rect = container.getBoundingClientRect();
    this.width = rect.width > 0 ? rect.width : 1400;
    this.height = rect.height > 0 ? rect.height : 900;
    this.svg = null;
    this.g = null;
    this.zoom = null;
    this.tree = null;
  }

  parseMindmapSyntax(code) {
    const lines = code.split('\n');
    let root = null;
    const stack = [];
    let rootDefined = false;
    
    lines.forEach(line => {
      // Skip empty lines and 'mindmap' declaration
      if (!line.trim() || line.trim() === 'mindmap') return;
      
      // Calculate actual indentation
      const indent = line.search(/\S/);
      let text = line.trim();
      
      // Parse tools if present (do this first to clean the text)
      let tools = null;
      const toolMatch = text.match(/^(.*?)\s*-\s*tools:\s*(.*)$/);
      if (toolMatch) {
        text = toolMatch[1].trim();
        tools = toolMatch[2].trim();
      }
      
      // Check for explicit root syntax
      if (text.startsWith('root((') && text.endsWith('))')) {
        text = text.slice(6, -2); // Extract text between root(( and ))
        root = { name: text, children: [], tools: tools };
        stack.push({ node: root, indent: indent });
        rootDefined = true;
        return;
      }
      
      // Clean up text - remove parentheses/brackets formatting
      let originalText = text;
      // Single parentheses for round nodes
      if (text.startsWith('(') && text.endsWith(')')) {
        text = text.slice(1, -1);
      }
      // Double parentheses for other formats
      else if (text.startsWith('((') && text.endsWith('))')) {
        text = text.slice(2, -2);
      }
      // Square brackets
      else if (text.startsWith('[') && text.endsWith(']')) {
        text = text.slice(1, -1);
      }
      
      // If root hasn't been defined yet, the first line is the root
      if (!rootDefined) {
        root = { name: text, children: [], tools: tools };
        stack.push({ node: root, indent: indent });
        rootDefined = true;
        return;
      }
      
      // Create new node
      const node = {
        name: text,
        tools: tools,
        children: []
      };
      
      // Find the correct parent based on indentation
      // Pop stack until we find a node with less indentation
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      
      // Add node to its parent
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.node.children.push(node);
      }
      
      // Push this node to stack for potential children
      stack.push({ node: node, indent: indent });
    });
    
    return root || { name: 'Root', children: [] };
  }

  // Calculate text dimensions
  getTextDimensions(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = '12px sans-serif';
    
    const metrics = context.measureText(text || '');
    const padding = 16;
    
    return {
      width: Math.max(80, metrics.width + padding * 2),
      height: 30
    };
  }

  render(mindmapCode) {
    if (!window.d3) {
      console.error('D3 is not loaded');
      this.container.innerHTML = '<div style="color:red; padding:20px;">Error: D3 library not loaded.</div>';
      return;
    }
    
    // Clear previous render
    this.container.innerHTML = '';
    
    // Parse the mindmap syntax
    const treeData = this.parseMindmapSyntax(mindmapCode);
    
    // Create hierarchy
    const root = d3.hierarchy(treeData);
    
    // Create tree layout - horizontal tree from center
    const treeLayout = d3.tree()
      .nodeSize([30, 180]) // [height between nodes, width between levels] - more compact
      .separation((a, b) => a.parent === b.parent ? 1 : 1.2);
    
    // Apply layout
    treeLayout(root);
    
    // Split nodes into left and right for balanced layout
    const leftNodes = [];
    const rightNodes = [];
    
    root.children?.forEach((child, i) => {
      if (i % 2 === 0) {
        rightNodes.push(child);
      } else {
        leftNodes.push(child);
      }
    });
    
    // Fixed distance for alignment
    const fixedDistance = 150; // Fixed distance from center for all level 1 nodes
    
    // Reposition nodes for balanced layout with aligned boxes
    const repositionNodes = (nodes, side) => {
      nodes.forEach(node => {
        const descendants = node.descendants();
        descendants.forEach(d => {
          if (d !== root) {
            // Set fixed positions for proper alignment
            if (d.depth === 1) {
              d.y = fixedDistance * side;
            } else if (d.depth === 2) {
              d.y = (fixedDistance + 180) * side;
            } else if (d.depth === 3) {
              d.y = (fixedDistance + 360) * side;
            } else {
              d.y = (fixedDistance + 180 * (d.depth - 1)) * side;
            }
          }
        });
      });
    };
    
    repositionNodes(leftNodes, -1);
    repositionNodes(rightNodes, 1);
    
    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('background', 'transparent');
    
    // Add zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });
    
    this.svg.call(this.zoom);
    
    // Create main group - center it
    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.width / 2},${this.height / 2})`);
    
    // Store reference to this for use in callbacks
    const self = this;
    
    // Create links with elbowed connectors
    const links = this.g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(root.links())
      .enter()
      .append('path')
      .attr('d', d => {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;
        
        // Get node dimensions
        const sourceWidth = this.getTextDimensions(d.source.data.name).width;
        const targetWidth = this.getTextDimensions(d.target.data.name).width;
        
        if (d.source.depth === 0) {
          // From root - straight line to first level
          const rootEdgeY = targetY > 0 ? sourceWidth/2 : -sourceWidth/2;
          const targetEdgeY = targetY > 0 ? targetY - targetWidth/2 : targetY + targetWidth/2;
          return `M ${rootEdgeY},${sourceX} L ${targetEdgeY},${targetX}`;
        } else {
          // Elbowed connector between other levels
          const sourceEdgeY = sourceY > 0 ? sourceY + sourceWidth/2 : sourceY - sourceWidth/2;
          const targetEdgeY = targetY > 0 ? targetY - targetWidth/2 : targetY + targetWidth/2;
          const elbowOffset = 20;
          
          return `M ${sourceEdgeY},${sourceX}
                  L ${sourceEdgeY + (targetY > 0 ? elbowOffset : -elbowOffset)},${sourceX}
                  L ${sourceEdgeY + (targetY > 0 ? elbowOffset : -elbowOffset)},${targetX}
                  L ${targetEdgeY},${targetX}`;
        }
      })
      .attr('stroke', '#999')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')
      .attr('opacity', 0.6);
    
    // Create nodes - position them at their calculated positions
    const nodes = this.g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`);
    
    // Add rectangles for nodes
    nodes.each(function(d) {
      const node = d3.select(this);
      const dimensions = self.getTextDimensions(d.data.name);
      
      // Colors based on depth
      const colors = {
        0: { bg: '#7c3aed', border: '#6d28d9', text: '#ffffff' }, // Root
        1: { bg: '#e0e7ff', border: '#3b82f6', text: '#1f2937' }, // Level 1
        2: { bg: '#ffffff', border: '#10b981', text: '#1f2937' }, // Level 2
        3: { bg: '#ffffff', border: '#f59e0b', text: '#1f2937' }, // Level 3
        4: { bg: '#ffffff', border: '#ef4444', text: '#1f2937' }, // Level 4
        default: { bg: '#ffffff', border: '#6b7280', text: '#1f2937' }
      };
      
      const colorScheme = colors[d.depth] || colors.default;
      
      // Add rectangle - position to align boxes
      let rectX = -dimensions.width / 2; // Default center for root
      
      if (d.depth > 0) {
        if (d.y > 0) {
          // Right side - all boxes start at x=0 (left-aligned)
          rectX = -dimensions.width / 2;
        } else {
          // Left side - all boxes end at x=0 (right-aligned)  
          rectX = -dimensions.width / 2;
        }
      }
      
      const rect = node.append('rect')
        .attr('x', rectX)
        .attr('y', -dimensions.height / 2)
        .attr('width', dimensions.width)
        .attr('height', dimensions.height)
        .attr('rx', d.depth === 0 ? 8 : 4)
        .attr('ry', d.depth === 0 ? 8 : 4)
        .attr('fill', colorScheme.bg)
        .attr('stroke', colorScheme.border)
        .attr('stroke-width', d.depth === 0 ? 3 : 2)
        .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');
      
      // Add text - centered in the box
      const textX = 0; // Always center text at node position
      
      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('x', textX)
        .attr('y', 0)
        .style('font-size', d.depth === 0 ? '14px' : '11px')
        .style('font-weight', d.depth === 0 ? 'bold' : 'normal')
        .style('fill', colorScheme.text)
        .style('pointer-events', 'none')
        .text(d.data.name);
    });
    
    // Add interactivity
    nodes
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).select('rect')
          .transition()
          .duration(200)
          .style('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))');
        
        // Show tooltip for tools
        if (d.data.tools) {
          const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'mindmap-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '6px 10px')
            .style('border-radius', '4px')
            .style('font-size', '11px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .text(`Tools: ${d.data.tools}`);
          
          tooltip
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 25) + 'px');
        }
      })
      .on('mouseleave', function() {
        d3.select(this).select('rect')
          .transition()
          .duration(200)
          .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');
        
        d3.selectAll('.mindmap-tooltip').remove();
      })
      .on('click', function(event, d) {
        // Toggle children visibility
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else if (d._children) {
          d.children = d._children;
          d._children = null;
        }
        // Re-render would go here
      });
    
    // Auto-fit
    setTimeout(() => {
      try {
        const bounds = this.g.node().getBBox();
        if (bounds.width > 0 && bounds.height > 0) {
          const padding = 50;
          const scaleX = (this.width - padding * 2) / bounds.width;
          const scaleY = (this.height - padding * 2) / bounds.height;
          const scale = Math.min(1, Math.min(scaleX, scaleY));
          
          if (Number.isFinite(scale) && scale > 0) {
            this.svg.call(
              this.zoom.transform,
              d3.zoomIdentity
                .translate(this.width / 2, this.height / 2)
                .scale(scale)
            );
          }
        }
      } catch (err) {
        console.log('Auto-fit skipped');
      }
    }, 100);
  }

  resetZoom() {
    if (this.svg && this.zoom) {
      this.svg.transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity
          .translate(this.width / 2, this.height / 2));
    }
  }

  zoomIn() {
    if (this.svg && this.zoom) {
      this.svg.transition()
        .duration(750)
        .call(this.zoom.scaleBy, 1.3);
    }
  }

  zoomOut() {
    if (this.svg && this.zoom) {
      this.svg.transition()
        .duration(750)
        .call(this.zoom.scaleBy, 0.7);
    }
  }
}