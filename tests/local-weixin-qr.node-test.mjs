import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getCode, checkCode, storeConfirmed, startPairing } from '../scripts/weixin-native-pair.mjs'
import { readNativeCredentials } from '../src/sources/weixin-native.ts'
const fixture=async work=>{
  const folder=mkdtempSync(join(tmpdir(),'dsh-qr-test-'))
  try {await work(join(folder,'credentials.json'))}
  finally {rmSync(folder,{recursive:true,force:true})}
}
const fake=(result,calls=[])=>async(url,init)=>{
  calls.push({url,init})
  return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}})
}
test('QR challenge and poll statuses are parsed with no OpenClaw dependency',async()=>{
  const calls=[]
  assert.deepEqual(await getCode(fake({qrcode:'challenge',qrcode_img_content:'https://pairing.example/qr'},calls)),
    {id:'challenge',content:'https://pairing.example/qr'})
  assert.equal(calls[0].url,'https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=3')
  assert.deepEqual(JSON.parse(calls[0].init.body),{local_token_list:[]})
  const status=await checkCode('challenge','https://ilinkai.weixin.qq.com',undefined,fake({status:'wait'},calls))
  assert.equal(status.status,'wait')
  assert.ok(calls[1].url.includes('qrcode=challenge'))
  assert.equal(calls[1].init.headers.AuthorizationType,undefined)
  assert.equal(calls[1].init.headers['X-WECHAT-UIN'],undefined)
})
test('confirmed state stores credentials owner-only, no token in public response',()=>fixture(async file=>{
  const result={status:'confirmed',bot_token:'this-is-only-a-test-token',ilink_bot_id:'test-bot',baseurl:'https://ilinkai.weixin.qq.com'}
  storeConfirmed(file,result)
  assert.equal(statSync(file).mode&0o077,0)
  assert.equal(readNativeCredentials(file).token,'this-is-only-a-test-token')
  assert.throws(()=>storeConfirmed(file,result),/overwrite/)
  assert.match(readFileSync(file,'utf8'),/test-bot/)
}))
test('mocked QR pairing flow requires no real login and delivers correct states',()=>fixture(async file=>{
  const emitted=[],steps=[
    {qrcode:'qr-a',qrcode_img_content:'fake-code'},
    {status:'scaned'},
    {status:'confirmed',bot_token:'this-is-only-a-test-token',ilink_bot_id:'test-bot',baseurl:'https://ilinkai.weixin.qq.com'}
  ]
  await startPairing(file,{fetcher:fakeSequence(steps),render:text=>emitted.push(text),sleep:async()=>{},clock:()=>Date.now()})
  assert.deepEqual(emitted,['fake-code'])
  assert.equal(readNativeCredentials(file).botId,'test-bot')
}))
test('blocked/unconfirmed binding never stores credentials',()=>fixture(async file=>{
  await assert.rejects(startPairing(file,{fetcher:fakeSequence([
    {qrcode:'qr-a',qrcode_img_content:'fake-code'}, {status:'binded_redirect'}
  ]),render:()=>{},sleep:async()=>{}}),/bound/)
  assert.throws(()=>readNativeCredentials(file),/ENOENT/)
}))
function fakeSequence(seq){
  let n=0
  return async()=>new Response(JSON.stringify(seq[Math.min(n++,seq.length-1)]),{status:200})
}
