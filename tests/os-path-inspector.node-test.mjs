/**
 * Native POSIX fd-rooted READ-ONLY research helper acceptance on disposable
 * fixture files. Never invoke against user projects, home, or production.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, closeSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = join(dirname(dirname(fileURLToPath(import.meta.url))), 'research', 'os-path-inspector.c')
function fixture(run) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(),'dsh-native-fd-inspection-')))
  const root = join(temp,'root')
  mkdirSync(root,{mode:0o700})
  const nested = join(root,'safe')
  mkdirSync(nested,{mode:0o700})
  writeFileSync(join(nested,'good.txt'),'ORIGINAL SYNTHETIC\n',{mode:0o600})
  const binary = join(temp,'inspector')
  const compiler = process.env.CC || 'cc'
  const compiled = spawnSync(compiler,
    ['-std=c11','-Wall','-Wextra','-Werror','-O2',source,'-o',binary],
    {encoding:'utf8',timeout:45000})
  assert.equal(compiled.status,0,'Native fixture compiler must work on CI Linux/macOS: '+(compiled.stderr??'').slice(0,2000))
  const inspect = (path,base=root) => {
    const result=spawnSync(binary,[base,path],{encoding:'utf8',timeout:5000})
    return {code:result.status,stdout:result.stdout.trim()}
  }
  try { run({temp,root,nested,inspect}) }
  finally { rmSync(temp,{recursive:true,force:true}) }
}
test('P3-native prototype read-only fd walk accepts one ordinary file but never writes it',()=>{
  fixture(({nested,inspect})=>{
    const before=readFileSync(join(nested,'good.txt'))
    assert.deepEqual(inspect('safe/good.txt'),{code:0,stdout:'OK'})
    assert.deepEqual(readFileSync(join(nested,'good.txt')),before)
  })
})
test('P3-native prototype refuses path escape, hidden files, traversal and root symlinks',()=>{
  fixture(({root,temp,inspect})=>{
    const illegal=['../outside','safe/../safe/good.txt','/absolute','./safe/good.txt',
      'safe//good.txt','safe/.hidden','safe/good file.txt','safe/good\\txt','safe/good.txt/']
    for(const name of illegal) assert.deepEqual(inspect(name),{code:2,stdout:'REJECT'},name)
    const link=join(temp,'root-link')
    symlinkSync(root,link)
    assert.deepEqual(inspect('safe/good.txt',link),{code:2,stdout:'REJECT'})
    assert.equal(existsSync(join(root,'safe','good.txt')),true)
  })
})
test('P3-native prototype refuses final and ancestor symlinks without following them',()=>{
  fixture(({root,nested,inspect})=>{
    symlinkSync(join(nested,'good.txt'),join(nested,'shortcut.txt'))
    symlinkSync(nested,join(root,'alias'))
    assert.deepEqual(inspect('safe/shortcut.txt'),{code:2,stdout:'REJECT'})
    assert.deepEqual(inspect('alias/good.txt'),{code:2,stdout:'REJECT'})
    assert.deepEqual(inspect('safe/good.txt'),{code:0,stdout:'OK'})
  })
})
test('P3-native prototype rejects hardlinks, group/world writable files, directories and nonregular FIFO',()=>{
  fixture(({root,nested,inspect})=>{
    const good=join(nested,'good.txt'),hard=join(nested,'hard.txt')
    linkSync(good,hard)
    assert.deepEqual(inspect('safe/good.txt'),{code:2,stdout:'REJECT'})
    assert.deepEqual(inspect('safe/hard.txt'),{code:2,stdout:'REJECT'})
    rmSync(hard)
    chmodSync(good,0o666)
    assert.deepEqual(inspect('safe/good.txt'),{code:2,stdout:'REJECT'})
    chmodSync(good,0o600)
    assert.deepEqual(inspect('safe'),{code:2,stdout:'REJECT'})
    const fifo=join(nested,'not-regular')
    const created=spawnSync('mkfifo',[fifo],{encoding:'utf8',timeout:5000})
    if (created.status === 0)
      assert.deepEqual(inspect('safe/not-regular'),{code:2,stdout:'REJECT'})
    assert.deepEqual(inspect('safe/good.txt'),{code:0,stdout:'OK'})
  })
})
test('P3-native prototype rejects unknown user xattrs, even if macOS has system provenance',()=>{
  fixture(({temp,nested,inspect})=>{
    const setter=join(temp,'fixture-xattr-maker')
    const sourceXattr=join(dirname(dirname(fileURLToPath(import.meta.url))),'tests','fixtures','os-xattr-fixture.c')
    const compiled=spawnSync(process.env.CC || 'cc',
      ['-std=c11','-Wall','-Wextra','-Werror','-O2',sourceXattr,'-o',setter],
      {encoding:'utf8',timeout:45000})
    assert.equal(compiled.status,0,'Fixture xattr writer must compile on macOS/Linux: '+(compiled.stderr??'').slice(0,600))
    const target=join(nested,'good.txt')
    const before=readFileSync(target)
    assert.deepEqual(inspect('safe/good.txt'),{code:0,stdout:'OK'})
    const wrote=spawnSync(setter,[target],{encoding:'utf8',timeout:5000})
    assert.equal(wrote.status,0,'Only a disposable test fixture gets the synthetic attribute')
    assert.deepEqual(inspect('safe/good.txt'),{code:2,stdout:'REJECT'})
    assert.deepEqual(readFileSync(target),before)
  })
})
test('P3-native prototype rejects changed directory permissions and stays read-only on failure',()=>{
  fixture(({nested,inspect})=>{
    chmodSync(nested,0o777)
    assert.deepEqual(inspect('safe/good.txt'),{code:2,stdout:'REJECT'})
    chmodSync(nested,0o700)
    assert.deepEqual(inspect('safe/good.txt'),{code:0,stdout:'OK'})
  })
})
