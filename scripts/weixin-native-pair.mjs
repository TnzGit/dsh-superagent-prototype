#!/usr/bin/env node
/**
 * Direct DSH Weixin QR pairing — REQUIRES operator approval before starting.
 * --check performs NO network requests or pairing. QR is drawn locally with qrencode.
 * On confirmed login, stores bot token only in a new owner-only credentials file.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, openSync, writeFileSync, closeSync, statSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { headers, secureBase, DEFAULT_BASE } from '../src/local-first/weixin-native-protocol.ts'

const QR_ROUTE='/ilink/bot/get_bot_qrcode?bot_type=3'
const STATUS_ROUTE='/ilink/bot/get_qrcode_status'
export const scanStates=['wait','scaned','confirmed','expired','need_verifycode','verify_code_blocked','scaned_but_redirect','binded_redirect']
/** No externally hosted QR rendering; a native local qrencode command is required. */
export function renderLocally(content, binary='qrencode') {
  if(!content || typeof content!=='string')throw Error('QR payload missing')
  execFileSync(binary,['-t','UTF8','-o','-'],{input:content,stdio:['pipe','inherit','inherit'],timeout:15000})
}
async function json(url,options,fetcher=fetch) {
  const res=await fetcher(url,{...options,signal:AbortSignal.timeout(35000),redirect:'error'})
  if(!res.ok)throw Error('Weixin QR API HTTP '+res.status)
  return res.json()
}
export async function getCode(fetcher=fetch) {
  const response=await json(DEFAULT_BASE+QR_ROUTE,{
    method:'POST',headers:headers(),body:JSON.stringify({local_token_list:[]})
  },fetcher)
  if(typeof response.qrcode!=='string'||!response.qrcode ||
      typeof response.qrcode_img_content!=='string'||!response.qrcode_img_content)
    throw Error('Weixin did not supply a QR challenge')
  return {id:response.qrcode,content:response.qrcode_img_content}
}
export async function checkCode(id,host=DEFAULT_BASE,verifyCode,fetcher=fetch) {
  const url=secureBase(host)+STATUS_ROUTE+'?qrcode='+encodeURIComponent(id)
    +(verifyCode?'&verify_code='+encodeURIComponent(verifyCode):'')
  const result=await json(url,{method:'GET',headers:headers()},fetcher)
  if(!scanStates.includes(result.status))throw Error('Unsupported Weixin QR status')
  return result
}
export function storeConfirmed(file, result) {
  if(!isAbsolute(file))throw Error('Credentials file must have an absolute path')
  if(existsSync(file))throw Error('Refusing to overwrite existing credentials')
  if(!result || result.status!=='confirmed'||typeof result.bot_token!=='string'||result.bot_token.length<16 ||
      typeof result.ilink_bot_id!=='string'||!result.ilink_bot_id)throw Error('Login was not confirmed')
  const baseUrl=secureBase(result.baseurl||DEFAULT_BASE)
  // User-only credentials file. Never print the bearer token or local identities.
  const fd=openSync(file,'wx',0o600)
  try { writeFileSync(fd,JSON.stringify({token:result.bot_token,botId:result.ilink_bot_id,baseUrl})+'\n',{encoding:'utf8'}) }
  finally {closeSync(fd)}
}
async function verifyCodeInput() {
  if(!process.stdin.isTTY || !process.stdin.setRawMode)throw Error('Enter verification code from an interactive local terminal')
  process.stdout.write('请操作者在终端输入手机上显示的验证码（不回显），按 Enter 确认：')
  process.stdin.setRawMode(true)
  process.stdin.resume()
  return await new Promise((done,reject)=>{
    let code=''
    const onData=chunk=>{
      for(const ch of String(chunk)){
        if(ch==='\r'||ch==='\n') {
          process.stdin.off('data',onData)
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdout.write('\n')
          done(code);return
        }
        if(ch==='\u0003'){process.stdin.off('data',onData);process.stdin.setRawMode(false);reject(Error('Operator cancelled'));return}
        if(/[A-Za-z0-9]/.test(ch) && code.length<24)code+=ch
      }
    }
    process.stdin.on('data',onData)
  })
}
export async function startPairing(file,{fetcher=fetch,render=renderLocally,verify=verifyCodeInput,clock=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  if(!isAbsolute(file) || existsSync(file))throw Error('Use a new absolute credentials path outside all git projects')
  const parent=statSync(dirname(file))
  if(!parent.isDirectory()||(parent.mode&0o077)!==0)throw Error('Credentials parent must be an owner-only directory (0700)')
  const deadline=clock()+5*60_000
  let host=DEFAULT_BASE,verifyCode=undefined,refreshes=0,qr=await getCode(fetcher)
  render(qr.content)
  process.stdout.write('请由操作者使用微信扫码并确认。成功之前不会启用微信接收。\n')
  while(clock()<deadline){
    const state=await checkCode(qr.id,host,verifyCode,fetcher)
    switch(state.status){
      case 'confirmed':storeConfirmed(file,state);process.stdout.write('微信配对成功，凭据已安全保存在本机。\n');return
      case 'scaned':process.stdout.write('扫码已识别，请在微信上确认。\n');break
      case 'need_verifycode':verifyCode=await verify();break
      case 'scaned_but_redirect':
        if(!state.redirect_host)throw Error('Weixin redirect has no hostname')
        host=secureBase(state.redirect_host);break
      case 'expired':
        if(++refreshes>2)throw Error('QR expired repeatedly; restart only with user approval')
        qr=await getCode(fetcher);render(qr.content);verifyCode=undefined;host=DEFAULT_BASE;break
      case 'binded_redirect':throw Error('Weixin bot is already bound; ask the operator before any rebinding')
      case 'verify_code_blocked':throw Error('Verification blocked; ask operator before retry')
    }
    await sleep(1250)
  }
  throw Error('Pairing expired without operator confirmation')
}
export async function main(args=process.argv.slice(2)) {
  if(args.length===1 && args[0]==='--check'){
    execFileSync('qrencode',['--version'],{stdio:'ignore',timeout:5000})
    process.stdout.write('本机 qrencode 可用；尚未触发二维码申请或登录。\n')
    return
  }
  const idx=args.indexOf('--output')
  if(!args.includes('--user-approved')||idx<0||!args[idx+1]||args.length!==3)
    throw Error('Usage: node --experimental-strip-types scripts/weixin-native-pair.mjs --user-approved --output /ABSOLUTE/PRIVATE/PATH.json')
  await startPairing(resolve(args[idx+1]))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{console.error('Weixin pairing stopped: '+(error instanceof Error?error.message:'unknown'));process.exitCode=1})
