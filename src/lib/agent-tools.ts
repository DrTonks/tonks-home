import profile from '@/config/public-profile.json'
type Args = Record<string, unknown>
type Tool = { name: string; description: string; inputSchema: Record<string, unknown>; annotations: {readOnlyHint: boolean}; execute: (args: Args) => Promise<string> }
type ModelContext = { registerTool: (tool: Tool) => unknown }
export function homeTools(): Tool[] {
  const output = (fn: (args: Args) => unknown) => async (args: Args) => {
    try { return JSON.stringify(fn(args)) } catch (error) { return JSON.stringify({error: error instanceof Error ? error.message : 'Invalid arguments'}) }
  }
  return [
    {name: 'tonks_home_info', description: 'Read the public Tonks profile and original site links. Does not expose visitor, device, conversation or account data.', annotations: {readOnlyHint: true},
      inputSchema: {type: 'object', properties: {}, additionalProperties: false},
      execute: output(args => { if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length) throw new Error('No arguments expected'); return profile })},
    {name: 'tonks_find_destinations', description: 'Find public destinations: blog articles, projects, timeline, albums or GitHub. Returns links; does not navigate or change the page.', annotations: {readOnlyHint: true},
      inputSchema: {type: 'object', properties: {query: {type: 'string', maxLength: 160}}, additionalProperties: false},
      execute: output(args => {
        if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(k => k !== 'query')) throw new Error('Invalid arguments')
        const query = args.query ?? ''
        if (typeof query !== 'string' || query.length > 160) throw new Error('Query too long or invalid')
        const terms = query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean)
        return profile.links.filter(link => terms.every(t => `${link.title} ${link.description} ${link.url}`.normalize('NFKC').toLowerCase().includes(t)))
      })},
  ]
}
let installed = false
export async function installAgentTools() {
  if (installed) return
  const context = (document as Document & {modelContext?: ModelContext}).modelContext || (navigator as Navigator & {modelContext?: ModelContext}).modelContext
  if (typeof context?.registerTool !== 'function') return
  installed = true
  for (const tool of homeTools()) {
    try { await context.registerTool(tool) } catch (error) { console.warn('[WebMCP] Tool unavailable:', tool.name, error) }
  }
}
