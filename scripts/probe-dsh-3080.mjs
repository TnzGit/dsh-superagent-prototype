#!/usr/bin/env node
/** Only READS official DSH 3080 Session/list and a private imported Workspace catalog.
 * Does not prompt, migrate, create, select a model, or restart either DSH process.
 */
import { pathToFileURL } from 'node:url'
import { readDshCatalog } from '../src/local-first/existing-dsh-projects.ts'
import { Dsh3080Bridge } from '../src/local-first/dsh-3080-bridge.ts'
export async function probe({catalogFile,projectId,sessionId},options={}) {
  const projects=readDshCatalog(catalogFile)
  const bridge=new Dsh3080Bridge({fetcher:options.fetcher})
  const sessions=await bridge.listSessions()
  const migration=sessions.filter(s=>s.formatStatus==='migration-required').length
  const cloudOrUnknown=sessions.filter(s=>{
    const m=s.projections?.values?.modelSelection
    return !m||typeof m!=='object'||m.provider!=='cmp170hx'||m.model!=='Qwen3.8-Flash-Next'
  }).length
  const summary={workspaceCount:projects.length,sessionCount:sessions.length,
    currentlyRunning:sessions.filter(s=>s.running).length,
    requiresMigration:migration,nonApprovedOrUnknownModel:cloudOrUnknown,
    ownerAuthRisk:'3080 host permits local anonymous owner; do not treat this as authentication',
    readyForLivePrompt:false}
  if(projectId || sessionId){
    const project=projects.find(p=>p.projectId===projectId)
    if(!project||!sessionId)throw Error('Supply a unique private project alias AND Session ID')
    const check=await bridge.inspect(project,sessionId)
    // Don't reveal the actual IDs, paths or model data in public logs.
    return {summary,check:{allowed:check.allowed,reasons:check.reasons,
      originalSessionVerified:check.originalSessionVerified}}
  }
  return {summary}
}
export async function main(argv=process.argv.slice(2)) {
  const index=argv.indexOf('--catalog')
  if(index<0||!argv[index+1])throw Error('Usage: node --experimental-strip-types scripts/probe-dsh-3080.mjs --catalog /PRIVATE/DSH-CATALOG.json [--project ALIAS --session SESSION-ID]')
  const project=argv.indexOf('--project'),session=argv.indexOf('--session')
  const output=await probe({catalogFile:argv[index+1],
    ...(project>=0?{projectId:argv[project+1]}:{}),...(session>=0?{sessionId:argv[session+1]}:{})})
  process.stdout.write(JSON.stringify(output,null,2)+'\n')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{console.error('DSH 3080 read-only probe failed: '+(error instanceof Error?error.message:'unknown'));process.exitCode=1})
