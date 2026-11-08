#!/usr/bin/env node
/** Read-only validation of a private DSH Workspace/Session inventory export. No network or writes. */
import { pathToFileURL } from 'node:url'
import { readDshCatalog } from '../src/local-first/existing-dsh-projects.ts'

export function checkCatalog(file, list=false) {
  const items=readDshCatalog(file)
  const sessions=items.reduce((total,p)=>total+p.sessionIds.length,0)
  if(items.length===0) throw Error('No existing DSH Workspaces in the inventory')
  if(list) {
    // Operator-only output; never print original paths or Session IDs.
    for(const p of items) process.stdout.write(p.projectId+'\t'+p.title+'\t'+p.sessionIds.length+' session(s)\n')
  }
  process.stdout.write('Existing DSH catalog verified: '+items.length+' workspace(s), '+sessions+' session membership(s)\n')
}
export function main(args=process.argv.slice(2)) {
  const list=args.includes('--list')
  const paths=args.filter(a=>a!=='--list')
  if(paths.length!==1)throw Error('Usage: node --experimental-strip-types scripts/check-existing-dsh-catalog.mjs /PRIVATE/DSH-CATALOG.json [--list]')
  checkCatalog(paths[0],list)
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  try{main()}catch(error){console.error(error instanceof Error?error.message:'Catalog check failed');process.exitCode=1}
