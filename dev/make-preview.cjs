// 미리보기 주소(/field-preview/) 전용 가공: 저장 데이터 분리·설치(매니페스트) 제외·미리보기 표시
// 사용: node dev/make-preview.cjs <빌드된 index.html> <출력 경로> <버전>
const fs = require('fs');
const [src, out, ver] = process.argv.slice(2);
let h = fs.readFileSync(src, 'utf8');
const shim = '<script>/* 미리보기: 게임 주소(/field/) 저장 데이터와 분리 */(function(){var L=window.localStorage,P="preview:",S=Storage.prototype,g=S.getItem,s=S.setItem,r=S.removeItem;'
  + 'S.getItem=function(k){return g.call(this,this===L?P+k:k)};S.setItem=function(k,v){return s.call(this,this===L?P+k:k,v)};S.removeItem=function(k){return r.call(this,this===L?P+k:k)};})();</script>';
const n0 = h.length;
h = h.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + shim);
if (h.length === n0) throw Error('charset meta not found');
h = h.replace(/<link rel="manifest"[^>]*>\n?/, '');
h = h.replace(/<title>([^<]*)<\/title>/, (m, t) => '<title>[미리보기 ' + ver + '] ' + t + '</title>');
h = h.replace('</body>', '<div style="position:fixed;left:50%;top:2px;transform:translateX(-50%);z-index:99999;pointer-events:none;font:11px sans-serif;color:#ffd27a;background:rgba(0,0,0,.55);padding:1px 6px;border-radius:4px">미리보기 ' + ver + '</div>\n</body>');
fs.writeFileSync(out, h);
console.log('preview built', ver, h.length);
