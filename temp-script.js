
var KEY="petrol-credit-ledger-v1",S,view=null,from="",to="",onlyDue=false,cb,tab="ledger",dr=null,iv=null,sv=null,bf="all",rf=today().slice(0,8)+"01",rt=today();
function load(){try{var r=localStorage.getItem(KEY);if(r)return JSON.parse(r)}catch(e){}
var d=function(n){return new Date(Date.now()-n*864e5).toISOString().slice(0,10)};
return{c:[
{id:1,name:"Shree Transport",phone:"9876500011",gst:"27ABCDE1234F1Z5",veh:["MH12 AB 1234","MH12 CD 5678"],limit:50000,e:[{d:d(9),t:"sale",n:"HSD 300 L",a:28500},{d:d(5),t:"pay",n:"UPI",a:10000},{d:d(2),t:"sale",n:"HSD 150 L",a:14250}]},
{id:2,name:"Patil Agro Services",phone:"9876500022",gst:"",veh:["MH14 XY 9090"],limit:20000,e:[{d:d(6),t:"sale",n:"MS 100 L",a:10800},{d:d(3),t:"sale",n:"Power MS 60 L",a:7100}]},
{id:3,name:"City Cab Fleet",phone:"9876500033",gst:"27PQRST5678G1Z2",veh:[],limit:30000,e:[{d:d(4),t:"sale",n:"MS 200 L",a:21600},{d:d(1),t:"pay",n:"Cash",a:21600}]}]}}
function save(){if(!SRV){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}return}clearTimeout(saveT);saveT=setTimeout(push,400)}
function due(c){return c.e.reduce(function(s,x){return s+(x.t=="sale"?x.a:-x.a)},0)}
function inr(n){return "₹"+Math.round(n).toLocaleString("en-IN")}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function today(){return new Date().toISOString().slice(0,10)}
function find(id){return S.c.filter(function(c){return c.id==id})[0]}
function render(){if(tab=="cashflow")return renderCashflow();if(tab=="inv")return renderInv();if(tab=="stock")return renderStock();if(tab=="sup")return renderSup();if(tab=="book")return renderBook();if(tab=="rep")return renderRep();if(tab=="bak")return renderBak();if(tab=="team")return renderTeam();if(tab=="credit")return renderCredit();if(tab=="duty")return renderDutyTab();if(tab=="tanks")return renderTanks();if(tab=="wdip")return loadDip();if(tab=="pay")return renderSalary();if(tab=="setup")return renderSetup();if(tab=="veh")return renderVeh();if(tab=="short")return renderShort();if(tab=="mypay")return loadMyPay();if(tab=="wduty")return loadW();var h="";
if(!view){var tot=S.c.reduce(function(s,c){return s+due(c)},0),q=(document.getElementById("q")||{}).value||"";
h+=nav()+pendHtml()+'<h1>Total credit outstanding</h1><div class="total">'+inr(tot)+'</div><div class="row"><input id="q" placeholder="Search name or vehicle" value="'+esc(q)+'" oninput="render();var i=document.getElementById(\'q\');i.focus();i.setSelectionRange(99,99)"><button onclick="custForm()">Add customer</button></div><button class="ghost" style="width:100%;margin-top:8px" onclick="bulkForm()">Send reminders to everyone with dues</button><button class="ghost" style="width:100%;margin-top:8px" onclick="renderVeh()">Vehicle-wise credit report</button><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto;margin:0" '+(onlyDue?'checked':'')+' onchange="onlyDue=this.checked;render()">Only customers with dues</label>';
var l=S.c.filter(function(c){var t=(c.name+c.veh.join(" ")).toLowerCase();return t.indexOf(q.toLowerCase())>-1&&(!onlyDue||due(c)>0)});
if(!l.length)h+='<div class="empty">No credit customers found. Add one to start a ledger.</div>';
l.forEach(function(c){var d=due(c),p=c.limit?Math.min(100,d/c.limit*100):0;
h+='<div class="cust" tabindex="0"'+(c.active===false?' style="opacity:.6"':'')+' onclick="view='+c.id+';render()" onkeydown="if(event.key==\'Enter\'){view='+c.id+';render()}"><div class="row"><b>'+esc(c.name)+(c.active===false?' (inactive)':'')+'</b><span class="amt" style="text-align:right;flex:none;color:'+(d>0?'var(--due)':'var(--ok)')+'">'+inr(d)+'</span></div><div class="sub">'+(c.veh.length?esc(c.veh.join(", ")):"No vehicles added")+'</div><div class="bar"><i style="width:'+p+'%;background:'+(p>=90?'var(--due)':p>=70?'var(--warn)':'var(--ok)')+'"></i></div><div class="sub" style="margin-top:4px">'+Math.round(p)+'% of '+inr(c.limit)+' limit used</div></div>'}
)}else{var c=find(view),d=due(c),bal=0;
h+='<button class="ghost noprint" onclick="view=null;render()">Back to customers</button><h1 style="margin-top:14px">'+esc(c.name)+'</h1><div class="total">'+inr(d)+'</div><div class="sub">Limit '+inr(c.limit)+' · Available '+inr(Math.max(0,c.limit-d))+'</div><div class="sub">'+esc(c.phone)+(c.gst?' · GST '+esc(c.gst):'')+'</div><div class="sub">Vehicles: '+(c.veh.length?esc(c.veh.join(", ")):"none added")+'</div>'+
'<div class="btns noprint"><button onclick="entryForm(\'sale\')">Add credit sale</button><button onclick="entryForm(\'pay\')">Receive payment</button><button class="ghost" onclick="remind()">Send WhatsApp reminder</button><button class="ghost" onclick="custForm('+c.id+')">Edit details</button><button class="ghost" onclick="window.print()">Print statement</button><button class="ghost" onclick="stmt()">Share text statement</button>'+xbtns()+'<button class="ghost" onclick="stmtPdfShare()">Send PDF on WhatsApp</button></div>';
XD=stmtDoc(c);h+=ageing(c)+'<div class="row noprint"><label>From<input type="date" value="'+from+'" onchange="from=this.value;render()"></label><label>To<input type="date" value="'+to+'" onchange="to=this.value;render()"></label></div>';
h+='<div class="tbl" style="margin-top:12px"><table><tr><th>Date</th><th>Detail</th><th class="r">Amount</th><th class="r">Balance</th><th class="noprint"></th></tr>';var n=0;
rows(c).forEach(function(o){var x=o.x;if(o.skip)return;n++;
h+='<tr><td>'+x.d.slice(5)+'</td><td>'+(x.t=="sale"?"Sale: ":"Paid: ")+esc(x.n)+'</td><td class="r '+x.t+'">'+(x.t=="sale"?"+":"\u2212")+inr(x.a)+'</td><td class="r">'+inr(o.bal)+'</td><td class="noprint" style="white-space:nowrap">'+(x.srv?'':'<button class="ghost" style="padding:5px 8px" onclick="entryForm(\''+x.t+'\','+o.i+')">Edit</button> ')+'<button class="ghost" style="padding:5px 8px" onclick="delEntry('+o.i+')">Delete</button></td></tr>'});
if(!n)h+='<tr><td colspan="5" class="empty">No entries in this range.</td></tr>';
h+='</table></div>'}
document.getElementById("app").innerHTML=h}
function openM(h, wide){var s=document.getElementById("sheet");s.innerHTML=h;if(wide)s.classList.add("wide-sheet");else s.classList.remove("wide-sheet");document.getElementById("modal").classList.add("on")}
function close(){document.getElementById("sheet").classList.remove("wide-sheet");document.getElementById("modal").classList.remove("on")}
document.getElementById("modal").onclick=function(e){if(e.target.id=="modal")close()};
function v(id){return document.getElementById(id).value.trim()}
function custForm(id){var c=id?find(id):{name:"",phone:"",gst:"",veh:[],limit:""};
openM('<h2>'+(id?'Edit customer':'Add credit customer')+'</h2><label>Name<input id="f1" value="'+esc(c.name)+'"></label><label>Phone (WhatsApp)<input id="f2" inputmode="tel" value="'+esc(c.phone)+'"></label><label>GST number (optional)<input id="f3" value="'+esc(c.gst)+'"></label><label>Vehicles, one per line (add the tank size in litres after a comma if known)<textarea id="f4" placeholder="MH12 AB 1234, 200&#10;MH14 XY 9090" style="width:100%;height:90px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);padding:8px;font:inherit;margin-top:4px">'+esc(c.veh.map(function(x){return x+(c.vtank&&c.vtank[x]?", "+c.vtank[x]:"")}).join("\n"))+'</textarea></label><label>Credit limit (₹)<input id="f5" inputmode="numeric" value="'+esc(c.limit)+'"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveCust('+(id||0)+')">Save customer</button></div>')}
function saveCust(id){var n=v("f1"),p=v("f2").replace(/\D/g,""),l=parseFloat(v("f5"));
var pv=parseVeh(document.getElementById("f4").value);if(!n)return er("Enter the customer name.");if(p.length<10)return er("Enter a 10-digit phone number.");if(!(l>0))return er("Enter a credit limit above zero.");
var o={name:n,phone:p,gst:v("f3").toUpperCase(),veh:pv.veh,vtank:pv.tank,limit:l};
if(id){Object.assign(find(id),o)}else{o.id=Date.now();o.e=[];S.c.push(o)}save();close();render()}
function er(m){document.getElementById("er").textContent=m}
function rows(c){var bal=0;return c.e.map(function(x,i){return{x:x,i:i}}).sort(function(p,q){return p.x.d<q.x.d?-1:1}).map(function(o){bal+=o.x.t=="sale"?o.x.a:-o.x.a;o.bal=bal;o.skip=(from&&o.x.d<from)||(to&&o.x.d>to);return o})}
function ageing(c){var paid=c.e.reduce(function(s,x){return s+(x.t=="pay"?x.a:0)},0),k=[0,0,0,0],now=Date.now(),L=["0-30 days","31-60","61-90","90+"];
c.e.filter(function(x){return x.t=="sale"}).sort(function(p,q){return p.d<q.d?-1:1}).forEach(function(x){var r=x.a,u=Math.min(paid,r);paid-=u;r-=u;if(r>0){var dy=Math.floor((now-new Date(x.d))/864e5);k[dy<=30?0:dy<=60?1:dy<=90?2:3]+=r}});
return '<div class="sub" style="margin-top:12px">Overdue ageing</div><div class="row" style="gap:6px">'+k.map(function(v,i){return '<div class="cust" style="margin:4px 0 0;padding:8px;cursor:default;text-align:center"><div class="sub">'+L[i]+'</div><b style="color:'+(i>1&&v>0?'var(--due)':'var(--ink)')+'">'+inr(v)+'</b></div>'}).join("")+'</div>'}
function ask(m,fn){cb=fn;openM('<h2>Please confirm</h2><div class="sub">'+esc(m)+'</div><div class="row" style="margin-top:14px"><button class="ghost" onclick="close()">Cancel</button><button onclick="close();cb()">Yes, continue</button></div>')}
function entryForm(t,i){var c=find(view),s=t=="sale",x=i!=null?c.e[i]:null;
openM('<h2>'+(x?'Edit ':'Add ')+(s?'credit sale':'payment')+'</h2><div class="sub">'+esc(c.name)+' \u00b7 Due '+inr(due(c))+'</div><label>Date<input id="f1" type="date" value="'+(x?x.d:today())+'"></label><label>'+(s?'Fuel / item and quantity<input id="f2" value="'+esc(x?x.n:"")+'" placeholder="e.g. HSD 200 L">':'Mode<select id="f2"><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Cheque</option></select>')+'</label><label>Amount (\u20b9)<input id="f3" inputmode="decimal" value="'+(x?x.a:"")+'"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveEntry(\''+t+'\','+(i==null?'null':i)+')">Save</button></div>');
if(x&&!s)document.getElementById("f2").value=x.n}
function saveEntry(t,i){var c=find(view),a=parseFloat(v("f3")),old=i!=null?c.e[i]:null,cur=due(c)-(old?(old.t=="sale"?old.a:-old.a):0);
if(!(a>0))return er("Enter an amount above zero.");if(!v("f2"))return er("Enter the item and quantity.");
var o={d:v("f1"),t:t,n:v("f2"),a:a};
function go(){if(old)c.e[i]=o;else c.e.push(o);save();close();render()}
if(t=="sale"&&cur+a>c.limit)return ask("This sale takes "+c.name+" over the credit limit by "+inr(cur+a-c.limit)+". Save anyway?",go);
if(t=="pay"&&a>cur)return ask("Payment is more than the amount due. Save anyway?",go);go()}
function delEntry(i){var c=find(view),x=c.e[i];ask("Delete the "+(x.t=="sale"?"sale":"payment")+" of "+inr(x.a)+" ("+x.n+")?",function(){if(x.srv){api("DELETE","/api/credit-sales/"+x.srv).then(function(){pullDuty(render)}).catch(function(e){badge(e.error||"Could not delete.")});return}c.e.splice(i,1);save();render()})}
function stmt(){var c=find(view),t="Statement for "+c.name+(from||to?" ("+(from||"start")+" to "+(to||"today")+")":"")+"\n";
rows(c).forEach(function(o){if(!o.skip)t+=o.x.d+" "+(o.x.t=="sale"?"Sale ":"Paid ")+o.x.n+" "+(o.x.t=="sale"?"+":"-")+Math.round(o.x.a)+" | Bal "+Math.round(o.bal)+"\n"});
t+="Total outstanding: "+inr(due(c));window.open("https://wa.me/91"+c.phone.slice(-10)+"?text="+encodeURIComponent(t),"_blank")}
function remind(){var c=find(view),d=due(c);
if(d<=0)return openM('<h2>No dues</h2><div class="sub">'+esc(c.name)+' has nothing outstanding.</div><div class="btns"><button onclick="close()">Close</button></div>');
var m="Dear "+c.name+", your outstanding credit balance at our petrol pump is "+inr(d)+". Please clear it at your earliest convenience. Thank you.";
openM('<h2>Reminder message</h2><label>Message<input id="f1" value="'+esc(m)+'"></label><div class="row" style="margin-top:14px"><button class="ghost" onclick="close()">Cancel</button><button onclick="window.open(\'https://wa.me/91'+c.phone.slice(-10)+'?text=\'+encodeURIComponent(v(\'f1\')),\'_blank\')">Open WhatsApp</button></div>')}
function r2(n){return Math.round(n*100)/100}
function m2(n){return "\u20b9"+n.toFixed(2)}
function tax(ls,ig){var g={},t=0;ls.forEach(function(l){var rt=l.g==null?18:l.g,a=l.q*l.r;t+=a;var o=g[rt]||(g[rt]={rate:rt,t:0});o.t+=a});var tx=Object.keys(g).map(function(k){var o=g[k];return{rate:o.rate,t:r2(o.t),x:r2(o.t*o.rate/100)}}).sort(function(a,b){return a.rate-b.rate});t=r2(t);var x=r2(tx.reduce(function(s,z){return s+z.x},0)),tot=Math.round(t+x);return{t:t,x:x,tot:tot,ro:r2(tot-t-x),ig:ig,tx:tx}}
function igstFor(g){return !!(S.biz.gst&&g&&S.biz.gst.slice(0,2)!=g.slice(0,2))}
function curG(){return dr.cust!="0"?find(dr.cust).gst:dr.wgst}
function nav(){
  renderSidebar();
  var bizName = (ME && ME.pump_name) ? ME.pump_name : ((S && S.biz && S.biz.name) ? S.biz.name : "Petrol Pump");
  var T=[["ledger","Ledger"],["inv","Invoices"],["stock","Stock"],["sup","Suppliers"],["book","Book"],["rep","Reports"],["bak","Backup"]];
  if(SRV)T.splice(1,0,["duty","Duty"],["cashflow","Cash Flow Register"],["tanks","Tanks"]);
  if(SRV&&ME&&ME.role=="owner")T.push(["pay","Salary"],["setup","Pump setup"]);
  if(SRV&&ME&&(ME.role=="owner"||ME.role=="manager"))T.push(["team","Team"]);

  var mobileTop = '<div class="mobile-top-bar noprint">' +
    '<button type="button" class="mobile-menu-btn" onclick="toggleSidebar(true)" aria-label="Open menu">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>' +
    '</button>' +
    '<div class="mobile-bar-title">' + esc(bizName) + '</div>' +
    (ME ? '<div class="mobile-user-tag">' + esc(ME.role) + '</div>' : '') +
  '</div>';

  var topStrip = '<div class="top-tab-strip noprint">' +
    T.map(function(t){
      return '<button type="button" class="top-strip-tab' + (tab==t[0]?' active':'') + '" onclick="tab=\''+t[0]+'\';view=null;iv=null;dr=null;sv=null;render()">' + t[1] + '</button>';
    }).join("") +
  '</div>';

  var desktopGrid = '<div class="top-nav-grid noprint" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">' +
    T.map(function(t){
      return '<button style="padding:10px 0;font-size:13px;min-width:0" class="'+(tab==t[0]?'':'ghost')+'" onclick="tab=\''+t[0]+'\';view=null;iv=null;dr=null;sv=null;render()">'+t[1]+'</button>';
    }).join("") +
  '</div>';

  return ubar() + mobileTop + topStrip + desktopGrid;
}
function renderInv(){var h=nav();
if(dr)h+=draftHtml();else if(iv)h+=invHtml(iv);else{
h+='<h1>GST invoices for lubricants and shop items</h1><div class="btns"><button onclick="newInv()">New invoice</button><button class="ghost" onclick="bizForm()">Business details</button></div>';
if(!S.inv.length)h+='<div class="empty">No invoices yet. Create one for a lubricant or shop sale.</div>';
S.inv.slice().reverse().forEach(function(i){h+='<div class="cust" tabindex="0" onclick="iv='+i.id+';renderInv()"><div class="row"><b>'+esc(i.no)+'</b><span class="amt" style="flex:none">'+m2(i.total)+'</span></div><div class="sub">'+esc(i.name)+' \u00b7 '+i.d+' \u00b7 '+(i.mode=="credit"?"On credit":esc(i.mode))+'</div></div>'})}
document.getElementById("app").innerHTML=h}
function newInv(){if(!S.biz.name||S.biz.gst.length!=15){bizForm(true);return}dr={cust:"0",wname:"",wgst:"",lines:[{n:"",q:1,r:"",g:18}],mode:"Cash"};renderInv()}
function bizForm(go){var b=S.biz;openM('<h2>Business details</h2><div class="sub">Shown on every invoice</div><label>Pump name<input id="f1" value="'+esc(b.name)+'"></label><label>Address<input id="f2" value="'+esc(b.addr)+'"></label><label>GSTIN (15 characters)<input id="f3" value="'+esc(b.gst)+'"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveBiz('+(go?1:0)+')">Save details</button></div>')}
function saveBiz(go){var g=v("f3").toUpperCase();if(!v("f1"))return er("Enter the pump name.");if(g.length!=15)return er("GSTIN must be 15 characters.");S.biz={name:v("f1"),addr:v("f2"),gst:g};save();close();if(go)newInv();else renderInv()}
function draftHtml(){var h='<h1>New invoice</h1><label>Customer<select onchange="dr.cust=this.value;dr.mode=\'Cash\';renderInv()"><option value="0">Walk-in customer</option>'+S.c.filter(function(c){return c.active!==false}).map(function(c){return '<option value="'+c.id+'"'+(dr.cust==c.id?' selected':'')+'>'+esc(c.name)+'</option>'}).join("")+'</select></label>';
if(dr.cust=="0")h+='<label>Name (optional)<input value="'+esc(dr.wname)+'" oninput="dr.wname=this.value"></label><label>Customer GSTIN (optional)<input value="'+esc(dr.wgst)+'" oninput="dr.wgst=this.value.toUpperCase();upd()"></label>';
h+='<label style="margin-top:16px">Items (rate excludes GST)</label>';
dr.lines.forEach(function(l,i){h+='<div class="cust" style="cursor:default"><select onchange="pick('+i+',this.value)"><option value="">Other item (not in stock)</option>'+S.items.map(function(t){return '<option value="'+t.id+'"'+(l.it==t.id?' selected':'')+'>'+esc(t.name)+' ('+t.stock+' '+esc(t.unit)+' in stock)</option>'}).join("")+'</select><input style="margin-top:8px" placeholder="Item, e.g. Engine oil 1 L" value="'+esc(l.n)+'" oninput="dr.lines['+i+'].n=this.value"><div class="row"><label>Qty<input inputmode="decimal" value="'+(l.q||"")+'" oninput="dr.lines['+i+'].q=parseFloat(this.value)||0;upd()"></label><label>Rate (\u20b9)<input inputmode="decimal" value="'+(l.r||"")+'" oninput="dr.lines['+i+'].r=parseFloat(this.value)||0;upd()"></label>'+'</div><div class="row"><label>GST %<select onchange="dr.lines['+i+'].g=+this.value;upd()">'+[0,5,12,18,28].map(function(g){return '<option'+((l.g==null?18:l.g)==g?' selected':'')+'>'+g+'</option>'}).join("")+'</select></label><label>HSN (optional)<input value="'+esc(l.hsn||"")+'" oninput="dr.lines['+i+'].hsn=this.value"></label>'+(dr.lines.length>1?'<button class="ghost" onclick="dr.lines.splice('+i+',1);renderInv()">Remove</button>':'')+'</div></div>'});
h+='<button class="ghost" onclick="dr.lines.push({n:\'\',q:1,r:\'\',g:18});renderInv()">Add item</button><label>Payment<select onchange="dr.mode=this.value"><option'+(dr.mode=="Cash"?" selected":"")+'>Cash</option><option'+(dr.mode=="UPI"?" selected":"")+'>UPI</option>'+(dr.cust!="0"?'<option value="credit"'+(dr.mode=="credit"?" selected":"")+'>On credit (adds to ledger)</option>':'')+'</select></label><div class="cust" id="tot" style="cursor:default"></div><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="dr=null;renderInv()">Cancel</button><button onclick="saveInv()">Save invoice</button></div>';
setTimeout(upd,0);return h}
function upd(){var e=document.getElementById("tot");if(!e||!dr)return;var k=tax(dr.lines,igstFor(curG())),R=function(a,b){return '<div class="row"><span>'+a+'</span><span style="text-align:right">'+b+'</span></div>'};
e.innerHTML=R("Taxable",m2(k.t))+k.tx.map(function(z){return k.ig?R("IGST "+z.rate+"%",m2(z.x)):R("CGST "+z.rate/2+"%",m2(r2(z.x/2)))+R("SGST "+z.rate/2+"%",m2(r2(z.x/2)))}).join("")+'<div class="amt">'+R("Total",m2(k.tot))+'</div>'}
function saveInv(){var ls=dr.lines.filter(function(l){return l.n.trim()});
if(!ls.length)return er("Add at least one item with a name.");
if(ls.some(function(l){return !(l.q>0&&l.r>0)}))return er("Enter a quantity and rate above zero for every item.");
var need={};ls.forEach(function(l){if(l.it)need[l.it]=(need[l.it]||0)+l.q});
for(var k0 in need){var t0=itm(k0);if(need[k0]>t0.stock)return er("Only "+t0.stock+" "+t0.unit+" of "+t0.name+" in stock.")}
var c=dr.cust!="0"?find(dr.cust):null,g=curG(),k=tax(ls,igstFor(g)),no="INV-"+("000"+(S.inv.length+1)).slice(-4);
var rec={id:Date.now(),no:no,d:today(),name:c?c.name:(dr.wname||"Walk-in customer"),gst:g||"",phone:c?c.phone:"",lines:ls,tx:k.tx,ig:k.ig,t:k.t,x:k.x,ro:k.ro,total:k.tot,mode:dr.mode};
for(var k1 in need){var t1=itm(k1);t1.stock=Math.round((t1.stock-need[k1])*1000)/1000}S.inv.push(rec);if(c&&dr.mode=="credit")c.e.push({d:rec.d,t:"sale",n:"Invoice "+no,a:rec.total});
save();dr=null;iv=rec.id;renderInv()}
function invHtml(id){var i=S.inv.filter(function(x){return x.id==id})[0],b=S.biz,T=function(a,c,bold){return '<tr><td colspan="5" class="r">'+(bold?'<b>'+a+'</b>':a)+'</td><td class="r">'+(bold?'<b>'+c+'</b>':c)+'</td></tr>'};
var h='<div class="btns noprint"><button class="ghost" onclick="iv=null;renderInv()">Back</button><button onclick="window.print()">Print invoice</button>'+(i.phone?'<button class="ghost" onclick="shareInv('+i.id+')">Share on WhatsApp</button>':'')+'</div><div class="tbl" style="padding:14px"><b style="font-size:18px">'+esc(b.name)+'</b><div class="sub">'+esc(b.addr)+'</div><div class="sub">GSTIN '+esc(b.gst)+'</div><h2 style="margin:14px 0 2px">Tax invoice '+esc(i.no)+'</h2><div class="sub">Date '+i.d+'</div><div style="margin:10px 0"><b>Bill to:</b> '+esc(i.name)+(i.gst?'<div class="sub">GSTIN '+esc(i.gst)+'</div>':'')+'</div><table><tr><th>Item</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST</th><th class="r">Amount</th></tr>';
i.lines.forEach(function(l){h+='<tr><td>'+esc(l.n)+'</td><td>'+esc(l.hsn||"")+'</td><td class="r">'+l.q+'</td><td class="r">'+m2(l.r)+'</td><td class="r">'+(l.g==null?18:l.g)+'%</td><td class="r">'+m2(l.q*l.r)+'</td></tr>'});
var tx=i.tx||[{rate:18,t:i.t,x:i.x}];
h+=T("Taxable value",m2(i.t))+tx.map(function(z){return i.ig?T("IGST "+z.rate+"% on "+m2(z.t),m2(z.x)):T("CGST "+z.rate/2+"% on "+m2(z.t),m2(r2(z.x/2)))+T("SGST "+z.rate/2+"% on "+m2(z.t),m2(r2(z.x/2)))}).join("")+T("Round off",m2(i.ro))+T("Total",m2(i.total),1)+'</table><div class="sub" style="margin-top:10px">Payment: '+(i.mode=="credit"?"On credit":esc(i.mode))+'</div></div>';return h}
function shareInv(id){var i=S.inv.filter(function(x){return x.id==id})[0],t=S.biz.name+"\nTax invoice "+i.no+" ("+i.d+")\n";i.lines.forEach(function(l){t+=l.n+" x "+l.q+" = "+m2(l.q*l.r)+"\n"});t+=(i.ig?"IGST: ":"CGST + SGST: ")+m2(i.x)+"\nTotal: "+m2(i.total);window.open("https://wa.me/91"+i.phone.slice(-10)+"?text="+encodeURIComponent(t),"_blank")}
function itm(id){return S.items.filter(function(x){return x.id==id})[0]}
function pick(i,id){var l=dr.lines[i];if(id){var t=itm(id);l.it=t.id;l.n=t.name;l.r=t.sell;l.g=t.gst==null?18:t.gst;l.hsn=t.hsn||""}else l.it=null;renderInv()}
var SCAT="*";
function itemCats(){var c=S.itemcats.slice();S.items.forEach(function(i){if(i.cat&&c.indexOf(i.cat)<0)c.push(i.cat)});return c}
function renderStock(){var low=S.items.filter(function(i){return i.stock<=i.low}),val=S.items.reduce(function(s,i){return s+i.stock*i.buy},0),cs=itemCats(),h=nav()+'<h1>Stock value at purchase price</h1><div class="total" style="color:var(--ink)">'+inr(val)+'</div>'+(low.length?'<div class="sub" style="color:var(--due);margin-bottom:8px">'+low.length+' item'+(low.length>1?'s are':' is')+' at or below the low-stock level</div>':'')+'<div class="btns"><button onclick="itemForm()">Add item</button><button class="ghost" onclick="catForm()">Categories</button><button class="ghost" onclick="renderImport()">Import from Excel</button></div>';
if(cs.length)h+='<label>Show<select onchange="SCAT=this.value;renderStock()"><option value="*">All products</option>'+cs.map(function(c){return '<option'+(SCAT==c?' selected':'')+'>'+esc(c)+'</option>'}).join("")+'<option value=""'+(SCAT===""?' selected':'')+'>No category</option></select></label>';
if(!S.items.length)h+='<div class="empty">No stock items yet. Add your first lubricant or shop item, or import a list from Excel.</div>';
var L=S.items.filter(function(i){return SCAT=="*"||(i.cat||"")==SCAT});
(SCAT=="*"?cs.concat([""]):[SCAT]).forEach(function(c){var g=L.filter(function(i){return(i.cat||"")==c});if(!g.length)return;if(cs.length)h+=sect(esc(c||"No category"));
g.forEach(function(i){var lw=i.stock<=i.low;h+='<div class="cust" style="cursor:default"><div class="row"><b>'+esc(i.name)+'</b><span class="amt" style="flex:none;color:'+(lw?'var(--due)':'var(--ok)')+'">'+i.stock+' '+esc(i.unit)+'</span></div><div class="sub">Sell '+m2(i.sell)+' \u00b7 Buy '+m2(i.buy)+' \u00b7 GST '+(i.gst==null?18:i.gst)+'%'+(i.hsn?' \u00b7 HSN '+esc(i.hsn):'')+' \u00b7 Alert at '+i.low+(lw?' \u00b7 Low stock':'')+'</div><div class="btns" style="margin:10px 0 0"><button class="ghost" onclick="addStock('+i.id+')">Add stock</button><button class="ghost" onclick="itemForm('+i.id+')">Edit item</button></div></div>'})});
document.getElementById("app").innerHTML=h}
function catForm(){openM('<h2>Product categories</h2><div class="sub">Group your stock, for example Engine oil, Coolant, Grease, Shop.</div>'+(itemCats().length?itemCats().map(function(c,i){return '<div class="row" style="margin-top:8px"><span>'+esc(c)+'</span><button class="ghost" style="flex:none;padding:5px 8px" onclick="catRemove('+i+')">Remove</button></div>'}).join(""):'<div class="empty">No categories yet.</div>')+'<label>New category<input id="ck1"></label><div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="ghost" onclick="close();renderStock()">Close</button><button onclick="catAdd2()">Add category</button></div>')}
function catAdd2(){var c=v("ck1");if(!c)return er("Enter a category name.");if(itemCats().some(function(x){return x.toLowerCase()==c.toLowerCase()}))return er("That category already exists.");S.itemcats.push(c);save();catForm()}
function catRemove(i){var c=itemCats()[i];S.itemcats=S.itemcats.filter(function(x){return x!=c});S.items.forEach(function(it){if(it.cat==c)it.cat=""});save();catForm()}
function itemForm(id){var i=id?itm(id):{name:"",unit:"piece",sell:"",buy:"",stock:"",low:"",cat:"",gst:18,hsn:""},U=["piece","litre","pack","kg"],G=[0,5,12,18,28];
openM('<h2>'+(id?'Edit item':'Add stock item')+'</h2><label>Item name<input id="f1" value="'+esc(i.name)+'"></label><label>Category<select id="f7"><option value="">No category</option>'+itemCats().map(function(c){return '<option'+(i.cat==c?' selected':'')+'>'+esc(c)+'</option>'}).join("")+'</select></label><label>Or a new category<input id="f7n"></label><label>Unit<select id="f2">'+U.map(function(u){return '<option'+(u==i.unit?' selected':'')+'>'+u+'</option>'}).join("")+'</select></label><label>Selling price (\u20b9, without GST)<input id="f3" inputmode="decimal" value="'+i.sell+'"></label><label>GST rate (%)<select id="f8">'+G.map(function(g){return '<option'+((i.gst==null?18:i.gst)==g?' selected':'')+'>'+g+'</option>'}).join("")+'</select></label><label>HSN code (optional)<input id="f9" value="'+esc(i.hsn||"")+'"></label><label>Purchase price (\u20b9)<input id="f4" inputmode="decimal" value="'+i.buy+'"></label><label>'+(id?'Current stock':'Opening stock')+'<input id="f5" inputmode="decimal" value="'+i.stock+'"></label><label>Low-stock alert level<input id="f6" inputmode="decimal" value="'+i.low+'"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveItem('+(id||0)+')">Save item</button></div>')}
function saveItem(id){var o={name:v("f1"),cat:v("f7n")||v("f7"),unit:v("f2"),sell:parseFloat(v("f3")),gst:parseFloat(v("f8")),hsn:v("f9"),buy:parseFloat(v("f4")),stock:parseFloat(v("f5")),low:parseFloat(v("f6"))};
if(!o.name)return er("Enter the item name.");if(!(o.sell>0))return er("Enter a selling price above zero.");if(!(o.buy>=0))return er("Enter the purchase price.");if(!(o.stock>=0))return er("Enter the stock quantity (0 or more).");if(!(o.low>=0))return er("Enter the low-stock level (0 or more).");
if(o.cat&&itemCats().indexOf(o.cat)<0)S.itemcats.push(o.cat);
if(id)Object.assign(itm(id),o);else{o.id=Date.now();S.items.push(o)}save();close();renderStock()}
function addStock(id){var i=itm(id);openM('<h2>Add stock</h2><div class="sub">'+esc(i.name)+' \u00b7 Now '+i.stock+' '+esc(i.unit)+'</div><label>Quantity received<input id="f1" inputmode="decimal"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveAdd('+id+')">Add to stock</button></div>')}
function saveAdd(id){var q=parseFloat(v("f1")),i=itm(id);if(!(q>0))return er("Enter a quantity above zero.");i.stock=Math.round((i.stock+q)*1000)/1000;save();close();renderStock()}
function dago(n){return new Date(Date.now()-n*864e5).toISOString().slice(0,10)}
function sbal(s){return s.e.reduce(function(a,x){return a+(x.t=="pay"?x.a:-x.a)},0)}
function sfind(id){return S.sup.filter(function(x){return x.id==id})[0]}
function renderSup(){var h=nav();
if(!sv){var adv=0,owe=0;S.sup.forEach(function(s){var b=sbal(s);if(b>=0)adv+=b;else owe-=b});
h+='<h1>Advance paid to suppliers</h1><div class="total" style="color:var(--ok)">'+inr(adv)+'</div><div class="sub" style="margin-bottom:10px">Payable to suppliers: <b style="color:var(--due)">'+inr(owe)+'</b></div><button onclick="supForm()">Add supplier</button>';
if(!S.sup.length)h+='<div class="empty">No suppliers yet. Add the oil company or a dealer.</div>';
S.sup.forEach(function(s){var b=sbal(s);h+='<div class="cust" tabindex="0" onclick="sv='+s.id+';renderSup()"><div class="row"><b>'+esc(s.name)+'</b><span class="amt" style="flex:none;color:'+(b>=0?'var(--ok)':'var(--due)')+'">'+inr(Math.abs(b))+'</span></div><div class="sub">'+esc(s.kind)+' \u00b7 '+(b>=0?'Advance balance':'Amount payable')+'</div></div>'})}
else{var s=sfind(sv),b=sbal(s),bal=0;
h+='<button class="ghost noprint" onclick="sv=null;renderSup()">Back to suppliers</button><h1 style="margin-top:14px">'+esc(s.name)+' \u00b7 '+esc(s.kind)+'</h1><div class="total" style="color:'+(b>=0?'var(--ok)':'var(--due)')+'">'+inr(Math.abs(b))+'</div><div class="sub">'+(b>=0?'Advance balance with this supplier':'Amount payable to this supplier')+'</div><div class="btns"><button onclick="supEntry(\'pay\')">Record payment</button><button onclick="supEntry(\'bill\')">Add purchase bill</button><button class="ghost" onclick="supForm('+s.id+')">Edit supplier</button></div><div class="tbl"><table><tr><th>Date</th><th>Detail</th><th class="r">Amount</th><th class="r">Balance</th><th></th></tr>';
s.e.map(function(x,i){return{x:x,i:i}}).sort(function(p,q){return p.x.d<q.x.d?-1:1}).forEach(function(o){var x=o.x,u=x.it?itm(x.it):null;bal+=x.t=="pay"?x.a:-x.a;
h+='<tr><td>'+x.d.slice(5)+'</td><td>'+(x.t=="pay"?"Paid: ":"Bill: ")+esc(x.n)+(u?' <span class="sub">('+x.q+' '+esc(u.unit)+' of '+esc(u.name)+' added to stock)</span>':'')+'</td><td class="r '+(x.t=="pay"?"pay":"sale")+'">'+(x.t=="pay"?"+":"\u2212")+inr(x.a)+'</td><td class="r">'+inr(Math.abs(bal))+(bal>=0?' adv':' due')+'</td><td><button class="ghost" style="padding:5px 8px" onclick="delSup('+o.i+')">Delete</button></td></tr>'});
if(!s.e.length)h+='<tr><td colspan="5" class="empty">No entries yet. Record a payment or add a purchase bill.</td></tr>';
h+='</table></div>'}
document.getElementById("app").innerHTML=h}
function supForm(id){var c=id?sfind(id):{name:"",kind:"Oil company",phone:""};
openM('<h2>'+(id?'Edit supplier':'Add supplier')+'</h2><label>Name<input id="f1" value="'+esc(c.name)+'"></label><label>Type<select id="f2"><option'+(c.kind=="Oil company"?" selected":"")+'>Oil company</option><option'+(c.kind=="Dealer"?" selected":"")+'>Dealer</option></select></label><label>Phone (optional)<input id="f3" inputmode="tel" value="'+esc(c.phone)+'"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveSup('+(id||0)+')">Save supplier</button></div>')}
function saveSup(id){if(!v("f1"))return er("Enter the supplier name.");var o={name:v("f1"),kind:v("f2"),phone:v("f3")};if(id)Object.assign(sfind(id),o);else{o.id=Date.now();o.e=[];S.sup.push(o)}save();close();renderSup()}
function supEntry(t){var s=sfind(sv),b=t=="bill";
openM('<h2>'+(b?'Add purchase bill':'Record payment')+'</h2><div class="sub">'+esc(s.name)+'</div><label>Date<input id="f1" type="date" value="'+today()+'"></label><label>'+(b?'Bill details<input id="f2" placeholder="e.g. HSD tanker, bill no. 1042">':'Mode<select id="f2"><option>Bank transfer</option><option>Cash</option><option>UPI</option><option>Cheque</option></select>')+'</label><label>Amount (\u20b9)<input id="f3" inputmode="decimal"></label>'+(b?'<label>Add to stock (optional)<select id="f4"><option value="">Not a stock item</option>'+S.items.map(function(i){return '<option value="'+i.id+'">'+esc(i.name)+'</option>'}).join("")+'</select></label><label>Quantity received<input id="f5" inputmode="decimal"></label>':'')+'<div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveSE(\''+t+'\')">Save</button></div>')}
function saveSE(t){var s=sfind(sv),a=parseFloat(v("f3")),o={d:v("f1"),t:t,n:v("f2"),a:a};
if(!(a>0))return er("Enter an amount above zero.");if(!o.n)return er("Enter the bill details.");
if(t=="bill"&&v("f4")){var q=parseFloat(v("f5"));if(!(q>0))return er("Enter the quantity received.");var i=itm(v("f4"));i.stock=Math.round((i.stock+q)*1000)/1000;o.it=i.id;o.q=q}
s.e.push(o);save();close();renderSup()}
function delSup(i){var s=sfind(sv),x=s.e[i];ask("Delete this "+(x.t=="pay"?"payment":"bill")+" of "+inr(x.a)+"?"+(x.it?" The stock it added will be removed too.":""),function(){if(x.it){var u=itm(x.it);if(u)u.stock=Math.max(0,Math.round((u.stock-x.q)*1000)/1000)}s.e.splice(i,1);save();renderSup()})}
var ACC=["Cash","Bank","UPI"],ACN={Cash:"Cash",Bank:"Bank",UPI:"UPI / wallet"};
function accOf(m){return m=="Cash"?"Cash":m=="UPI"?"UPI":"Bank"}
function bkRows(){var r=[],mn=mname();(DM||[]).forEach(function(x){var by={},nm={};Object.keys(x.pay).forEach(function(k){var a=accOfMode(k),amt=+x.pay[k]||0;if(amt<=0)return;by[a]=(by[a]||0)+amt;(nm[a]=nm[a]||[]).push(mn[k]||k)});Object.keys(by).forEach(function(a){r.push({d:x.d,a:a,m:by[a],n:"Duty collections "+x.d+" ("+nm[a].join(", ")+")"})})});
S.c.forEach(function(c){c.e.forEach(function(x){if(x.t=="pay")r.push({d:x.d,a:accOf(x.n),m:x.a,n:"Received from "+c.name})})});
S.inv.forEach(function(i){if(i.mode!="credit")r.push({d:i.d,a:accOf(i.mode),m:i.total,n:"Invoice "+i.no+" ("+i.name+")"})});
S.sup.forEach(function(s){s.e.forEach(function(x){if(x.t=="pay")r.push({d:x.d,a:accOf(x.n),m:-x.a,n:"Paid to "+s.name})})});
S.bk.forEach(function(b){if(b.t=="xfer"){r.push({d:b.d,a:b.acct,m:-b.a,n:b.dep?"Bank deposit"+(b.slip?" (slip "+b.slip+")":"")+(b.by?" by "+b.by:""):"Transfer to "+ACN[b.to],id:b.id});r.push({d:b.d,a:b.to,m:b.a,n:b.dep?"Bank deposit received":"Transfer from "+ACN[b.acct],id:b.id})}else r.push({d:b.d,a:b.acct,m:b.t=="in"?b.a:-b.a,n:(b.cat?b.cat+": ":"")+b.n,id:b.id})});
return r.sort(function(p,q){return p.d<q.d?1:-1})}
function renderBook0(){var R=bkRows(),h=nav(),tot=0,B={};
ACC.forEach(function(a){B[a]=(S.ob[a]||0)+R.filter(function(x){return x.a==a}).reduce(function(s,x){return s+x.m},0);tot+=B[a]});
h+='<div style="display:flex;gap:8px;margin-bottom:14px;background:var(--card);padding:12px 14px;border-radius:10px;border:1px solid var(--line);align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b style="color:var(--ink);font-size:14px">6 AM Shift Cash Flow Engine</b><div class="sub" style="margin-top:2px">Track 6 AM opening cash, morning/evening/night shifts, bank deposits &amp; next day rollover</div></div><button onclick="tab=\'cashflow\';render()">Open 6 AM Cash Flow &rarr;</button></div>';
h+='<h1>Money in hand, all accounts</h1><div class="total" style="color:var(--ink)">'+inr(tot)+'</div><div class="row" style="gap:6px">'+ACC.map(function(a){return '<div class="cust" style="margin:0;padding:8px;cursor:default;text-align:center"><div class="sub">'+ACN[a]+'</div><b style="color:'+(B[a]<0?'var(--due)':'var(--ink)')+'">'+inr(B[a])+'</b></div>'}).join("")+'</div>'+depHtml()+'<div class="btns"><button onclick="bkForm(\'out\')">Add expense</button><button onclick="bkForm(\'in\')">Add income</button><button class="ghost" onclick="depForm()">Bank deposit</button><button class="ghost" onclick="bkForm(\'xfer\')">Transfer</button><button class="ghost" onclick="obForm()">Opening balances</button></div><div class="row" style="gap:6px;margin-bottom:10px">'+["all"].concat(ACC).map(function(a){return '<button style="padding:8px 4px;font-size:14px" class="'+(bf==a?'':'ghost')+'" onclick="bf=\''+a+'\';renderBook()">'+(a=="all"?"All":ACN[a])+'</button>'}).join("")+'</div><div class="tbl"><table><tr><th>Date</th><th>Detail</th><th>Account</th><th class="r">Amount</th><th></th></tr>';
var L=R.filter(function(x){return bf=="all"||x.a==bf});
L.forEach(function(x){h+='<tr><td>'+x.d.slice(5)+'</td><td>'+esc(x.n)+'</td><td>'+ACN[x.a]+'</td><td class="r '+(x.m>=0?'pay':'sale')+'">'+(x.m>=0?'+':'\u2212')+inr(Math.abs(x.m))+'</td><td>'+(x.id?'<button class="ghost" style="padding:5px 8px" onclick="delBk('+x.id+')">Delete</button>':'')+'</td></tr>'});
if(!L.length)h+='<tr><td colspan="5" class="empty">No money movements yet.</td></tr>';
h+='</table></div><div class="sub" style="margin-top:8px">Customer payments, cash and UPI invoices, supplier payments, and duty collections (once the manager closes the day) appear here automatically. Money a worker spent from the till is already deducted from what they hand in. Add expenses, income, transfers and bank deposits yourself.</div>';
document.getElementById("app").innerHTML=h}
function accSel(id,sel){return '<select id="'+id+'">'+ACC.map(function(a){return '<option value="'+a+'"'+(a==sel?' selected':'')+'>'+ACN[a]+'</option>'}).join("")+'</select>'}
function bkForm(t){var x=t=="xfer";openM('<h2>'+(t=="out"?'Add expense':t=="in"?'Add income':'Transfer between accounts')+'</h2><label>Date<input id="f1" type="date" value="'+today()+'"></label><label>'+(x?'From':'Account')+accSel("f2","Cash")+'</label>'+(x?'<label>To'+accSel("f3","Bank")+'</label>':(t=="out"?CATSEL:'')+'<label>Details<input id="f4" placeholder="'+(t=="out"?"e.g. Electricity bill":"e.g. Other income")+'"></label>')+'<label>Amount (\u20b9)<input id="f5" inputmode="decimal"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveBk(\''+t+'\')">Save</button></div>')}
function saveBk(t){var a=parseFloat(v("f5")),o={id:Date.now(),d:v("f1"),t:t,acct:v("f2"),a:a};
if(!(a>0))return er("Enter an amount above zero.");
if(t=="xfer"){o.to=v("f3");if(o.to==o.acct)return er("Choose two different accounts.")}else{o.n=v("f4");if(!o.n)return er("Enter the details.")}
if(t=="out")o.cat=v("f6");S.bk.push(o);save();close();renderBook()}
function delBk(id){ask("Delete this entry?",function(){S.bk=S.bk.filter(function(b){return b.id!=id});save();renderBook()})}
function obForm(){openM('<h2>Opening balances</h2><div class="sub">What each account held before you started using this book</div>'+ACC.map(function(a,i){return '<label>'+ACN[a]+' (\u20b9)<input id="o'+i+'" inputmode="decimal" value="'+(S.ob[a]||0)+'"></label>'}).join("")+'<div class="err" id="er"></div><div class="row" style="margin-top:14px"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveOb()">Save balances</button></div>')}
function saveOb(){var o={};for(var i=0;i<3;i++){var n=parseFloat(v("o"+i));if(isNaN(n))return er("Enter a number for every account (0 if empty).");o[ACC[i]]=n}S.ob=o;save();close();renderBook()}
var CAT=["Salary","Electricity","Rent","Repairs","Transport","Other"],CATSEL='<label>Category<select id="f6">'+CAT.map(function(c){return '<option>'+c+'</option>'}).join("")+'</select></label>';
function inR(d){return d>=rf&&d<=rt}
function rtab(title,head,rows){var h='<h1 style="margin:20px 0 6px;color:var(--ink);font-size:17px;font-weight:800">'+title+'</h1><div class="tbl"><table><tr>'+head.map(function(c,i){return '<th'+(i?' class="r"':'')+'>'+c+'</th>'}).join("")+'</tr>';
rows.forEach(function(r){h+='<tr>'+r.map(function(c,i){return '<td'+(i?' class="r"':'')+'>'+c+'</td>'}).join("")+'</tr>'});return h+'</table></div>'}
function renderRep0(){var h=nav(),sales=0,cg=0,ig=0,n=0;
S.inv.forEach(function(i){if(!inR(i.d))return;n++;sales+=i.t;if(i.ig)ig+=i.x;else cg+=i.x/2});
var buy={"Oil company":0,"Dealer":0};S.sup.forEach(function(s){s.e.forEach(function(x){if(x.t=="bill"&&inR(x.d))buy[s.kind]=(buy[s.kind]||0)+x.a})});
var ex={},exT=0,inc=0;S.bk.forEach(function(b){if(!inR(b.d))return;if(b.t=="out"){var k=b.cat||"Other";ex[k]=(ex[k]||0)+b.a;exT+=b.a}else if(b.t=="in")inc+=b.a});
var fuelS=0,lubeS=0;(DM||[]).forEach(function(x){if(!inR(x.d))return;fuelS+=x.fuelTotal;lubeS+=x.lubeTotal;x.exp.forEach(function(e){ex[e.cat]=(ex[e.cat]||0)+e.amount;exT+=e.amount})});
var mg=SRV?marginData():null,net=sales+fuelS+lubeS+inc-buy["Oil company"]-buy.Dealer-exT;
h+='<div class="row noprint"><label>From<input type="date" value="'+rf+'" onchange="rf=this.value;renderRep()"></label><label>To<input type="date" value="'+rt+'" onchange="rt=this.value;renderRep()"></label></div><div class="btns noprint"><button class="ghost" onclick="window.print()">Print reports</button>'+xbtns()+'</div><div class="sub">Period: '+rf+' to '+rt+'. Customer outstanding and stock are as of today.</div>';
h+=rtab("Profit and loss",["Item","Amount"],[].concat(SRV?[["Fuel sales (closed days)",m2(fuelS)],["Lube and shop sales (closed days)",m2(lubeS)]]:[],[["Invoiced sales (before GST)",m2(sales)],["Other income",m2(inc)],["Purchases: oil company",m2(buy["Oil company"])],["Purchases: dealers",m2(buy.Dealer)],["Expenses",m2(exT)],["<b>Net</b>",'<b style="color:'+(net<0?'var(--due)':'var(--ok)')+'">'+m2(net)+'</b>']]))+(SRV?'<div class="sub" style="margin-top:6px">Fuel and lube sales and duty expenses come from closed business days. If you also invoice a lube sale that was entered in a duty, it is counted twice.</div>':'<div class="sub" style="margin-top:6px">Fuel sales are not recorded in this preview, so oil company purchases will make the net look lower than it really is.</div>')+(mg?marginHtml(mg,inc,exT):"");
var gr={};S.inv.forEach(function(i){if(!inR(i.d))return;(i.tx||[{rate:18,t:i.t,x:i.x}]).forEach(function(z){var o=gr[z.rate]||(gr[z.rate]={t:0,c:0,g:0});o.t+=z.t;if(i.ig)o.g+=z.x;else o.c+=z.x/2})});
var grk=Object.keys(gr).sort(function(a,b){return a-b});
h+=rtab("GST collected",["Item","Amount"],[["Invoices",n],["Taxable value",m2(sales)],["CGST",m2(cg)],["SGST",m2(cg)],["IGST",m2(ig)],["<b>Total tax</b>","<b>"+m2(cg*2+ig)+"</b>"]])+(grk.length?rtab("GST by rate",["Rate","Taxable","CGST","SGST","IGST"],grk.map(function(k){var o=gr[k];return[k+"%",m2(o.t),m2(o.c),m2(o.c),m2(o.g)]})):"");
var er2=Object.keys(ex).sort(function(a,b){return ex[b]-ex[a]}).map(function(k){return [esc(k),m2(ex[k])]});
h+=rtab("Expenses by category",["Category","Amount"],er2.length?er2.concat([["<b>Total</b>","<b>"+m2(exT)+"</b>"]]):[["No expenses in this period",""]]);
var cs=S.c.filter(function(c){return due(c)>0}).sort(function(a,b){return due(b)-due(a)}),ct=0;
var cr=cs.map(function(c){ct+=due(c);return [esc(c.name)+(due(c)>c.limit?' <span class="sale">(over limit)</span>':''),inr(due(c))]});
h+=rtab("Customer outstanding",["Customer","Due"],cr.length?cr.concat([["<b>Total</b>","<b>"+inr(ct)+"</b>"]]):[["No dues",""]]);
var cv=0,rv=0,sr=S.items.map(function(i){cv+=i.stock*i.buy;rv+=i.stock*i.sell;return [esc(i.name)+(i.stock<=i.low?' <span class="sale">(low)</span>':''),i.stock+" "+esc(i.unit),m2(i.stock*i.buy),m2(i.stock*i.sell)]});
h+='<h1 style="margin:20px 0 6px;color:var(--ink);font-size:17px;font-weight:800">Stock valuation</h1><div class="tbl"><table><tr><th>Item</th><th class="r">Stock</th><th class="r">At cost</th><th class="r">At selling price</th></tr>'+sr.map(function(r){return '<tr><td>'+r[0]+'</td><td class="r">'+r[1]+'</td><td class="r">'+r[2]+'</td><td class="r">'+r[3]+'</td></tr>'}).join("")+'<tr><td colspan="2"><b>Total</b></td><td class="r"><b>'+m2(cv)+'</b></td><td class="r"><b>'+m2(rv)+'</b></td></tr></table></div>';
XD=repDoc({gr:gr,fuelS:fuelS,lubeS:lubeS,mg:mg,sales:sales,inc:inc,buyOil:buy["Oil company"],buyDlr:buy.Dealer,exT:exT,net:net,n:n,cg:cg,ig:ig,ex:ex,cs:cs,ct:ct,cv:cv,rv:rv});document.getElementById("app").innerHTML=h}
var dl=null;try{if(window.claude&&claude.use)claude.use("downloads").then(function(d){dl=d}).catch(function(){})}catch(e){}
function renderBak0(){var n=function(a){return (a||[]).length},h=nav();
h+='<h1>Backup and restore</h1><div class="cust" style="cursor:default">'+(SRV?'<b>Your data is stored on your server.</b><div class="sub">Still download a backup file now and then and keep it safe.</div>':'<b>Your data lives only in this browser.</b><div class="sub">Clearing browser data or switching phones loses it. Back up regularly and keep the file safe.</div>')+'<div class="sub" style="margin-top:6px">Last backup: '+(S.lastBk?esc(S.lastBk):"never")+'</div></div>';
h+='<div class="tbl" style="margin-top:10px"><table>'+[["Credit customers",n(S.c)],["Invoices",n(S.inv)],["Stock items",n(S.items)],["Suppliers",n(S.sup)],["Book entries",n(S.bk)]].map(function(r){return '<tr><td>'+r[0]+'</td><td class="r">'+r[1]+'</td></tr>'}).join("")+'</table></div>';
h+='<div class="btns"><button onclick="doBackup()">Back up to file</button><button class="ghost" onclick="showBk()">Show backup text</button><button class="ghost" onclick="restForm()">Restore</button></div>'+(SRV?'':'<div class="cust" style="cursor:default"><b>Owner, manager and worker logins</b><div class="sub">These need the real backend. Until it is running, anyone who opens this page sees everything.</div></div>')+'';
document.getElementById("app").innerHTML=h}
function doBackup(){if(!dl)return showBk();
dl.save({filename:"petrol-pump-backup-"+today()+".json",data:JSON.stringify(strip(),null,1)}).then(function(){S.lastBk=new Date().toLocaleString("en-IN");save();renderBak()}).catch(function(e){if(e&&e.code=="declined")return;showBk()})}
function showBk(){openM('<h2>Backup text</h2><div class="sub">Copy all of this and keep it somewhere safe. Paste it into Restore to bring the data back.</div><textarea id="bt" readonly style="width:100%;height:180px;margin-top:8px;font:12px monospace;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);padding:8px"></textarea><div class="row" style="margin-top:12px"><button class="ghost" onclick="close()">Close</button><button onclick="var t=document.getElementById(\'bt\');t.select();document.execCommand(\'copy\')">Select and copy</button></div>');document.getElementById("bt").value=JSON.stringify(strip())}
function restForm(){openM('<h2>Restore from backup</h2><div class="sub">This replaces all data in this browser with the backup.</div><label>Backup file<input id="rf1" type="file" accept=".json,application/json"></label><label>Or paste backup text<textarea id="rt" style="width:100%;height:120px;font:12px monospace;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);padding:8px"></textarea></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="doRestore()">Restore data</button></div>');
document.getElementById("rf1").onchange=function(){var f=this.files[0];if(!f)return;var r=new FileReader();r.onload=function(){document.getElementById("rt").value=r.result};r.readAsText(f)}}
function doRestore(){var o;try{o=JSON.parse(document.getElementById("rt").value)}catch(e){return er("This isn't a valid backup. Choose the .json file or paste the full backup text.")}
if(!o||!Array.isArray(o.c)||!Array.isArray(o.inv))return er("This backup is missing customer or invoice data.");
ask("Replace all current data with this backup?",function(){S=o;S.items=S.items||[];S.sup=S.sup||[];S.bk=S.bk||[];S.ob=S.ob||{Cash:0,Bank:0,UPI:0};S.biz=S.biz||{name:"",addr:"",gst:""};if(SRV)normS();save();SRV?pullDuty(render):render()})}
function localStart(){S=load();S.inv=S.inv||[];S.bk=S.bk||[];S.ob=S.ob||{Cash:20000,Bank:100000,UPI:0};S.sup=S.sup||[{id:1,name:"Oil company depot",kind:"Oil company",phone:"",e:[{d:dago(8),t:"pay",n:"Bank transfer",a:500000},{d:dago(4),t:"bill",n:"MS and HSD tanker",a:320000}]},{id:2,name:"Lube dealer",kind:"Dealer",phone:"",e:[{d:dago(6),t:"bill",n:"Oil and coolant stock",a:18000}]}];S.items=S.items||[{id:1,name:"Engine oil 1 L",unit:"piece",sell:520,buy:430,stock:24,low:6},{id:2,name:"Coolant 1 L",unit:"piece",sell:260,buy:200,stock:5,low:6},{id:3,name:"Gear oil 500 ml",unit:"piece",sell:310,buy:250,stock:12,low:4}];S.biz=S.biz||{name:"",addr:"",gst:""};render()}
var ME=null,SRV=false,VER=0,saveT=null,CL=[],MY=[],PEND=[];
var AUTH_TOKEN=localStorage.getItem("petrol_auth_token")||"";
function api(m,u,b){var h={"Content-Type":"application/json","X-App":"1"};if(AUTH_TOKEN)h["Authorization"]="Bearer "+AUTH_TOKEN;return fetch(u,{method:m,headers:h,body:b?JSON.stringify(b):undefined,credentials:"same-origin"}).then(function(r){return r.json().then(function(j){if(!r.ok){j.status=r.status;throw j}return j},function(){if(!r.ok)throw{status:r.status};return{}})});}
function badge(t){var e=document.getElementById("bdg");e.textContent=t;e.style.display=t?"block":"none"}
function emptyS(){return{c:[],inv:[],items:[],sup:[],bk:[],nozzles:[],tanks:[],deliv:[],rates:[],expcats:[],paymodes:[],fuelprods:[],itemcats:[],ob:{Cash:0,Bank:0,UPI:0},biz:{name:"",addr:"",gst:""}}}
function strip(){var o=JSON.parse(JSON.stringify(S));o.c.forEach(function(c){c.e=c.e.filter(function(x){return !x.srv})});return o}
var SEC={c:["c"],inv:["inv"],items:["items","itemcats"],sup:["sup"],bk:["bk","ob"],biz:["biz"],tanks:["tanks","deliv"],setup:["nozzles","rates","expcats","paymodes","fuelprods"]},VERS={},SNAP={};
function secOf(o,n){var r={};SEC[n].forEach(function(k){r[k]=o[k]});return JSON.stringify(r)}
function snapAll(){var o=strip();Object.keys(SEC).forEach(function(n){SNAP[n]=secOf(o,n)})}
function normS(){["c","inv","items","sup","bk","nozzles","tanks","deliv","rates","expcats","paymodes","fuelprods","itemcats"].forEach(function(k){S[k]=S[k]||[]});S.ob=S.ob||{Cash:0,Bank:0,UPI:0};S.biz=S.biz||{name:"",addr:"",gst:""}}
function push(){var o=strip(),ch={},vs={};Object.keys(SEC).forEach(function(n){if(secOf(o,n)!==SNAP[n]){var d={};SEC[n].forEach(function(k){d[k]=o[k]});ch[n]=d;vs[n]=VERS[n]||0}});
if(!Object.keys(ch).length)return;
api("PUT","/api/state",{vers:vs,changes:ch}).then(function(r){Object.keys(r.vers).forEach(function(n){VERS[n]=r.vers[n];SNAP[n]=secOf(o,n)});badge("")}).catch(function(e){if(e.status==409)openM('<h2>Data changed elsewhere</h2><div class="sub">Someone else saved changes to the same part of the data'+(e.conflicts?' ('+e.conflicts.join(", ")+')':'')+'. Reload to get the latest data. Your last change was not saved.</div><div class="btns"><button onclick="location.reload()">Reload now</button></div>');else if(e.status==401)location.reload();else badge("Could not save. Check your connection.")})}
function pullDuty(cb){api("GET","/api/credit-sales").then(function(rows){CSALES=rows;S.c.forEach(function(c){c.e=c.e.filter(function(x){return !x.srv})});PEND=[];rows.forEach(function(r){if(r.status=="pending"){PEND.push(r);return}var c=find(r.cust_id);if(c)c.e.push({d:r.d,t:"sale",n:"Duty: "+r.n+(r.veh?" ("+r.veh+")":"")+" by "+r.worker,a:r.a,srv:r.id})});cb&&cb()}).catch(function(){cb&&cb()})}
function pendHtml(){if(!SRV||!PEND.length)return '';var h='<div class="cust" style="cursor:default;border-color:var(--warn)"><b style="color:var(--warn)">'+PEND.length+' credit sale'+(PEND.length>1?'s':'')+' waiting for approval</b><div class="sub">Over the customer\'s credit limit. Managers and the owner can approve.</div>';
PEND.forEach(function(r){var c=find(r.cust_id);h+='<div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px"><div class="row"><b>'+esc(c?c.name:"Customer")+'</b><span class="amt" style="flex:none">'+inr(r.a)+'</span></div><div class="sub">'+esc(r.n)+(r.veh?' \u00b7 '+esc(r.veh):'')+' \u00b7 by '+esc(r.worker)+' \u00b7 '+r.d+'</div>'+(c?'<div class="sub">Due '+inr(due(c))+' of '+inr(c.limit)+' limit</div>':'')+'<div class="btns" style="margin:8px 0 0"><button onclick="decide('+r.id+',\'approve\')">Approve</button><button class="ghost" onclick="decide('+r.id+',\'reject\')">Reject</button></div></div>'});return h+'</div>'}
function decide(id,w){api("POST","/api/credit-sales/"+id+"/"+w).then(function(){pullDuty(render)}).catch(function(e){badge(e.error||"Could not update.");pullDuty(render)})}
var DT=null,DD=bizToday(),DF=null,WD=null,RV="sum",SU="nozzles",FUELS=["Petrol (MS)","Diesel (HSD)","Power petrol","Power diesel","Other"],DEFCATS=["Tea and food","Repairs","Electricity","Transport","Other"];
function bizToday(){return new Date(Date.now()-216e5).toLocaleDateString("en-CA")}
function allModes(){return S.paymodes&&S.paymodes.length?S.paymodes:[{key:"cash",name:"Cash",active:true},{key:"upi",name:"UPI",active:true},{key:"card",name:"Card",active:true}]}
function mname(){var m={};allModes().forEach(function(x){m[x.key]=x.name});return m}
function cats(){return S.expcats&&S.expcats.length?S.expcats:DEFCATS}
function fnum(x){var n=parseFloat(x);return isNaN(n)?0:n}
function R2(a,b){return '<div class="row"><span>'+a+'</span><span style="text-align:right">'+b+'</span></div>'}
function sect(t){return '<h1 style="margin:16px 0 6px;color:var(--ink);font-size:17px;font-weight:800">'+t+'</h1>'}
function sgn(x){return Math.abs(x)<1?'Tally':(x<0?'Short ':'Excess ')+inr(Math.abs(x))}
function wnav(){
  renderSidebar();
  var bizName = (ME && ME.pump_name) ? ME.pump_name : ((S && S.biz && S.biz.name) ? S.biz.name : "Petrol Pump");
  var T=[
    ["wduty","Duty","loadW"],
    ["wlube","Lubes & shop","loadWLube"],
    ["wexp","Expenses","loadWExp"],
    ["credit","Credit sale","loadCredit"],
    ["wdip","Tank dip","loadDip"],
    ["mypay","My pay","loadMyPay"]
  ];

  var mobileTop = '<div class="mobile-top-bar noprint">' +
    '<button type="button" class="mobile-menu-btn" onclick="toggleSidebar(true)" aria-label="Open menu">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>' +
    '</button>' +
    '<div class="mobile-bar-title">' + esc(bizName) + '</div>' +
    (ME ? '<div class="mobile-user-tag">' + esc(ME.role) + '</div>' : '') +
  '</div>';

  var topStrip = '<div class="top-tab-strip noprint">' +
    T.map(function(t){
      return '<button type="button" class="top-strip-tab' + (tab==t[0]?' active':'') + '" onclick="tab=\''+t[0]+'\';'+t[2]+'()">' + t[1] + '</button>';
    }).join("") +
  '</div>';

  var desktopGrid = '<div class="top-nav-grid noprint" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin-bottom:12px">' +
    T.map(function(t){
      return '<button style="padding:9px 4px;font-size:13.5px" class="'+(tab==t[0]?'':'ghost')+'" onclick="tab=\''+t[0]+'\';'+t[2]+'()">'+t[1]+'</button>';
    }).join("") +
  '</div>';

  return mobileTop + topStrip + desktopGrid;
}
function dsum(){var e=document.getElementById("dsum");if(!e||!DF)return;var L=0,A=0,P=0,X=0,C=0;
DF.lines.forEach(function(l,i){var no=l.closing==="",lt=no?0:Math.round((fnum(l.closing)-fnum(l.opening)-fnum(l.testing))*100)/100,am=Math.round(lt*fnum(l.rate)*100)/100;if((l.unit||"L")=="L")L+=lt;A+=am;var x=document.getElementById("dl"+i);if(x)x.textContent=no?"Enter the closing reading":lt+" "+(l.unit||"L")+" sold = "+m2(am)});
DF.items.forEach(function(it,i){var s=DF.stock.filter(function(x){return x.id==it.item_id})[0],am=s?Math.round(fnum(it.qty)*s.sell*100)/100:0;P+=am;var x=document.getElementById("il"+i);if(x)x.textContent=s?m2(am):""});
DF.exps.forEach(function(x){X+=fnum(x.amount)});DF.modes.forEach(function(m){C+=fnum(DF.pay[m.key])});
var ex=A+P-DF.credit-X,df=Math.round((C-ex)*100)/100;
var lubeTag = P > 0 ? ' <span class="sub" style="font-size:12px">(' + DF.items.length + ' item' + (DF.items.length > 1 ? 's' : '') + ')</span>' : '';
var creditTag = DF.credit > 0 ? ' <span class="sub" style="font-size:12px">(from Credit tab)</span>' : '';
var expTag = X > 0 ? ' <span class="sub" style="font-size:12px">(' + DF.exps.length + ' entry' + (DF.exps.length > 1 ? 's' : '') + ')</span>' : '';
e.innerHTML=R2("Liquid fuel sold",L.toFixed(2)+" L")+R2("Fuel sales",m2(A))+R2("Lube and shop sales",m2(P)+lubeTag)+R2("Less credit sales",m2(DF.credit)+creditTag)+R2("Less expenses paid from the till",m2(X)+expTag)+R2("Expected collection",m2(ex))+R2("Collected",m2(C))+'<div class="amt" style="color:'+(Math.abs(df)<1?'var(--ok)':'var(--due)')+'">'+R2(df<=-1?"Short":df>=1?"Excess":"Tally",m2(Math.abs(df)))+'</div>'}
function fin(label,path,val,ed){return '<label>'+label+'<input '+(ed?'':'disabled ')+'inputmode="decimal" value="'+esc(val)+'" oninput="'+path+'=this.value;dsum()"></label>'}
function formHtml(){var wk=DF.mode=="worker",h='';
DF.lines.forEach(function(l,i){var P='DF.lines['+i+'].';h+='<div class="cust" style="cursor:default"><b>'+esc(l.name)+'</b> <span class="sub">'+esc(l.fuel)+'</span><div class="row">'+fin("Opening",P+'opening',l.opening,!wk)+fin("Closing",P+'closing',l.closing,1)+'</div><div class="row">'+fin("Testing ("+(l.unit||"L")+")",P+'testing',l.testing,1)+fin("Rate (\u20b9/"+(l.unit||"L")+")",P+'rate',l.rate,!wk)+'</div><div class="sub" id="dl'+i+'" style="margin-top:6px"></div></div>'});
if(!wk){
  h+=sect("Lubes and shop");
  DF.items.forEach(function(it,i){h+='<div class="cust" style="cursor:default"><select onchange="DF.items['+i+'].item_id=this.value;dsum()"><option value="">Choose item</option>'+DF.stock.map(function(s){return '<option value="'+s.id+'"'+(it.item_id==s.id?' selected':'')+'>'+esc(s.name)+' ('+s.stock+' '+esc(s.unit)+' in stock) \u00b7 '+m2(s.sell)+'</option>'}).join("")+'</select><div class="row">'+fin("Quantity","DF.items["+i+"].qty",it.qty,1)+'<span class="sub" id="il'+i+'" style="text-align:right"></span><button class="ghost" style="flex:none;padding:6px 10px" onclick="DF.items.splice('+i+',1);renderDF()">Remove</button></div></div>'});
  h+='<button class="ghost" onclick="DF.items.push({item_id:\'\',qty:\'\'});renderDF()">Add lube or shop item</button>';
  h+=sect("Expenses paid from the till");
  DF.exps.forEach(function(x,i){var cl=DF.cats.indexOf(x.cat)<0?DF.cats.concat([x.cat]):DF.cats;h+='<div class="cust" style="cursor:default"><select onchange="DF.exps['+i+'].cat=this.value">'+cl.map(function(c){return '<option'+(x.cat==c?' selected':'')+'>'+esc(c)+'</option>'}).join("")+'</select><label>Details<input value="'+esc(x.note)+'" oninput="DF.exps['+i+'].note=this.value"></label><div class="row">'+fin("Amount (\u20b9)","DF.exps["+i+"].amount",x.amount,1)+'<button class="ghost" style="flex:none;padding:6px 10px" onclick="DF.exps.splice('+i+',1);renderDF()">Remove</button></div></div>'});
  h+='<button class="ghost" onclick="DF.exps.push({cat:DF.cats[0],note:\'\',amount:\'\'});renderDF()">Add expense</button>';
}
h+=sect("Money collected")+'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">'+DF.modes.map(function(m){return fin(esc(m.name),"DF.pay['"+m.key+"']",DF.pay[m.key]||"",1)}).join("")+'</div>';
h+='<label>Note (optional)<input value="'+esc(DF.note)+'" oninput="DF.note=this.value"></label><div class="cust" id="dsum" style="cursor:default;margin-top:12px"></div><div class="err" id="er"></div>';
setTimeout(dsum,0);return h}
function fromDuty(d,ctx,mode){var pay={};Object.keys(d.pay||{}).forEach(function(k){pay[k]=d.pay[k]||""});
return{id:d.id,mode:mode,modes:ctx.modes,cats:ctx.cats,stock:ctx.items,lines:d.lines.map(function(l){return{nozzle_id:l.nozzle_id,name:l.nozzle,fuel:l.fuel,unit:l.unit||"L",opening:l.opening==null?"":l.opening,closing:l.closing==null?"":l.closing,testing:l.testing||0,rate:l.rate==null?"":l.rate}}),items:d.items.map(function(i){return{item_id:i.item_id,qty:i.qty}}),exps:d.expenses.map(function(e){return{cat:e.cat,note:e.note,amount:e.amount}}),pay:pay,note:d.note||"",credit:d.credit,meta:d}}
function dpay(){return{lines:DF.lines.map(function(l){return{nozzle_id:l.nozzle_id,opening:l.opening,closing:l.closing,testing:l.testing,rate:l.rate}}),items:DF.items,expenses:DF.exps,pay:DF.pay,note:DF.note}}
function msg(m,good){var e=document.getElementById("er");if(e){e.style.color=good?"var(--ok)":"var(--due)";e.textContent=m}}
function renderDF(){var m=DF.meta,h;
if(DF.mode=="worker")h=ubar()+wnav()+'<h1>'+esc(m.shift)+' duty \u00b7 '+m.d+'</h1><div class="sub">Opening readings and rates are set by your manager. Credit sales, lubes, and expenses saved in their tabs are counted automatically.</div>'+formHtml()+'<div class="row" style="margin-top:12px"><button class="ghost" onclick="wSave(0)">Save draft</button><button onclick="wSave(1)">Submit duty</button></div>';
else h=nav()+'<button class="ghost noprint" onclick="renderDutyTab()">Back to duty list</button><h1 style="margin-top:14px">'+esc(m.worker)+' \u00b7 '+esc(m.shift)+' \u00b7 '+m.d+'</h1><div class="sub">Check the figures, correct anything that is wrong, then close the duty.</div>'+formHtml()+'<div class="row" style="margin-top:12px"><button class="ghost" onclick="mSave(0)">Save changes</button><button onclick="mSave(1)">Close duty</button></div>';
document.getElementById("app").innerHTML=h}
function dutyBlock(d,mn){var T=function(a,b,c){return '<tr><td>'+a+'</td><td class="r"'+(c?' style="color:'+c+'"':'')+'>'+b+'</td></tr>'};
var h='<div class="cust" style="cursor:default"><div class="row"><b>'+esc(d.worker)+' \u00b7 '+esc(d.shift)+'</b><span class="sub" style="flex:none">'+d.d+'</span></div><div class="tbl" style="margin-top:8px"><table><tr><th>Nozzle</th><th class="r">Open</th><th class="r">Close</th><th class="r">Test</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>'+d.lines.map(function(l){return '<tr><td>'+esc(l.nozzle)+'<div class="sub">'+esc(l.fuel)+'</div></td><td class="r">'+l.opening+'</td><td class="r">'+l.closing+'</td><td class="r">'+l.testing+'</td><td class="r">'+l.litres+'</td><td class="r">'+m2(l.rate)+'</td><td class="r">'+m2(l.amount)+'</td></tr>'}).join("")+'</table></div>';
if(d.items.length)h+='<div class="tbl" style="margin-top:8px"><table><tr><th>Lube / shop</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr>'+d.items.map(function(i){return '<tr><td>'+esc(i.name)+'</td><td class="r">'+i.qty+'</td><td class="r">'+m2(i.price)+'</td><td class="r">'+m2(i.amount)+'</td></tr>'}).join("")+'</table></div>';
if(d.expenses.length)h+='<div class="tbl" style="margin-top:8px"><table style="min-width:0"><tr><th>Expense</th><th class="r">Amount</th></tr>'+d.expenses.map(function(e){return '<tr><td>'+esc(e.cat)+(e.note?'<div class="sub">'+esc(e.note)+'</div>':'')+'</td><td class="r">'+m2(e.amount)+'</td></tr>'}).join("")+'</table></div>';
h+='<div class="tbl" style="margin-top:8px"><table style="min-width:0">'+T("Fuel sales",m2(d.sales))+T("Lube and shop sales",m2(d.lube))+T("Less credit sales","\u2212"+m2(d.credit))+T("Less expenses","\u2212"+m2(d.exp))+T("<b>Expected collection</b>","<b>"+m2(d.expected)+"</b>")+Object.keys(d.pay).map(function(k){return T(esc(mn[k]||k),m2(d.pay[k]))}).join("")+T("<b>Collected</b>","<b>"+m2(d.collected)+"</b>")+T("<b>Difference</b>","<b>"+sgn(d.diff)+"</b>",Math.abs(d.diff)<1?'var(--ok)':'var(--due)')+'</table></div>'+(d.note?'<div class="sub" style="margin-top:6px">Note: '+esc(d.note)+'</div>':'')+'</div>';
return h}
// ---- Worker
function loadW(){
  tab="wduty";
  if(DF&&DF.id&&DF.mode=="worker"){renderDF();return}
  api("GET","/api/duty/current").then(function(r){WD=r;renderW()}).catch(function(e){document.getElementById("app").innerHTML=ubar()+wnav()+'<div class="empty">Could not load. '+esc(e.error||"Check your connection.")+'</div>'})
}
function renderW(){if(WD.duty){DF=fromDuty(WD.duty,{modes:WD.modes,cats:WD.cats,items:WD.items},"worker");return renderDF()}
var h=ubar()+wnav()+'<h1>My duty</h1><div class="empty">No duty assigned yet. Your manager assigns your shift and nozzles.</div><h1 style="margin-top:22px">My recent duties</h1>';
if(!WD.recent.length)h+='<div class="empty">No duties yet.</div>';
WD.recent.forEach(function(d){h+='<div class="cust" tabindex="0" onclick="viewMyDuty('+d.id+')"><div class="row"><b>'+esc(d.shift)+' \u00b7 '+d.d+'</b><span class="sub" style="flex:none;color:'+(d.status=="closed"?'var(--ok)':'var(--warn)')+'">'+(d.status=="closed"?"Closed":"Waiting for manager")+'</span></div><div class="sub">'+d.litres+' L \u00b7 Sales '+inr(d.sales+d.lube)+' \u00b7 Collected '+inr(d.collected)+' \u00b7 '+sgn(d.diff)+'</div></div>'});
document.getElementById("app").innerHTML=h}
function viewMyDuty(id){api("GET","/api/my-duties/"+id).then(function(r){var mn={};r.modes.forEach(function(m){mn[m.key]=m.name});document.getElementById("app").innerHTML=ubar()+wnav()+'<button class="ghost" onclick="loadW()">Back to my duties</button><div style="margin-top:10px">'+dutyBlock(r.duty,mn)+'</div>'}).catch(function(e){toast(e.error||"Could not open the duty.")})}
function wSave(sub){var go=function(){api(sub?"POST":"PUT","/api/duty/"+DF.id+(sub?"/submit":""),dpay()).then(function(){if(sub){DF=null;loadW()}else msg("Draft saved.",1)}).catch(function(e){msg(e.error||"Could not save. Check your connection.")})};
if(sub)ask("Submit this duty to the manager? You cannot change it after this.",go);else go()}

function loadWLube(){
  tab="wlube";
  if(DF&&DF.meta&&DF.id){renderWLube();return}
  document.getElementById("app").innerHTML=ubar()+wnav()+'<div class="empty">Loading duty details\u2026</div>';
  api("GET","/api/duty/current").then(function(r){
    WD=r;
    if(WD.duty){DF=fromDuty(WD.duty,{modes:WD.modes,cats:WD.cats,items:WD.items},"worker")}
    renderWLube();
  }).catch(function(e){
    document.getElementById("app").innerHTML=ubar()+wnav()+'<div class="empty">Could not load. '+esc(e.error||"Check your connection.")+'</div>';
  });
}

function renderWLube(){
  tab="wlube";
  if(!DF||!DF.meta||!DF.id){
    document.getElementById("app").innerHTML=ubar()+wnav()+'<h1>Lubes &amp; shop</h1><div class="empty">No duty assigned yet. Your manager assigns your shift before you can record lube and shop sales.</div>';
    return;
  }
  var m=DF.meta,totalLube=0;
  DF.items.forEach(function(it){
    var s=DF.stock.filter(function(x){return x.id==it.item_id})[0];
    if(s)totalLube+=Math.round(fnum(it.qty)*s.sell*100)/100;
  });

  var h=ubar()+wnav()+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">'+
      '<div><h1>Lubes &amp; shop</h1><div class="sub">'+esc(m.shift)+' duty \u00b7 '+m.d+' \u00b7 Linked directly with duty collection</div></div>'+
      '<div style="text-align:right"><button class="ghost" style="padding:6px 12px;font-size:13px" onclick="tab=\'wduty\';renderDF()">View duty form \u2192</button></div>'+
    '</div>'+
    '<div class="cust" style="cursor:default;margin:12px 0;background:var(--card)">'+
      '<div class="row"><b>Total lube &amp; shop sales</b><span class="amt" style="flex:none;color:var(--ink)">'+inr(totalLube)+'</span></div>'+
      '<div class="sub" style="margin-top:4px">'+DF.items.length+' item(s) recorded for this shift \u00b7 Counts towards expected collection</div>'+
    '</div>';

  h+='<h1 style="margin-top:18px;font-size:16px">+ Add lube or shop item</h1>'+
    '<div class="cust" style="cursor:default;background:var(--card)">'+
      '<label style="margin-top:4px">Product'+
        '<select id="wl_item" onchange="calcWlPreview()">'+
          '<option value="">Choose item from stock</option>'+
          (DF.stock||[]).map(function(s){
            return '<option value="'+s.id+'" data-price="'+s.sell+'" data-unit="'+esc(s.unit)+'">'+
              esc(s.name)+' ('+s.stock+' '+esc(s.unit)+' in stock) \u00b7 '+inr(s.sell)+
            '</option>';
          }).join("")+
        '</select>'+
      '</label>'+
      '<div class="row" style="margin-top:8px">'+
        '<label>Quantity<input id="wl_qty" inputmode="decimal" placeholder="e.g. 1" oninput="calcWlPreview()"></label>'+
        '<div style="flex:1;text-align:right;padding-top:20px"><span class="sub">Total: </span><b id="wl_preview" style="font-size:16px">\u20b90.00</b></div>'+
      '</div>'+
      '<div class="err" id="wl_err"></div>'+
      '<button type="button" style="width:100%;margin-top:8px" onclick="addWLubeItem()">Add to duty</button>'+
    '</div>';

  h+='<h1 style="margin-top:24px;font-size:16px">Recorded items ('+DF.items.length+')</h1>';
  if(!DF.items.length){
    h+='<div class="empty">No lube or shop items added to this duty yet.</div>';
  } else {
    DF.items.forEach(function(it,i){
      var s=DF.stock.filter(function(x){return x.id==it.item_id})[0];
      var amt=s?Math.round(fnum(it.qty)*s.sell*100)/100:0;
      h+='<div class="cust" style="cursor:default;margin-top:8px">'+
        '<div class="row"><b>'+esc(s?s.name:"Unknown item")+'</b><span class="amt" style="flex:none">'+inr(amt)+'</span></div>'+
        '<div class="row" style="margin-top:4px"><span class="sub">'+it.qty+' '+(s?esc(s.unit):"")+' \u00d7 '+inr(s?s.sell:0)+'</span>'+
        '<button class="ghost" style="flex:none;padding:5px 10px;font-size:12px;color:var(--due)" onclick="removeWLubeItem('+i+')">Remove</button></div>'+
      '</div>';
    });
  }
  document.getElementById("app").innerHTML=h;
}

function calcWlPreview(){
  var sel=document.getElementById("wl_item"),qEl=document.getElementById("wl_qty"),pEl=document.getElementById("wl_preview");
  if(!sel||!qEl||!pEl)return;
  var opt=sel.options[sel.selectedIndex],price=opt?parseFloat(opt.getAttribute("data-price")||0):0,qty=parseFloat(qEl.value||0);
  pEl.textContent=inr(Math.round(qty*price*100)/100);
}

function addWLubeItem(){
  var sel=document.getElementById("wl_item"),qEl=document.getElementById("wl_qty"),errEl=document.getElementById("wl_err");
  if(!sel||!sel.value){if(errEl)errEl.textContent="Please choose an item.";return}
  var qty=parseFloat(qEl.value);
  if(!(qty>0)){if(errEl)errEl.textContent="Enter a quantity above zero.";return}
  var ex=DF.items.filter(function(x){return x.item_id==sel.value})[0];
  if(ex){ex.qty=Math.round((fnum(ex.qty)+qty)*100)/100}else{DF.items.push({item_id:sel.value,qty:qty})}
  api("PUT","/api/duty/"+DF.id,dpay()).then(function(){toast("Lube item added to duty");renderWLube()}).catch(function(){renderWLube()});
}

function removeWLubeItem(idx){
  DF.items.splice(idx,1);
  api("PUT","/api/duty/"+DF.id,dpay()).then(function(){toast("Item removed");renderWLube()}).catch(function(){renderWLube()});
}

function loadWExp(){
  tab="wexp";
  if(DF&&DF.meta&&DF.id){renderWExp();return}
  document.getElementById("app").innerHTML=ubar()+wnav()+'<div class="empty">Loading duty details\u2026</div>';
  api("GET","/api/duty/current").then(function(r){
    WD=r;
    if(WD.duty){DF=fromDuty(WD.duty,{modes:WD.modes,cats:WD.cats,items:WD.items},"worker")}
    renderWExp();
  }).catch(function(e){
    document.getElementById("app").innerHTML=ubar()+wnav()+'<div class="empty">Could not load. '+esc(e.error||"Check your connection.")+'</div>';
  });
}

function renderWExp(){
  tab="wexp";
  if(!DF||!DF.meta||!DF.id){
    document.getElementById("app").innerHTML=ubar()+wnav()+'<h1>Expenses</h1><div class="empty">No duty assigned yet. Your manager assigns your shift before you can record expenses.</div>';
    return;
  }
  var m=DF.meta,totalExp=0;
  DF.exps.forEach(function(x){totalExp+=fnum(x.amount)});

  var h=ubar()+wnav()+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">'+
      '<div><h1>Expenses paid from till</h1><div class="sub">'+esc(m.shift)+' duty \u00b7 '+m.d+' \u00b7 Deducted from expected cash collection</div></div>'+
      '<div style="text-align:right"><button class="ghost" style="padding:6px 12px;font-size:13px" onclick="tab=\'wduty\';renderDF()">View duty form \u2192</button></div>'+
    '</div>'+
    '<div class="cust" style="cursor:default;margin:12px 0;background:var(--card)">'+
      '<div class="row"><b>Total expenses paid from till</b><span class="amt" style="flex:none;color:var(--due)">&minus;'+inr(totalExp)+'</span></div>'+
      '<div class="sub" style="margin-top:4px">'+DF.exps.length+' entry(s) recorded for this shift \u00b7 Deducted from expected collection</div>'+
    '</div>';

  h+='<h1 style="margin-top:18px;font-size:16px">+ Record expense from till</h1>'+
    '<div class="cust" style="cursor:default;background:var(--card)">'+
      '<label style="margin-top:4px">Category'+
        '<select id="we_cat">'+
          (DF.cats||[]).map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>'}).join("")+
        '</select>'+
      '</label>'+
      '<label style="margin-top:8px">Details / Note (optional)'+
        '<input id="we_note" placeholder="e.g. Tea and snacks, generator fuel, cleaning">'+
      '</label>'+
      '<label style="margin-top:8px">Amount (\u20b9)'+
        '<input id="we_amt" inputmode="decimal" placeholder="e.g. 150">'+
      '</label>'+
      '<div class="err" id="we_err"></div>'+
      '<button type="button" style="width:100%;margin-top:8px" onclick="addWExpItem()">Record expense</button>'+
    '</div>';

  h+='<h1 style="margin-top:24px;font-size:16px">Recorded expenses ('+DF.exps.length+')</h1>';
  if(!DF.exps.length){
    h+='<div class="empty">No expenses paid from the till during this duty.</div>';
  } else {
    DF.exps.forEach(function(x,i){
      h+='<div class="cust" style="cursor:default;margin-top:8px">'+
        '<div class="row"><b>'+esc(x.cat)+'</b><span class="amt" style="flex:none;color:var(--due)">&minus;'+inr(x.amount)+'</span></div>'+
        '<div class="row" style="margin-top:4px"><span class="sub">'+(x.note?esc(x.note):"No details")+'</span>'+
        '<button class="ghost" style="flex:none;padding:5px 10px;font-size:12px;color:var(--due)" onclick="removeWExpItem('+i+')">Remove</button></div>'+
      '</div>';
    });
  }
  document.getElementById("app").innerHTML=h;
}

function addWExpItem(){
  var catEl=document.getElementById("we_cat"),noteEl=document.getElementById("we_note"),amtEl=document.getElementById("we_amt"),errEl=document.getElementById("we_err");
  var amt=parseFloat(amtEl.value);
  if(!(amt>0)){if(errEl)errEl.textContent="Enter an amount above zero.";return}
  DF.exps.push({cat:catEl.value||(DF.cats&&DF.cats[0])||"Other",note:noteEl.value||"",amount:amt});
  api("PUT","/api/duty/"+DF.id,dpay()).then(function(){toast("Expense recorded and deducted from duty");renderWExp()}).catch(function(){renderWExp()});
}

function removeWExpItem(idx){
  DF.exps.splice(idx,1);
  api("PUT","/api/duty/"+DF.id,dpay()).then(function(){toast("Expense removed");renderWExp()}).catch(function(){renderWExp()});
}
// ---- Manager: assign, review, close day, reports
function reloadState(cb){api("GET","/api/state").then(function(r){VERS=r.vers||{};S=r.state||emptyS();normS();snapAll();pullDuty(cb)}).catch(function(){cb&&cb()})}
function renderDutyTab(){var A=document.getElementById("app");if(!SRV){A.innerHTML=nav()+'<div class="empty">Duty entries need the server. They are not available in this preview.</div>';return}
tab="duty";A.innerHTML=nav()+'<div class="empty">Loading\u2026</div>';
api("GET","/api/duties?d="+DD).then(function(r){if(tab!="duty")return;var st=r.day_status,h=nav()+'<h1>Duty and nozzle readings</h1><div class="btns"><button onclick="assignForm()">Assign duty</button><button class="ghost" onclick="sumForm()">Daily summary</button><button class="ghost" onclick="dayReport()">Day report</button><button class="ghost" onclick="renderShort()">Shortage report</button></div>';
h+='<label>Business day<input type="date" value="'+DD+'" onchange="DD=this.value;renderDutyTab()"></label><div class="cust" style="cursor:default;margin-top:10px"><div class="row"><b>'+DD+'</b><span style="flex:none;color:'+(st=="approved"?'var(--ok)':st=="closed"?'var(--warn)':'var(--ink)')+'">'+(st=="approved"?"Approved by owner":st=="closed"?"Closed, waiting for owner":"Open")+'</span></div><div class="sub">The business day runs from 6 AM to 6 AM.</div><div class="btns" style="margin:8px 0 0">'+(st=="open"?'<button onclick="dayAsk(\'close\')">Close day</button>':'')+(st=="closed"&&ME.role=="owner"?'<button onclick="dayAct(\'approve\')">Approve day</button>':'')+(st!="open"&&ME.role=="owner"?'<button class="ghost" onclick="dayAct(\'reopen\')">Reopen day</button>':'')+'</div></div>';
if(r.open.length)h+='<div class="cust" style="cursor:default"><b>Duties in progress</b>'+r.open.map(function(d){return '<div class="row" style="margin-top:10px"><span>'+esc(d.worker)+' \u00b7 '+esc(d.shift)+'<div class="sub">'+d.lines.map(function(l){return esc(l.nozzle)}).join(", ")+' \u00b7 '+d.d+'</div></span><button class="ghost" style="flex:none;padding:6px 10px" onclick="cancelDuty('+d.id+')">Cancel</button></div>'}).join("")+'</div>';
if(r.pending.length)h+='<div class="cust" style="cursor:default;border-color:var(--warn)"><b style="color:var(--warn)">'+r.pending.length+' dut'+(r.pending.length>1?'ies':'y')+' waiting to be closed</b>'+r.pending.map(function(d){return '<div class="row" style="margin-top:10px"><span>'+esc(d.worker)+' \u00b7 '+esc(d.shift)+' \u00b7 '+d.d+'<div class="sub">'+sgn(d.diff)+'</div></span><button style="flex:none" onclick="reviewDuty('+d.id+')">Review</button></div>'}).join("")+'</div>';
var T={l:0,s:0,k:0,d:0},F={};
h+='<div class="tbl" style="margin-top:12px"><table><tr><th>Worker</th><th class="r">Litres</th><th class="r">Sales</th><th class="r">Collected</th><th class="r">Short / excess</th><th></th></tr>';
r.day.forEach(function(d){T.l+=d.litres;T.s+=d.sales+d.lube;T.k+=d.collected;T.d+=d.diff;d.lines.forEach(function(l){var k=l.fuel||"Other",f=F[k]||(F[k]={l:0,a:0});f.l+=l.litres;f.a+=l.amount});
h+='<tr><td>'+esc(d.worker)+'<div class="sub">'+esc(d.shift)+' \u00b7 '+(d.status=="closed"?"closed":"to close")+'</div></td><td class="r">'+d.litres+'</td><td class="r">'+inr(d.sales+d.lube)+'</td><td class="r">'+inr(d.collected)+'</td><td class="r" style="color:'+(Math.abs(d.diff)<1?'var(--ok)':'var(--due)')+'">'+sgn(d.diff)+'</td><td><button class="ghost" style="padding:5px 8px" onclick="reviewDuty('+d.id+')">Open</button></td></tr>'});
if(!r.day.length)h+='<tr><td colspan="6" class="empty">No submitted duties on this date.</td></tr>';
else h+='<tr><td><b>Day total</b></td><td class="r"><b>'+Math.round(T.l*100)/100+'</b></td><td class="r"><b>'+inr(T.s)+'</b></td><td class="r"><b>'+inr(T.k)+'</b></td><td class="r"><b>'+sgn(T.d)+'</b></td><td></td></tr>';
h+='</table></div>';
A.innerHTML=h}).catch(function(e){badge(e.error||"Could not load duties.")})}
function dayAct(a){api("POST","/api/days/"+DD+"/"+a).then(function(){renderDutyTab()}).catch(function(e){toast(e.error||"Could not update the day.")})}
function dayAsk(a){ask("Close the business day "+DD+"? It then goes to the owner for approval, and no more duties can be added to it.",function(){dayAct(a)})}
function cancelDuty(id){ask("Cancel this duty? The nozzles become free again.",function(){api("DELETE","/api/duties/"+id).then(renderDutyTab).catch(function(e){toast(e.error||"Could not cancel.")})})}
function assignForm(){api("GET","/api/assign-info").then(function(r){
if(!r.workers.length)return toast("Add a worker in the Team tab first.");
if(r.day!="open")return toast("Today's business day is closed. Ask the owner to reopen it.");
if(!r.nozzles.length)return toast("Add nozzles in Pump setup first (owner).");
openM('<h2>Assign duty</h2><div class="sub">Business day '+r.date+'</div><label>Worker<select id="as_w">'+r.workers.map(function(w){return '<option value="'+w.id+'">'+esc(w.name)+'</option>'}).join("")+'</select></label><label>Shift<select id="as_s"><option>Morning</option><option>Evening</option><option>Night</option></select></label><div class="sub" style="margin-top:12px">Nozzles</div>'+r.nozzles.map(function(n){var why=n.busy_by?"with "+n.busy_by:n.rate==null?"no rate set":n.opening==null?"no opening reading":"";return '<label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" class="an" value="'+n.id+'" style="width:auto;margin:0"'+(why?' disabled':'')+'>'+esc(n.name)+' \u00b7 '+esc(n.fuel)+(why?' <span class="sub">('+esc(why)+')</span>':' <span class="sub">(starts at '+n.opening+', '+m2(n.rate)+'/L)</span>')+'</label>'}).join("")+'<div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="ghost" onclick="close()">Cancel</button><button onclick="doAssign()">Assign duty</button></div>')}).catch(function(e){toast(e.error||"Could not load.")})}
function doAssign(){var ids=[].slice.call(document.querySelectorAll(".an:checked")).map(function(x){return x.value});if(!ids.length)return er("Choose at least one nozzle.");api("POST","/api/duties/assign",{worker_id:v("as_w"),shift:v("as_s"),nozzle_ids:ids}).then(function(){close();renderDutyTab()}).catch(function(e){er(e.error||"Could not assign.")})}
function reviewDuty(id){api("GET","/api/duties/"+id).then(function(d){var pay=d.pay||{};
if(d.status=="closed"){document.getElementById("app").innerHTML=nav()+'<button class="ghost noprint" onclick="renderDutyTab()">Back to duty list</button><div style="margin-top:10px">'+dutyBlock(d,mname())+'</div>'+(ME.role=="owner"?'<div class="btns noprint"><button class="ghost" onclick="reopenDuty('+d.id+')">Reopen for changes</button></div>':'');return}
var ms=allModes().filter(function(m){return m.active!==false||m.key=="cash"||pay[m.key]!=null}).map(function(m){return{key:m.key,name:m.name}}),ci=S.items.map(function(i){return{id:i.id,name:i.name,unit:i.unit,sell:i.sell,stock:i.stock}});
DF=fromDuty(d,{modes:ms,cats:cats(),items:ci},"review");renderDF()}).catch(function(e){toast(e.error||"Could not open the duty.")})}
function mSave(close){api("PUT","/api/duties/"+DF.id,dpay()).then(function(){return close?api("POST","/api/duties/"+DF.id+"/close"):0}).then(function(){if(close)reloadState(renderDutyTab);else msg("Changes saved.",1)}).catch(function(e){msg(e.error||"Could not save.")})}
function reopenDuty(id){api("POST","/api/duties/"+id+"/reopen").then(function(){reloadState(function(){reviewDuty(id)})}).catch(function(e){toast(e.error||"Could not reopen.")})}
function dayReport(){api("GET","/api/day-report?d="+DD).then(function(r){var mn={};r.modes.forEach(function(m){mn[m.key]=m.name});var s=r.summary,h=nav()+'<button class="ghost noprint" onclick="renderDutyTab()">Back to duty list</button><h1 style="margin-top:14px">Day report \u00b7 '+r.d+'</h1><div class="sub">Closed duties only. Day status: '+esc(r.day.status)+'</div><div class="row noprint" style="margin:10px 0;gap:6px"><button class="'+(RV=="sum"?'':'ghost')+'" onclick="RV=\'sum\';dayReport()">Summary</button><button class="'+(RV=="det"?'':'ghost')+'" onclick="RV=\'det\';dayReport()">Worker-wise detail</button><button class="ghost" style="flex:none" onclick="window.print()">Print</button>'+xbtns()+'</div>';
if(!r.duties.length)h+='<div class="empty">No closed duties on this date.</div>';
else if(RV=="det")r.duties.forEach(function(d){h+=dutyBlock(d,mn)});
else{var tb=function(title,head,rows){return rows.length?sect(title)+'<div class="tbl"><table style="min-width:0"><tr>'+head.map(function(c,i){return '<th'+(i?' class="r"':'')+'>'+c+'</th>'}).join("")+'</tr>'+rows.map(function(x){return '<tr>'+x.map(function(c,i){return '<td'+(i?' class="r"':'')+'>'+c+'</td>'}).join("")+'</tr>'}).join("")+'</table></div>':''};
h+=tb("Fuel sold",["Fuel","Quantity","Amount"],Object.keys(s.fuel).map(function(k){return [esc(k),Math.round(s.fuel[k].litres*100)/100,m2(s.fuel[k].amount)]}))+tb("Lubes and shop",["Item","Qty","Amount"],Object.keys(s.shop).map(function(k){return [esc(k),s.shop[k].qty,m2(s.shop[k].amount)]}))+tb("Expenses by category",["Category","Amount"],Object.keys(s.exps).map(function(k){return [esc(k),m2(s.exps[k])]}))+tb("Collections",["Mode","Amount"],Object.keys(s.pay).map(function(k){return [esc(mn[k]||k),m2(s.pay[k])]}))+sect("Totals")+'<div class="cust" style="cursor:default">'+R2("Fuel sales",m2(s.sales))+R2("Lube and shop sales",m2(s.lube))+R2("<b>Total sales</b>","<b>"+m2(s.total)+"</b>")+R2("Credit sales",m2(s.credit))+R2("Expenses",m2(s.exp))+R2("Expected collection",m2(s.expected))+R2("Collected",m2(s.collected))+'<div class="amt" style="color:'+(Math.abs(s.diff)<1?'var(--ok)':'var(--due)')+'">'+R2("Difference",sgn(s.diff))+'</div><div class="sub">'+r.duties.length+' closed dut'+(r.duties.length>1?'ies':'y')+'</div></div>'}
XD=dayDoc(r,mn);document.getElementById("app").innerHTML=h}).catch(function(e){toast(e.error||"Could not load the report.")})}
// ---- Vyapar Themes System
var VYAPAR_THEMES = [
  {
    id: "standard",
    name: "Vyapar Standard",
    badge: "Classic Ledger",
    desc: "Traditional Indian Bahi-Khata ledger styling. Crimson red branding, crisp tabular borders, and high contrast for fast billing counter scanning.",
    primary: "#B91C1C",
    surface: "#FFFFFF",
    bg: "#F3F4F6",
    ink: "#111827",
    due: "#DC2626",
    ok: "#15803D"
  },
  {
    id: "modern",
    name: "Vyapar Modern",
    badge: "Sleek SaaS",
    desc: "Contemporary fintech & SaaS billing style. Sapphire Indigo Blue with soft layered cards, gentle rounded corners, and calm slate background.",
    primary: "#2563EB",
    surface: "#FFFFFF",
    bg: "#F8FAFC",
    ink: "#0F172A",
    due: "#EF4444",
    ok: "#10B981"
  },
  {
    id: "trending",
    name: "Vyapar Trending",
    badge: "Neo-Fintech / Retail",
    desc: "High-energy retail & modern fuel station look. Emerald Forest Green representing positive cash flow, paired with Warm Gold/Amber accents.",
    primary: "#059669",
    surface: "#FFFFFF",
    bg: "#F0FDF4",
    ink: "#064E3B",
    due: "#E11D48",
    ok: "#059669"
  }
];

function getVyaparTheme() {
  try {
    return localStorage.getItem("vyapar_theme") || "modern";
  } catch(e) {
    return "modern";
  }
}

function setVyaparTheme(themeId) {
  try {
    localStorage.setItem("vyapar_theme", themeId);
  } catch(e) {}
  document.documentElement.setAttribute("data-vyapar-theme", themeId);
  toast("Theme switched to " + (themeId === "standard" ? "Vyapar Standard" : themeId === "trending" ? "Vyapar Trending" : "Vyapar Modern"));
  renderSidebar();
  if (tab === "setup") renderSetup();
}

function toggleSidebar(open) {
  var sb = document.getElementById("app-sidebar");
  var ov = document.getElementById("sidebar-overlay");
  if (!sb) return;
  var isOpen = (open === undefined) ? !sb.classList.contains("open") : !!open;
  if (isOpen) {
    sb.classList.add("open");
    if (ov) ov.classList.add("open");
  } else {
    sb.classList.remove("open");
    if (ov) ov.classList.remove("open");
  }
}

function renderSidebar() {
  var sb = document.getElementById("app-sidebar");
  if (!sb) return;
  if (!ME) {
    sb.style.display = "none";
    var ov = document.getElementById("sidebar-overlay");
    if (ov) ov.classList.remove("open");
    document.body.classList.add("no-sidebar");
    return;
  }
  document.body.classList.remove("no-sidebar");
  sb.style.display = "";
  var curTh = getVyaparTheme();
  var bizName = (ME && ME.pump_name) ? ME.pump_name : ((S && S.biz && S.biz.name) ? S.biz.name : "Petrol Pump");
  var bizGst = (ME && ME.pump_code) ? (ME.pump_code + (S && S.biz && S.biz.gst ? " &bull; " + S.biz.gst : "")) : ((S && S.biz && S.biz.gst) ? S.biz.gst : "Fuel Station");

  var navItems = [];
  if (ME.role === "worker") {
    navItems = [
      { id: "wduty", label: "My Duty", icon: "⛽", action: "tab='wduty';loadW()" },
      { id: "wlube", label: "Lubes & Shop", icon: "🛢️", action: "tab='wlube';loadWLube()" },
      { id: "wexp", label: "Expenses", icon: "💸", action: "tab='wexp';loadWExp()" },
      { id: "credit", label: "Credit Sale", icon: "💳", action: "tab='credit';loadCredit()" },
      { id: "wdip", label: "Tank Dip", icon: "📏", action: "tab='wdip';loadDip()" },
      { id: "mypay", label: "My Pay", icon: "💵", action: "tab='mypay';loadMyPay()" }
    ];
  } else {
    navItems = [
      { id: "ledger", label: "Ledger", icon: "📒", action: "tab='ledger';view=null;render()" },
      { id: "duty", label: "Duty & Nozzles", icon: "⛽", action: "tab='duty';render()" },
      { id: "cashflow", label: "Cash Flow Register", icon: "💵", action: "tab='cashflow';render()" },
      { id: "tanks", label: "Tanks & Stock", icon: "🛢️", action: "tab='tanks';render()" },
      { id: "inv", label: "Invoices", icon: "🧾", action: "tab='inv';view=null;iv=null;dr=null;render()" },
      { id: "stock", label: "Stock & Lubes", icon: "📦", action: "tab='stock';render()" },
      { id: "sup", label: "Suppliers", icon: "🚚", action: "tab='sup';sv=null;render()" },
      { id: "book", label: "Cash Book", icon: "📖", action: "tab='book';render()" },
      { id: "rep", label: "Reports", icon: "📊", action: "tab='rep';render()" }
    ];
    if (ME.role === "owner" || ME.role === "manager") {
      navItems.push({ id: "team", label: "Team", icon: "👥", action: "tab='team';render()" });
    }
    if (ME.role === "owner") {
      navItems.push({ id: "pay", label: "Salary", icon: "💰", action: "tab='pay';render()" });
      navItems.push({ id: "setup", label: "Pump Setup", icon: "⚙️", action: "tab='setup';render()" });
    }
    navItems.push({ id: "bak", label: "Backup", icon: "💾", action: "tab='bak';render()" });
  }

  var activeThBadge = curTh === "standard" ? "Standard" : (curTh === "trending" ? "Trending" : "Modern");

  var h = '<div class="sidebar-brand"' + (ME.role === "owner" ? ' onclick="stationSwitcherModal()" style="cursor:pointer" title="Click to manage or switch stations"' : '') + '>' +
    '<div style="font-size:15px;font-weight:800;letter-spacing:-0.2px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(bizName) + '">' + esc(bizName) + '</div>' +
    '<div style="font-size:11px;opacity:0.88;margin-top:2px;display:flex;align-items:center;gap:4px">' +
      '<span class="brand-sub-text">' + bizGst + '</span>' +
      '<span style="background:rgba(255,255,255,0.22);padding:1px 5px;border-radius:4px;font-size:9.5px;font-weight:700">' + activeThBadge + '</span>' +
      (ME.role === "owner" ? '<span style="font-size:9.5px;opacity:0.8">&bull; Switch &#x25BE;</span>' : '') +
    '</div>' +
  '</div>';

  h += '<div class="sidebar-nav-list">';
  navItems.forEach(function(item) {
    var isAct = (tab === item.id);
    h += '<button type="button" class="nav-item' + (isAct ? ' active' : '') + '" onclick="toggleSidebar(false);' + item.action + '" title="' + esc(item.label) + '">' +
      '<span class="nav-icon" style="font-size:17px">' + item.icon + '</span>' +
      '<span class="nav-label">' + esc(item.label) + '</span>' +
    '</button>';
  });
  h += '</div>';

  h += '<div class="sidebar-footer">' +
    '<div class="sidebar-user-info" style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px">' +
      '<span style="font-size:12px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(ME.name) + '</span>' +
      '<span style="font-size:10px;text-transform:uppercase;font-weight:700;padding:2px 6px;border-radius:999px;background:var(--theme-accent-soft);color:var(--theme-accent)">' + esc(ME.role) + '</span>' +
    '</div>' +
    '<div class="footer-btns" style="display:flex;gap:4px;margin-bottom:4px">' +
      '<button type="button" class="ghost" style="flex:1;padding:4px 2px;font-size:11px" onclick="pwForm()" title="Change password">Password</button>' +
      (ME.role === "owner" ? '<button type="button" class="ghost" style="flex:1;padding:4px 2px;font-size:11px" onclick="toggleSidebar(false);tab=\'setup\';SU=\'theme\';renderSetup()" title="Theme Switcher">Theme</button>' : '') +
      '<button type="button" class="ghost" style="flex:1;padding:4px 2px;font-size:11px" onclick="logout()" title="Log out">Log out</button>' +
    '</div>' +
    '<div class="sidebar-theme-pills">' +
      '<button type="button" class="theme-pill-btn" onclick="setVyaparTheme(\'standard\')" title="Vyapar Standard Theme (Crimson Red / Classic Ledger)">Standard</button>' +
      '<button type="button" class="theme-pill-btn" onclick="setVyaparTheme(\'modern\')" title="Vyapar Modern Theme (Sapphire Blue / Modern SaaS)">Modern</button>' +
      '<button type="button" class="theme-pill-btn" onclick="setVyaparTheme(\'trending\')" title="Vyapar Trending Theme (Emerald Green / Retail Flow)">Trending</button>' +
    '</div>' +
    (ME.role === "worker" ? '<div style="margin-top:4px">' + langSel() + '</div>' : '') +
  '</div>';

  sb.innerHTML = h;
}

try {
  document.documentElement.setAttribute("data-vyapar-theme", getVyaparTheme());
} catch(e) {}

// ---- Pump setup (owner)
function rateNow(f,d){var b=null;S.rates.forEach(function(r){if(r.fuel==f&&r.from<=d&&(!b||r.from>b.from||(r.from==b.from&&r.id>b.id)))b=r});return b}
function renderSetup(){var A=document.getElementById("app");if(!SRV){A.innerHTML=nav()+'<div class="empty">Pump setup needs the server. It is not available in this preview.</div>';return}
tab="setup";var T=[["nozzles","Nozzles"],["open","Opening readings"],["rates","Fuel rates"],["cats","Expense categories"],["modes","Payment modes"],["cust","Credit customers"],["fuels","Fuel products"],["station","Station & Outlets"],["theme","Theme switcher"],["audit","Audit log"]];
var h=nav()+'<h1>Pump setup</h1><div class="setup-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">'+T.map(function(t){return '<button style="padding:9px 2px;font-size:13px;min-width:0" class="'+(SU==t[0]?'':'ghost')+'" onclick="SU=\''+t[0]+'\';renderSetup()">'+t[1]+'</button>'}).join("")+'</div>';
var tn=function(id){var t=S.tanks.filter(function(x){return x.id==id})[0];return t?t.name:"No tank"};
if(SU=="nozzles"){h+='<div class="btns"><button onclick="nozEdit(0)">Add nozzle</button></div>';if(!S.nozzles.length)h+='<div class="empty">No nozzles yet.</div>';
S.nozzles.forEach(function(n){h+='<div class="cust" style="cursor:default'+(n.active===false?';opacity:.6':'')+'"><div class="row"><b>'+esc(n.name)+'</b><span class="sub" style="flex:none">'+(n.active===false?'Inactive':'Active')+'</span></div><div class="sub">'+esc(n.fuel)+' \u00b7 '+esc(tn(n.tank_id))+'</div><div class="btns" style="margin:8px 0 0"><button class="ghost" style="padding:6px 10px" onclick="nozEdit('+n.id+')">Edit</button></div></div>'})}
else if(SU=="open"){h+='<div class="sub">The reading each nozzle starts at for its very first duty. After that, every duty starts at the previous closing reading.</div>';if(!S.nozzles.length)h+='<div class="empty">Add nozzles first.</div>';
S.nozzles.forEach(function(n,i){h+='<label>'+esc(n.name)+' \u00b7 '+esc(n.fuel)+'<input id="op'+i+'" inputmode="decimal" value="'+(n.open==null?"":n.open)+'"></label>'});
if(S.nozzles.length)h+='<div class="err" id="er"></div><button style="margin-top:12px" onclick="saveOpen()">Save readings</button>'}
else if(SU=="rates"){var fs=[];S.nozzles.forEach(function(n){if(fs.indexOf(n.fuel)<0)fs.push(n.fuel)});S.rates.forEach(function(r){if(fs.indexOf(r.fuel)<0)fs.push(r.fuel)});
h+='<div class="sub">A new rate applies to duties on or after its start date. Duties already assigned keep the rate they started with.</div>';if(!fs.length)h+='<div class="empty">Add nozzles first.</div>';
fs.forEach(function(f){var c=rateNow(f,bizToday());h+='<div class="cust" style="cursor:default"><div class="row"><b>'+esc(f)+'</b><span class="amt" style="flex:none">'+(c?m2(c.rate)+' /L':'No rate')+'</span></div>'+(c?'<div class="sub">From '+c.from+'</div>':'')+'<div class="btns" style="margin:8px 0 0"><button class="ghost" style="padding:6px 10px" onclick="rateAdd(\''+esc(f)+'\')">Set new rate</button></div></div>'});
var hs=S.rates.slice().sort(function(a,b){return a.from<b.from?1:-1});if(hs.length){h+=sect("Rate history");hs.forEach(function(r){h+='<div class="row" style="margin-top:6px"><span>'+esc(r.fuel)+' \u00b7 '+m2(r.rate)+'<div class="sub">From '+r.from+'</div></span><button class="ghost" style="flex:none;padding:5px 8px" onclick="rateDel('+r.id+')">Delete</button></div>'})}}
else if(SU=="cats"){h+='<div class="sub">Workers choose from these when they enter an expense.</div>';cats().forEach(function(c,i){h+='<div class="row" style="margin-top:8px"><span>'+esc(c)+'</span><button class="ghost" style="flex:none;padding:5px 8px" onclick="catDel('+i+')">Remove</button></div>'});
h+='<label>New category<input id="nc"></label><div class="err" id="er"></div><button style="margin-top:10px" onclick="catAdd()">Add category</button>'}
else if(SU=="modes"){h+='<div class="sub">Turn off the payment modes you do not use. They disappear from duty forms. Cash is always on.</div>';allModes().forEach(function(m,i){h+='<div class="row" style="margin-top:8px"><span>'+esc(m.name)+'</span><button class="'+(m.active!==false?'':'ghost')+'" style="flex:none;padding:6px 10px"'+(m.key=="cash"?' disabled':'')+' onclick="modeTog('+i+')">'+(m.active!==false?'On':'Off')+'</button></div>'});
h+='<label>Add a payment mode<input id="nm" placeholder="e.g. Fleet card"></label><div class="err" id="er"></div><button style="margin-top:10px" onclick="modeAdd()">Add mode</button>'}
else if(SU=="fuels"){h+='<div class="sub">The fuels you sell. Choose a unit for each (litre, kg for CNG, kWh for EV charging). Density limits are used to flag density checks on liquid fuels. The limits shown first are common defaults: confirm them with your oil company and change them here.</div><div class="btns"><button onclick="fuelEdit(-1)">Add fuel product</button></div>';
fprods().forEach(function(p,i){var cf=p.unit=="L"?'<div class="sub">Density '+(p.dmin!=null&&p.dmin!==""?p.dmin:(DENSD[p.name]?DENSD[p.name][0]:"no limit"))+' to '+(p.dmax!=null&&p.dmax!==""?p.dmax:(DENSD[p.name]?DENSD[p.name][1]:"no limit"))+' \u00b7 tolerance '+(p.dtol!=null&&p.dtol!==""?p.dtol:0.003)+'</div>':'';h+='<div class="cust" style="cursor:default'+(p.active===false?';opacity:.6':'')+'"><div class="row"><b>'+esc(p.name)+'</b><span class="sub" style="flex:none">'+esc(p.unit)+(p.active===false?' \u00b7 inactive':'')+'</span></div>'+cf+'<div class="btns" style="margin:8px 0 0"><button class="ghost" style="padding:6px 10px" onclick="fuelEdit('+i+')">Edit</button></div></div>'})}
else if(SU=="station"){
  h+='<div class="sub" style="margin-bottom:12px">Multi-Customer SaaS Data Isolation. All pump nozzles, tanks, duties, credit sales, ledgers, and team members are strictly isolated to your active station.</div>'+
    '<div class="cust" style="cursor:default;margin-bottom:16px;border:2px solid var(--theme-accent);background:var(--card)">'+
      '<div class="row" style="align-items:center;margin-bottom:6px"><b>Current Station Details</b><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--theme-accent-soft);color:var(--theme-accent)">Active Station</span></div>'+
      '<label style="margin-top:8px">Station / Pump Name<input id="st_name" value="'+esc(ME.pump_name || "")+'"></label>'+
      '<label>Station Code (Unique identifier)<input id="st_code" autocapitalize="characters" value="'+esc(ME.pump_code || "")+'"></label>'+
      '<div class="sub" style="margin:4px 0 10px">Station ID: #'+esc(ME.pump_id)+' &bull; Multi-customer tenant isolated</div>'+
      '<div class="err" id="er"></div>'+
      '<div class="btns" style="margin-top:10px"><button onclick="saveStationInfo()">Save Station Info</button></div>'+
    '</div>'+
    '<h1 style="font-size:17px;font-weight:800;color:var(--ink);margin:18px 0 6px">Your Outlets & Stations</h1>'+
    '<div class="sub" style="margin-bottom:10px">Manage multiple petrol pump locations under your account. Switch between stations anytime.</div>'+
    '<div id="setup-pump-list"><div class="empty">Loading stations\u2026</div></div>'+
    '<div class="btns" style="margin-top:14px"><button onclick="newStationModal()">+ Add New Station Outlet</button></div>';
}
else if(SU=="theme"){
  var curTheme = getVyaparTheme();
  h+='<div class="sub" style="margin-bottom:12px">Choose from the 3 themes inspired by the Vyapar app. Responsive for desktop, tablet, and mobile displays.</div>';
  h+='<div class="theme-switcher-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-bottom:14px">';
  VYAPAR_THEMES.forEach(function(th){
    var isAct = th.id === curTheme;
    h+='<div class="cust" style="cursor:pointer;padding:15px;margin:0;border:2px solid '+(isAct?'var(--theme-accent)':'var(--line)')+';background:var(--card);position:relative" onclick="setVyaparTheme(\''+th.id+'\')">'+
      '<div class="row" style="align-items:center;margin-bottom:6px">'+
        '<b style="font-size:16px;color:var(--ink)">'+esc(th.name)+'</b>'+
        '<span style="flex:none;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;'+(isAct?'background:var(--btn);color:var(--btnt)':'background:var(--line);color:var(--mute)')+'">'+(isAct?'Active':'Select')+'</span>'+
      '</div>'+
      '<div style="font-size:11px;font-weight:700;color:'+th.primary+';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">'+esc(th.badge)+'</div>'+
      '<div class="sub" style="font-size:12px;line-height:1.45;margin-bottom:12px">'+esc(th.desc)+'</div>'+
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">'+
        '<span style="font-size:11px;color:var(--mute);font-weight:600;margin-right:2px">Palette:</span>'+
        '<span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:'+th.primary+';border:1px solid rgba(0,0,0,0.1)" title="Primary Accent ('+th.primary+')"></span>'+
        '<span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:'+th.bg+';border:1px solid #cbd5e1" title="Canvas Background ('+th.bg+')"></span>'+
        '<span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:'+th.surface+';border:1px solid #cbd5e1" title="Card Surface ('+th.surface+')"></span>'+
        '<span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:'+th.due+';border:1px solid rgba(0,0,0,0.1)" title="Dues ('+th.due+')"></span>'+
        '<span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:'+th.ok+';border:1px solid rgba(0,0,0,0.1)" title="Tally / Settled ('+th.ok+')"></span>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:11px;color:var(--mute);margin-bottom:12px">'+
        '<span style="background:var(--theme-accent-soft);color:var(--theme-accent);padding:2px 6px;border-radius:4px;font-weight:600">Desktop</span>'+
        '<span style="background:var(--theme-accent-soft);color:var(--theme-accent);padding:2px 6px;border-radius:4px;font-weight:600">Tablet</span>'+
        '<span style="background:var(--theme-accent-soft);color:var(--theme-accent);padding:2px 6px;border-radius:4px;font-weight:600">Mobile</span>'+
      '</div>'+
      '<button style="width:100%;padding:9px" class="'+(isAct?'':'ghost')+'" onclick="event.stopPropagation();setVyaparTheme(\''+th.id+'\')">'+(isAct?'Current Theme':'Apply '+th.name)+'</button>'+
    '</div>';
  });
  h+='</div>';
}
else if(SU=="audit"){h+='<div class="sub">Every change is recorded here with who made it and when. Only the owner can see this.</div><label>Search<input id="aq" placeholder="Name, action or text" onchange="loadAudit()"></label><div id="al" style="margin-top:8px"></div>'}
else{h+='<div class="sub">Inactive customers are hidden from workers and invoices. Their ledger stays.</div>';if(!S.c.length)h+='<div class="empty">No credit customers yet.</div>';S.c.forEach(function(c){h+='<div class="row" style="margin-top:8px"><span>'+esc(c.name)+'</span><button class="'+(c.active===false?'ghost':'')+'" style="flex:none;padding:6px 10px" onclick="custTog('+c.id+')">'+(c.active===false?'Inactive':'Active')+'</button></div>'})}
A.innerHTML=h;if(SU=="audit")loadAudit();if(SU=="station")loadSetupPumps()}
function nozEdit(id){var n=id?S.nozzles.filter(function(x){return x.id==id})[0]:{name:"",fuel:fuelNames()[0],tank_id:"",active:true,open:""};
openM('<h2>'+(id?'Edit nozzle':'Add nozzle')+'</h2><label>Name<input id="n1" placeholder="e.g. Nozzle 1" value="'+esc(n.name)+'"></label><label>Fuel<select id="n2">'+fuelNames().map(function(f){return '<option'+(f==n.fuel?' selected':'')+'>'+f+'</option>'}).join("")+'</select></label><label>Tank<select id="n3"><option value="">No tank linked</option>'+S.tanks.map(function(t){return '<option value="'+t.id+'"'+(n.tank_id==t.id?' selected':'')+'>'+esc(t.name)+'</option>'}).join("")+'</select></label><label>Status<select id="n4"><option value="1"'+(n.active!==false?' selected':'')+'>Active</option><option value="0"'+(n.active===false?' selected':'')+'>Inactive</option></select></label><label>Opening reading for its first duty<input id="n5" inputmode="decimal" value="'+(n.open==null?"":n.open)+'"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveNoz('+id+')">Save nozzle</button></div>')}
function saveNoz(id){var nm=v("n1"),op=v("n5");if(!nm)return er("Enter a nozzle name.");if(op!==""&&isNaN(parseFloat(op)))return er("Opening reading must be a number.");
var o={name:nm,fuel:v("n2"),tank_id:v("n3"),active:v("n4")=="1",open:op===""?null:parseFloat(op)};if(id)Object.assign(S.nozzles.filter(function(x){return x.id==id})[0],o);else{o.id=Date.now();S.nozzles.push(o)}save();close();renderSetup()}
function saveOpen(){var vals=[];for(var i=0;i<S.nozzles.length;i++){var t=document.getElementById("op"+i).value.trim();if(t!==""&&(isNaN(parseFloat(t))||parseFloat(t)<0))return er("Check the reading for "+S.nozzles[i].name+".");vals.push(t===""?null:parseFloat(t))}vals.forEach(function(x,i){S.nozzles[i].open=x});save();er("Saved.");setTimeout(renderSetup,600)}
function rateAdd(f){openM('<h2>New rate for '+esc(f)+'</h2><label>Rate (\u20b9 per litre)<input id="r1" inputmode="decimal"></label><label>Applies from<input id="r2" type="date" value="'+bizToday()+'"></label><div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="ghost" onclick="close()">Cancel</button><button onclick="rateSave(\''+f.replace(/'/g,"\\'")+'\')">Save rate</button></div>')}
function rateSave(f){var r=parseFloat(v("r1")),d=v("r2");if(!(r>0))return er("Enter the rate.");if(!d)return er("Choose the start date.");S.rates.push({id:Date.now(),fuel:f,rate:r,from:d});save();close();renderSetup()}
function rateDel(id){ask("Delete this rate?",function(){S.rates=S.rates.filter(function(r){return r.id!=id});save();renderSetup()})}
function catAdd(){var c=v("nc");if(!c)return er("Enter a category name.");var l=cats().slice();if(l.indexOf(c)>=0)return er("That category already exists.");l.push(c);S.expcats=l;save();renderSetup()}
function catDel(i){var l=cats().slice();l.splice(i,1);if(!l.length)l=["Other"];S.expcats=l;save();renderSetup()}
function modeTog(i){var l=allModes().map(function(m){return Object.assign({},m)});if(l[i].key=="cash")return;l[i].active=l[i].active===false;S.paymodes=l;save();renderSetup()}
function modeAdd(){var nm=v("nm");if(!nm)return er("Enter a name.");var l=allModes().map(function(m){return Object.assign({},m)});if(l.some(function(m){return m.name.toLowerCase()==nm.toLowerCase()}))return er("That mode already exists.");l.push({key:"m"+Date.now(),name:nm,active:true});S.paymodes=l;save();renderSetup()}
function custTog(id){var c=find(id);c.active=c.active===false;save();renderSetup()}
var TK = null, DIP_NOTES = {}, DENS_FILTER = { tank_id: "" };
var TANK_VIEW = "stock"; // "stock" | "dens" | "overview"
var TANK_PRODUCT = ""; // "" for All Products, or fuel name (e.g. "Petrol (MS)", "Diesel (HSD)")
var TANK_FROM = "";
var TANK_TO = "";

function fld(v, dec) {
  if (v == null || v === "" || isNaN(+v)) return "";
  var n = +v;
  if (n < 2 && n > 0.4) n = n * 1000;
  return dec !== undefined ? n.toFixed(dec) : (Math.round(n * 10) / 10).toFixed(1);
}
function calcD15(obs, temp) {
  if (obs == null || isNaN(obs) || temp == null || isNaN(temp)) return "";
  var o = obs < 2 ? obs * 1000 : obs;
  var d15 = o + (temp - 15) * 0.89;
  return (Math.round(d15 * 10) / 10).toFixed(1);
}
function lt(n){return (Math.round(n*10)/10).toLocaleString("en-IN")+" L"}
function tdate(t){return new Date(t*1000).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
function getDatesInRange(fromStr, toStr) {
  var dates = [];
  if (!fromStr || !toStr) return dates;
  var d = fromStr;
  var count = 0;
  while (d <= toStr && count < 366) {
    dates.push(d);
    var dt = new Date(d + "T12:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + 1);
    d = dt.toISOString().slice(0, 10);
    count++;
  }
  return dates;
}
function fmtDateDMY(dStr) {
  if (!dStr) return "";
  var p = dStr.split('-');
  return p.length === 3 ? (parseInt(p[2], 10) + '/' + parseInt(p[1], 10) + '/' + p[0]) : dStr;
}
function toast(m){badge(m);setTimeout(function(){badge("")},4000)}
function getFuelRate(f, t) {
  var d = t ? new Date(t * 1000 - 216e5).toLocaleDateString("en-CA") : bizToday();
  var r = rateNow(f, d) || rateNow(f, bizToday());
  if (r && r.rate != null) return +r.rate;
  var latest = null;
  (S.rates || []).forEach(function(x) {
    if (x.fuel == f && (!latest || x.from > latest.from || (x.from == latest.from && x.id > latest.id))) latest = x;
  });
  return latest ? +latest.rate : null;
}
function renderTanks() {
  tab = "tanks";
  var A = document.getElementById("app");
  var wrap = document.querySelector(".wrap");
  if (wrap) wrap.classList.add("wide");

  if (TANK_VIEW === "all" || !TANK_VIEW) TANK_VIEW = "stock";

  if (!TANK_FROM) {
    var dt = new Date();
    dt.setDate(dt.getDate() - 15);
    TANK_FROM = dt.toISOString().slice(0, 10);
  }
  if (!TANK_TO) TANK_TO = today();

  Promise.all([api("GET", "/api/stock-check"), api("GET", "/api/density-register")]).then(function(RR) {
    var T = RR[0], DREG = RR[1];
    if (tab != "tanks") return;

    var tanksList = (DREG && DREG.tanks && DREG.tanks.length) ? DREG.tanks : ((T && T.length) ? T : (S.tanks || []));

    // Determine all active fuel products
    var allProds = fuelNames();
    var productSet = {};
    (allProds || []).forEach(function(f) { productSet[f] = true; });
    (tanksList || []).forEach(function(tk) { if (tk.fuel) productSet[tk.fuel] = true; });
    (DREG && DREG.rows ? DREG.rows : []).forEach(function(r) { if (r.fuel) productSet[r.fuel] = true; });
    var prodList = Object.keys(productSet);
    if (!prodList.length) prodList = ["Petrol (MS)", "Diesel (HSD)"];

    // Default to the first product if none selected or invalid
    if (!TANK_PRODUCT || prodList.indexOf(TANK_PRODUCT) < 0) {
      TANK_PRODUCT = prodList[0];
    }

    var h = nav();

    // Print Header
    h += '<div class="print-only" style="margin-bottom:14px;border-bottom:2px solid #000;padding-bottom:6px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div>' +
          '<h1 style="font-size:18px;margin:0;font-weight:800;color:#000">' + esc((S.meta && S.meta.pump_name) || (ME && ME.name) || "Petroleum Retail Outlet") + '</h1>' +
          '<div style="font-size:13px;font-weight:700;margin-top:2px;color:#333">' +
            (TANK_VIEW === 'dens' ? 'Daily Density Register (Statutory Standard)' : (TANK_VIEW === 'overview' ? 'Tank Levels & Deliveries' : 'Tanks Stock Check Register')) +
            ' &mdash; Product: ' + esc(TANK_PRODUCT) +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;font-size:11px;color:#333">' +
          '<div><b>Date Range:</b> ' + esc(TANK_FROM) + ' to ' + esc(TANK_TO) + '</div>' +
          '<div><b>Generated:</b> ' + new Date().toLocaleString("en-IN") + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    // Page Header & Action Buttons
    h += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:8px">' +
      '<div>' +
        '<h1 style="font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-0.5px;margin:0">Tanks Stock Check & Daily Density Register</h1>' +
        '<div class="sub" style="margin-top:3px">Statutory stock audit, meter vs dip variation, and daily 15&deg;C density decantation register</div>' +
      '</div>' +
      '<div class="btns noprint" style="margin:0">' +
        '<button onclick="densRegisterForm()">+ Record Density Check</button>' +
        '<button onclick="dipForm()">+ Add Dip Reading</button>' +
        '<button onclick="delivForm()">+ Fuel Delivery</button>' +
        '<button class="ghost" onclick="tankForm()">Tanks Setup</button>' +
        '<button class="ghost" onclick="window.print()" style="display:inline-flex;align-items:center;gap:5px">🖨️ Print Register</button>' +
      '</div>' +
    '</div>';

    // View Tabs (Tanks Stock Check, Daily Density Register, Tank Levels & Deliveries)
    h += '<div class="noprint" style="display:flex;gap:8px;margin:12px 0 10px;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;align-items:center">' +
      '<button class="' + (TANK_VIEW === 'stock' ? '' : 'ghost') + '" onclick="TANK_VIEW=\'stock\';renderTanks()" style="font-size:12.5px;padding:6px 14px;border-radius:20px;font-weight:700">⛽ Tanks Stock Check</button>' +
      '<button class="' + (TANK_VIEW === 'dens' ? '' : 'ghost') + '" onclick="TANK_VIEW=\'dens\';renderTanks()" style="font-size:12.5px;padding:6px 14px;border-radius:20px;font-weight:700">🧪 Daily Density Register</button>' +
      '<button class="' + (TANK_VIEW === 'overview' ? '' : 'ghost') + '" onclick="TANK_VIEW=\'overview\';renderTanks()" style="font-size:12.5px;padding:6px 14px;border-radius:20px;font-weight:700">🛢️ Tank Levels & Deliveries</button>' +
    '</div>';

    // Product Pills Bar (Quick Product-Wise Switching - specific products only)
    h += '<div class="noprint" style="display:flex;align-items:center;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px;flex-wrap:wrap">' +
      '<span style="font-size:12px;font-weight:700;color:var(--mute);margin-right:2px;white-space:nowrap">Product:</span>' +
      prodList.map(function(pn) {
        var icon = (pn.toLowerCase().indexOf('petrol') >= 0 || pn.toLowerCase().indexOf('ms') >= 0) ? '⛽' : '🛢️';
        return '<button class="' + (TANK_PRODUCT === pn ? '' : 'ghost') + '" onclick="TANK_PRODUCT=\'' + esc(pn) + '\';DENS_FILTER.tank_id=\'\';renderTanks()" style="font-size:12px;padding:5px 14px;border-radius:16px;font-weight:700">' + icon + ' ' + esc(pn) + '</button>';
      }).join('') +
    '</div>';

    // Date Range Selector Toolbar (with From Date, To Date, Quick presets, and Print button)
    h += '<div class="row noprint" style="align-items:flex-end;gap:8px;margin-bottom:14px;background:var(--card);padding:10px 14px;border-radius:10px;border:1px solid var(--line);flex-wrap:wrap">' +
      '<label style="margin:0">From Date<input type="date" value="' + TANK_FROM + '" onchange="TANK_FROM=this.value;renderTanks()"></label>' +
      '<label style="margin:0">To Date<input type="date" value="' + TANK_TO + '" onchange="TANK_TO=this.value;renderTanks()"></label>' +
      '<button class="ghost" style="padding:7px 12px" onclick="var d=new Date();d.setDate(d.getDate()-7);TANK_FROM=d.toISOString().slice(0,10);TANK_TO=today();renderTanks()">Last 7 Days</button>' +
      '<button class="ghost" style="padding:7px 12px" onclick="var d=new Date();d.setDate(d.getDate()-15);TANK_FROM=d.toISOString().slice(0,10);TANK_TO=today();renderTanks()">Last 15 Days</button>' +
      '<button class="ghost" style="padding:7px 12px" onclick="var d=new Date();d.setDate(1);TANK_FROM=d.toISOString().slice(0,10);TANK_TO=today();renderTanks()">This Month</button>' +
      '<button class="ghost" style="padding:7px 12px" onclick="var d=new Date();d.setMonth(d.getMonth()-1);d.setDate(1);var end=new Date(d.getFullYear(),d.getMonth()+1,0);TANK_FROM=d.toISOString().slice(0,10);TANK_TO=end.toISOString().slice(0,10);renderTanks()">Last Month</button>' +
      '<button class="ghost" style="margin-left:auto;padding:7px 12px;display:inline-flex;align-items:center;gap:5px" onclick="window.print()">🖨️ Print Register</button>' +
    '</div>';

    // Formula Rule Banner
    if (TANK_VIEW === 'stock') {
      h += '<div style="font-size:12px;color:var(--ink);background:var(--card);padding:10px 14px;border-radius:10px;border:1px solid var(--line);font-family:monospace;line-height:1.5;margin-bottom:16px">' +
        '<b>Tanks Stock Check Statutory Formula:</b> ' +
        '<b>Total Stock</b> = Opening Stock (Dip) + Receipts &bull; ' +
        '<span style="color:var(--btn);font-weight:700">Net Sales</span> = Meter Sales &minus; Pump Testing &bull; ' +
        '<span style="color:var(--ok);font-weight:700">Sales by Dip</span> = Total Stock &minus; Tomorrow Opening (Next Dip) &bull; ' +
        '<span style="color:var(--due);font-weight:700">Daily Variations</span> = Net Meter Sales &minus; Sales by Dip &bull; ' +
        '<b>Cumulative</b> = Monthly Running Totals' +
      '</div>';
    } else if (TANK_VIEW === 'dens') {
      h += '<div style="font-size:12px;color:var(--ink);background:var(--card);padding:10px 14px;border-radius:10px;border:1px solid var(--line);font-family:monospace;line-height:1.5;margin-bottom:16px">' +
        '<b>Daily Density Register Statutory Formula:</b> ' +
        '<b>Morning U/G Density @ 15&deg;C</b> = Standardized density via ASTM 53B petroleum temperature reduction &bull; ' +
        '<b>Mix Density</b> = Avg(I, II, III, IV) Tanker Compartments &bull; ' +
        '<span style="color:var(--due);font-weight:700">Dif in Density</span> = Mix &minus; Challan (&le; 3.0 kg/m&sup3;) &bull; ' +
        '<span style="color:var(--ok);font-weight:700">Decantation Check</span> = Density @ 15&deg;C verified after unloading and 100 L nozzle dispensing flush' +
      '</div>';
    }

    if (!T.length) h += '<div class="empty">No tanks yet. Tap Tanks setup to add your tanks.</div>';

    // In Overview, show tank level cards
    if (TANK_VIEW === 'overview') {
      T.forEach(function(t) {
        if (TANK_PRODUCT && t.fuel !== TANK_PRODUCT) return;
        if (DENS_FILTER.tank_id && String(t.id) !== String(DENS_FILTER.tank_id)) return;
        var pc = t.capacity && t.book != null ? Math.max(0, Math.min(100, t.book / t.capacity * 100)) : 0;
        h += '<div class="cust" style="cursor:default;margin-top:10px">' +
          '<div class="row"><b>' + esc(t.name) + ' \u00b7 ' + esc(t.fuel) + '</b><span class="amt" style="flex:none">' + (t.book != null ? lt(t.book) : 'No dip yet') + '</span></div>' +
          '<div class="sub">' + (t.last ? 'Last recorded dip: <b>' + lt(t.last.litres) + '</b>' + (t.last.dip != null ? ' (' + t.last.dip + ' cm)' : '') + ' on ' + tdate(t.last.t) + (t.last.by ? ' by ' + esc(t.last.by) : '') : 'Add a dip reading to start tracking stock') + '</div>' +
          (t.capacity && t.book != null ? '<div class="bar"><i style="width:' + pc + '%"></i></div><div class="sub" style="margin-top:4px">' + Math.round(pc) + '% of ' + lt(t.capacity) + ' capacity (current calculated book stock)</div>' : '') +
        '</div>';
      });
    }

    // In Stock, show Tanks Stock Check organized Product-wise
    if (TANK_VIEW === 'stock') {
      var prodsToRender = TANK_PRODUCT ? [TANK_PRODUCT] : prodList;
      var anyStockRendered = false;

      prodsToRender.forEach(function(fName) {
        var pTanks = T.filter(function(t) { return t.fuel === fName; });
        if (DENS_FILTER.tank_id) {
          pTanks = pTanks.filter(function(t) { return String(t.id) === String(DENS_FILTER.tank_id); });
        }
        if (!pTanks.length) {
          if (TANK_PRODUCT === fName) {
            h += '<div class="empty" style="margin:20px 0;padding:24px">No tanks found for product <b>' + esc(fName) + '</b>. Configure tanks in Tanks Setup.</div>';
          }
          return;
        }

        anyStockRendered = true;
        var fRate = getFuelRate(fName, null);
        var fIcon = (fName.toLowerCase().indexOf('petrol') >= 0 || fName.toLowerCase().indexOf('ms') >= 0) ? '⛽' : '🛢️';

        // Product Section Banner
        h += '<div style="margin:28px 0 12px;padding:12px 16px;background:var(--card);border-left:4px solid var(--theme-accent);border-radius:0 10px 10px 0;border-top:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
          '<div>' +
            '<div style="display:flex;align-items:center;gap:8px">' +
              '<span style="font-size:20px">' + fIcon + '</span>' +
              '<h2 style="margin:0;font-size:18px;font-weight:800;color:var(--ink)">Product: ' + esc(fName) + ' &mdash; Stock Check</h2>' +
              '<span style="background:var(--theme-accent-soft);color:var(--theme-accent);font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px">' + pTanks.length + ' Tank' + (pTanks.length === 1 ? '' : 's') + '</span>' +
            '</div>' +
            '<div class="sub" style="margin-top:3px">Assigned Tanks: ' + pTanks.map(function(t){ return '<b>' + esc(t.name) + '</b> (' + (t.capacity ? lt(t.capacity) : 'No cap') + ')'; }).join(', ') + ' &bull; Period: ' + esc(TANK_FROM) + ' to ' + esc(TANK_TO) + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            (fRate ? '<div style="font-size:12px;color:var(--ink);background:rgba(37,99,235,0.08);padding:5px 12px;border-radius:6px;font-weight:700">Selling Rate: ' + m2(fRate) + '/L</div>' : '') +
          '</div>' +
        '</div>';

        var prodTotGross = 0, prodTotTest = 0, prodTotNet = 0, prodTotRecv = 0, prodTotDip = 0, prodTotVar = 0, prodCheckCount = 0;

        pTanks.forEach(function(t) {
          var allChecks = t.checks || [];
          var byMonthSales = {}, byMonthVar = {};
          var ascChecks = allChecks.slice().sort(function(a, b) { return a.to - b.to; });
          ascChecks.forEach(function(c) {
            var mKey = (c.d ? c.d.slice(0, 7) : new Date(c.to * 1000 - 216e5).toLocaleDateString("en-CA").slice(0, 7));
            var nSales = (c.net_meter_sales != null ? c.net_meter_sales : (c.sold || 0));
            var totStock = c.total_stock != null ? c.total_stock : Math.round(((c.opening || 0) + (c.received || 0)) * 100) / 100;
            var dipSales = (c.sales_by_dip != null ? c.sales_by_dip : Math.round((totStock - (c.actual || 0)) * 100) / 100);
            var diff = (c.diff != null ? c.diff : (nSales - dipSales));
            byMonthSales[mKey] = Math.round(((byMonthSales[mKey] || 0) + nSales) * 100) / 100;
            byMonthVar[mKey] = Math.round(((byMonthVar[mKey] || 0) + diff) * 100) / 100;
            if (c.cumulative_sales == null) c.cumulative_sales = byMonthSales[mKey];
            if (c.cumulative_variation == null) c.cumulative_variation = byMonthVar[mKey];
          });

          // Filter checks by date range TANK_FROM and TANK_TO
          var filteredChecks = allChecks.filter(function(c) {
            var rowDate = c.d || (c.to ? new Date(c.to * 1000 - 216e5).toLocaleDateString("en-CA") : "");
            if (TANK_FROM && rowDate < TANK_FROM) return false;
            if (TANK_TO && rowDate > TANK_TO) return false;
            return true;
          });

          var datesList = getDatesInRange(TANK_FROM, TANK_TO).reverse();
          if (!datesList.length && filteredChecks.length) {
            datesList = [today()];
          }

          var checksByDate = {};
          filteredChecks.forEach(function(c) {
            var cd = c.d || (c.to ? new Date(c.to * 1000 - 216e5).toLocaleDateString("en-CA") : "");
            if (cd) { (checksByDate[cd] = checksByDate[cd] || []).push(c); }
          });

          h += '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin:18px 0 8px;flex-wrap:wrap;gap:10px">' +
            '<div>' +
              '<h3 style="margin:0;color:var(--ink);font-size:16px;font-weight:800">' + esc(t.name) + ' &middot; <span style="font-weight:600;color:var(--mute)">' + esc(t.fuel) + '</span></h3>' +
              '<div class="sub" style="margin-top:2px">Audit of meter sales vs physical tank depletion &bull; ' + filteredChecks.length + ' of ' + datesList.length + ' days recorded in range</div>' +
            '</div>' +
            '<div class="noprint">' +
              '<button class="ghost" style="font-size:12px;padding:5px 12px" onclick="dipForm(' + t.id + ')">+ Add Dip Reading</button>' +
            '</div>' +
          '</div>';

          h += '<div class="tbl" style="margin-bottom:20px;overflow-x:auto"><table style="min-width:1180px">' +
            '<thead>' +
              '<tr style="background:rgba(0,0,0,0.02)">' +
                '<th style="white-space:nowrap;padding:10px">Dip Period / Time</th>' +
                '<th class="r" style="white-space:nowrap;padding:10px">Opening Stock<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Dip Reading</span></th>' +
                '<th class="r" style="white-space:nowrap;padding:10px">Receipts<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Deliveries</span></th>' +
                '<th class="r" style="white-space:nowrap;padding:10px;background:rgba(0,0,0,0.02)">Total Stock<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Opening + Receipts</span></th>' +
                '<th class="r" style="white-space:nowrap;padding:10px">Sales by Meter<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Gross Meter</span></th>' +
                '<th class="r" style="white-space:nowrap;padding:10px">Pump Test<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Testing</span></th>' +
                '<th class="r" style="white-space:nowrap;padding:10px;background:rgba(37,99,235,0.08);color:var(--ink)">Net Sales by Meter<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Meter &minus; Test</span></th>' +
                '<th class="r" style="white-space:nowrap;padding:10px;background:rgba(37,99,235,0.04);color:var(--ink)">Cumulative Sale<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Month Running Total</span></th>' +
                '<th class="r" style="white-space:nowrap;padding:10px;background:rgba(16,185,129,0.08);color:var(--ink)">Sales by Dip<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Total Stock &minus; Next Dip</span></th>' +
                '<th class="r" style="white-space:nowrap;padding:10px;font-weight:800">Daily Variations<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Meter &minus; Dip</span></th>' +
                '<th class="r" style="white-space:nowrap;padding:10px;font-weight:800;background:rgba(0,0,0,0.03)">Cumulative Variation<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Month Running Diff</span></th>' +
                '<th class="r" style="white-space:nowrap;padding:10px">Remarks<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Product Rate</span></th>' +
                '<th class="noprint" style="text-align:center;width:65px;padding:10px">Action</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>';

          var totGross = 0, totTest = 0, totNet = 0, totRecv = 0, totDipSales = 0, totVar = 0;
          var renderedCheckIds = {};

          datesList.forEach(function(dStr) {
            var dayChecks = checksByDate[dStr];
            if (dayChecks && dayChecks.length) {
              dayChecks.forEach(function(c) {
                renderedCheckIds[c.id] = true;
                DIP_NOTES[c.id] = c.note || "";
                var nSales = (c.net_meter_sales != null ? c.net_meter_sales : (c.sold || 0));
                var gSales = (c.meter_sales != null ? c.meter_sales : (nSales + (c.pump_test || 0)));
                var pTest = (c.pump_test != null ? c.pump_test : 0);
                var totStock = c.total_stock != null ? c.total_stock : Math.round(((c.opening || 0) + (c.received || 0)) * 100) / 100;
                var dipSales = (c.sales_by_dip != null ? c.sales_by_dip : Math.round((totStock - (c.actual || 0)) * 100) / 100);
                var diff = (c.diff != null ? c.diff : (nSales - dipSales));
                var prRate = c.rate != null ? c.rate : getFuelRate(t.fuel, c.to);

                totGross += gSales;
                totTest += pTest;
                totNet += nSales;
                totRecv += (c.received || 0);
                totDipSales += dipSales;
                totVar += diff;

                prodTotGross += gSales;
                prodTotTest += pTest;
                prodTotNet += nSales;
                prodTotRecv += (c.received || 0);
                prodTotDip += dipSales;
                prodTotVar += diff;
                prodCheckCount++;

                var cumSales = c.cumulative_sales != null ? c.cumulative_sales : 0;
                var cumVar = c.cumulative_variation != null ? c.cumulative_variation : 0;

                var bad = Math.abs(diff) > Math.max(5, (gSales || 0) * 0.005);
                var diffSign = diff > 0 ? '+' : (diff < 0 ? '\u2212' : '');
                var diffAbs = Math.abs(diff);

                var badCum = Math.abs(cumVar) > Math.max(10, (cumSales || 0) * 0.005);
                var cumSign = cumVar > 0 ? '+' : (cumVar < 0 ? '\u2212' : '');
                var cumAbs = Math.abs(cumVar);

                h += '<tr>' +
                  '<td style="vertical-align:middle;padding:10px">' +
                    '<span style="font-weight:700;color:var(--ink)">' + tdate(c.to) + '</span>' +
                    '<div class="sub" style="font-size:11px;margin-top:2px">' + (c.from ? 'from ' + tdate(c.from) : '') + (c.by ? ' &bull; ' + esc(c.by) : '') + '</div>' +
                  '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums"><span style="font-weight:700">' + lt(c.opening) + '</span>' + (c.opening_dip != null ? '<div class="sub" style="font-size:11px;color:var(--mute)">' + c.opening_dip + ' cm</div>' : '') + '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (c.received > 0 ? '<span style="color:var(--ok);font-weight:700">+' + lt(c.received) + '</span>' : '<span style="color:var(--mute)">&mdash;</span>') + '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(0,0,0,0.015);font-weight:700">' + lt(totStock) + '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + lt(gSales) + '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (pTest > 0 ? '<span style="color:var(--mute)">' + lt(pTest) + '</span>' : '<span style="color:var(--mute)">0.0 L</span>') + '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(37,99,235,0.06);font-weight:800;color:var(--ink)">' + lt(nSales) + '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(37,99,235,0.03);font-weight:700;color:var(--ink)">' + lt(cumSales) + '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(16,185,129,0.06);font-weight:800;color:var(--ink)">' + lt(dipSales) + '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;font-weight:800;font-size:15px;color:' + (bad ? 'var(--due)' : 'var(--ok)') + '">' + (diff == 0 ? '0.0 L' : diffSign + lt(diffAbs)) + '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;font-weight:800;font-size:14px;background:rgba(0,0,0,0.02);color:' + (badCum ? 'var(--due)' : 'var(--ok)') + '">' + (cumVar == 0 ? '0.0 L' : cumSign + lt(cumAbs)) + '</td>' +
                  '<td class="r" style="vertical-align:middle;padding:10px;font-size:13px;font-variant-numeric:tabular-nums">' +
                    (prRate != null ? '<span style="font-weight:700;color:var(--ink);background:rgba(37,99,235,0.08);padding:2px 8px;border-radius:4px;font-size:12px;display:inline-block">' + m2(prRate) + '/L</span>' : '<span style="color:var(--mute);font-size:11.5px;font-style:italic">No rate set</span>') +
                  '</td>' +
                  '<td class="noprint" style="vertical-align:middle;text-align:center;padding:10px"><button class="ghost" style="padding:4px 8px;font-size:12px" title="Delete dip reading" onclick="delDip(' + c.id + ')">Delete</button></td>' +
                '</tr>';
              });
            } else {
              // Blank record row for dates with no dip recorded
              h += '<tr style="opacity:0.75;background:rgba(0,0,0,0.01)">' +
                '<td style="vertical-align:middle;padding:10px;white-space:nowrap">' +
                  '<span style="font-weight:700;color:var(--ink)">' + fmtDateDMY(dStr) + '</span>' +
                  '<div class="sub" style="font-size:11px;margin-top:2px;color:var(--mute)">Not recorded</div>' +
                '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
                '<td class="noprint" style="vertical-align:middle;text-align:center;padding:10px">' +
                  '<button class="ghost" style="padding:3px 8px;font-size:11px;color:var(--btn)" onclick="dipForm(' + t.id + ')">+ Add Dip</button>' +
                '</td>' +
              '</tr>';
            }
          });

          // Any checks in filteredChecks not in datesList (edge case)
          filteredChecks.forEach(function(c) {
            if (renderedCheckIds[c.id]) return;
            DIP_NOTES[c.id] = c.note || "";
            var nSales = (c.net_meter_sales != null ? c.net_meter_sales : (c.sold || 0));
            var gSales = (c.meter_sales != null ? c.meter_sales : (nSales + (c.pump_test || 0)));
            var pTest = (c.pump_test != null ? c.pump_test : 0);
            var totStock = c.total_stock != null ? c.total_stock : Math.round(((c.opening || 0) + (c.received || 0)) * 100) / 100;
            var dipSales = (c.sales_by_dip != null ? c.sales_by_dip : Math.round((totStock - (c.actual || 0)) * 100) / 100);
            var diff = (c.diff != null ? c.diff : (nSales - dipSales));
            var prRate = c.rate != null ? c.rate : getFuelRate(t.fuel, c.to);

            totGross += gSales;
            totTest += pTest;
            totNet += nSales;
            totRecv += (c.received || 0);
            totDipSales += dipSales;
            totVar += diff;

            prodTotGross += gSales;
            prodTotTest += pTest;
            prodTotNet += nSales;
            prodTotRecv += (c.received || 0);
            prodTotDip += dipSales;
            prodTotVar += diff;
            prodCheckCount++;

            var cumSales = c.cumulative_sales != null ? c.cumulative_sales : 0;
            var cumVar = c.cumulative_variation != null ? c.cumulative_variation : 0;
            var bad = Math.abs(diff) > Math.max(5, (gSales || 0) * 0.005);
            var diffSign = diff > 0 ? '+' : (diff < 0 ? '\u2212' : '');
            var diffAbs = Math.abs(diff);
            var badCum = Math.abs(cumVar) > Math.max(10, (cumSales || 0) * 0.005);
            var cumSign = cumVar > 0 ? '+' : (cumVar < 0 ? '\u2212' : '');
            var cumAbs = Math.abs(cumVar);

            h += '<tr>' +
              '<td style="vertical-align:middle;padding:10px">' +
                '<span style="font-weight:700;color:var(--ink)">' + tdate(c.to) + '</span>' +
                '<div class="sub" style="font-size:11px;margin-top:2px">' + (c.from ? 'from ' + tdate(c.from) : '') + (c.by ? ' &bull; ' + esc(c.by) : '') + '</div>' +
              '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums"><span style="font-weight:700">' + lt(c.opening) + '</span>' + (c.opening_dip != null ? '<div class="sub" style="font-size:11px;color:var(--mute)">' + c.opening_dip + ' cm</div>' : '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (c.received > 0 ? '<span style="color:var(--ok);font-weight:700">+' + lt(c.received) + '</span>' : '<span style="color:var(--mute)">&mdash;</span>') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(0,0,0,0.015);font-weight:700">' + lt(totStock) + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + lt(gSales) + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (pTest > 0 ? '<span style="color:var(--mute)">' + lt(pTest) + '</span>' : '<span style="color:var(--mute)">0.0 L</span>') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(37,99,235,0.06);font-weight:800;color:var(--ink)">' + lt(nSales) + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(37,99,235,0.03);font-weight:700;color:var(--ink)">' + lt(cumSales) + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(16,185,129,0.06);font-weight:800;color:var(--ink)">' + lt(dipSales) + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;font-weight:800;font-size:15px;color:' + (bad ? 'var(--due)' : 'var(--ok)') + '">' + (diff == 0 ? '0.0 L' : diffSign + lt(diffAbs)) + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;font-weight:800;font-size:14px;background:rgba(0,0,0,0.02);color:' + (badCum ? 'var(--due)' : 'var(--ok)') + '">' + (cumVar == 0 ? '0.0 L' : cumSign + lt(cumAbs)) + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-size:13px;font-variant-numeric:tabular-nums">' +
                (prRate != null ? '<span style="font-weight:700;color:var(--ink);background:rgba(37,99,235,0.08);padding:2px 8px;border-radius:4px;font-size:12px;display:inline-block">' + m2(prRate) + '/L</span>' : '<span style="color:var(--mute);font-size:11.5px;font-style:italic">No rate set</span>') +
              '</td>' +
              '<td class="noprint" style="vertical-align:middle;text-align:center;padding:10px"><button class="ghost" style="padding:4px 8px;font-size:12px" title="Delete dip reading" onclick="delDip(' + c.id + ')">Delete</button></td>' +
            '</tr>';
          });

            // Tank summary totals footer
            var totBad = Math.abs(totVar) > Math.max(5, (totGross || 0) * 0.005);
            h += '<tfoot>' +
              '<tr style="background:rgba(0,0,0,0.035);font-weight:800;border-top:2px solid var(--line)">' +
                '<td style="padding:10px">' + esc(t.name) + ' Totals (' + filteredChecks.length + ' checks)</td>' +
                '<td class="r" style="padding:10px">&mdash;</td>' +
                '<td class="r" style="padding:10px;color:var(--ok)">' + (totRecv > 0 ? '+' + lt(totRecv) : '&mdash;') + '</td>' +
                '<td class="r" style="padding:10px">&mdash;</td>' +
                '<td class="r" style="padding:10px">' + lt(totGross) + '</td>' +
                '<td class="r" style="padding:10px;color:var(--mute)">' + lt(totTest) + '</td>' +
                '<td class="r" style="padding:10px;color:var(--ink);background:rgba(37,99,235,0.08)">' + lt(totNet) + '</td>' +
                '<td class="r" style="padding:10px">&mdash;</td>' +
                '<td class="r" style="padding:10px;color:var(--ink);background:rgba(16,185,129,0.08)">' + lt(totDipSales) + '</td>' +
                '<td class="r" style="padding:10px;font-size:14px;color:' + (totBad ? 'var(--due)' : 'var(--ok)') + '">' + (totVar == 0 ? '0.0 L' : (totVar > 0 ? '+' : '\u2212') + lt(Math.abs(totVar))) + '</td>' +
                '<td class="r" style="padding:10px">&mdash;</td>' +
                '<td class="r" style="padding:10px">&mdash;</td>' +
                '<td class="noprint" style="padding:10px">&mdash;</td>' +
              '</tr>' +
            '</tfoot>';
          }

          h += '</tbody></table></div>';
        });

        // If product has multiple tanks, show Consolidated Product Totals
        if (pTanks.length > 1) {
          var pBad = Math.abs(prodTotVar) > Math.max(5, (prodTotGross || 0) * 0.005);
          h += '<div style="margin:-10px 0 24px;padding:12px 16px;background:rgba(37,99,235,0.04);border:1px solid rgba(37,99,235,0.15);border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
            '<div>' +
              '<b style="color:var(--ink);font-size:13.5px">' + fIcon + ' ' + esc(fName) + ' Consolidated Product Total:</b> ' +
              '<span class="sub" style="font-size:12px"> Across ' + pTanks.length + ' tanks (' + prodCheckCount + ' checks)</span>' +
            '</div>' +
            '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px;font-variant-numeric:tabular-nums">' +
              '<div>Receipts: <b style="color:var(--ok)">+' + lt(prodTotRecv) + '</b></div>' +
              '<div>Gross: <b style="color:var(--ink)">' + lt(prodTotGross) + '</b></div>' +
              '<div>Pump Test: <b style="color:var(--mute)">' + lt(prodTotTest) + '</b></div>' +
              '<div>Net Sales: <b style="color:var(--ink);background:rgba(37,99,235,0.08);padding:2px 6px;border-radius:4px">' + lt(prodTotNet) + '</b></div>' +
              '<div>Sales by Dip: <b style="color:var(--ink);background:rgba(16,185,129,0.08);padding:2px 6px;border-radius:4px">' + lt(prodTotDip) + '</b></div>' +
              '<div>Net Variation: <b style="color:' + (pBad ? 'var(--due)' : 'var(--ok)') + '">' + (prodTotVar == 0 ? '0.0 L' : (prodTotVar > 0 ? '+' : '\u2212') + lt(Math.abs(prodTotVar))) + '</b></div>' +
            '</div>' +
          '</div>';
        }
      });

      if (!anyStockRendered) {
        h += '<div class="empty">No stock checks matching the selected product or date range.</div>';
      }
    }

    // In Density, show Daily Density Register (Product-wise)
    if (TANK_VIEW === 'dens') {
      h += densHtml(DREG, prodList);
    }

    // In Overview, show Recent Deliveries
    if (TANK_VIEW === 'overview') {
      var dv = S.deliv.slice().reverse().slice(0, 10);
      if (dv.length) {
        h += '<h1 style="margin:24px 0 8px;color:var(--ink);font-size:17px;font-weight:800">Recent deliveries</h1>';
        dv.forEach(function(d) {
          var s = sfind(d.sup), tot = d.lines.reduce(function(a, l) { return a + l.litres; }, 0);
          h += '<div class="cust" style="cursor:default"><div class="row"><b>' + d.d + ' \u00b7 ' + lt(tot) + '</b><span class="amt" style="flex:none">' + inr(d.amount) + '</span></div><div class="sub">' + esc(s ? s.name : "Supplier") + (d.billno ? ' \u00b7 Bill ' + esc(d.billno) : '') + ' \u00b7 ' + d.lines.map(function(l) { var k = S.tanks.filter(function(x) { return x.id == l.tank_id; })[0]; return esc(k ? k.name : "Tank") + ' ' + lt(l.litres) + (l.amount ? ' (' + inr(l.amount) + ')' : ''); }).join(", ") + '</div><div class="btns noprint" style="margin:8px 0 0"><button class="ghost" style="padding:5px 10px" onclick="delDeliv(' + d.id + ')">Delete</button></div></div>';
        });
      }
    }

    A.innerHTML = h;
  }).catch(function(e) { badge(e.error || "Could not load tank stock."); });
}
function dipFields(tanks, preTankId){return '<label>Tank<select id="t1"><option value="">Choose tank</option>'+tanks.map(function(t){return '<option value="'+t.id+'"'+(preTankId&&String(preTankId)===String(t.id)?' selected':'')+'>'+esc(t.name)+' ('+esc(t.fuel)+')</option>'}).join("")+'</select></label><label>Litres (from the dip chart)<input id="t2" inputmode="decimal"></label><div class="sub" style="margin-top:8px">or</div><label>Dip reading (same unit as your dip chart)<input id="t3" inputmode="decimal"></label><div class="sub" style="margin-top:10px">Density check (optional)</div><div class="row"><label>Measured<input id="td1" inputmode="decimal" placeholder="0.745"></label><label>Temp \u00b0C<input id="td2" inputmode="decimal"></label><label>At 15 \u00b0C<input id="td3" inputmode="decimal" placeholder="0.748"></label></div><label>Note (optional)<input id="t4"></label><div class="err" id="er"></div>'}
function postDip(done){var b={tank_id:v("t1"),litres:v("t2"),dip:v("t3"),dens_obs:v("td1"),temp:v("td2"),d15:v("td3"),note:v("t4")};if(!b.tank_id)return er("Choose a tank.");if(!b.litres&&!b.dip)return er("Enter the litres or the dip reading.");api("POST","/api/dips",b).then(function(){done()}).catch(function(e){er(e.error||"Could not save. Check your connection.")})}
function dipForm(preTankId){if(!S.tanks.length)return toast("Add your tanks first (Tanks setup).");openM('<h2>Dip reading</h2>'+dipFields(S.tanks, preTankId)+'<div class="row" style="margin-top:12px"><button class="ghost" onclick="close()">Cancel</button><button onclick="postDip(function(){close();renderTanks()})">Save reading</button></div>')}
function delDip(id){ask("Delete this dip reading? The stock checks will be recalculated.",function(){api("DELETE","/api/dips/"+id).then(renderTanks).catch(function(e){badge(e.error||"Could not delete.")})})}
function editRemark(id){var cur=DIP_NOTES[id]||"";openM('<h2>Stock check remark</h2><div class="sub">Add or update remark for this dip reading interval.</div><label>Remark / Note<input id="rem_val" value="'+esc(cur)+'" placeholder="e.g. Tanker delivery, calibration, temperature shift" maxlength="200"></label><div class="err" id="er"></div><div class="row" style="margin-top:14px"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveRemark('+id+')">Save remark</button></div>');setTimeout(function(){var el=document.getElementById("rem_val");if(el)el.focus()},100)}
function saveRemark(id){var note=v("rem_val");api("PUT","/api/dips/"+id+"/note",{note:note}).then(function(){close();renderTanks()}).catch(function(e){er(e.error||"Could not save remark.")})}
function loadDip(){api("GET","/api/tanks").then(function(r){TK=r;renderWDip()}).catch(function(e){document.getElementById("app").innerHTML=ubar()+wnav()+'<div class="empty">Could not load. '+esc(e.error||"Check your connection.")+'</div>'})}
function renderWDip(){var h=ubar()+wnav()+'<h1>Tank dip reading</h1>';
if(!TK.tanks.length)h+='<div class="empty">No tanks are set up yet. Ask the manager.</div>';else h+=dipFields(TK.tanks)+'<button style="width:100%;margin-top:12px" onclick="postDip(loadDip)">Save reading</button>';
h+='<h1 style="margin-top:22px">My recent readings</h1>';if(!TK.mine.length)h+='<div class="empty">No readings yet.</div>';
TK.mine.forEach(function(d){h+='<div class="cust" style="cursor:default"><div class="row"><b>'+esc(d.tank)+'</b><span class="amt" style="flex:none">'+lt(d.litres)+'</span></div><div class="sub">'+tdate(d.t)+(d.dip!=null?' \u00b7 Dip '+d.dip:'')+(d.d15!=null?' \u00b7 Density@15 '+d.d15:d.dens_obs!=null?' \u00b7 Density '+d.dens_obs:'')+(d.note?' \u00b7 '+esc(d.note):'')+'</div></div>'});
document.getElementById("app").innerHTML=h}
function tankForm(){openM('<h2>Tanks</h2><div class="sub">Dip readings are tracked per tank.</div>'+S.tanks.map(function(t){return '<div class="row" style="margin-top:10px"><span>'+esc(t.name)+'<div class="sub">'+esc(t.fuel)+(t.capacity?' \u00b7 '+lt(t.capacity):'')+(t.chart&&t.chart.length>1?' \u00b7 dip chart set':' \u00b7 no dip chart')+'</div></span><button class="ghost" style="flex:none;padding:6px 10px" onclick="tankEdit('+t.id+')">Edit</button></div>'}).join("")+'<div class="row" style="margin-top:14px"><button class="ghost" onclick="close();renderTanks()">Close</button><button onclick="tankEdit(0)">Add tank</button></div>')}
function tankEdit(id){var t=id?S.tanks.filter(function(x){return x.id==id})[0]:{name:"",fuel:fuelNames()[0],capacity:"",chart:[]};
openM('<h2>'+(id?'Edit tank':'Add tank')+'</h2><label>Name<input id="k1" placeholder="e.g. Tank 1" value="'+esc(t.name)+'"></label><label>Fuel<select id="k2">'+fuelNames().map(function(f){return '<option'+(f==t.fuel?' selected':'')+'>'+f+'</option>'}).join("")+'</select></label><label>Capacity (litres)<input id="k3" inputmode="decimal" value="'+esc(t.capacity)+'"></label><label>Dip chart (optional): one line per reading, as dip, litres<textarea id="k4" placeholder="10, 500&#10;20, 1100&#10;30, 1800" style="width:100%;height:120px;font:13px monospace;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);padding:8px;margin-top:4px">'+esc((t.chart||[]).map(function(c){return c.cm+", "+c.l}).join("\n"))+'</textarea></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="tankForm()">Cancel</button><button onclick="saveTank('+id+')">Save tank</button></div>')}
function saveTank(id){var nm=v("k1"),cap=parseFloat(v("k3")),ch=[],ls=document.getElementById("k4").value.split(/\n/).map(function(x){return x.trim()}).filter(Boolean);
if(!nm)return er("Enter the tank name.");if(!(cap>0))return er("Enter the tank capacity in litres.");
for(var i=0;i<ls.length;i++){var p=ls[i].split(/[,\s]+/),a=parseFloat(p[0]),b=parseFloat(p[1]);if(p.length!=2||isNaN(a)||isNaN(b))return er("Dip chart line "+(i+1)+" should look like: 10, 500");ch.push({cm:a,l:b})}
ch.sort(function(x,y){return x.cm-y.cm});
var o={name:nm,fuel:v("k2"),capacity:cap,chart:ch};if(id)Object.assign(S.tanks.filter(function(x){return x.id==id})[0],o);else{o.id=Date.now();S.tanks.push(o)}save();tankForm()}
function delivForm(){var oc=S.sup.filter(function(s){return s.kind=="Oil company"});if(!oc.length)return toast("Add the oil company in Suppliers first.");if(!S.tanks.length)return toast("Add your tanks first (Tanks setup).");
var rows="";for(var i=0;i<3;i++)rows+='<div class="row"><label>Tank<select id="vt'+i+'"><option value="">None</option>'+S.tanks.map(function(t){return '<option value="'+t.id+'">'+esc(t.name)+'</option>'}).join("")+'</select></label><label>Litres<input id="vl'+i+'" inputmode="decimal"></label><label>Amount (\u20b9)<input id="va'+i+'" inputmode="decimal"></label></div><div class="row"><label>Invoice dens.<input id="vi'+i+'" inputmode="decimal" placeholder="0.745"></label><label>Measured<input id="vm'+i+'" inputmode="decimal"></label><label>Temp \u00b0C<input id="vc'+i+'" inputmode="decimal"></label><label>At 15 \u00b0C<input id="vd'+i+'" inputmode="decimal"></label></div>';
openM('<h2>Fuel delivery</h2><div class="sub">Records the litres in each tank and adds the bill to the oil company account.</div><label>Date<input id="dd" type="date" value="'+today()+'"></label><label>Oil company<select id="ds">'+oc.map(function(s){return '<option value="'+s.id+'">'+esc(s.name)+'</option>'}).join("")+'</select></label><label>Bill number (optional)<input id="db"></label><label style="margin-top:16px">Litres, bill amount and density for each fuel (up to 3 tanks). Density is optional. The bill total is the sum.</label>'+rows+'<div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveDeliv()">Save delivery</button></div>')}
function saveDeliv(){var ls=[],a=0;
for(var i=0;i<3;i++){var t=v("vt"+i),l=parseFloat(v("vl"+i)),m=parseFloat(v("va"+i));if(!t&&!(l>0)&&!(m>0))continue;if(!t||!(l>0)||!(m>0))return er("For each row you use, choose a tank and enter the litres and the amount.");if(ls.some(function(x){return x.tank_id==t}))return er("Each tank can appear once.");var dn={inv:v("vi"+i),obs:v("vm"+i),temp:v("vc"+i),d15:v("vd"+i)},has=false;for(var k in dn){if(dn[k]!==""){has=true;var num=parseFloat(dn[k]);if(isNaN(num)||(k=="temp"?(num<-10||num>90):(num<0.5||num>1.2)))return er("Check the "+(k=="temp"?"temperature":"density")+" you entered for this tank.");dn[k]=num}else delete dn[k]}
ls.push(has?{tank_id:t,litres:l,amount:m,dens:dn}:{tank_id:t,litres:l,amount:m});a+=m}
if(!ls.length)return er("Enter the litres and amount for at least one tank.");a=rnd(a);
var d=v("dd"),id=Date.now(),tot=ls.reduce(function(s,l){return s+l.litres},0),ts=d==today()?Date.now():new Date(d+"T12:00:00").getTime();
S.deliv.push({id:id,d:d,ts:ts,sup:v("ds"),billno:v("db"),amount:a,lines:ls});
sfind(v("ds")).e.push({d:d,t:"bill",n:"Fuel delivery"+(v("db")?" "+v("db"):"")+" ("+tot+" L)",a:a,dv:id});save();close();renderTanks()}
function delDeliv(id){ask("Delete this delivery? The bill is removed from the oil company account too.",function(){S.deliv=S.deliv.filter(function(d){return d.id!=id});S.sup.forEach(function(s){s.e=s.e.filter(function(x){return x.dv!=id})});save();renderTanks()})}
var PM=today().slice(0,7),SHS=["Morning","Evening","Night"],KL={advance:"Advance",bonus:"Bonus",waive:"Shortage waived",paid:"Paid"};
function payCard(w,own){var L=function(a,b,c){return '<tr><td>'+a+'</td><td class="r"'+(c?' style="color:'+c+'"':'')+'>'+b+'</td></tr>'};
var du=SHS.filter(function(x){return w.count[x]>0}).map(function(x){return x+' \u00d7 '+w.count[x]+(w.rates[x]!=null?' @ '+inr(w.rates[x]):' (no rate set)')}).join(", ")||"No closed duties";
var h='<div class="cust" style="cursor:default"><div class="row"><b>'+esc(w.name)+'</b><span class="amt" style="flex:none">'+inr(w.net)+'</span></div><div class="sub">Net pay for the month</div>'+(w.missing_rate?'<div class="sub" style="color:var(--due)">Some duties have no rate set, so they count as zero.</div>':'')+(w.pending?'<div class="sub" style="color:var(--warn)">'+w.pending+' duty not yet closed, not counted</div>':'')+
'<div class="tbl" style="margin-top:8px"><table style="min-width:0">'+L("Duties<div class=\"sub\">"+esc(du)+"</div>",inr(w.earn))+L("Bonus","+"+inr(w.bonus))+L("Advances","\u2212"+inr(w.advance),'var(--due)')+L("Cash shortage"+(w.waived?'<div class="sub">'+inr(w.waived)+' waived</div>':''),"\u2212"+inr(Math.max(0,w.short-w.waived)),'var(--due)')+L("Already paid","\u2212"+inr(w.paid))+L("<b>Balance to pay</b>","<b>"+inr(w.balance)+"</b>")+'</table></div>';
if(w.items.length){h+='<div class="sub" style="margin-top:10px">Entries this month</div>';w.items.forEach(function(x){h+='<div class="row" style="margin-top:6px"><span>'+esc(KL[x.kind])+(x.note?' \u00b7 '+esc(x.note):'')+'<div class="sub">'+x.d+'</div></span><span style="flex:none;text-align:right">'+inr(x.amount)+'</span>'+(own?'':'<button class="ghost" style="flex:none;padding:5px 8px" onclick="delPay('+x.id+')">Delete</button>')+'</div>'})}
if(!own)h+='<div class="btns" style="margin:12px 0 0"><button class="ghost" onclick="rateForm('+w.id+')">Set rates</button><button class="ghost" onclick="payForm('+w.id+',\'advance\')">Advance</button><button class="ghost" onclick="payForm('+w.id+',\'bonus\')">Bonus</button>'+(w.short>w.waived?'<button class="ghost" onclick="payForm('+w.id+',\'waive\')">Waive shortage</button>':'')+'<button onclick="payForm('+w.id+',\'paid\')">Record payment</button></div>';
return h+'</div>'}
function monthPick(fn){return '<label>Month<input type="month" value="'+PM+'" onchange="PM=this.value||PM;'+fn+'()"></label>'}
function renderSalary(){var A=document.getElementById("app");if(!SRV){A.innerHTML=nav()+'<div class="empty">Salary needs the server. It is not available in this preview.</div>';return}
tab="pay";A.innerHTML=nav()+'<div class="empty">Loading\u2026</div>';
api("GET","/api/payroll?month="+PM).then(function(r){if(tab!="pay")return;var h=nav()+'<h1>Worker salary</h1>'+monthPick("renderSalary")+'<div class="btns noprint">'+xbtns()+'</div><div class="sub" style="margin-top:6px">Pay = closed duties \u00d7 rate, plus bonus, minus advances and cash shortages. Only the owner can see this tab.</div>';
if(!r.workers.length)h+='<div class="empty">No workers yet. Add them in the Team tab.</div>';
r.workers.forEach(function(w){h+=payCard(w,false)});XD=salDoc(r);A.innerHTML=h}).catch(function(e){badge(e.error||"Could not load salary.")})}
function loadMyPay(){api("GET","/api/my-pay?month="+PM).then(function(r){document.getElementById("app").innerHTML=ubar()+wnav()+'<h1>My pay</h1>'+monthPick("loadMyPay")+'<div style="margin-top:10px">'+payCard(r.worker,true)+'</div>'}).catch(function(e){document.getElementById("app").innerHTML=ubar()+wnav()+'<div class="empty">Could not load. '+esc(e.error||"Check your connection.")+'</div>'})}
function rateForm(id){api("GET","/api/payroll?month="+PM).then(function(r){var x=r.workers.filter(function(k){return k.id==id})[0];openM('<h2>Pay per duty</h2><div class="sub">'+esc(x.name)+'. Leave a shift blank if they do not work it.</div>'+SHS.map(function(sh,i){return '<label>'+sh+' duty (\u20b9)<input id="r'+i+'" inputmode="decimal" value="'+(x.rates[sh]!=null?x.rates[sh]:"")+'"></label>'}).join("")+'<div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveRates('+id+')">Save rates</button></div>')})}
function saveRates(id){var b={};SHS.forEach(function(sh,i){b[sh]=v("r"+i)});api("PUT","/api/payroll/rates",{worker_id:id,rates:b}).then(function(){close();renderSalary()}).catch(function(e){er(e.error||"Could not save.")})}
function payForm(id,kind){var T={advance:"Advance given",bonus:"Bonus or extra pay",waive:"Waive cash shortage",paid:"Record salary payment"};
openM('<h2>'+T[kind]+'</h2><div class="sub">For '+PM+'</div><label>Amount (\u20b9)<input id="m1" inputmode="decimal"></label><label>Note (optional)<input id="m2"></label><div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="ghost" onclick="close()">Cancel</button><button onclick="savePay('+id+',\''+kind+'\')">Save</button></div>')}
function savePay(id,kind){api("POST","/api/payroll/items",{worker_id:id,month:PM,kind:kind,amount:v("m1"),note:v("m2")}).then(function(){close();renderSalary()}).catch(function(e){er(e.error||"Could not save.")})}
function delPay(id){ask("Delete this entry?",function(){api("DELETE","/api/payroll/items/"+id).then(renderSalary).catch(function(e){badge(e.error||"Could not delete.")})})}
var SUM=null;
function sumForm(){api("GET","/api/daily-summary?d="+DD).then(function(r){SUM=r;openM('<h2>Daily summary</h2><div class="sub">For '+DD+'. Check it, then send it on WhatsApp.</div><textarea id="st" style="width:100%;height:230px;margin-top:8px;font:13px/1.4 monospace;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);padding:8px"></textarea><label>Send to WhatsApp number (leave blank to choose in WhatsApp)<input id="sn" inputmode="tel" value="'+esc(r.to)+'"></label><div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="ghost" onclick="close()">Close</button><button class="ghost" onclick="copySum()">Copy</button><button onclick="sendSum()">Open WhatsApp</button></div>');document.getElementById("st").value=r.text}).catch(function(e){badge(e.error||"Could not build the summary.")})}
function copySum(){var t=document.getElementById("st");t.select();try{document.execCommand("copy");er("Copied.")}catch(e){er("Select the text and copy it.")}}
function sendSum(){var n=v("sn").replace(/\D/g,"").slice(-10),t=document.getElementById("st").value;window.open("https://wa.me/"+(n.length==10?"91"+n:"")+"?text="+encodeURIComponent(t),"_blank")}
var BK=null,BT="Dear {name}, your outstanding balance is {amount}. Please clear it at your earliest convenience. Thank you.";
function bulkForm(){var L=S.c.filter(function(c){return due(c)>0}).sort(function(a,b){return due(b)-due(a)});
if(!L.length)return openM('<h2>No dues</h2><div class="sub">No customer owes anything right now.</div><div class="btns"><button onclick="close()">Close</button></div>');
BK={sent:{},ids:L.map(function(c){return c.id})};var tot=L.reduce(function(s,c){return s+due(c)},0);
openM('<h2>Payment reminders</h2><div class="sub">'+L.length+' customer'+(L.length>1?'s owe ':' owes ')+inr(tot)+' in total. WhatsApp opens one chat at a time: tap Send for each customer, or Open next to go down the list.</div><label>Message<textarea id="bm" style="width:100%;height:90px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);padding:8px;font:inherit">'+esc(BT)+'</textarea></label><div class="sub">{name} and {amount} are filled in for each customer.</div><div id="bl" style="margin-top:10px"></div><div class="row" style="margin-top:12px"><button class="ghost" onclick="close();render()">Close</button><button onclick="bulkNext()">Open next</button></div>');
bulkList()}
function bulkList(){var h="";BK.ids.forEach(function(id){var c=find(id);h+='<div class="row" style="margin-top:8px"><span><b>'+esc(c.name)+'</b><div class="sub">'+inr(due(c))+(c.reminded?' \u00b7 last reminded '+c.reminded.slice(5):'')+'</div></span><button class="'+(BK.sent[id]?'ghost':'')+'" style="flex:none;padding:8px 12px" onclick="bulkSend('+id+')">'+(BK.sent[id]?'Sent \u2713':'Send')+'</button></div>'});document.getElementById("bl").innerHTML=h}
function bulkSend(id){var c=find(id);BT=document.getElementById("bm").value;var m=BT.replace(/\{name\}/g,c.name).replace(/\{amount\}/g,inr(due(c)));window.open("https://wa.me/91"+c.phone.slice(-10)+"?text="+encodeURIComponent(m),"_blank");BK.sent[id]=1;c.reminded=today();save();bulkList()}
function bulkNext(){var id=BK.ids.filter(function(i){return !BK.sent[i]})[0];if(id==null)return;bulkSend(id)}
function loadAudit(){var q=(document.getElementById("aq")||{}).value||"";api("GET","/api/audit?q="+encodeURIComponent(q)).then(function(L){var h=L.length?'':'<div class="empty">Nothing recorded yet.</div>';L.forEach(function(x){h+='<div class="cust" style="cursor:default;padding:10px 12px"><div class="row"><b>'+esc(x.user_name||"System")+'</b><span class="sub" style="flex:none;text-align:right">'+tdate(x.t)+'</span></div><div class="sub">'+esc(x.detail||x.action)+'</div></div>'});var e=document.getElementById("al");if(e)e.innerHTML=h}).catch(function(e){badge(e.error||"Could not load the audit log.")})}
function srvBackups(){var e=document.getElementById("sb");if(!e)return;api("GET","/api/backups").then(function(L){var h='<h1 style="margin:20px 0 6px;color:var(--ink);font-size:17px;font-weight:800">Server backups</h1><div class="sub">The server saves a full copy every night after 2 AM and keeps the latest 30. Download one now and then and keep it somewhere safe.</div><div class="btns"><button onclick="runBackup()">Back up now</button></div>';
if(!L.length)h+='<div class="empty">No server backups yet.</div>';
L.forEach(function(b){h+='<div class="row" style="margin-top:8px"><span>'+esc(b.name)+'<div class="sub">'+Math.round(b.size/1024)+' KB \u00b7 '+tdate(b.t)+'</div></span><a href="/api/backups/'+encodeURIComponent(b.name)+'" style="flex:none;padding:6px 10px;color:var(--ink)">Download</a><button class="ghost" style="flex:none;padding:5px 8px" onclick="restoreAsk(\''+esc(b.name)+'\')">Restore</button></div>'});e.innerHTML=h}).catch(function(e){badge(e.error||"Could not list the backups.")})}
function runBackup(){api("POST","/api/backups/run").then(function(){toast("Backup saved.");srvBackups()}).catch(function(e){toast(e.error||"Backup failed.")})}
function restoreAsk(n){ask("Replace ALL current data with the backup "+n+"? A safety copy of today's data is saved first, and everyone is logged out.",function(){api("POST","/api/backups/restore",{name:n}).then(function(){location.reload()}).catch(function(e){toast(e.error||"Restore failed.")})})}
function renderBak(){renderBak0();if(SRV&&ME&&ME.role=="owner"){var d=document.createElement("div");d.id="sb";document.getElementById("app").appendChild(d);srvBackups()}}
var XD=null;
function rnd(x){return Math.round(x*100)/100}
function xdoc(title,sub){return{title:title,sub:sub||"",secs:[]}}
function xsec(d,h,head,rows,sheet){d.secs.push({h:h,head:head,rows:rows,sheet:sheet||h});return d}
function xbtns(){return '<button class="ghost" style="flex:none" onclick="exportDoc(\'xlsx\')">Excel</button><button class="ghost" style="flex:none" onclick="exportDoc(\'pdf\')">PDF</button>'}
var CRCT=null;
function crc32(b){if(!CRCT){CRCT=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;CRCT[n]=c>>>0}}var c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=CRCT[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function u16(n){return[n&255,(n>>8)&255]}
function u32(n){return[n&255,(n>>8)&255,(n>>16)&255,(n>>>24)&255]}
function zipBytes(files){var enc=new TextEncoder(),parts=[],cd=[],off=0;
files.forEach(function(f){var nm=enc.encode(f.name),d=enc.encode(f.data),crc=crc32(d);
var lh=[0x50,0x4b,3,4].concat(u16(20),u16(0),u16(0),u16(0),u16(0x21),u32(crc),u32(d.length),u32(d.length),u16(nm.length),u16(0));
parts.push(new Uint8Array(lh),nm,d);
cd.push([0x50,0x4b,1,2].concat(u16(20),u16(20),u16(0),u16(0),u16(0),u16(0x21),u32(crc),u32(d.length),u32(d.length),u16(nm.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),Array.from(nm)));
off+=lh.length+nm.length+d.length});
var cdb=[].concat.apply([],cd),end=[0x50,0x4b,5,6].concat(u16(0),u16(0),u16(files.length),u16(files.length),u32(cdb.length),u32(off),u16(0));
parts.push(new Uint8Array(cdb),new Uint8Array(end));var n=0;parts.forEach(function(p){n+=p.length});var out=new Uint8Array(n),o=0;parts.forEach(function(p){out.set(p,o);o+=p.length});return out}
function xl(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"")}
function colName(i){var s="";i++;while(i>0){var m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s}
function xcell(v,r,c,bold){var ref=colName(c)+r;if(typeof v=="number"&&isFinite(v))return '<c r="'+ref+'" s="'+(bold?1:(v%1===0?2:3))+'"><v>'+v+'</v></c>';return '<c r="'+ref+'" t="inlineStr"'+(bold?' s="1"':'')+'><is><t xml:space="preserve">'+xl(v==null?"":v)+'</t></is></c>'}
function xlsxBytes(d){var NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',groups=[],idx={};
d.secs.forEach(function(sc){var nm=String(sc.sheet).replace(/[\[\]:*?\/\\]/g,"-").slice(0,31)||"Sheet";if(idx[nm]===undefined){idx[nm]=groups.length;groups.push({name:nm,secs:[]})}groups[idx[nm]].secs.push(sc)});
if(!groups.length)groups.push({name:"Report",secs:[]});
var files=[],ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',wb='',rel='';
groups.forEach(function(g,gi){var rows='',r=1,widths=[];
var put=function(arr,bold){var cs='';arr.forEach(function(v,ci){cs+=xcell(v,r,ci,bold);var len=String(typeof v=="number"?v.toLocaleString("en-IN"):(v==null?"":v)).length;widths[ci]=Math.max(widths[ci]||8,Math.min(48,len+2))});rows+='<row r="'+r+'">'+cs+'</row>';r++};
if(!d.notitle){put([d.title+(g.secs.length==1?" - "+g.secs[0].h:"")],1);if(d.sub)put([d.sub])}
g.secs.forEach(function(sc){if(!d.notitle)r++;if(g.secs.length>1)put([sc.h],1);put(sc.head,1);sc.rows.forEach(function(x){put(x)})});
var cols='<cols>'+widths.map(function(w,i){return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>'}).join('')+'</cols>';
files.push({name:'xl/worksheets/sheet'+(gi+1)+'.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="'+NS+'">'+cols+'<sheetData>'+rows+'</sheetData></worksheet>'});
ct+='<Override PartName="/xl/worksheets/sheet'+(gi+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
wb+='<sheet name="'+xl(g.name)+'" sheetId="'+(gi+1)+'" r:id="rId'+(gi+1)+'"/>';
rel+='<Relationship Id="rId'+(gi+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(gi+1)+'.xml"/>'});
rel+='<Relationship Id="rId'+(groups.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
var head='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
files.unshift({name:'[Content_Types].xml',data:ct+'</Types>'},
{name:'_rels/.rels',data:head+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
{name:'xl/workbook.xml',data:head+'<workbook xmlns="'+NS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+wb+'</sheets></workbook>'},
{name:'xl/_rels/workbook.xml.rels',data:head+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rel+'</Relationships>'},
{name:'xl/styles.xml',data:head+'<styleSheet xmlns="'+NS+'"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'});
return zipBytes(files)}
function lat(s){return String(s==null?"":s).replace(/\u20b9/g,"Rs.").replace(/[\u00b7\u2022]/g,"-").replace(/\u00d7/g,"x").replace(/[\u2212\u2013\u2014]/g,"-").replace(/[^\x20-\x7e]/g,"?")}
function pfmt(v){return typeof v=="number"&&isFinite(v)?v.toLocaleString("en-IN",{minimumFractionDigits:v%1?2:0,maximumFractionDigits:2}):lat(v)}
function pdfBytes(d){var lines=[],layouts=[],maxW=0;
d.secs.forEach(function(sc){var n=sc.head.length,w=[],num=[];for(var i=0;i<n;i++){w[i]=lat(sc.head[i]).length;num[i]=true}
sc.rows.forEach(function(r){r.forEach(function(v,i){if(i>=n)return;if(v!==""&&v!=null&&typeof v!="number")num[i]=false;w[i]=Math.max(w[i],Math.min(34,pfmt(v).length))})});
w=w.map(function(x){return Math.min(34,x)});var tw=w.reduce(function(a,b){return a+b},0)+2*(n-1);maxW=Math.max(maxW,tw);layouts.push({w:w,num:num})});
var land=maxW>96,FS=9,PW=land?842:595,PH=land?595:842,avail=PW-72;if(maxW*FS*0.6>avail)FS=Math.max(6,Math.floor(avail/(maxW*0.6)));var LH=Math.round(FS*1.35);
var cell=function(v,wd,isNum){var t=pfmt(v);if(t.length>wd)t=t.slice(0,Math.max(0,wd-2))+"..";return isNum?t.padStart(wd):t.padEnd(wd)};
lines.push({t:lat(d.title),b:1,s:FS+5,g:FS+8});if(d.sub)lines.push({t:lat(d.sub),s:FS,g:LH});lines.push({t:"",s:FS,g:LH});
d.secs.forEach(function(sc,si){var L=layouts[si];if(sc.h)lines.push({t:lat(sc.h),b:1,s:FS+1,g:LH});
lines.push({t:sc.head.map(function(h,i){return cell(h,L.w[i],L.num[i])}).join("  "),b:1,s:FS,g:LH});lines.push({t:L.w.map(function(x){return "-".repeat(x)}).join("  "),s:FS,g:LH});
sc.rows.forEach(function(r){lines.push({t:sc.head.map(function(h,i){return cell(r[i],L.w[i],L.num[i])}).join("  "),s:FS,g:LH})});lines.push({t:"",s:FS,g:LH})});
var pages=[[]],y=PH-40;lines.forEach(function(l){if(y-l.g<45){pages.push([]);y=PH-40}y-=l.g;pages[pages.length-1].push({y:y+0,l:l})});
var esc=function(t){return t.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")};
var objs=[],add=function(s){objs.push(s);return objs.length};
add("<< /Type /Catalog /Pages 2 0 R >>");add("");add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>");
var kids=[];pages.forEach(function(pg,pi){var c='';pg.forEach(function(x){c+='BT /F'+(x.l.b?2:1)+' '+x.l.s+' Tf 1 0 0 1 36 '+x.y+' Tm ('+esc(x.l.t)+') Tj ET\n'});c+='BT /F1 8 Tf 1 0 0 1 36 22 Tm (Page '+(pi+1)+' of '+pages.length+') Tj ET\n';
var pid=add('');var cid=add('<< /Length '+c.length+' >>\nstream\n'+c+'endstream');objs[pid-1]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+PW+' '+PH+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+cid+' 0 R >>';kids.push(pid+' 0 R')});
objs[1]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+kids.length+' >>';
var out='%PDF-1.4\n',offs=[];objs.forEach(function(o,i){offs.push(out.length);out+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});
var xr=out.length;out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';offs.forEach(function(o){out+=String(o).padStart(10,"0")+' 00000 n \n'});
out+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xr+'\n%%EOF';
var b=new Uint8Array(out.length);for(var i=0;i<out.length;i++)b[i]=out.charCodeAt(i)&255;return b}
function saveBytes(bytes,name,type){var b=new Blob([bytes],{type:type}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500)}
function exportDoc(kind){var d=XD;if(!d)return toast("Nothing to export on this screen.");var base=(d.title+" "+d.sub).replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"export";
if(kind=="xlsx")saveBytes(xlsxBytes(d),base+".xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");else saveBytes(pdfBytes(d),base+".pdf","application/pdf")}
function dayDoc(r,mn){var s=r.summary,d=xdoc("Day report "+r.d,(RV=="sum"?"Summary":"Worker-wise detail")+(S.biz&&S.biz.name?" - "+S.biz.name:""));
if(RV=="sum"){var ks=function(o){return Object.keys(o)};
xsec(d,"Fuel sold",["Fuel","Quantity","Amount"],ks(s.fuel).map(function(k){return[k,rnd(s.fuel[k].litres),rnd(s.fuel[k].amount)]}),"Summary");
if(ks(s.shop).length)xsec(d,"Lubes and shop",["Item","Qty","Amount"],ks(s.shop).map(function(k){return[k,s.shop[k].qty,rnd(s.shop[k].amount)]}),"Summary");
if(ks(s.exps).length)xsec(d,"Expenses by category",["Category","Amount"],ks(s.exps).map(function(k){return[k,rnd(s.exps[k])]}),"Summary");
xsec(d,"Collections",["Mode","Amount"],ks(s.pay).map(function(k){return[mn[k]||k,rnd(s.pay[k])]}),"Summary");
xsec(d,"Totals",["Item","Amount"],[["Fuel sales",s.sales],["Lube and shop sales",s.lube],["Total sales",s.total],["Credit sales",s.credit],["Expenses",s.exp],["Expected collection",s.expected],["Collected",s.collected],["Difference (short is negative)",s.diff]],"Summary")}
else r.duties.forEach(function(x){var nm=x.worker+" "+x.shift+" #"+x.id,tg=x.worker+" "+x.shift;
xsec(d,tg+": nozzles",["Nozzle","Open","Close","Test","Litres","Rate","Amount"],x.lines.map(function(l){return[l.nozzle,l.opening,l.closing,l.testing,l.litres,l.rate,l.amount]}),nm);
if(x.items.length)xsec(d,tg+": lube and shop",["Item","Qty","Price","Amount"],x.items.map(function(i){return[i.name,i.qty,i.price,i.amount]}),nm);
if(x.expenses.length)xsec(d,tg+": expenses",["Category","Details","Amount"],x.expenses.map(function(e){return[e.cat,e.note||"",e.amount]}),nm);
xsec(d,tg+": totals",["Item","Amount"],[["Fuel sales",x.sales],["Lube and shop sales",x.lube],["Credit sales",x.credit],["Expenses",x.exp],["Expected collection",x.expected]].concat(Object.keys(x.pay).map(function(k){return[(mn[k]||k)+" collected",x.pay[k]]}),[["Collected",x.collected],["Difference (short is negative)",x.diff]]),nm)});
return d}
function repDoc(p){var d=xdoc("Reports",rf+" to "+rt+(S.biz&&S.biz.name?" - "+S.biz.name:""));
xsec(d,"Profit and loss",["Item","Amount"],[].concat(p.mg?[["Fuel sales (closed days)",rnd(p.fuelS)],["Lube and shop sales (closed days)",rnd(p.lubeS)]]:[],[["Invoiced sales (before GST)",rnd(p.sales)],["Other income",rnd(p.inc)],["Purchases: oil company",rnd(p.buyOil)],["Purchases: dealers",rnd(p.buyDlr)],["Expenses",rnd(p.exT)],["Net",rnd(p.net)]]));
if(p.mg){var M=p.mg;xsec(d,"Fuel margin",["Fuel","Quantity sold","Sales","Cost per unit","Margin","Margin per unit","Margin %"],M.fuel.map(function(f){return[f.fuel,rnd(f.l),rnd(f.sales),f.cpl==null?"no cost":rnd(f.cpl),f.margin==null?"n/a":rnd(f.margin),f.margin==null||!f.l?"n/a":rnd(f.margin/f.l),f.margin==null||!f.sales?"n/a":rnd(f.margin/f.sales*100)]}));xsec(d,"Shop and invoice margin",["Item","Qty","Sales","Cost","Margin"],M.shop.map(function(i){return[i.name,i.q,rnd(i.sales),i.cost==null?"no cost":rnd(i.cost),i.cost==null?"n/a":rnd(i.sales-i.cost)]}).concat([["Invoiced stock items","",rnd(M.inv.sales),rnd(M.inv.cost),rnd(M.inv.sales-M.inv.cost)]]));var T=marginTotals(M,p.inc,p.exT);xsec(d,"Profit by margin",["Item","Amount"],[["Fuel margin",rnd(T.fuel)],["Shop margin",rnd(T.shop)],["Invoiced stock margin",rnd(T.inv)],["Other income",rnd(p.inc)],["Expenses",rnd(p.exT)],["Net profit before worker pay",rnd(T.net)]])}
xsec(d,"GST collected",["Item","Amount"],[["Invoices",p.n],["Taxable value",rnd(p.sales)],["CGST",rnd(p.cg)],["SGST",rnd(p.cg)],["IGST",rnd(p.ig)],["Total tax",rnd(p.cg*2+p.ig)]]);
xsec(d,"GST by rate",["Rate","Taxable","CGST","SGST","IGST"],Object.keys(p.gr||{}).sort(function(a,b){return a-b}).map(function(k){var o=p.gr[k];return[k+"%",rnd(o.t),rnd(o.c),rnd(o.c),rnd(o.g)]}));
var ek=Object.keys(p.ex).sort(function(a,b){return p.ex[b]-p.ex[a]});xsec(d,"Expenses by category",["Category","Amount"],ek.map(function(k){return[k,rnd(p.ex[k])]}).concat(ek.length?[["Total",rnd(p.exT)]]:[]));
xsec(d,"Customer outstanding (today)",["Customer","Phone","Due","Credit limit","Over limit"],p.cs.map(function(c){return[c.name,c.phone,rnd(due(c)),c.limit,due(c)>c.limit?"Yes":""]}).concat(p.cs.length?[["Total","",rnd(p.ct),"",""]]:[]));
xsec(d,"Stock valuation (today)",["Item","Unit","Stock","Purchase price","Selling price","Value at cost","Value at selling price","Low"],S.items.map(function(i){return[i.name,i.unit,i.stock,i.buy,i.sell,rnd(i.stock*i.buy),rnd(i.stock*i.sell),i.stock<=i.low?"Low":""]}).concat([["Total","","","","",rnd(p.cv),rnd(p.rv),""]]));
return d}
function ageBuckets(c){var paid=c.e.reduce(function(s,x){return s+(x.t=="pay"?x.a:0)},0),k=[0,0,0,0],now=Date.now();c.e.filter(function(x){return x.t=="sale"}).sort(function(p,q){return p.d<q.d?-1:1}).forEach(function(x){var r=x.a,u=Math.min(paid,r);paid-=u;r-=u;if(r>0){var dy=Math.floor((now-new Date(x.d))/864e5);k[dy<=30?0:dy<=60?1:dy<=90?2:3]+=r}});return k}
function stmtDoc(c){var d=xdoc("Statement - "+c.name,(from||to?(from||"start")+" to "+(to||"today"):"All entries")+(S.biz&&S.biz.name?" - "+S.biz.name:""));
xsec(d,"Customer",["Field","Value"],[["Name",c.name],["Phone",c.phone],["GST number",c.gst||"-"],["Vehicles",c.veh.join(", ")||"-"],["Credit limit",c.limit],["Outstanding",rnd(due(c))]],"Statement");
var R=rows(c).filter(function(o){return !o.skip}),ent=[];
if(R.length&&(from||to)){var f=R[0];ent.push(["","Balance brought forward","","",rnd(f.bal-(f.x.t=="sale"?f.x.a:-f.x.a))])}
R.forEach(function(o){ent.push([o.x.d,(o.x.t=="sale"?"Sale: ":"Paid: ")+o.x.n,o.x.t=="sale"?o.x.a:"",o.x.t=="pay"?o.x.a:"",rnd(o.bal)])});
xsec(d,"Entries",["Date","Detail","Sales (debit)","Payments (credit)","Balance"],ent,"Statement");
var k=ageBuckets(c);xsec(d,"Overdue ageing",["0-30 days","31-60 days","61-90 days","Over 90 days"],[[rnd(k[0]),rnd(k[1]),rnd(k[2]),rnd(k[3])]],"Statement");return d}
function stmtPdfShare(){var c=find(view),d=stmtDoc(c),bytes=pdfBytes(d),name=("Statement-"+c.name).replace(/[^A-Za-z0-9]+/g,"-")+".pdf";
try{var f=new File([bytes],name,{type:"application/pdf"});if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:"Statement for "+c.name,text:"Account statement for "+c.name+". Outstanding: "+inr(due(c))+"."}).catch(function(){});return}}catch(e){}
saveBytes(bytes,name,"application/pdf");toast("PDF saved. Attach it in the WhatsApp chat.");window.open("https://wa.me/91"+c.phone.slice(-10)+"?text="+encodeURIComponent("Dear "+c.name+", your account statement is attached. Outstanding balance: "+inr(due(c))+"."),"_blank")}
function salDoc(r){var d=xdoc("Worker salary "+r.month,S.biz&&S.biz.name?S.biz.name:"");
xsec(d,"Salary",["Worker","Morning","Evening","Night","Duties pay","Bonus","Advances","Shortage deducted","Paid","Net pay","Balance to pay"],r.workers.map(function(w){return[w.name,w.count.Morning,w.count.Evening,w.count.Night,w.earn,w.bonus,w.advance,rnd(Math.max(0,w.short-w.waived)),w.paid,w.net,w.balance]}),"Salary");
var it=[];r.workers.forEach(function(w){w.items.forEach(function(x){it.push([w.name,x.d,{advance:"Advance",bonus:"Bonus",waive:"Shortage waived",paid:"Paid"}[x.kind],x.note||"",x.amount])})});
if(it.length)xsec(d,"Entries",["Worker","Date","Type","Note","Amount"],it,"Entries");return d}
var VM=bizToday().slice(0,7),VC="",CSALES=[],CF=[];
function parseVeh(t){var veh=[],tank={};String(t||"").split(/\n/).forEach(function(line){var last=null;line.split(",").forEach(function(p){p=p.trim();if(!p)return;if(last&&/^\d+(\.\d+)?$/.test(p))tank[last]=parseFloat(p);else{last=p.toUpperCase();if(veh.indexOf(last)<0)veh.push(last)}})});return{veh:veh,tank:tank}}
function vkey(s){return String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
function monthsBack(m,n){var y=+m.slice(0,4),mo=+m.slice(5,7),o=[];for(var i=n-1;i>=0;i--){var d=new Date(y,mo-1-i,1);o.push(d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2))}return o}
function vehFlags(r,hist){var c=find(r.cust_id),k=vkey(r.veh),why=[];if(!k)return["No vehicle number"];if(!c)return why;
var reg=(c.veh||[]).map(vkey);if(reg.length&&reg.indexOf(k)<0)why.push("Vehicle not on the customer's list");
var tank=0;(c.veh||[]).forEach(function(x){if(vkey(x)==k&&c.vtank&&c.vtank[x])tank=+c.vtank[x]});
if(tank>0){if(r.litres>tank)why.push("More than tank size ("+r.litres+" L vs "+tank+" L)")}
else{var prev=hist.filter(function(x){return x.cust_id==r.cust_id&&vkey(x.veh)==k&&x.id<r.id});if(prev.length>=3){var avg=prev.reduce(function(s,x){return s+x.litres},0)/prev.length;if(r.litres>2*avg&&r.litres-avg>=10)why.push("Much more than usual ("+r.litres+" L vs average "+Math.round(avg)+" L)")}}
return why}
function renderVeh(){var A=document.getElementById("app");if(!SRV){A.innerHTML=nav()+'<div class="empty">The vehicle report needs the server. It is not available in this preview.</div>';return}
tab="veh";A.innerHTML=nav()+'<div class="empty">Loading\u2026</div>';
pullDuty(function(){if(tab!="veh")return;var okRows=CSALES.filter(function(r){return r.status!="pending"}),all=okRows.filter(function(r){return r.litres>0}),skipped=okRows.length-all.length;
var cn=function(id){var c=find(id);return c?c.name:"Customer"},sel=all.filter(function(r){return r.d.slice(0,7)==VM&&(!VC||r.cust_id==VC)}),G={},order=[],flagged=[];
sel.forEach(function(r){var k=r.cust_id+"|"+vkey(r.veh),g=G[k];if(!g){g=G[k]={cust:r.cust_id,veh:r.veh||"(no vehicle)",n:0,l:0,a:0,max:0,fl:0,w:{}};order.push(k)}
g.n++;g.l+=r.litres;g.a+=r.a;g.max=Math.max(g.max,r.litres);var w=g.w[r.worker]||(g.w[r.worker]={n:0,l:0,a:0});w.n++;w.l+=r.litres;w.a+=r.a;var f=vehFlags(r,all);if(f.length){g.fl++;flagged.push([r.d,cn(r.cust_id),r.veh||"(no vehicle)",r.litres,r.a,r.worker,f.join("; ")])}});
var sumR=order.map(function(k){var g=G[k];return[cn(g.cust),g.veh,g.n,rnd(g.l),rnd(g.a),rnd(g.l/g.n),g.max,g.fl,Object.keys(g.w).join(", ")]});
var wR=[];order.forEach(function(k){var g=G[k];Object.keys(g.w).forEach(function(n){var w=g.w[n];wR.push([cn(g.cust),g.veh,n,w.n,rnd(w.l),rnd(w.a)])})});
var ms=monthsBack(VM,6),M={},mo=[];all.filter(function(r){return(!VC||r.cust_id==VC)&&ms.indexOf(r.d.slice(0,7))>=0}).forEach(function(r){var k=r.cust_id+"|"+vkey(r.veh),g=M[k];if(!g){g=M[k]={cust:r.cust_id,veh:r.veh||"(no vehicle)",m:{},a:0};mo.push(k)}var mm=r.d.slice(0,7);g.m[mm]=(g.m[mm]||0)+r.litres;g.a+=r.a});
var mR=mo.map(function(k){var g=M[k],t=0,row=[cn(g.cust),g.veh];ms.forEach(function(m){var x=rnd(g.m[m]||0);t+=x;row.push(x)});row.push(rnd(t),rnd(g.a));return row});
var d=xdoc("Vehicle-wise credit report "+VM,(VC?cn(VC):"All customers")+(S.biz&&S.biz.name?" - "+S.biz.name:""));
xsec(d,"Per vehicle",["Customer","Vehicle","Fills","Litres","Amount","Avg fill (L)","Largest (L)","Flagged","Served by"],sumR,"Per vehicle");
xsec(d,"Served by (worker-wise)",["Customer","Vehicle","Worker","Fills","Litres","Amount"],wR,"Workers");
xsec(d,"Monthly litres per vehicle",["Customer","Vehicle"].concat(ms,["Total litres","Total amount"]),mR,"Monthly");
xsec(d,"Unusual fill-ups",["Date","Customer","Vehicle","Litres","Amount","Worker","Why flagged"],flagged,"Unusual");XD=d;
var T=function(sc){if(!sc.rows.length)return sect(sc.h)+'<div class="sub">Nothing for this selection.</div>';return rtab(sc.h,sc.head,sc.rows.map(function(r){return r.map(function(x){return typeof x=="number"?(x%1?x.toFixed(2):String(x)):esc(x)})}))};
var h=nav()+'<button class="ghost noprint" onclick="tab=\'ledger\';view=null;render()">Back to ledger</button><h1 style="margin-top:14px">Vehicle-wise credit report</h1><div class="sub">From credit sales workers saved with litres. Manual ledger entries have no vehicle or litres, so they are not included.</div><div class="row noprint"><label>Month<input type="month" value="'+VM+'" onchange="VM=this.value||VM;renderVeh()"></label><label>Customer<select onchange="VC=this.value;renderVeh()"><option value="">All customers</option>'+S.c.map(function(c){return '<option value="'+c.id+'"'+(VC==c.id?' selected':'')+'>'+esc(c.name)+'</option>'}).join("")+'</select></label></div><div class="btns noprint">'+xbtns()+'</div>';
d.secs.forEach(function(sc,i){if(i==3&&sc.rows.length)h+=rtab("Unusual fill-ups ("+sc.rows.length+")",sc.head,sc.rows.map(function(r){return r.map(function(x){return typeof x=="number"?(x%1?x.toFixed(2):String(x)):esc(x)})}));else h+=T(sc)});
if(skipped)h+='<div class="sub" style="margin-top:10px">'+skipped+' credit sale'+(skipped>1?'s were':' was')+' left out because no litres were recorded.</div>';
h+='<div class="sub" style="margin-top:6px">A fill is flagged when it is above the vehicle\'s tank size (if you entered one), or, with no tank size, more than twice that vehicle\'s average after at least 3 earlier fills. Fills with no vehicle number, or a vehicle not on the customer\'s list, are flagged too.</div>';
A.innerHTML=h})}
var SF=bizToday().slice(0,8)+"01",ST=bizToday(),SN=3,SG="week";
function wkStart(d){var x=new Date(d+"T00:00:00"),k=(x.getDay()+6)%7;x.setDate(x.getDate()-k);return x.toLocaleDateString("en-CA")}
function shortBuild(R,f,t,n,g){var W={},ids=[],Pm={},Pk=[];
R.forEach(function(x){var w=W[x.worker_id];if(!w){w=W[x.worker_id]={name:x.worker,duties:0,short:0,amt:0,exc:0,sales:0,mon:{}};ids.push(x.worker_id)}
w.duties++;w.sales+=x.sales;var m=x.d.slice(0,7);if(x.diff<=-1){w.short++;w.amt+=-x.diff;var o=w.mon[m]||(w.mon[m]={c:0,a:0});o.c++;o.a+=-x.diff}else if(x.diff>=1)w.exc+=x.diff;
var pk=g=="week"?wkStart(x.d):m,p=Pm[pk]||(Pm[pk]={d:0,c:0,a:0,w:{}});if(!Pm[pk].seen){Pm[pk].seen=1;Pk.push(pk)}p.d++;if(x.diff<=-1){p.c++;p.a+=-x.diff;p.w[x.worker_id]=(p.w[x.worker_id]||0)+(-x.diff)}});
ids.sort(function(a,b){return W[b].amt-W[a].amt});Pk.sort();
var d=xdoc("Shortage report "+f+" to "+t,"Closed duties only"+(S.biz&&S.biz.name?" - "+S.biz.name:""));
xsec(d,"Shortages per worker",["Worker","Duties","Times short","Short total","Average short","Excess total","Net difference"],ids.map(function(i){var w=W[i];return[w.name,w.duties,w.short,rnd(w.amt),w.short?rnd(w.amt/w.short):0,rnd(w.exc),rnd(w.exc-w.amt)]}),"Per worker");
var rp=[];ids.forEach(function(i){var w=W[i];Object.keys(w.mon).sort().forEach(function(m){if(w.mon[m].c>=n)rp.push([w.name,m,w.mon[m].c,rnd(w.mon[m].a)])})});rp.sort(function(a,b){return b[2]-a[2]||b[3]-a[3]});
xsec(d,"Repeat shortages ("+n+" or more in a month)",["Worker","Month","Times short","Short total"],rp,"Repeat");
xsec(d,"Shortage as a percentage of sales",["Worker","Sales","Short total","Short % of sales","Duties short %"],ids.map(function(i){var w=W[i];return[w.name,rnd(w.sales),rnd(w.amt),w.sales?rnd(w.amt/w.sales*100):0,w.duties?rnd(w.short/w.duties*100):0]}),"Percent");
xsec(d,"Trend by "+(g=="week"?"week":"month"),["Period","Duties","Times short","Short total"].concat(ids.map(function(i){return W[i].name}),[]),Pk.map(function(k){var p=Pm[k];return[(g=="week"?"Week of ":"")+k,p.d,p.c,rnd(p.a)].concat(ids.map(function(i){return rnd(p.w[i]||0)}))}),"Trend");
return d}
function renderShort(){var A=document.getElementById("app");if(!SRV){A.innerHTML=nav()+'<div class="empty">The shortage report needs the server. It is not available in this preview.</div>';return}
tab="short";A.innerHTML=nav()+'<div class="empty">Loading\u2026</div>';
api("GET","/api/shortage-data?from="+SF+"&to="+ST).then(function(R){if(tab!="short")return;var d=shortBuild(R,SF,ST,SN,SG);XD=d;
var tr=function(sc){if(!sc.rows.length)return sect(sc.h)+'<div class="sub">Nothing for this selection.</div>';return rtab(sc.h,sc.head,sc.rows.map(function(r){return r.map(function(x){return typeof x=="number"?(x%1?x.toFixed(2):String(x)):esc(x)})}))};
var h=nav()+'<button class="ghost noprint" onclick="renderDutyTab()">Back to duty list</button><h1 style="margin-top:14px">Shortage report</h1><div class="sub">Closed duties only. A duty counts as short when the money handed in is ₹1 or more below what was expected.</div><div class="row noprint"><label>From<input type="date" value="'+SF+'" onchange="SF=this.value||SF;renderShort()"></label><label>To<input type="date" value="'+ST+'" onchange="ST=this.value||ST;renderShort()"></label></div><div class="row noprint"><label>Repeat means at least<input type="number" min="1" value="'+SN+'" onchange="SN=Math.max(1,parseInt(this.value)||3);renderShort()"></label><label>Trend by<select onchange="SG=this.value;renderShort()"><option value="week"'+(SG=="week"?' selected':'')+'>Week</option><option value="month"'+(SG=="month"?' selected':'')+'>Month</option></select></label></div><div class="btns noprint">'+xbtns()+'</div>';
if(!R.length)h+='<div class="empty">No closed duties in this period.</div>';else d.secs.forEach(function(sc){h+=tr(sc)});
A.innerHTML=h}).catch(function(e){badge(e.error||"Could not load the report.")})}
var DM=null;
function withDM(cb){if(!SRV){cb();return}api("GET","/api/duty-money").then(function(r){DM=r;cb()}).catch(function(){cb()})}
function renderBook(){withDM(renderBook0)}
function renderRep(){withDM(renderRep0)}
function accOfMode(k){return k=="cash"?"Cash":k=="upi"?"UPI":"Bank"}
function depPlan(){var days=(DM||[]).filter(function(x){return(+x.pay.cash||0)>0}).sort(function(a,b){return a.d<b.d?-1:1}),rem=S.bk.filter(function(b){return b.dep}).reduce(function(s,b){return s+b.a},0),rows=[];
days.forEach(function(x){var c=+x.pay.cash,b=Math.min(rem,c);rem-=b;rows.push({d:x.d,cash:c,bank:b,left:rnd(c-b)})});return{rows:rows,extra:rnd(rem),left:rnd(rows.reduce(function(s,r){return s+r.left},0))}}
function depHtml(){if(!SRV)return'';var P=depPlan();
if(!P.rows.length&&!S.bk.some(function(b){return b.dep}))return '<div class="cust" style="cursor:default;margin-top:10px"><b>Bank deposits</b><div class="sub">Cash collected on closed days will show here, with how much has been banked.</div><div class="btns" style="margin:8px 0 0"><button onclick="depForm()">Record a deposit</button></div></div>';
var old=P.rows.filter(function(r){return r.left>=1})[0],h='<div class="cust" style="cursor:default;margin-top:10px"><div class="row"><b>Cash waiting to be banked</b><span class="amt" style="flex:none;color:'+(P.left>=1?'var(--warn)':'var(--ok)')+'">'+inr(P.left)+'</span></div>'+(old?'<div class="sub">Oldest: '+old.d+' ('+Math.floor((Date.now()-new Date(old.d))/864e5)+' days ago)</div>':'<div class="sub">All duty cash has been banked.</div>')+(P.extra>=1?'<div class="sub">Deposits are '+inr(P.extra)+' more than duty cash (opening cash or other cash).</div>':'')+'<div class="btns" style="margin:8px 0 0"><button onclick="depForm()">Record a deposit</button></div>';
var last=P.rows.slice(-10).reverse();if(last.length)h+='<div class="tbl" style="margin-top:8px"><table style="min-width:0"><tr><th>Day</th><th class="r">Cash handed in</th><th class="r">Banked</th><th class="r">Still to bank</th></tr>'+last.map(function(r){return '<tr><td>'+r.d.slice(5)+'</td><td class="r">'+inr(r.cash)+'</td><td class="r">'+inr(r.bank)+'</td><td class="r" style="color:'+(r.left>=1?'var(--due)':'var(--ok)')+'">'+inr(r.left)+'</td></tr>'}).join("")+'</table></div>';return h+'</div>'}
function depForm(){openM('<h2>Bank deposit</h2><div class="sub">Moves cash from the Cash account to the Bank account.</div><label>Date<input id="dp1" type="date" value="'+today()+'"></label><label>Amount (\u20b9)<input id="dp2" inputmode="decimal"></label><label>Slip or reference number (optional)<input id="dp3"></label><label>Deposited by (optional)<input id="dp4"></label><div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveDep()">Save deposit</button></div>')}
function saveDep(){var a=parseFloat(v("dp2"));if(!(a>0))return er("Enter the amount.");S.bk.push({id:Date.now(),d:v("dp1"),t:"xfer",acct:"Cash",to:"Bank",a:a,dep:1,slip:v("dp3"),by:v("dp4")});save();close();renderBook()}
function costPerL(fuel){var inP=[],before=[];S.deliv.forEach(function(d){var tot=d.lines.reduce(function(a,l){return a+l.litres},0);d.lines.forEach(function(l){var tk=S.tanks.filter(function(x){return x.id==l.tank_id})[0];if(!tk||tk.fuel!=fuel||!(l.litres>0))return;var amt=l.amount>0?l.amount:(tot>0?d.amount*l.litres/tot:0),rec={d:d.d,l:l.litres,a:amt};if(d.d>=rf&&d.d<=rt)inP.push(rec);else if(d.d<rf)before.push(rec)})});
var use=inP;if(!use.length&&before.length){before.sort(function(a,b){return a.d<b.d?-1:1});use=[before[before.length-1]]}var L=0,A=0;use.forEach(function(x){L+=x.l;A+=x.a});return L>0?A/L:null}
function marginData(){var F={},fuelM=[],I={};
(DM||[]).forEach(function(x){if(!inR(x.d))return;Object.keys(x.fuel).forEach(function(k){var f=F[k]||(F[k]={l:0,a:0});f.l+=x.fuel[k].litres;f.a+=x.fuel[k].amount});x.lube.forEach(function(i){var o=I[i.item_id]||(I[i.item_id]={name:i.name,q:0,a:0});o.q+=i.qty;o.a+=i.amount})});
Object.keys(F).forEach(function(k){var c=costPerL(k),f=F[k];fuelM.push({fuel:k,l:f.l,sales:f.a,cpl:c,margin:c==null?null:f.a-f.l*c})});
var shop=Object.keys(I).map(function(id){var it=S.items.filter(function(x){return String(x.id)==String(id)})[0],o=I[id];return{name:o.name,q:o.q,sales:o.a,cost:it?o.q*it.buy:null}});
var inv={sales:0,cost:0,nocost:0};S.inv.forEach(function(iv){if(!inR(iv.d))return;iv.lines.forEach(function(l){var amt=l.q*l.r,it=l.it?S.items.filter(function(x){return x.id==l.it})[0]:null;if(it){inv.sales+=amt;inv.cost+=l.q*it.buy}else inv.nocost+=amt})});
return{fuel:fuelM,shop:shop,inv:inv}}
function marginTotals(M,inc,exT){var f=0,sh=0;M.fuel.forEach(function(x){if(x.margin!=null)f+=x.margin});M.shop.forEach(function(x){if(x.cost!=null)sh+=x.sales-x.cost});var iv=M.inv.sales-M.inv.cost;return{fuel:f,shop:sh,inv:iv,net:f+sh+iv+inc-exT}}
function marginHtml(M,inc,exT){var T=marginTotals(M,inc,exT),pct=function(a,b){return b?(a/b*100).toFixed(1)+"%":"-"};
var fr=M.fuel.map(function(f){return[esc(f.fuel),rnd(f.l),m2(f.sales),f.cpl==null?"no cost":m2(f.cpl),f.margin==null?"n/a":m2(f.margin),f.margin==null||!f.l?"n/a":m2(f.margin/f.l),f.margin==null?"n/a":pct(f.margin,f.sales)]});
var h=rtab("Fuel margin (closed days)",["Fuel","Quantity","Sales","Cost / unit","Margin","Margin / unit","Margin %"],fr.length?fr:[["No fuel sold in this period","","","","","",""]]);
if(M.fuel.some(function(f){return f.cpl==null}))h+='<div class="sub" style="margin-top:6px">"no cost" means no fuel delivery with an amount was recorded for that fuel in this period or earlier. Cost per litre is the average of the deliveries in the period (or the latest earlier one).</div>';
var sr=M.shop.map(function(i){return[esc(i.name),i.q,m2(i.sales),i.cost==null?"no cost":m2(i.cost),i.cost==null?"n/a":m2(i.sales-i.cost)]}).concat([["Invoiced stock items","",m2(M.inv.sales),m2(M.inv.cost),m2(M.inv.sales-M.inv.cost)]]);
h+=rtab("Shop and invoice margin",["Item","Qty","Sales","Cost","Margin"],sr);
if(M.inv.nocost>0)h+='<div class="sub" style="margin-top:6px">'+m2(M.inv.nocost)+' of invoiced sales are not linked to a stock item, so they are left out of the margin.</div>';
return h+rtab("Profit by margin",["Item","Amount"],[["Fuel margin",m2(T.fuel)],["Shop margin",m2(T.shop)],["Invoiced stock margin",m2(T.inv)],["Other income",m2(inc)],["Expenses",m2(exT)],["<b>Net profit before worker pay</b>",'<b style="color:'+(T.net<0?'var(--due)':'var(--ok)')+'">'+m2(T.net)+'</b>']])+'<div class="sub" style="margin-top:6px">This uses the cost of the fuel and items actually sold, not what you bought. The profit and loss above uses purchases instead.</div>'}
var FUELDEF=[["Petrol (MS)","L"],["Diesel (HSD)","L"],["Power petrol","L"],["Power diesel","L"],["Other","L"]],DENSD={"Petrol (MS)":[0.72,0.775],"Diesel (HSD)":[0.82,0.86],"Power petrol":[0.72,0.775],"Power diesel":[0.82,0.86]};
function fprods(){return S.fuelprods&&S.fuelprods.length?S.fuelprods:FUELDEF.map(function(x,i){return{id:"d"+i,name:x[0],unit:x[1],active:true}})}
function fuelNames(){return fprods().filter(function(p){return p.active!==false}).map(function(p){return p.name})}
function unitOf(f){var p=fprods().filter(function(x){return x.name==f})[0];return p&&p.unit||"L"}
function dn(x){return x==null?'-':Number(x).toFixed(4)}

function densHtml(DREG, prodList) {
  var rows = (DREG && DREG.rows) ? DREG.rows : (Array.isArray(DREG) ? DREG : []);
  var tanks = (DREG && DREG.tanks) ? DREG.tanks : (S.tanks || []);

  if (DENS_FILTER.tank_id) {
    rows = rows.filter(function(r) { return String(r.tank_id) === String(DENS_FILTER.tank_id); });
  }
  if (TANK_FROM) {
    rows = rows.filter(function(r) { return !r.d || r.d >= TANK_FROM; });
  }
  if (TANK_TO) {
    rows = rows.filter(function(r) { return !r.d || r.d <= TANK_TO; });
  }

  var prodsToRender = TANK_PRODUCT ? [TANK_PRODUCT] : (prodList && prodList.length ? prodList : fuelNames());
  if (!prodsToRender.length) prodsToRender = ["Petrol (MS)", "Diesel (HSD)"];

  var h = '';
  var anyDensRendered = false;

  prodsToRender.forEach(function(fName) {
    var pTanks = tanks.filter(function(t) { return t.fuel === fName; });
    if (DENS_FILTER.tank_id) {
      pTanks = pTanks.filter(function(t) { return String(t.id) === String(DENS_FILTER.tank_id); });
    }

    var pRows = rows.filter(function(r) {
      if (DENS_FILTER.tank_id && String(r.tank_id) !== String(DENS_FILTER.tank_id)) return false;
      if (r.fuel) return r.fuel === fName;
      var tk = tanks.filter(function(t) { return String(t.id) === String(r.tank_id); })[0];
      return tk && tk.fuel === fName;
    });

    if (!pTanks.length && !pRows.length) {
      if (TANK_PRODUCT === fName) {
        h += '<div class="empty" style="margin:20px 0;padding:24px">No tanks or density records found for product <b>' + esc(fName) + '</b>. Configure tanks in Tanks Setup.</div>';
      }
      return;
    }

    anyDensRendered = true;
    var fIcon = (fName.toLowerCase().indexOf('petrol') >= 0 || fName.toLowerCase().indexOf('ms') >= 0) ? '⛽' : '🛢️';
    var stdRange = DENSD[fName] || (fName.toLowerCase().indexOf('diesel') >= 0 ? [0.82, 0.86] : [0.72, 0.775]);
    var minDens = (stdRange[0] < 2 ? stdRange[0] * 1000 : stdRange[0]).toFixed(1);
    var maxDens = (stdRange[1] < 2 ? stdRange[1] * 1000 : stdRange[1]).toFixed(1);

    var m15Vals = pRows.map(function(r) {
      return r.m_d15 ? (+r.m_d15 < 2 ? +r.m_d15 * 1000 : +r.m_d15) : null;
    }).filter(function(v) { return v != null && !isNaN(v); });
    var avgM15 = m15Vals.length ? (m15Vals.reduce(function(a, b){ return a + b; }, 0) / m15Vals.length).toFixed(1) : null;

    var mixVals = pRows.map(function(r) {
      return r.mix_dens ? (+r.mix_dens < 2 ? +r.mix_dens * 1000 : +r.mix_dens) : null;
    }).filter(function(v) { return v != null && !isNaN(v); });
    var avgMix = mixVals.length ? (mixVals.reduce(function(a, b){ return a + b; }, 0) / mixVals.length).toFixed(1) : null;

    var chalVals = pRows.map(function(r) {
      return r.chalan_dens ? (+r.chalan_dens < 2 ? +r.chalan_dens * 1000 : +r.chalan_dens) : null;
    }).filter(function(v) { return v != null && !isNaN(v); });
    var avgChal = chalVals.length ? (chalVals.reduce(function(a, b){ return a + b; }, 0) / chalVals.length).toFixed(1) : null;

    var totDecantKL = pRows.reduce(function(acc, r) { return acc + (r.receipt_kl ? +r.receipt_kl : 0); }, 0);
    var warnDiffs = pRows.filter(function(r) { return r.dens_diff != null && Math.abs(r.dens_diff) > 3.0; }).length;

    // Product Section Banner
    h += '<div style="margin:28px 0 12px;padding:12px 16px;background:var(--card);border-left:4px solid var(--theme-accent);border-radius:0 10px 10px 0;border-top:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
      '<div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<span style="font-size:20px">' + fIcon + '</span>' +
          '<h2 style="margin:0;font-size:18px;font-weight:800;color:var(--ink)">Product: ' + esc(fName) + ' &mdash; Daily Density Register</h2>' +
          '<span style="background:rgba(37,99,235,0.08);color:var(--btn);font-size:11.5px;font-weight:700;padding:2px 10px;border-radius:12px;border:1px solid rgba(37,99,235,0.2)">Statutory 15&deg;C Range: ' + minDens + ' &ndash; ' + maxDens + ' kg/m&sup3;</span>' +
          '<span style="background:var(--theme-accent-soft);color:var(--theme-accent);font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px">' + pTanks.length + ' Tank' + (pTanks.length === 1 ? '' : 's') + '</span>' +
        '</div>' +
        '<div class="sub" style="margin-top:3px">' +
          (pTanks.length ? 'Assigned Tanks: ' + pTanks.map(function(t){ return '<b>' + esc(t.name) + '</b>'; }).join(', ') + ' &bull; ' : '') +
          'Period: ' + esc(TANK_FROM) + ' to ' + esc(TANK_TO) + ' &bull; ' + pRows.length + ' check' + (pRows.length === 1 ? '' : 's') + ' recorded' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px">' +
        (avgM15 ? '<div style="background:rgba(37,99,235,0.06);padding:5px 10px;border-radius:6px">Avg Morning 15&deg;C: <b style="color:var(--ink)">' + avgM15 + ' kg/m&sup3;</b></div>' : '') +
        (totDecantKL > 0 ? '<div style="background:rgba(16,185,129,0.06);padding:5px 10px;border-radius:6px">Total Decanted: <b style="color:var(--ok)">' + fld(totDecantKL) + ' KL</b></div>' : '') +
        (pRows.length ? (warnDiffs === 0 ? '<div style="color:var(--ok);font-weight:700;display:flex;align-items:center;gap:4px">✓ Challan Diff &le; 3.0</div>' : '<div style="color:var(--due);font-weight:700">⚠ ' + warnDiffs + ' Challan Diff &gt; 3.0</div>') : '') +
        '<button class="noprint ghost" style="padding:5px 10px;font-size:12px" onclick="densRegisterForm(' + (pTanks.length ? pTanks[0].id : '') + ')">+ Record Check</button>' +
      '</div>' +
    '</div>';

    // 17-column Statutory Table for this product
    h += '<div class="tbl" style="margin-bottom:24px;overflow-x:auto">' +
      '<table style="min-width:1240px">' +
        '<thead>' +
          '<tr style="background:rgba(0,0,0,0.02)">' +
            '<th rowspan="2" style="white-space:nowrap;padding:10px;text-align:left;vertical-align:middle">Date / Tank</th>' +
            '<th colspan="3" style="white-space:nowrap;padding:10px;text-align:center;background:rgba(37,99,235,0.04);color:var(--ink);font-weight:800">Morning Density at 15&deg;C U/G Tanks</th>' +
            '<th colspan="4" style="white-space:nowrap;padding:10px;text-align:center;color:var(--ink);font-weight:800">Tank/Truck Receipt Density Compartment</th>' +
            '<th rowspan="2" class="r" style="white-space:nowrap;padding:10px;text-align:right;vertical-align:middle;font-weight:800">Mix<br>Density</th>' +
            '<th rowspan="2" class="r" style="white-space:nowrap;padding:10px;text-align:right;vertical-align:middle">Density @ 15&deg;C<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">As per challan</span></th>' +
            '<th rowspan="2" class="r" style="white-space:nowrap;padding:10px;text-align:right;vertical-align:middle;font-weight:800">Dif in Density<br><span style="font-size:10.5px;font-weight:normal;color:var(--mute)">Mix &minus; Challan</span></th>' +
            '<th colspan="2" style="white-space:nowrap;padding:10px;text-align:center;color:var(--ink);font-weight:800">Stock Before Receipt</th>' +
            '<th colspan="3" style="white-space:nowrap;padding:10px;text-align:center;background:rgba(16,185,129,0.04);color:var(--ink);font-weight:800">After Decantation (100L Flush)</th>' +
            '<th class="noprint" rowspan="2" style="text-align:center;vertical-align:middle;width:65px;padding:10px">Action</th>' +
          '</tr>' +
          '<tr style="background:rgba(0,0,0,0.015);color:var(--mute);font-weight:700;font-size:11px">' +
            '<th class="r" style="padding:8px 6px">Density</th>' +
            '<th class="r" style="padding:8px 6px">Temp</th>' +
            '<th class="r" style="padding:8px 6px;color:var(--ink);background:rgba(37,99,235,0.06);font-weight:800">At 15&deg;C</th>' +
            '<th class="r" style="padding:8px 6px;width:48px">I</th>' +
            '<th class="r" style="padding:8px 6px;width:48px">II</th>' +
            '<th class="r" style="padding:8px 6px;width:48px">III</th>' +
            '<th class="r" style="padding:8px 6px;width:48px">IV</th>' +
            '<th class="r" style="padding:8px 6px">Dip</th>' +
            '<th class="r" style="padding:8px 6px">Stock</th>' +
            '<th class="r" style="padding:8px 6px;color:var(--ink);background:rgba(16,185,129,0.06);font-weight:800">Density</th>' +
            '<th class="r" style="padding:8px 6px">Receipt KL</th>' +
            '<th style="padding:8px 6px;text-align:center">Challan no</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>';

    var datesList = getDatesInRange(TANK_FROM, TANK_TO).reverse();
    if (!datesList.length && pRows.length) {
      datesList = [today()];
    }

    var densByDateTank = {};
    pRows.forEach(function(r) {
      var k = (r.d || "") + "_" + (r.tank_id || "");
      (densByDateTank[k] = densByDateTank[k] || []).push(r);
    });

    var renderedDensIds = {};

    datesList.forEach(function(dStr) {
      if (pTanks.length > 0) {
        pTanks.forEach(function(tk) {
          var k = dStr + "_" + tk.id;
          var recList = densByDateTank[k] || (pTanks.length === 1 ? densByDateTank[dStr + "_"] : null);
          if (recList && recList.length) {
            recList.forEach(function(r) {
              if (r.id) renderedDensIds[r.id] = true;
              var dParts = (r.d || '').split('-');
              var dFmt = dParts.length === 3 ? (parseInt(dParts[2], 10) + '/' + parseInt(dParts[1], 10) + '/' + dParts[0]) : r.d;
              var isWarning = r.dens_diff != null && Math.abs(r.dens_diff) > 3.0;

              h += '<tr>' +
                '<td style="vertical-align:middle;padding:10px;white-space:nowrap">' +
                  '<span style="font-weight:700;color:var(--ink)">' + esc(dFmt) + '</span>' +
                  (r.tank_name ? '<div class="sub" style="font-size:11px;margin-top:2px">' + esc(r.tank_name) + '</div>' : '') +
                '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (fld(r.m_obs) || '&mdash;') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (fld(r.m_temp) || '&mdash;') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(37,99,235,0.06);font-weight:800;color:var(--ink)">' + (fld(r.m_d15) || '&mdash;') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px 6px;font-variant-numeric:tabular-nums">' + (fld(r.comp1) || '') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px 6px;font-variant-numeric:tabular-nums">' + (fld(r.comp2) || '') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px 6px;font-variant-numeric:tabular-nums">' + (fld(r.comp3) || '') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px 6px;font-variant-numeric:tabular-nums">' + (fld(r.comp4) || '') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;font-weight:700">' + (fld(r.mix_dens) || '') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (fld(r.chalan_dens) || '') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;font-weight:800;font-size:14px;color:' + (r.dens_diff != null ? (isWarning ? 'var(--due)' : 'var(--ok)') : 'inherit') + '">' + (r.dens_diff != null ? fld(r.dens_diff) : '') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (fld(r.pre_dip) || '') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (r.pre_stock != null ? lt(r.pre_stock) : '') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(16,185,129,0.06);font-weight:800;color:var(--ink)">' + (fld(r.post_dens) || '') + '</td>' +
                '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (r.receipt_kl != null ? (fld(r.receipt_kl) + ' KL') : '') + '</td>' +
                '<td style="vertical-align:middle;padding:10px;text-align:center;font-size:12px">' + esc(r.chalan_no || '') + '</td>' +
                '<td class="noprint" style="vertical-align:middle;text-align:center;padding:10px">' +
                  (r.id > 0 ? '<button class="ghost" style="padding:4px 8px;font-size:12px" title="Delete density check" onclick="delDensReg(' + r.id + ')">Delete</button>' : '<span style="color:var(--mute)">&mdash;</span>') +
                '</td>' +
              '</tr>';
            });
          } else {
            // Blank record row for non-recorded date
            h += '<tr style="opacity:0.75;background:rgba(0,0,0,0.01)">' +
              '<td style="vertical-align:middle;padding:10px;white-space:nowrap">' +
                '<span style="font-weight:700;color:var(--ink)">' + fmtDateDMY(dStr) + '</span>' +
                '<div class="sub" style="font-size:11px;margin-top:2px;color:var(--mute)">' + esc(tk.name) + ' &bull; <span style="font-style:italic">Not recorded</span></div>' +
              '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;color:var(--mute)">&mdash;</td>' +
              '<td style="vertical-align:middle;padding:10px;text-align:center;color:var(--mute)">&mdash;</td>' +
              '<td class="noprint" style="vertical-align:middle;text-align:center;padding:10px">' +
                '<button class="ghost" style="padding:3px 8px;font-size:11px;color:var(--btn)" onclick="densRegisterForm(' + tk.id + ',\'' + dStr + '\')">+ Record</button>' +
              '</td>' +
            '</tr>';
          }
        });
      } else {
        // No tanks configured
        var recList = densByDateTank[dStr + "_"];
        if (recList && recList.length) {
          recList.forEach(function(r) {
            if (r.id) renderedDensIds[r.id] = true;
            var dParts = (r.d || '').split('-');
            var dFmt = dParts.length === 3 ? (parseInt(dParts[2], 10) + '/' + parseInt(dParts[1], 10) + '/' + dParts[0]) : r.d;
            var isWarning = r.dens_diff != null && Math.abs(r.dens_diff) > 3.0;
            h += '<tr>' +
              '<td style="vertical-align:middle;padding:10px;white-space:nowrap">' +
                '<span style="font-weight:700;color:var(--ink)">' + esc(dFmt) + '</span>' +
              '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px">' + (fld(r.m_obs) || '&mdash;') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px">' + (fld(r.m_temp) || '&mdash;') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;background:rgba(37,99,235,0.06);font-weight:800;color:var(--ink)">' + (fld(r.m_d15) || '&mdash;') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px 6px">' + (fld(r.comp1) || '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px 6px">' + (fld(r.comp2) || '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px 6px">' + (fld(r.comp3) || '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px 6px">' + (fld(r.comp4) || '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-weight:700">' + (fld(r.mix_dens) || '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px">' + (fld(r.chalan_dens) || '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;font-weight:800;color:' + (r.dens_diff != null ? (isWarning ? 'var(--due)' : 'var(--ok)') : 'inherit') + '">' + (r.dens_diff != null ? fld(r.dens_diff) : '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px">' + (fld(r.pre_dip) || '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px">' + (r.pre_stock != null ? lt(r.pre_stock) : '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px;background:rgba(16,185,129,0.06);font-weight:800;color:var(--ink)">' + (fld(r.post_dens) || '') + '</td>' +
              '<td class="r" style="vertical-align:middle;padding:10px">' + (r.receipt_kl != null ? (fld(r.receipt_kl) + ' KL') : '') + '</td>' +
              '<td style="vertical-align:middle;padding:10px;text-align:center">' + esc(r.chalan_no || '') + '</td>' +
              '<td class="noprint" style="vertical-align:middle;text-align:center;padding:10px">' +
                (r.id > 0 ? '<button class="ghost" style="padding:4px 8px;font-size:12px" title="Delete density check" onclick="delDensReg(' + r.id + ')">Delete</button>' : '<span style="color:var(--mute)">&mdash;</span>') +
              '</td>' +
            '</tr>';
          });
        } else {
          h += '<tr style="opacity:0.75;background:rgba(0,0,0,0.01)">' +
            '<td style="vertical-align:middle;padding:10px;white-space:nowrap">' +
              '<span style="font-weight:700;color:var(--ink)">' + fmtDateDMY(dStr) + '</span>' +
              '<div class="sub" style="font-size:11px;margin-top:2px;color:var(--mute)">Not recorded</div>' +
            '</td>' +
            '<td colspan="15" class="r" style="vertical-align:middle;padding:10px;color:var(--mute);text-align:center">&mdash;</td>' +
            '<td class="noprint" style="vertical-align:middle;text-align:center;padding:10px">' +
              '<button class="ghost" style="padding:3px 8px;font-size:11px;color:var(--btn)" onclick="densRegisterForm(null,\'' + dStr + '\')">+ Record</button>' +
            '</td>' +
          '</tr>';
        }
      }
    });

    // Any remaining pRows outside datesList
    pRows.forEach(function(r) {
      if (r.id && renderedDensIds[r.id]) return;
      var dParts = (r.d || '').split('-');
      var dFmt = dParts.length === 3 ? (parseInt(dParts[2], 10) + '/' + parseInt(dParts[1], 10) + '/' + dParts[0]) : r.d;
      var isWarning = r.dens_diff != null && Math.abs(r.dens_diff) > 3.0;

      h += '<tr>' +
        '<td style="vertical-align:middle;padding:10px;white-space:nowrap">' +
          '<span style="font-weight:700;color:var(--ink)">' + esc(dFmt) + '</span>' +
          (r.tank_name ? '<div class="sub" style="font-size:11px;margin-top:2px">' + esc(r.tank_name) + '</div>' : '') +
        '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (fld(r.m_obs) || '&mdash;') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (fld(r.m_temp) || '&mdash;') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(37,99,235,0.06);font-weight:800;color:var(--ink)">' + (fld(r.m_d15) || '&mdash;') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px 6px;font-variant-numeric:tabular-nums">' + (fld(r.comp1) || '') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px 6px;font-variant-numeric:tabular-nums">' + (fld(r.comp2) || '') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px 6px;font-variant-numeric:tabular-nums">' + (fld(r.comp3) || '') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px 6px;font-variant-numeric:tabular-nums">' + (fld(r.comp4) || '') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;font-weight:700">' + (fld(r.mix_dens) || '') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (fld(r.chalan_dens) || '') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;font-weight:800;font-size:14px;color:' + (r.dens_diff != null ? (isWarning ? 'var(--due)' : 'var(--ok)') : 'inherit') + '">' + (r.dens_diff != null ? fld(r.dens_diff) : '') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (fld(r.pre_dip) || '') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (r.pre_stock != null ? lt(r.pre_stock) : '') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;background:rgba(16,185,129,0.06);font-weight:800;color:var(--ink)">' + (fld(r.post_dens) || '') + '</td>' +
        '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums">' + (r.receipt_kl != null ? (fld(r.receipt_kl) + ' KL') : '') + '</td>' +
        '<td style="vertical-align:middle;padding:10px;text-align:center;font-size:12px">' + esc(r.chalan_no || '') + '</td>' +
        '<td class="noprint" style="vertical-align:middle;text-align:center;padding:10px">' +
          (r.id > 0 ? '<button class="ghost" style="padding:4px 8px;font-size:12px" title="Delete density check" onclick="delDensReg(' + r.id + ')">Delete</button>' : '<span style="color:var(--mute)">&mdash;</span>') +
        '</td>' +
      '</tr>';
    });

    // Product footer summary row
    h += '<tfoot>' +
      '<tr style="background:rgba(0,0,0,0.035);font-weight:800;border-top:2px solid var(--line)">' +
        '<td style="padding:10px">' + esc(fName) + ' Summary (' + pRows.length + ' of ' + (datesList.length * Math.max(1, pTanks.length)) + ' days recorded)</td>' +
        '<td class="r" style="padding:10px">&mdash;</td>' +
        '<td class="r" style="padding:10px">&mdash;</td>' +
        '<td class="r" style="padding:10px;color:var(--ink);background:rgba(37,99,235,0.08)">' + (avgM15 ? avgM15 : '&mdash;') + '</td>' +
        '<td class="r" style="padding:10px" colspan="4">&mdash;</td>' +
        '<td class="r" style="padding:10px">' + (avgMix ? avgMix : '&mdash;') + '</td>' +
        '<td class="r" style="padding:10px">' + (avgChal ? avgChal : '&mdash;') + '</td>' +
        '<td class="r" style="padding:10px;color:' + (warnDiffs > 0 ? 'var(--due)' : 'var(--ok)') + '">' + (warnDiffs === 0 ? '✓ &le; 3.0' : warnDiffs + ' &gt; 3.0') + '</td>' +
        '<td class="r" style="padding:10px">&mdash;</td>' +
        '<td class="r" style="padding:10px">&mdash;</td>' +
        '<td class="r" style="padding:10px;background:rgba(16,185,129,0.08)">&mdash;</td>' +
        '<td class="r" style="padding:10px;color:var(--ok)">' + (totDecantKL > 0 ? fld(totDecantKL) + ' KL' : '&mdash;') + '</td>' +
        '<td style="padding:10px;text-align:center">&mdash;</td>' +
        '<td class="noprint" style="padding:10px">&mdash;</td>' +
      '</tr>' +
    '</tfoot>';

    h += '</tbody></table></div>';
  });

  if (!anyDensRendered) {
    h += '<div class="empty" style="margin:20px 0;padding:24px">No density checks matching the selected product or date range.</div>';
  }

  return h;
}

function densRegisterForm(preTankId) {
  if (!S.tanks.length) return toast("Add your tanks first in Tanks setup.");
  var todayStr = today();
  var defaultTankId = preTankId || (DENS_FILTER.tank_id ? DENS_FILTER.tank_id : (TANK_PRODUCT ? (S.tanks.filter(function(t){ return t.fuel === TANK_PRODUCT; })[0] || {}).id : S.tanks[0].id));
  openM('<h2>Record Density Check</h2><div class="sub">Log daily morning underground tank density and tanker receipt decantation</div>' +
    '<div class="row"><label>Date<input id="dr_d" type="date" value="' + todayStr + '"></label>' +
    '<label>Tank<select id="dr_tank">' + S.tanks.map(function(t){return '<option value="' + t.id + '"' + (String(t.id) === String(defaultTankId) ? ' selected' : '') + '>' + esc(t.name) + ' (' + esc(t.fuel) + ')</option>'}).join("") + '</select></label></div>' +
    
    '<div style="font-weight:800;margin:14px 0 4px;color:var(--ink)">1. Morning Density at 15°C U/G Tanks</div>' +
    '<div class="row">' +
      '<label>Observed Density<input id="dr_m_obs" inputmode="decimal" placeholder="e.g. 732.0" oninput="autoCalcD15()"></label>' +
      '<label>Temp (°C)<input id="dr_m_temp" inputmode="decimal" placeholder="e.g. 27.0" oninput="autoCalcD15()"></label>' +
      '<label>Density at 15°C<input id="dr_m_d15" inputmode="decimal" placeholder="Auto / e.g. 742.7"></label>' +
    '</div>' +
    
    '<div style="margin:14px 0 6px">' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;color:var(--ink)">' +
        '<input type="checkbox" id="dr_has_deliv" onchange="var el=document.getElementById(\'dr_deliv_box\');if(el)el.style.display=this.checked?\'block\':\'none\'">' +
        'Tanker delivery received today (Decantation checks)' +
      '</label>' +
    '</div>' +
    
    '<div id="dr_deliv_box" style="display:none;background:rgba(0,0,0,0.02);padding:12px;border-radius:8px;border:1px solid var(--line);margin-bottom:8px">' +
      '<div style="font-weight:700;margin-bottom:6px;font-size:13px">Tank/Truck Receipt Density Compartments</div>' +
      '<div class="row">' +
        '<label>Comp I<input id="dr_c1" inputmode="decimal" placeholder="e.g. 742.0" oninput="autoCalcMix()"></label>' +
        '<label>Comp II<input id="dr_c2" inputmode="decimal" placeholder="e.g. 741.8" oninput="autoCalcMix()"></label>' +
        '<label>Comp III<input id="dr_c3" inputmode="decimal" placeholder="" oninput="autoCalcMix()"></label>' +
        '<label>Comp IV<input id="dr_c4" inputmode="decimal" placeholder="" oninput="autoCalcMix()"></label>' +
      '</div>' +
      '<div class="row" style="margin-top:8px">' +
        '<label>Mix Compartment Density<input id="dr_mix" inputmode="decimal" placeholder="Auto average" oninput="autoCalcDiff()"></label>' +
        '<label>Challan Density @ 15°C<input id="dr_chalan_dens" inputmode="decimal" placeholder="e.g. 741.3" oninput="autoCalcDiff()"></label>' +
        '<label>Difference (Mix &minus; Challan)<input id="dr_diff" inputmode="decimal" placeholder="Auto diff"></label>' +
      '</div>' +
      '<div style="font-weight:700;margin:12px 0 6px;font-size:13px">Stock Before Receipt & Decantation (100L Flush)</div>' +
      '<div class="row">' +
        '<label>Pre-Receipt Dip (cm)<input id="dr_pre_dip" inputmode="decimal" placeholder="e.g. 142.5"></label>' +
        '<label>Pre-Receipt Stock (L)<input id="dr_pre_stock" inputmode="decimal" placeholder="e.g. 4200"></label>' +
      '</div>' +
      '<div class="row" style="margin-top:8px">' +
        '<label>Density @ 15°C After Decant (100L)<input id="dr_post_dens" inputmode="decimal" placeholder="e.g. 741.6"></label>' +
        '<label>Receipt KL<input id="dr_rec_kl" inputmode="decimal" placeholder="e.g. 3.0 or 6.0"></label>' +
        '<label>Challan No.<input id="dr_chalan_no" placeholder="e.g. CH-91042"></label>' +
      '</div>' +
    '</div>' +
    
    '<div class="err" id="er"></div>' +
    '<div class="row" style="margin-top:14px"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveDensRegister()">Save density check</button></div>'
  );
}

function autoCalcD15() {
  var obs = parseFloat(v("dr_m_obs")), temp = parseFloat(v("dr_m_temp"));
  if (!isNaN(obs) && !isNaN(temp)) {
    var o = obs < 2 ? obs * 1000 : obs;
    var d15 = o + (temp - 15) * 0.89;
    var el = document.getElementById("dr_m_d15");
    if (el) el.value = (Math.round(d15 * 10) / 10).toFixed(1);
  }
}

function autoCalcMix() {
  var c1 = parseFloat(v("dr_c1")), c2 = parseFloat(v("dr_c2")), c3 = parseFloat(v("dr_c3")), c4 = parseFloat(v("dr_c4"));
  var arr = [c1, c2, c3, c4].filter(function(x){ return !isNaN(x); }).map(function(x){ return x < 2 ? x * 1000 : x; });
  if (arr.length > 0) {
    var avg = arr.reduce(function(a, b){ return a + b; }, 0) / arr.length;
    var el = document.getElementById("dr_mix");
    if (el) el.value = (Math.round(avg * 10) / 10).toFixed(1);
    autoCalcDiff();
  }
}

function autoCalcDiff() {
  var mix = parseFloat(v("dr_mix")), ch = parseFloat(v("dr_chalan_dens"));
  if (!isNaN(mix) && !isNaN(ch)) {
    var m = mix < 2 ? mix * 1000 : mix;
    var c = ch < 2 ? ch * 1000 : ch;
    var df = Math.abs(m - c);
    var el = document.getElementById("dr_diff");
    if (el) el.value = (Math.round(df * 10) / 10).toFixed(1);
  }
}

function saveDensRegister() {
  var b = {
    d: v("dr_d"),
    tank_id: v("dr_tank"),
    m_obs: v("dr_m_obs"),
    m_temp: v("dr_m_temp"),
    m_d15: v("dr_m_d15")
  };
  var chk = document.getElementById("dr_has_deliv");
  if (chk && chk.checked) {
    b.comp1 = v("dr_c1");
    b.comp2 = v("dr_c2");
    b.comp3 = v("dr_c3");
    b.comp4 = v("dr_c4");
    b.mix_dens = v("dr_mix");
    b.chalan_dens = v("dr_chalan_dens");
    b.dens_diff = v("dr_diff");
    b.pre_dip = v("dr_pre_dip");
    b.pre_stock = v("dr_pre_stock");
    b.post_dens = v("dr_post_dens");
    b.receipt_kl = v("dr_rec_kl");
    b.chalan_no = v("dr_chalan_no");
  }
  if (!b.tank_id) return er("Please choose a tank.");
  if (!b.d) return er("Please select a date.");
  if (!b.m_obs && !b.m_d15 && !(chk && chk.checked)) return er("Please enter observed density or temperature.");
  api("POST", "/api/density-register", b).then(function() {
    close();
    renderTanks();
  }).catch(function(e) {
    er(e.error || "Could not save density check.");
  });
}

function delDensReg(id) {
  ask("Delete this density register entry?", function() {
    api("DELETE", "/api/density-register/" + id).then(renderTanks).catch(function(e) {
      badge(e.error || "Could not delete.");
    });
  });
}
function fuelEdit(i){var l=fprods(),p=i>=0?l[i]:{name:"",unit:"L",active:true};
openM('<h2>'+(i>=0?'Edit fuel product':'Add fuel product')+'</h2><label>Name<input id="fp1" value="'+esc(p.name)+'" placeholder="e.g. XP95 or CNG"></label><label>Unit<select id="fp2">'+["L","kg","kWh"].map(function(u){return '<option'+(p.unit==u?' selected':'')+'>'+u+'</option>'}).join("")+'</select></label><label>Status<select id="fp3"><option value="1"'+(p.active!==false?' selected':'')+'>Active</option><option value="0"'+(p.active===false?' selected':'')+'>Inactive</option></select></label><div class="sub" style="margin-top:10px">Density limits (liquid fuels only; leave blank to use the defaults)</div><div class="row"><label>Lowest<input id="fp4" inputmode="decimal" value="'+(p.dmin==null?"":p.dmin)+'"></label><label>Highest<input id="fp5" inputmode="decimal" value="'+(p.dmax==null?"":p.dmax)+'"></label><label>Tolerance<input id="fp6" inputmode="decimal" value="'+(p.dtol==null?"":p.dtol)+'" placeholder="0.003"></label></div><div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="ghost" onclick="close()">Cancel</button><button onclick="fuelSave('+i+')">Save</button></div>')}
function fuelSave(i){var nm=v("fp1");if(!nm)return er("Enter the name.");var l=fprods().map(function(p){return Object.assign({},p)});
if(l.some(function(p,k){return k!=i&&p.name.toLowerCase()==nm.toLowerCase()}))return er("That fuel product already exists.");
var nz=function(t){return t===""?null:parseFloat(t)},o={name:nm,unit:v("fp2"),active:v("fp3")=="1",dmin:nz(v("fp4")),dmax:nz(v("fp5")),dtol:nz(v("fp6"))};
if([o.dmin,o.dmax,o.dtol].some(function(x){return x!=null&&isNaN(x)}))return er("Density limits must be numbers such as 0.745.");
if(i>=0){var old=l[i].name;Object.assign(l[i],o);if(old!=nm){S.nozzles.forEach(function(n){if(n.fuel==old)n.fuel=nm});S.tanks.forEach(function(t){if(t.fuel==old)t.fuel=nm});S.rates.forEach(function(r){if(r.fuel==old)r.fuel=nm})}}else{o.id=Date.now();l.push(o)}
S.fuelprods=l;save();close();renderSetup()}
var IMP=null;
async function inflateRaw(u8){var ds=new DecompressionStream("deflate-raw"),w=ds.writable.getWriter();w.write(u8);w.close();var r=ds.readable.getReader(),parts=[],n=0;for(;;){var x=await r.read();if(x.done)break;parts.push(x.value);n+=x.value.length}var out=new Uint8Array(n),o=0;parts.forEach(function(p){out.set(p,o);o+=p.length});return out}
function unzipIndex(buf){var u=new Uint8Array(buf),dv=new DataView(buf),i=u.length-22;while(i>=0&&dv.getUint32(i,true)!==0x06054b50)i--;if(i<0)throw new Error("This is not a valid .xlsx file.");var cnt=dv.getUint16(i+10,true),off=dv.getUint32(i+16,true),F={};
for(var k=0;k<cnt;k++){var meth=dv.getUint16(off+10,true),csz=dv.getUint32(off+20,true),nl=dv.getUint16(off+28,true),xl=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),lo=dv.getUint32(off+42,true),name=new TextDecoder().decode(u.subarray(off+46,off+46+nl)),lnl=dv.getUint16(lo+26,true),lxl=dv.getUint16(lo+28,true),ds=lo+30+lnl+lxl;F[name]={meth:meth,data:u.subarray(ds,ds+csz)};off+=46+nl+xl+cl}return F}
async function ftext(f){return new TextDecoder().decode(f.meth==0?f.data:await inflateRaw(f.data))}
async function parseXlsx(buf){var F=unzipIndex(buf),ss=[];
if(F["xl/sharedStrings.xml"]){var x=new DOMParser().parseFromString(await ftext(F["xl/sharedStrings.xml"]),"text/xml");[].forEach.call(x.getElementsByTagName("si"),function(si){ss.push([].map.call(si.getElementsByTagName("t"),function(t){return t.textContent}).join(""))})}
var sn=Object.keys(F).filter(function(n){return /^xl\/worksheets\/sheet\d+\.xml$/.test(n)}).sort(function(a,b){return parseInt(a.replace(/\D/g,""))-parseInt(b.replace(/\D/g,""))})[0];if(!sn)throw new Error("No sheet was found in this file.");
var sx=new DOMParser().parseFromString(await ftext(F[sn]),"text/xml"),rows=[];
[].forEach.call(sx.getElementsByTagName("row"),function(r){var row=[];[].forEach.call(r.getElementsByTagName("c"),function(c){var col=0;(c.getAttribute("r")||"A").replace(/[A-Z]+/,function(m){for(var j=0;j<m.length;j++)col=col*26+m.charCodeAt(j)-64;return""});col--;var t=c.getAttribute("t"),vv=c.getElementsByTagName("v")[0],val="";
if(t=="s")val=vv?ss[+vv.textContent]||"":"";else if(t=="inlineStr")val=[].map.call(c.getElementsByTagName("t"),function(z){return z.textContent}).join("");else if(vv)val=(t=="str"||t=="b"||isNaN(+vv.textContent))?vv.textContent:+vv.textContent;row[col]=val});
var out=[];for(var q=0;q<row.length;q++)out.push(row[q]==null?"":row[q]);rows.push(out)});return rows}
function parseCsv(t){var rows=[],row=[],cur="",q=false;for(var i=0;i<t.length;i++){var c=t[i];if(q){if(c=='"'&&t[i+1]=='"'){cur+='"';i++}else if(c=='"')q=false;else cur+=c}else if(c=='"')q=true;else if(c==","||c=="\t"||c==";"){row.push(cur);cur=""}else if(c=="\n"||c=="\r"){if(c=="\r"&&t[i+1]=="\n")i++;row.push(cur);rows.push(row);row=[];cur=""}else cur+=c}if(cur!==""||row.length){row.push(cur);rows.push(row)}return rows}
var IMPCOL={name:["name","product","productname","item","itemname"],cat:["category","cat","group"],unit:["unit","uom"],sell:["sellingprice","sellprice","price","mrp","rate","salesprice","salerate"],buy:["purchaseprice","buyprice","cost","costprice"],stock:["openingstock","stock","quantity","qty"],low:["lowstocklevel","lowstock","reorderlevel","minstock","alertlevel"],gst:["gst","gstrate","gstpercent","tax"],hsn:["hsn","hsncode","hsnsac"]};
function hkey(x){return String(x).toLowerCase().replace(/[^a-z0-9]/g,"")}
function pnum(x){if(typeof x=="number")return x;var t=String(x==null?"":x).replace(/[^0-9.\-]/g,"");return t===""?null:parseFloat(t)}
function normUnit(u){var k=String(u||"").toLowerCase().trim();if(!k)return"piece";if(["piece","pc","pcs","nos","no","unit","units","each"].indexOf(k)>=0)return"piece";if(["litre","liter","l","ltr","ltrs","lt","litres","liters"].indexOf(k)>=0)return"litre";if(["pack","packet","pkt","box","can","carton"].indexOf(k)>=0)return"pack";if(["kg","kgs","kilogram","kilograms"].indexOf(k)>=0)return"kg";return"piece"}
function impBuild(rows){var hi=-1,map={};for(var i=0;i<rows.length&&hi<0;i++){var m={};rows[i].forEach(function(c,ci){var k=hkey(c);Object.keys(IMPCOL).forEach(function(f){if(m[f]==null&&IMPCOL[f].indexOf(k)>=0)m[f]=ci})});if(m.name!=null&&m.sell!=null){hi=i;map=m}}
if(hi<0)throw new Error("Could not find the column headings. The first row needs at least Name and Selling price.");
var out=[],seen={};for(var r=hi+1;r<rows.length;r++){var row=rows[r],g=function(f){return map[f]==null?"":row[map[f]]},nm=String(g("name")).trim();if(!nm&&row.every(function(c){return String(c).trim()===""}))continue;
var o={i:out.length,line:r+1,name:nm,cat:String(g("cat")).trim(),unit:normUnit(g("unit")),sell:pnum(g("sell")),buy:pnum(g("buy")),stock:pnum(g("stock")),low:pnum(g("low")),gst:pnum(g("gst")),hsn:String(g("hsn")).trim(),has:{},st:"new",why:"",act:"add"};
["cat","unit","buy","stock","low","gst","hsn"].forEach(function(f){o.has[f]=map[f]!=null&&String(g(f)).trim()!==""});
var why="";if(!nm)why="No name";else if(!(o.sell>0))why="Selling price must be above zero";else if(o.has.gst&&[0,5,12,18,28].indexOf(o.gst)<0)why="GST rate must be 0, 5, 12, 18 or 28";else if((o.buy!=null&&o.buy<0)||(o.stock!=null&&o.stock<0)||(o.low!=null&&o.low<0))why="Prices and stock cannot be negative";
else if(seen[nm.toLowerCase()]!=null)why="Same name as row "+seen[nm.toLowerCase()];
if(why){o.st="bad";o.why=why;o.act="skip"}else{seen[nm.toLowerCase()]=o.line;var ex=S.items.filter(function(x){return x.name.toLowerCase()==nm.toLowerCase()})[0];if(ex){o.st="exists";o.ex=ex.id;o.act="skip"}}
out.push(o)}return out}
async function impFile(f){if(!f)return;try{var rows;if(/\.xlsx$/i.test(f.name)){if(typeof DecompressionStream=="undefined")throw new Error("This browser cannot read .xlsx files. Save the sheet as .csv and try again.");rows=await parseXlsx(await f.arrayBuffer())}else rows=parseCsv(await f.text());IMP={name:f.name,rows:impBuild(rows)};renderImport()}catch(e){er(e.message||"Could not read the file.")}}
function impTemplate(){var d=xdoc("Product import template","");d.notitle=true;xsec(d,"Products",["Name","Category","Unit","Selling price","Purchase price","Opening stock","Low stock level","GST %","HSN"],[["Engine oil 1 L","Engine oil","piece",520,430,24,6,18,"2710"],["Coolant 1 L","Coolant","piece",260,200,12,4,18,"3820"]],"Products");saveBytes(xlsxBytes(d),"product-import-template.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
function renderImport(){var h=nav()+'<button class="ghost noprint" onclick="IMP=null;renderStock()">Back to stock</button><h1 style="margin-top:14px">Import products from Excel</h1>';
if(!IMP)h+='<div class="sub">Use an .xlsx or .csv file with these column headings: Name, Category, Unit, Selling price, Purchase price, Opening stock, Low stock level, GST %, HSN. Only Name and Selling price are required. You will see a preview and choose what to import before anything is saved.</div><div class="btns"><button class="ghost" onclick="impTemplate()">Download template</button></div><label>Choose your file<input type="file" accept=".xlsx,.csv,.txt" onchange="impFile(this.files[0])"></label><div class="err" id="er"></div>';
else{var R=IMP.rows,nn=R.filter(function(x){return x.st=="new"}).length,ne=R.filter(function(x){return x.st=="exists"}).length,nb=R.filter(function(x){return x.st=="bad"}).length;
h+='<div class="sub">'+esc(IMP.name)+': '+R.length+' rows. '+nn+' new, '+ne+' already in stock, '+nb+' with a problem.</div><div class="btns noprint"><button class="ghost" onclick="impAll(\'add\',\'new\')">Add all new</button><button class="ghost" onclick="impAll(\'update\',\'exists\')">Update all existing</button><button class="ghost" onclick="impAll(\'skip\',\'exists\')">Skip all existing</button></div>';
R.forEach(function(o,i){var ctl=o.st=="bad"?'<span style="color:var(--due)">'+esc(o.why)+'</span>':o.st=="new"?'<select onchange="IMP.rows['+i+'].act=this.value"><option value="add"'+(o.act=="add"?' selected':'')+'>Add</option><option value="skip"'+(o.act=="skip"?' selected':'')+'>Skip</option></select>':'<select onchange="IMP.rows['+i+'].act=this.value"><option value="update"'+(o.act=="update"?' selected':'')+'>Update existing</option><option value="skip"'+(o.act=="skip"?' selected':'')+'>Skip</option></select>';
h+='<div class="cust" style="cursor:default;padding:10px 12px"><div class="row"><b>'+esc(o.name||"(no name)")+'</b><span class="sub" style="flex:none">'+(o.st=="exists"?"Already in stock":o.st=="new"?"New":"Problem")+' \u00b7 row '+o.line+'</span></div><div class="sub">'+esc(o.cat||"No category")+' \u00b7 '+esc(o.unit)+' \u00b7 Sell '+(o.sell==null?"-":m2(o.sell))+' \u00b7 Buy '+(o.buy==null?"-":m2(o.buy))+' \u00b7 Stock '+(o.stock==null?"-":o.stock)+' \u00b7 GST '+(o.gst==null?"18 (default)":o.gst)+'%'+(o.hsn?' \u00b7 HSN '+esc(o.hsn):'')+'</div><div style="margin-top:6px">'+ctl+'</div></div>'});
h+='<div class="sub" style="margin-top:8px">For products already in stock, only the columns that have a value in your file are updated, and the current stock quantity is never changed.</div><div class="err" id="er"></div><div class="row" style="margin-top:10px"><button class="ghost" onclick="IMP=null;renderImport()">Choose another file</button><button onclick="impRun()">Import</button></div>'}
document.getElementById("app").innerHTML=h}
function impAll(act,st){IMP.rows.forEach(function(o){if(o.st==st)o.act=act});renderImport()}
function impRun(){var a=0,u=0;IMP.rows.forEach(function(o){if(o.st=="bad"||o.act=="skip")return;if(o.cat&&itemCats().indexOf(o.cat)<0)S.itemcats.push(o.cat);
if(o.st=="new"&&o.act=="add"){S.items.push({id:Date.now()+o.i,name:o.name,cat:o.cat,unit:o.unit,sell:o.sell,buy:o.buy==null?0:o.buy,stock:o.stock==null?0:o.stock,low:o.low==null?0:o.low,gst:o.gst==null?18:o.gst,hsn:o.hsn});a++}
else if(o.st=="exists"&&o.act=="update"){var it=itm(o.ex);it.sell=o.sell;if(o.has.cat)it.cat=o.cat;if(o.has.unit)it.unit=o.unit;if(o.has.buy)it.buy=o.buy;if(o.has.low)it.low=o.low;if(o.has.gst)it.gst=o.gst;if(o.has.hsn)it.hsn=o.hsn;u++}});
save();IMP=null;renderStock();toast("Imported: "+a+" added, "+u+" updated.")}
var LANG="en",I18=null,I18N={
"Password":["पासवर्ड","पासवर्ड"],"Log out":["लॉग आउट","लॉग आउट"],"Duty":["ड्युटी","ड्यूटी"],"Credit sale":["उधार विक्री","उधार बिक्री"],"Tank dip":["टाकी डिप","टैंक डिप"],"My pay":["माझा पगार","मेरा वेतन"],
"Change password":["पासवर्ड बदला","पासवर्ड बदलें"],"Current password":["सध्याचा पासवर्ड","मौजूदा पासवर्ड"],"New password (6+ characters)":["नवीन पासवर्ड (६+ अक्षरे)","नया पासवर्ड (6+ अक्षर)"],"Password changed":["पासवर्ड बदलला","पासवर्ड बदल गया"],
"My duty":["माझी ड्युटी","मेरी ड्यूटी"],"No duty assigned yet. Your manager assigns your shift and nozzles.":["अजून ड्युटी दिलेली नाही. तुमचे व्यवस्थापक तुमची शिफ्ट आणि नोझल ठरवतात.","अभी कोई ड्यूटी नहीं मिली है। आपके मैनेजर आपकी शिफ्ट और नोज़ल तय करते हैं।"],
"My recent duties":["माझ्या अलीकडील ड्युटी","मेरी हाल की ड्यूटी"],"No duties yet.":["अजून ड्युटी नाही.","अभी कोई ड्यूटी नहीं।"],"Closed":["बंद","बंद"],"Waiting for manager":["व्यवस्थापकाची प्रतीक्षा","मैनेजर की प्रतीक्षा"],"Back to my duties":["माझ्या ड्युटीकडे परत","मेरी ड्यूटी पर वापस"],
"Opening readings and rates are set by your manager. Credit sales you save during this duty are counted automatically.":["सुरुवातीचे रीडिंग आणि दर तुमचे व्यवस्थापक ठरवतात. या ड्युटीत तुम्ही नोंदवलेली उधार विक्री आपोआप मोजली जाते.","शुरुआती रीडिंग और रेट आपके मैनेजर तय करते हैं। इस ड्यूटी में आपकी दर्ज की गई उधार बिक्री अपने-आप गिनी जाती है।"],
"Opening":["सुरुवातीचे रीडिंग","शुरुआती रीडिंग"],"Closing":["शेवटचे रीडिंग","अंतिम रीडिंग"],"Enter the closing reading":["शेवटचे रीडिंग टाका","अंतिम रीडिंग डालें"],
"Lubes and shop":["ल्युब आणि दुकान","ल्यूब और दुकान"],"Choose item":["वस्तू निवडा","वस्तु चुनें"],"Quantity":["प्रमाण","मात्रा"],"Remove":["काढा","हटाएं"],"Add lube or shop item":["ल्युब किंवा दुकानातील वस्तू जोडा","ल्यूब या दुकान की वस्तु जोड़ें"],
"Expenses paid from the till":["गल्ल्यातून दिलेला खर्च","गल्ले से दिया गया खर्च"],"Details":["तपशील","विवरण"],"Amount (₹)":["रक्कम (₹)","राशि (₹)"],"Add expense":["खर्च जोडा","खर्च जोड़ें"],
"Money collected":["जमा केलेले पैसे","जमा किया गया पैसा"],"Cash":["रोख","नकद"],"UPI":["UPI","UPI"],"Card":["कार्ड","कार्ड"],"Note (optional)":["टीप (ऐच्छिक)","नोट (वैकल्पिक)"],
"Save draft":["मसुदा जतन करा","ड्राफ्ट सेव करें"],"Submit duty":["ड्युटी सादर करा","ड्यूटी जमा करें"],"Draft saved.":["मसुदा जतन केला.","ड्राफ्ट सेव हो गया।"],
"Submit this duty to the manager? You cannot change it after this.":["ही ड्युटी व्यवस्थापकाकडे सादर करायची का? यानंतर तुम्ही बदल करू शकणार नाही.","क्या यह ड्यूटी मैनेजर को जमा करें? इसके बाद आप बदलाव नहीं कर सकेंगे।"],
"Please confirm":["कृपया खात्री करा","कृपया पुष्टि करें"],"Cancel":["रद्द करा","रद्द करें"],"Yes, continue":["होय, पुढे जा","हाँ, आगे बढ़ें"],"Close":["बंद करा","बंद करें"],"Save":["जतन करा","सेव करें"],"Loading…":["लोड होत आहे…","लोड हो रहा है…"],
"Liquid fuel sold":["विकलेले द्रव इंधन","बिका तरल ईंधन"],"Fuel sales":["इंधन विक्री","ईंधन बिक्री"],"Lube and shop sales":["ल्युब आणि दुकान विक्री","ल्यूब और दुकान की बिक्री"],"Less credit sales":["वजा उधार विक्री","घटाएं: उधार बिक्री"],
"Less expenses paid from the till":["वजा गल्ल्यातून दिलेला खर्च","घटाएं: गल्ले से दिया खर्च"],"Expected collection":["अपेक्षित जमा","अपेक्षित जमा"],"Collected":["जमा केले","जमा किया"],"Short":["कमी","कम"],"Excess":["जास्त","ज्यादा"],"Tally":["बरोबर","बराबर"],
"Nozzle":["नोझल","नोज़ल"],"Open":["सुरू","शुरू"],"Test":["टेस्ट","टेस्ट"],"Qty":["प्रमाण","मात्रा"],"Rate":["दर","रेट"],"Amount":["रक्कम","राशि"],"Lube / shop":["ल्युब / दुकान","ल्यूब / दुकान"],"Price":["किंमत","कीमत"],"Expense":["खर्च","खर्च"],"Less expenses":["वजा खर्च","घटाएं: खर्च"],"Difference":["फरक","अंतर"],
"Saved sales appear in the customer ledger straight away.":["जतन केलेली विक्री लगेच ग्राहकाच्या खात्यात दिसते.","सेव की गई बिक्री तुरंत ग्राहक के खाते में दिखती है।"],"Customer":["ग्राहक","ग्राहक"],"Choose customer":["ग्राहक निवडा","ग्राहक चुनें"],"Vehicle number":["वाहन क्रमांक","वाहन नंबर"],"Fuel":["इंधन","ईंधन"],
"Other item (not fuel)":["इतर वस्तू (इंधन नाही)","अन्य वस्तु (ईंधन नहीं)"],"Quantity (litres, kg or kWh)":["प्रमाण (लिटर, किलो किंवा kWh)","मात्रा (लीटर, किलो या kWh)"],"Details (needed for other items)":["तपशील (इतर वस्तूंसाठी आवश्यक)","विवरण (अन्य वस्तुओं के लिए जरूरी)"],
"Save credit sale":["उधार विक्री जतन करा","उधार बिक्री सेव करें"],"My recent entries":["माझ्या अलीकडील नोंदी","मेरी हाल की प्रविष्टियाँ"],"No entries yet.":["अजून नोंदी नाहीत.","अभी कोई प्रविष्टि नहीं।"],"Waiting for manager approval":["व्यवस्थापकाच्या मंजुरीची प्रतीक्षा","मैनेजर की मंजूरी की प्रतीक्षा"],"Rejected by manager":["व्यवस्थापकाने नाकारले","मैनेजर ने अस्वीकार किया"],
"Choose a customer.":["ग्राहक निवडा.","ग्राहक चुनें।"],"Enter the litres.":["प्रमाण टाका.","मात्रा डालें।"],"Describe the item.":["वस्तूचे वर्णन लिहा.","वस्तु का विवरण लिखें।"],"Enter an amount above zero.":["शून्यापेक्षा जास्त रक्कम टाका.","शून्य से अधिक राशि डालें।"],"Could not save. Check your connection.":["जतन करता आले नाही. इंटरनेट तपासा.","सेव नहीं हो सका। कनेक्शन जांचें।"],"This customer is inactive.":["हा ग्राहक निष्क्रिय आहे.","यह ग्राहक निष्क्रिय है।"],
"Tank dip reading":["टाकी डिप रीडिंग","टैंक डिप रीडिंग"],"Tank":["टाकी","टैंक"],"Choose tank":["टाकी निवडा","टैंक चुनें"],"Litres (from the dip chart)":["लिटर (डिप चार्टनुसार)","लीटर (डिप चार्ट से)"],"or":["किंवा","या"],"Dip reading (same unit as your dip chart)":["डिप रीडिंग (डिप चार्टच्या एककात)","डिप रीडिंग (डिप चार्ट वाली इकाई में)"],
"Density check (optional)":["घनता तपासणी (ऐच्छिक)","घनत्व जांच (वैकल्पिक)"],"Measured":["मोजलेली","मापा गया"],"Temp °C":["तापमान °C","तापमान °C"],"At 15 °C":["15 °C वर","15 °C पर"],"Save reading":["रीडिंग जतन करा","रीडिंग सेव करें"],"My recent readings":["माझी अलीकडील रीडिंग","मेरी हाल की रीडिंग"],"No readings yet.":["अजून रीडिंग नाही.","अभी कोई रीडिंग नहीं।"],
"Density Register":["घनता रजिस्टर","घनत्व रजिस्टर"],"Tank Stock & Dips":["टाकी साठा आणि डिप","टैंक स्टॉक और डिप"],"+ Morning Density":["+ सकाळची घनता","+ सुबह का घनत्व"],"+ Decantation (TT)":["+ डिकँटेशन (TT)","+ डिकेंटेशन (TT)"],"Export Excel":["एक्सेल एक्सपोर्ट","एक्सेल निर्यात"],"Observed Density (kg/m³)":["मोजलेली घनता (kg/m³)","मापी गई घनत्व (kg/m³)"],"Temperature (°C)":["तापमान (°C)","तापमान (°C)"],"Density At 15°C (kg/m³)":["15°C वर घनता (kg/m³)","15°C पर घनत्व (kg/m³)"],
"No tanks are set up yet. Ask the manager.":["अजून टाक्या सेट केलेल्या नाहीत. व्यवस्थापकाला विचारा.","अभी टैंक सेट नहीं हैं। मैनेजर से पूछें।"],"Choose a tank.":["टाकी निवडा.","टैंक चुनें।"],"Enter the litres or the dip reading.":["लिटर किंवा डिप रीडिंग टाका.","लीटर या डिप रीडिंग डालें।"],
"Month":["महिना","महीना"],"Net pay for the month":["महिन्याचा निव्वळ पगार","महीने का शुद्ध वेतन"],"Duties":["ड्युटी","ड्यूटी"],"Bonus":["बोनस","बोनस"],"Advances":["उचल","अग्रिम"],"Cash shortage":["रोख कमतरता","नकद कमी"],"Already paid":["आधीच दिलेले","पहले दिया गया"],"Balance to pay":["देणे बाकी","देय शेष"],
"Entries this month":["या महिन्यातील नोंदी","इस महीने की प्रविष्टियाँ"],"Advance":["उचल","अग्रिम"],"Shortage waived":["कमतरता माफ","कमी माफ"],"Paid":["दिले","चुकाया"],"No closed duties":["बंद झालेली ड्युटी नाही","कोई बंद ड्यूटी नहीं"],"Some duties have no rate set, so they count as zero.":["काही ड्युटींचा दर ठरवलेला नाही, म्हणून त्या शून्य मोजल्या आहेत.","कुछ ड्यूटी का रेट तय नहीं है, इसलिए वे शून्य गिनी गई हैं।"],
"Morning":["सकाळ","सुबह"],"Evening":["संध्याकाळ","शाम"],"Night":["रात्र","रात"],"Other":["इतर","अन्य"]},
I18R=[
[/^(Morning|Evening|Night) duty · (.*)$/,function(m,l){return trw(m[1],l)+(l==0?" ड्युटी · ":" ड्यूटी · ")+m[2]}],
[/^Testing \((.*)\)$/,function(m,l){return (l==0?"टेस्टिंग (":"टेस्टिंग (")+m[1]+")"}],
[/^Rate \(₹\/(.*)\)$/,function(m,l){return (l==0?"दर (₹/":"रेट (₹/")+m[1]+")"}],
[/^(.*) (L|kg|kWh) sold = (.*)$/,function(m,l){return m[1]+" "+m[2]+(l==0?" विक्री = ":" बिक्री = ")+m[3]}],
[/^(Short|Excess) (.*)$/,function(m,l){return trw(m[1],l)+" "+m[2]}],
[/^Credit available: (.*)$/,function(m,l){return (l==0?"उपलब्ध क्रेडिट: ":"उपलब्ध क्रेडिट: ")+m[1]}],
[/^This is more than the customer's available credit \((.*)\)\. It will be sent to a manager for approval\. Continue\?$/,function(m,l){return l==0?"ही रक्कम ग्राहकाच्या उपलब्ध क्रेडिटपेक्षा जास्त आहे ("+m[1]+"). ती व्यवस्थापकाच्या मंजुरीसाठी पाठवली जाईल. पुढे जायचे?":"यह राशि ग्राहक के उपलब्ध क्रेडिट ("+m[1]+") से ज्यादा है। इसे मैनेजर की मंजूरी के लिए भेजा जाएगा। आगे बढ़ें?"}],
[/^Note: (.*)$/,function(m,l){return (l==0?"टीप: ":"नोट: ")+m[1]}],
[/^(\d+) duty not yet closed, not counted$/,function(m,l){return l==0?m[1]+" ड्युटी अजून बंद नाही, मोजलेली नाही":m[1]+" ड्यूटी अभी बंद नहीं, गिनी नहीं गई"}],
[/^(.*) waived$/,function(m,l){return m[1]+(l==0?" माफ":" माफ")}],
[/^Enter the closing reading for (.*)\.$/,function(m,l){return l==0?m[1]+" साठी शेवटचे रीडिंग टाका.":m[1]+" के लिए अंतिम रीडिंग डालें।"}],
[/^Closing is less than opening for (.*)\.$/,function(m,l){return l==0?m[1]+" चे शेवटचे रीडिंग सुरुवातीच्या रीडिंगपेक्षा कमी आहे.":m[1]+" का अंतिम रीडिंग शुरुआती रीडिंग से कम है।"}],
[/^Testing litres are more than the fuel dispensed on (.*)\.$/,function(m,l){return l==0?m[1]+" वर टेस्टिंग प्रमाण दिलेल्या इंधनापेक्षा जास्त आहे.":m[1]+" पर टेस्टिंग मात्रा दिए गए ईंधन से ज्यादा है।"}],
[/^Only (.*) of (.*) in stock\.$/,function(m,l){return l==0?m[2]+" चा फक्त "+m[1]+" साठा आहे.":m[2]+" का केवल "+m[1]+" स्टॉक है।"}],
[/^Enter an amount above zero for every expense\.$/,function(m,l){return l==0?"प्रत्येक खर्चासाठी शून्यापेक्षा जास्त रक्कम टाका.":"हर खर्च के लिए शून्य से अधिक राशि डालें।"}],
[/^(.*(Morning|Evening|Night) × \d+.*)$/,function(m,l){return m[1].replace(/Morning|Evening|Night/g,function(w){return trw(w,l)})}]];
function trw(w,l){var e=I18N[w];return e?e[l]:w}
function trText(s){var l=LANG=="mr"?0:1,k=s.trim();if(!k||!/[A-Za-z]/.test(k))return null;var e=I18N[k];if(e)return s.replace(k,e[l]);
for(var i=0;i<I18R.length;i++){var m=k.match(I18R[i][0]);if(m)return s.replace(k,I18R[i][1](m,l))}return null}
function trAll(){if(LANG=="en")return;["app","sheet"].forEach(function(id){var root=document.getElementById(id);if(!root)return;
var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),n,list=[];while((n=w.nextNode()))list.push(n);
list.forEach(function(n){var p=n.parentNode,tag=p&&p.tagName;if(tag=="OPTION"&&!p.hasAttribute("value"))return;if(tag=="TEXTAREA"||tag=="SCRIPT"||tag=="STYLE")return;var t=trText(n.nodeValue);if(t!=null&&t!==n.nodeValue)n.nodeValue=t});
[].forEach.call(root.querySelectorAll("[placeholder]"),function(e){var t=trText(e.getAttribute("placeholder"));if(t!=null)e.setAttribute("placeholder",t)})})}
function startI18n(){if(I18||!window.MutationObserver)return;var obs=function(){["app","sheet"].forEach(function(id){var e=document.getElementById(id);if(e)I18.observe(e,{childList:true,subtree:true,characterData:true})})};
I18=new MutationObserver(function(){if(LANG=="en")return;I18.disconnect();trAll();obs()});obs()}
function setLang(l){LANG=l;api("POST","/api/lang",{lang:l}).catch(function(){});var f={wduty:loadW,wlube:loadWLube,wexp:loadWExp,credit:loadCredit,wdip:loadDip,mypay:loadMyPay}[tab];if(f)f();trAll()}
function langSel(){return '<select style="flex:none;width:auto;padding:5px 6px;margin:0" onchange="setLang(this.value)" aria-label="Language"><option value="en"'+(LANG=="en"?' selected':'')+'>English</option><option value="mr"'+(LANG=="mr"?' selected':'')+'>मराठी</option><option value="hi"'+(LANG=="hi"?' selected':'')+'>हिन्दी</option></select>'}
function ubar(){
  if (!SRV || !ME) return '';
  return '<div class="user-bar-top row noprint" style="margin-bottom:10px;gap:6px;align-items:center;flex-wrap:wrap">' +
    '<span class="sub" style="flex:1;min-width:180px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
      '<b style="color:var(--ink)">' + esc(ME.pump_name || "Petrol Pump") + '</b>' +
      (ME.pump_code ? '<span style="background:var(--theme-accent-soft);color:var(--theme-accent);padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700">' + esc(ME.pump_code) + '</span>' : '') +
      '<span style="opacity:0.75">&bull; ' + esc(ME.name) + ' (' + esc(ME.role) + ')</span>' +
    '</span>' +
    (ME.role == "worker" ? langSel() : "") +
    (ME.role == "owner" ? '<button class="ghost" style="padding:5px 10px;flex:none" onclick="stationSwitcherModal()" title="Switch or manage stations">Stations</button>' : '') +
    '<button class="ghost" style="padding:5px 10px;flex:none" onclick="pwForm()">Password</button>' +
    '<button class="ghost" style="padding:5px 10px;flex:none" onclick="logout()">Log out</button>' +
  '</div>';
}
function boot(){api("GET","/api/me").then(function(m){SRV=true;ME=m.user;if(m.biz){DD=m.biz;SF=m.biz.slice(0,8)+"01";ST=m.biz;VM=m.biz.slice(0,7)}if(!ME)return authView(m.setup);start()}).catch(function(){SRV=false;localStart()})}
function start(){view=null;renderSidebar();if(ME.role=="worker"){LANG=ME.lang||"en";startI18n();tab="wduty";return loadW()}tab="ledger";
api("GET","/api/state").then(function(r){VERS=r.vers||{};S=r.state||emptyS();normS();snapAll();pullDuty(render)}).catch(function(e){badge("Could not load data: "+(e.error||"check your connection"))})}
var fbAuth = null, fbProvider = null;
function initFbAuth(cb) {
  if (fbAuth) { if (cb) cb(); return; }
  if (window.firebase) {
    api("GET", "/api/firebase-config").then(function(cfg) {
      if (cfg && cfg.apiKey) {
        if (!firebase.apps.length) {
          firebase.initializeApp(cfg);
        }
        fbAuth = firebase.auth();
        fbProvider = new firebase.auth.GoogleAuthProvider();
        if (cb) cb();
      }
    }).catch(function() {});
  }
}
function doGoogleAuth() {
  initFbAuth(function() {
    if (!fbAuth) return er("Authentication service unavailable.");
    fbAuth.signInWithPopup(fbProvider).then(function(res) {
      return res.user.getIdToken();
    }).then(function(idToken) {
      return api("POST", "/api/auth/google", { idToken: idToken });
    }).then(function(r) {
      if (r.token) {
        AUTH_TOKEN = r.token;
        try { localStorage.setItem("petrol_auth_token", r.token); } catch(e) {}
      }
      ME = r.user;
      start();
    }).catch(function(e) {
      er(e.message || e.error || "Google sign-in could not be completed.");
    });
  });
}
function authView(setup, mode){
  document.body.classList.add("no-sidebar");
  renderSidebar();
  initFbAuth();
  var isReg = (mode === 'register') || (!mode && setup);
  var h = '<h1 style="font-size:22px;color:var(--ink);font-weight:800;margin:20px 0 4px">Petrol Pump Manager</h1>' +
    '<div class="sub">' + (isReg ? 'Register your petrol pump station for isolated business management.' : 'Sign in to access your station management portal.') + '</div>' +
    '<div style="display:flex;gap:6px;margin:16px 0 14px;border-bottom:1px solid var(--line);padding-bottom:10px">' +
      '<button type="button" style="flex:1;padding:8px 0;font-size:13px" class="' + (isReg ? 'ghost' : '') + '" onclick="authView(' + (setup?1:0) + ',\'login\')">Sign In</button>' +
      '<button type="button" style="flex:1;padding:8px 0;font-size:13px" class="' + (isReg ? '' : 'ghost') + '" onclick="authView(' + (setup?1:0) + ',\'register\')">Register New Pump</button>' +
    '</div>';

  if (!isReg) {
    h += '<button type="button" style="width:100%;margin:4px 0 16px;background:#4285F4;color:#fff;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:600;padding:11px 16px;border:none;border-radius:var(--radius);cursor:pointer;font-size:14px;box-shadow:0 1px 3px rgba(0,0,0,0.15)" onclick="doGoogleAuth()">' +
      '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
      '<span>Sign in with Google</span>' +
    '</button>' +
    '<div style="display:flex;align-items:center;text-align:center;color:var(--mute);font-size:12px;margin:8px 0 16px"><span style="flex:1;height:1px;background:var(--line)"></span><span style="padding:0 8px">OR MOBILE NUMBER</span><span style="flex:1;height:1px;background:var(--line)"></span></div>' +
    '<label>Mobile number<input id="a1" inputmode="tel" autocomplete="username"></label>' +
    '<label>Password<input id="a2" type="password" autocomplete="current-password"></label>' +
    '<div class="err" id="er"></div>' +
    '<button style="width:100%;margin-top:6px" onclick="doAuth(false)">Log in to Station</button>' +
    '<div style="text-align:center;margin-top:14px;font-size:12px"><a href="javascript:void(0)" onclick="authView(' + (setup?1:0) + ',\'register\')" style="color:var(--theme-accent);text-decoration:none;font-weight:600">New station customer? Register your petrol pump &rarr;</a></div>';
  } else {
    h += '<div class="sub" style="margin-bottom:12px;background:var(--theme-accent-soft);padding:8px 10px;border-radius:6px;color:var(--ink);font-size:12px">Each registered petrol pump gets an isolated dataset for nozzle readings, tank dips, credit ledgers, and staff logins.</div>' +
    '<label>Petrol Pump / Station Name<input id="a_pump_name" placeholder="e.g. Apex Highway Fuel Station"></label>' +
    '<label>Station Code (optional, e.g. APEX-01)<input id="a_pump_code" placeholder="Leave blank to auto-generate"></label>' +
    '<label>Owner Full Name<input id="a0" placeholder="e.g. Rahul Sharma"></label>' +
    '<label>Mobile number<input id="a1" inputmode="tel" autocomplete="username"></label>' +
    '<label>Owner Password (6+ characters)<input id="a2" type="password" autocomplete="new-password"></label>' +
    '<div class="err" id="er"></div>' +
    '<button style="width:100%;margin-top:6px" onclick="doAuth(true)">Register &amp; Launch Station</button>' +
    '<div style="text-align:center;margin-top:14px;font-size:12px"><a href="javascript:void(0)" onclick="authView(' + (setup?1:0) + ',\'login\')" style="color:var(--theme-accent);text-decoration:none;font-weight:600">Already have an account? Sign in &rarr;</a></div>';
  }

  document.getElementById("app").innerHTML = h;
  var pEl = document.getElementById("a2");
  if (pEl) pEl.onkeydown = function(e) { if (e.key === "Enter") doAuth(isReg); };
}
function doAuth(isRegister){
  var b = { mobile: v("a1"), password: document.getElementById("a2").value };
  if (isRegister) {
    b.name = v("a0");
    b.pump_name = v("a_pump_name");
    b.pump_code = v("a_pump_code");
    api("POST", "/api/signup", b).then(function(r){
      if(r.token){ AUTH_TOKEN=r.token; try{ localStorage.setItem("petrol_auth_token", r.token); }catch(e){} }
      ME=r.user; start();
    }).catch(function(e){ er(e.error || "Could not register station. Check details."); });
  } else {
    api("POST", "/api/login", b).then(function(r){
      if(r.token){ AUTH_TOKEN=r.token; try{ localStorage.setItem("petrol_auth_token", r.token); }catch(e){} }
      ME=r.user; start();
    }).catch(function(e){ er(e.error || "Could not log in. Check your credentials."); });
  }
}
function stationSwitcherModal() {
  openM('<h2>Petrol Pump Stations</h2><div class="sub">Switch between your stations or create an additional station. All business data is strictly isolated.</div><div id="pump-modal-list" style="margin:12px 0"><div class="empty">Loading stations\u2026</div></div><div class="btns" style="margin-top:12px"><button onclick="newStationModal()">+ Add New Station</button><button class="ghost" onclick="close()">Close</button></div>');
  api("GET", "/api/pumps").then(function(list) {
    var el = document.getElementById("pump-modal-list");
    if (!el) return;
    if (!list || !list.length) { el.innerHTML = '<div class="empty">No stations found.</div>'; return; }
    var h = '';
    list.forEach(function(p) {
      var isCur = (ME && ME.pump_id == p.id);
      h += '<div class="cust" style="cursor:default;margin-bottom:8px;border:1px solid ' + (isCur ? 'var(--theme-accent)' : 'var(--line)') + ';background:' + (isCur ? 'var(--theme-accent-soft)' : 'var(--surface)') + '">' +
        '<div class="row"><b>' + esc(p.name) + '</b><span class="sub" style="font-weight:700;color:var(--theme-accent)">' + esc(p.code) + '</span></div>' +
        '<div class="sub" style="margin-top:2px">Station #' + p.id + (isCur ? ' &bull; <b style="color:var(--theme-accent)">Active Station</b>' : '') + '</div>' +
        (isCur ? '' : '<div class="btns" style="margin-top:8px"><button style="padding:6px 12px;font-size:12px" onclick="switchStation(' + p.id + ')">Switch to this station</button></div>') +
      '</div>';
    });
    el.innerHTML = h;
  }).catch(function(e) {
    var el = document.getElementById("pump-modal-list");
    if (el) el.innerHTML = '<div class="err">' + esc(e.error || "Could not load stations") + '</div>';
  });
}
function switchStation(id) {
  api("POST", "/api/pumps/switch", { pump_id: id }).then(function(r) {
    ME = r.user;
    close();
    badge("Switched to " + ME.pump_name);
    start();
  }).catch(function(e) {
    er(e.error || "Could not switch station");
  });
}
function newStationModal() {
  openM('<h2>Add New Petrol Pump Station</h2><div class="sub">Creates a new isolated station tenant under your owner account.</div>' +
    '<label>Station Name<input id="np_name" placeholder="e.g. City Highway Express"></label>' +
    '<label>Station Code (optional, e.g. PUMP-02)<input id="np_code" placeholder="Leave empty to auto-generate"></label>' +
    '<div class="err" id="er"></div>' +
    '<div class="row" style="margin-top:12px">' +
      '<button class="ghost" onclick="stationSwitcherModal()">Back</button>' +
      '<button onclick="saveNewStation()">Create Station</button>' +
    '</div>');
}
function saveNewStation() {
  var nm = v("np_name"), cd = v("np_code");
  if (!nm) return er("Enter station name.");
  api("POST", "/api/pumps", { name: nm, code: cd }).then(function(r) {
    ask("Station created! Switch to " + r.name + " now?", function() {
      switchStation(r.id);
    });
  }).catch(function(e) {
    er(e.error || "Could not create station.");
  });
}
function saveStationInfo(){
  var nm = v("st_name"), cd = v("st_code");
  if(!nm) return er("Enter station name.");
  api("PATCH", "/api/pump", { name: nm, code: cd }).then(function(p){
    ME.pump_name = p.name;
    ME.pump_code = p.code;
    badge("Station info saved!");
    renderSidebar();
    renderSetup();
  }).catch(function(e){
    er(e.error || "Could not save station info.");
  });
}
function loadSetupPumps(){
  api("GET", "/api/pumps").then(function(list){
    var el = document.getElementById("setup-pump-list");
    if(!el) return;
    if(!list || !list.length){ el.innerHTML = '<div class="empty">No stations found.</div>'; return; }
    var h = '';
    list.forEach(function(p){
      var isCur = (ME && ME.pump_id == p.id);
      h += '<div class="cust" style="cursor:default;margin-bottom:8px;border:1px solid '+(isCur?'var(--theme-accent)':'var(--line)')+';background:'+(isCur?'var(--theme-accent-soft)':'var(--card)')+'">'+
        '<div class="row"><b>'+esc(p.name)+'</b><span class="sub" style="font-weight:700;color:var(--theme-accent)">'+esc(p.code)+'</span></div>'+
        '<div class="sub">Station #'+p.id+(isCur?' &bull; <b style="color:var(--theme-accent)">Current Active Station</b>':'')+'</div>'+
        (isCur?'':'<div class="btns" style="margin-top:8px"><button class="ghost" style="padding:6px 10px;font-size:12px" onclick="switchStation('+p.id+')">Switch to this station</button></div>')+
      '</div>';
    });
    el.innerHTML = h;
  }).catch(function(){});
}
function logout(){try{localStorage.removeItem("petrol_auth_token")}catch(e){}AUTH_TOKEN="";if(fbAuth){try{fbAuth.signOut()}catch(e){}}api("POST","/api/logout").then(function(){location.reload()}).catch(function(){location.reload()})}
function pwForm(){openM('<h2>Change password</h2><label>Current password<input id="p1" type="password"></label><label>New password (6+ characters)<input id="p2" type="password"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="savePw()">Change password</button></div>')}
function savePw(){api("POST","/api/password",{old:document.getElementById("p1").value,password:document.getElementById("p2").value}).then(function(){openM('<h2>Password changed</h2><div class="btns"><button onclick="close()">Close</button></div>')}).catch(function(e){er(e.error||"Could not change the password.")})}
function loadCredit(){Promise.all([api("GET","/api/customers"),api("GET","/api/my-credit-sales"),api("GET","/api/fuels")]).then(function(r){CL=r[0];MY=r[1];CF=r[2];renderCredit()}).catch(function(e){document.getElementById("app").innerHTML=ubar()+'<div class="empty">Could not load. '+esc(e.error||"Check your connection.")+'</div>'})}
function renderCredit(){var h=ubar()+wnav()+'<h1>Credit sale</h1><div class="sub" style="margin-bottom:4px">Saved sales appear in the customer ledger straight away.</div><label>Customer<select id="d1" onchange="dcust()"><option value="">Choose customer</option>'+CL.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>'}).join("")+'</select></label><div class="sub" id="d0" style="margin-top:4px"></div><label>Vehicle number<input id="d2" list="vl" autocapitalize="characters"><datalist id="vl"></datalist></label><label>Fuel<select id="d5"><option value="">Other item (not fuel)</option>'+CF.map(function(f,i){return '<option'+(i==0?' selected':'')+'>'+esc(f.name)+'</option>'}).join("")+'</select></label><label>Quantity (litres, kg or kWh)<input id="d6" inputmode="decimal"></label><label>Details (needed for other items)<input id="d3" placeholder="e.g. engine oil 1 L"></label><label>Amount (\u20b9)<input id="d4" inputmode="decimal"></label><div class="err" id="er"></div><button style="width:100%" onclick="saveDuty(0)">Save credit sale</button><h1 style="margin-top:22px">My recent entries</h1>';
if(!MY.length)h+='<div class="empty">No entries yet.</div>';
MY.forEach(function(x){h+='<div class="cust" style="cursor:default"><div class="row"><b>'+esc(x.cname)+'</b><span class="amt" style="flex:none">'+inr(x.a)+'</span></div><div class="sub">'+x.d+' \u00b7 '+esc(x.n)+(x.veh?' \u00b7 '+esc(x.veh):'')+'</div>'+(x.status=="pending"?'<div class="sub" style="color:var(--warn)">Waiting for manager approval</div>':x.status=="rejected"?'<div class="sub" style="color:var(--due)">Rejected by manager</div>':'')+'</div>'});
document.getElementById("app").innerHTML=h}
function dcust(){var c=CL.filter(function(x){return x.id==v("d1")})[0];document.getElementById("vl").innerHTML=c?c.veh.map(function(x){return '<option value="'+esc(x)+'">'}).join(""):"";document.getElementById("d0").textContent=c?"Credit available: "+inr(c.available):""}
function saveDuty(force){var a=parseFloat(v("d4")),fu=v("d5"),lt=parseFloat(v("d6")),b={cust_id:v("d1"),fuel:fu,litres:fu?lt:"",n:v("d3"),a:a,veh:v("d2"),force:!!force};
if(!b.cust_id)return er("Choose a customer.");if(fu&&!(lt>0))return er("Enter the litres.");if(!fu&&!b.n)return er("Describe the item.");if(!(a>0))return er("Enter an amount above zero.");
var c=CL.filter(function(x){return x.id==b.cust_id})[0],go=function(){api("POST","/api/credit-sales",b).then(function(){loadCredit()}).catch(function(e){er(e.error||"Could not save. Check your connection.")})};
if(c&&a>c.available)return ask("This is more than the customer's available credit ("+inr(c.available)+"). It will be sent to a manager for approval. Continue?",go);go()}
function renderTeam(){document.getElementById("app").innerHTML=nav()+'<div class="empty">Loading team\u2026</div>';
api("GET","/api/users").then(function(U){if(tab!="team")return;
var h=nav()+'<h1>Team logins</h1>'+
  '<div class="cust" style="cursor:default;margin-bottom:12px;background:var(--theme-accent-soft);border:1px solid var(--theme-accent);padding:10px 14px">'+
    '<div class="row"><b>Station: '+esc(ME.pump_name || "Petrol Pump")+'</b><span style="font-weight:700;color:var(--theme-accent)">'+esc(ME.pump_code || "")+'</span></div>'+
    '<div class="sub" style="margin-top:2px">Staff and managers are isolated to this petrol pump station.</div>'+
  '</div>'+
  '<div class="btns"><button onclick="userForm()">Add user</button></div>';
U.forEach(function(u){h+='<div class="cust" style="cursor:default"><div class="row"><b>'+esc(u.name)+'</b><span class="sub" style="flex:none;text-align:right">'+u.role+(u.active?'':' \u00b7 inactive')+'</span></div><div class="sub">Mobile '+esc(u.mobile)+'</div>'+(u.role=="owner"?'':'<div class="btns" style="margin:10px 0 0"><button class="ghost" onclick="userAct('+u.id+',\''+(u.active?'off':'on')+'\')">'+(u.active?'Deactivate':'Activate')+'</button><button class="ghost" onclick="resetPw('+u.id+')">Reset password</button></div>')+'</div>'});
document.getElementById("app").innerHTML=h}).catch(function(e){badge(e.error||"Could not load the team.")})}
function userForm(){openM('<h2>Add user</h2><label>Name<input id="u1"></label><label>Mobile number (used to log in)<input id="u2" inputmode="tel"></label><label>Role<select id="u3"><option value="worker">Worker</option>'+(ME.role=="owner"?'<option value="manager">Manager</option>':'')+'</select></label><label>Password (6+ characters)<input id="u4" autocomplete="off"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="saveUser()">Save user</button></div>')}
function saveUser(){api("POST","/api/users",{name:v("u1"),mobile:v("u2"),role:v("u3"),password:document.getElementById("u4").value}).then(function(){close();renderTeam()}).catch(function(e){er(e.error||"Could not save.")})}
function userAct(id,w){api("PATCH","/api/users/"+id,{active:w=="on"}).then(renderTeam).catch(function(e){badge(e.error||"Could not update the user.")})}
function resetPw(id){openM('<h2>Reset password</h2><label>New password (6+ characters)<input id="u4" autocomplete="off"></label><div class="err" id="er"></div><div class="row"><button class="ghost" onclick="close()">Cancel</button><button onclick="savePw2('+id+')">Reset password</button></div>')}
function savePw2(id){api("PATCH","/api/users/"+id,{password:document.getElementById("u4").value}).then(function(){close();renderTeam()}).catch(function(e){er(e.error||"Could not reset the password.")})}
// ---- Contiguous Cash Flow Register Engine (Day Start 6 AM, Shifts, Bank Deposit, Closing Rollover)
var CF_REG_FROM = "";
var CF_REG_TO = "";
var CF_DATE = today();

function cfDayStr(d) {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch(e) { return d; }
}

function renderCashflow() {
  tab = "cashflow";
  var A = document.getElementById("app");
  if (!SRV) {
    A.innerHTML = nav() + '<div class="empty">Cash Flow Register requires the server to be running.</div>';
    return;
  }
  if (!CF_REG_FROM) {
    var dt = new Date();
    dt.setDate(dt.getDate() - 7);
    CF_REG_FROM = dt.toISOString().slice(0, 10);
  }
  if (!CF_REG_TO) CF_REG_TO = today();

  var wrap = document.querySelector(".wrap");
  if (wrap) wrap.classList.add("wide");

  A.innerHTML = nav() + '<div class="empty">Loading Contiguous Cash Flow Register\u2026</div>';

  api("GET", "/api/cashflow/register?from=" + CF_REG_FROM + "&to=" + CF_REG_TO).then(function(R) {
    if (tab !== "cashflow") return;
    var h = nav() +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<h1 style="font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-0.5px;margin:0">Contiguous Cash Flow Register</h1>' +
            '<span style="background:var(--theme-accent-soft);color:var(--theme-accent);font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px">06:00 AM Cycle</span>' +
          '</div>' +
          '<div class="sub" style="margin-top:3px">Day start 06:00 AM &bull; Opening Cash (+) Morning Shift (&minus;) Bank Deposit (+) Evening Shift (+) Night Shift = Closing Balance (Rolls over as Next Day 06:00 AM Opening)</div>' +
        '</div>' +
        '<div class="btns" style="margin:0">' +
          '<button onclick="cfDepositModal(today())">+ Record Bank Deposit</button>' +
          '<button class="ghost" onclick="cfOpeningModal(today(), 0)">Set 6 AM Opening Cash</button>' +
          '<button class="ghost" onclick="window.print()">Print register</button>' +
        '</div>' +
      '</div>' +

      // Formula Indicator Banner
      '<div style="font-size:12px;color:var(--ink);background:var(--card);padding:9px 14px;border-radius:10px;border:1px solid var(--line);font-family:monospace;line-height:1.45;margin-bottom:14px">' +
        '<b>Formula</b>: <span style="color:var(--theme-accent);font-weight:700">Opening (6 AM)</span> + <span style="color:var(--ok);font-weight:700">Morning Shift</span> &minus; <span style="color:var(--due);font-weight:700">Bank Deposit</span> + <span style="color:var(--ok);font-weight:700">Evening Shift</span> + <span style="color:var(--ok);font-weight:700">Night Shift</span> = <b>Closing Balance (= Next Day 6 AM Opening)</b>' +
      '</div>' +

      // Date Range Filter Toolbar
      '<div class="row noprint" style="align-items:flex-end;gap:8px;margin-bottom:14px;background:var(--card);padding:10px 14px;border-radius:10px;border:1px solid var(--line);flex-wrap:wrap">' +
        '<label style="margin:0">From Date<input type="date" value="' + CF_REG_FROM + '" onchange="CF_REG_FROM=this.value;renderCashflow()"></label>' +
        '<label style="margin:0">To Date<input type="date" value="' + CF_REG_TO + '" onchange="CF_REG_TO=this.value;renderCashflow()"></label>' +
        '<button class="ghost" style="padding:7px 12px" onclick="var d=new Date();d.setDate(d.getDate()-7);CF_REG_FROM=d.toISOString().slice(0,10);CF_REG_TO=today();renderCashflow()">Last 7 Days</button>' +
        '<button class="ghost" style="padding:7px 12px" onclick="var d=new Date();d.setDate(d.getDate()-15);CF_REG_FROM=d.toISOString().slice(0,10);CF_REG_TO=today();renderCashflow()">Last 15 Days</button>' +
        '<button class="ghost" style="padding:7px 12px" onclick="var d=new Date();d.setDate(1);CF_REG_FROM=d.toISOString().slice(0,10);CF_REG_TO=today();renderCashflow()">This Month</button>' +
        '<button class="ghost" style="padding:7px 12px" onclick="var d=new Date();d.setMonth(d.getMonth()-1);d.setDate(1);var end=new Date(d.getFullYear(),d.getMonth()+1,0);CF_REG_FROM=d.toISOString().slice(0,10);CF_REG_TO=end.toISOString().slice(0,10);renderCashflow()">Last Month</button>' +
      '</div>' +

      // Contiguous Register Table
      '<div class="tbl" style="margin-bottom:20px"><table style="min-width:1160px">' +
        '<thead>' +
          '<tr style="background:rgba(0,0,0,0.02)">' +
            '<th style="white-space:nowrap;padding:10px">Date / Day</th>' +
            '<th class="r" style="white-space:nowrap;padding:10px;background:rgba(37,99,235,0.05);color:var(--ink)">06:00 AM Opening<br><span style="font-size:10px;font-weight:normal;color:var(--mute)">Start Till Cash</span></th>' +
            '<th class="r" style="white-space:nowrap;padding:10px;color:var(--ok)">Morning (+)<br><span style="font-size:10px;font-weight:normal;color:var(--mute)">Shift Cash</span></th>' +
            '<th class="r" style="white-space:nowrap;padding:10px;background:rgba(0,0,0,0.015)">Subtotal<br><span style="font-size:10px;font-weight:normal;color:var(--mute)">Opening + Morning</span></th>' +
            '<th class="r" style="white-space:nowrap;padding:10px;color:var(--due)">Bank Deposit (&minus;)<br><span style="font-size:10px;font-weight:normal;color:var(--mute)">Deposited in Bank</span></th>' +
            '<th class="r" style="white-space:nowrap;padding:10px">Till After Deposit<br><span style="font-size:10px;font-weight:normal;color:var(--mute)">Cash in Hand</span></th>' +
            '<th class="r" style="white-space:nowrap;padding:10px;color:var(--ok)">Evening (+)<br><span style="font-size:10px;font-weight:normal;color:var(--mute)">Shift Cash</span></th>' +
            '<th class="r" style="white-space:nowrap;padding:10px;color:var(--ok)">Night (+)<br><span style="font-size:10px;font-weight:normal;color:var(--mute)">Shift Cash</span></th>' +
            '<th class="r" style="white-space:nowrap;padding:10px;background:rgba(16,185,129,0.08);color:var(--ink);font-weight:800">Closing Balance (=)<br><span style="font-size:10px;font-weight:normal;color:var(--mute)">End of Day Till Cash</span></th>' +
            '<th class="r" style="white-space:nowrap;padding:10px;background:rgba(16,185,129,0.04);color:var(--ink)">Next Day 6 AM Opening<br><span style="font-size:10px;font-weight:normal;color:var(--mute)">Auto-Rollover</span></th>' +
            '<th style="text-align:center;padding:10px;width:130px">Actions</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>';

    var days = R.days || [];
    if (!days.length) {
      h += '<tr><td colspan="11" class="empty">No cash flow activity in this date range.</td></tr>';
    } else {
      days.forEach(function(row) {
        var depList = row.bank_deposits || [];
        var depCount = depList.length;
        h += '<tr>' +
          '<td style="vertical-align:middle;padding:10px;font-weight:700"><span style="color:var(--ink)">' + row.d + '</span><div class="sub" style="font-size:11px">' + cfDayStr(row.d).split(',')[0] + '</div></td>' +
          '<td class="r" style="vertical-align:middle;padding:10px;font-weight:700;font-variant-numeric:tabular-nums;background:rgba(37,99,235,0.03)">' +
            inr(row.opening_cash) +
            (row.opening_is_manual ?
              '<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:2px"><span style="font-size:9.5px;color:var(--theme-accent);font-weight:700;background:var(--theme-accent-soft);padding:1px 5px;border-radius:3px">MANUAL</span><button class="ghost" style="padding:1px 4px;font-size:9.5px;color:var(--due)" onclick="cfResetOpening(\'' + row.d + '\')" title="Reset to auto-carry from previous day">&times; Reset</button></div>' :
              '<div class="sub" style="font-size:9.5px;color:var(--ok)">&check; Auto-roll</div>') +
          '</td>' +
          '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;color:var(--ok);font-weight:700">+' + inr(row.morning_cash) + '</td>' +
          '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;font-weight:700">' + inr(row.subtotal_after_morning) + '</td>' +
          '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;color:' + (row.bank_deposit > 0 ? 'var(--due)' : 'var(--mute)') + ';font-weight:700">' +
            (row.bank_deposit > 0 ?
              '<span style="cursor:pointer;text-decoration:underline" onclick="cfDepositsListModal(\'' + row.d + '\')" title="Click to view/manage deposit slips">&minus;' + inr(row.bank_deposit) + '</span>' +
              '<div class="sub" style="font-size:9.5px">' + depCount + ' slip' + (depCount === 1 ? '' : 's') + '</div>' :
              '&mdash;') +
          '</td>' +
          '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;font-weight:700">' + inr(row.subtotal_after_deposit) + '</td>' +
          '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;color:var(--ok);font-weight:700">+' + inr(row.evening_cash) + '</td>' +
          '<td class="r" style="vertical-align:middle;padding:10px;font-variant-numeric:tabular-nums;color:var(--ok);font-weight:700">+' + inr(row.night_cash) + '</td>' +
          '<td class="r" style="vertical-align:middle;padding:10px;font-weight:800;font-size:15px;font-variant-numeric:tabular-nums;background:rgba(16,185,129,0.08);color:var(--ink)">' + inr(row.closing_cash) + '</td>' +
          '<td class="r" style="vertical-align:middle;padding:10px;font-weight:700;font-variant-numeric:tabular-nums;background:rgba(16,185,129,0.04);color:var(--ok)">' + inr(row.next_day_opening) + ' &check;</td>' +
          '<td style="vertical-align:middle;text-align:center;padding:10px;white-space:nowrap">' +
            '<button class="ghost" style="padding:4px 7px;font-size:11px;margin-right:4px" onclick="cfDepositModal(\'' + row.d + '\')" title="Record bank deposit for this day">+ Deposit</button>' +
            '<button class="ghost" style="padding:4px 7px;font-size:11px" onclick="cfOpeningModal(\'' + row.d + '\',' + row.opening_cash + ')" title="Adjust 06:00 AM opening till cash">Edit 6 AM</button>' +
          '</td>' +
        '</tr>';
      });
    }
    h += '</tbody></table></div>';
    A.innerHTML = h;
  }).catch(function(e) {
    A.innerHTML = nav() + '<div class="empty">Error loading Contiguous Cash Flow Register: ' + esc(e.error || e.message) + '</div>';
  });
}

function cfDepositsListModal(d) {
  api("GET", "/api/cashflow/day/" + d).then(function(flow) {
    var list = flow.bank_deposits || [];
    var h = '<h2>Bank Deposits for ' + esc(d) + '</h2>' +
      '<div class="sub">Total banked: <b>' + inr(flow.bank_deposit) + '</b> across ' + list.length + ' deposit' + (list.length === 1 ? '' : 's') + '.</div>';

    if (!list.length) {
      h += '<div class="empty">No bank deposits on this day.</div>';
    } else {
      h += '<div style="margin:14px 0;display:flex;flex-direction:column;gap:8px">';
      list.forEach(function(dp) {
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--card);border:1px solid var(--line);border-radius:8px">' +
          '<div>' +
            '<b style="font-size:13px;color:var(--ink)">' + esc(dp.bank_name || "Bank") + '</b>: <span style="font-weight:700;color:var(--due)">&minus;' + inr(dp.amount) + '</span>' +
            '<div class="sub" style="font-size:11px;margin-top:2px">' +
              (dp.slip_no ? 'Slip #' + esc(dp.slip_no) + ' &bull; ' : '') +
              (dp.deposited_by ? 'By ' + esc(dp.deposited_by) + ' &bull; ' : '') +
              (dp.note ? esc(dp.note) : '') +
            '</div>' +
          '</div>' +
          '<button class="ghost" style="padding:3px 8px;font-size:11.5px;color:var(--due)" onclick="cfDeleteDeposit(' + dp.id + ',\'' + d + '\')">Delete</button>' +
        '</div>';
      });
      h += '</div>';
    }

    h += '<div class="row" style="margin-top:16px;justify-content:space-between">' +
      '<button class="ghost" onclick="close()">Close</button>' +
      '<button onclick="close();cfDepositModal(\'' + d + '\')">+ Add Deposit for ' + esc(d) + '</button>' +
    '</div>';

    openM(h);
  }).catch(function(e) {
    badge(e.error || "Could not load deposit list.");
  });
}

function cfDepositModal(d) {
  openM('<h2>Record Bank Deposit</h2>' +
    '<div class="sub">Deducts cash from station till and records bank deposit for ' + esc(d) + '.</div>' +
    '<label>Deposit Date<input id="cf_d" type="date" value="' + esc(d) + '"></label>' +
    '<label>Amount (&amp;#8377;)<input id="cf_amt" inputmode="decimal" placeholder="e.g. 50000" autofocus></label>' +
    '<label>Bank Name<select id="cf_bank">' +
      '<option value="State Bank of India">State Bank of India (SBI)</option>' +
      '<option value="HDFC Bank">HDFC Bank</option>' +
      '<option value="ICICI Bank">ICICI Bank</option>' +
      '<option value="Punjab National Bank">Punjab National Bank (PNB)</option>' +
      '<option value="Bank of Baroda">Bank of Baroda</option>' +
      '<option value="Axis Bank">Axis Bank</option>' +
      '<option value="Canara Bank">Canara Bank</option>' +
      '<option value="Union Bank of India">Union Bank of India</option>' +
      '<option value="Bank Account">Other Bank Account</option>' +
    '</select></label>' +
    '<label>Challan / Slip Number (optional)<input id="cf_slip" placeholder="e.g. SBI-DEP-88412"></label>' +
    '<label>Deposited By<input id="cf_by" value="' + esc((ME && ME.name) || "Manager") + '"></label>' +
    '<label>Note (optional)<input id="cf_note" placeholder="e.g. Afternoon post-morning shift collection deposit"></label>' +
    '<div class="err" id="er"></div>' +
    '<div class="row" style="margin-top:14px">' +
      '<button class="ghost" onclick="close()">Cancel</button>' +
      '<button onclick="cfSaveDeposit()">Save Bank Deposit</button>' +
    '</div>');
  setTimeout(function() {
    var el = document.getElementById("cf_amt");
    if (el) el.focus();
  }, 100);
}

function cfSaveDeposit() {
  var d = v("cf_d") || CF_DATE;
  var amt = parseFloat(v("cf_amt"));
  if (!(amt > 0)) return er("Please enter a valid deposit amount above &amp;#8377;0.");
  var bank = v("cf_bank");
  var slip = v("cf_slip");
  var by = v("cf_by");
  var note = v("cf_note");

  api("POST", "/api/cashflow/deposit", {
    d: d,
    amount: amt,
    bank_name: bank,
    slip_no: slip,
    deposited_by: by,
    note: note
  }).then(function() {
    badge("Bank deposit of &amp;#8377;" + amt + " recorded!");
    close();
    CF_DATE = d;
    renderCashflow();
  }).catch(function(e) {
    er(e.error || "Could not save deposit.");
  });
}

function cfDeleteDeposit(id, d) {
  ask("Delete this bank deposit? The daily cash flow and closing balance will be automatically updated.", function() {
    api("DELETE", "/api/cashflow/deposit/" + id).then(function() {
      badge("Bank deposit deleted");
      CF_DATE = d;
      renderCashflow();
    }).catch(function(e) {
      badge(e.error || "Could not delete deposit.");
    });
  });
}

function cfOpeningModal(d, currentAmt) {
  openM('<h2>Set 06:00 AM Opening Till Cash</h2>' +
    '<div class="sub">Set physical cash counted in drawer at 06:00 AM on ' + esc(d) + '.</div>' +
    '<label>Date<input id="cfo_d" type="date" value="' + esc(d) + '" disabled></label>' +
    '<label>Opening Cash (&amp;#8377;)<input id="cfo_amt" inputmode="decimal" value="' + (currentAmt != null ? currentAmt : 0) + '"></label>' +
    '<label>Note (optional)<input id="cfo_note" placeholder="e.g. Verified physically at 06:00 AM handover"></label>' +
    '<div style="font-size:11.5px;color:var(--mute);margin-top:6px;line-height:1.4">' +
      '<b>Note:</b> Setting this marks this day with a manual 6 AM opening till count. All subsequent days will automatically roll forward from this day\'s calculated closing balance.' +
    '</div>' +
    '<div class="err" id="er"></div>' +
    '<div class="row" style="margin-top:14px">' +
      '<button class="ghost" onclick="close()">Cancel</button>' +
      '<button onclick="cfSaveOpening(\'' + esc(d) + '\')">Save Opening Cash</button>' +
    '</div>');
  setTimeout(function() {
    var el = document.getElementById("cfo_amt");
    if (el) { el.focus(); el.select(); }
  }, 100);
}

function cfSaveOpening(d) {
  var amt = parseFloat(v("cfo_amt"));
  if (isNaN(amt) || amt < 0) return er("Enter a valid opening cash amount (0 or greater).");
  var note = v("cfo_note");

  api("POST", "/api/cashflow/opening", {
    d: d,
    opening_cash: amt,
    note: note
  }).then(function() {
    badge("Opening cash set to &amp;#8377;" + amt);
    close();
    CF_DATE = d;
    renderCashflow();
  }).catch(function(e) {
    er(e.error || "Could not save opening cash.");
  });
}

function cfResetOpening(d) {
  ask("Reset 06:00 AM opening cash on " + d + " to automatically carry forward from " + d + "'s previous day closing balance?", function() {
    api("POST", "/api/cashflow/reset-opening", { d: d }).then(function() {
      badge("Opening cash reset to auto-carry from previous day!");
      CF_DATE = d;
      renderCashflow();
    }).catch(function(e) {
      badge(e.error || "Could not reset opening cash.");
    });
  });
}

setInterval(function(){if(!SRV||!ME||ME.role=="worker"||tab!="ledger"||document.getElementById("modal").classList.contains("on"))return;var a=document.activeElement;if(a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName))return;pullDuty(render)},30000);
boot();
