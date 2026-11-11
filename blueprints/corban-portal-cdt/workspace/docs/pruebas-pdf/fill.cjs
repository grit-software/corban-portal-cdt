const fs=require('fs'); const L=require('./pdf-lib.min.js');
const W=process.env.FORMATOS||'../../assets/formatos/';
const OUT='./out/'; fs.mkdirSync(OUT,{recursive:true});
const mapA=JSON.parse(fs.readFileSync(W+'mapping.json')), mapB=JSON.parse(fs.readFileSync(W+'mapping.cuenta-pago.json'));
const D={nombre1:'JUAN',nombre2:'CARLOS',apellido1:'PEREZ',apellido2:'GOMEZ',nombre_completo:'JUAN CARLOS PEREZ GOMEZ',
 tipo_doc:'cc',num_doc:'1020304050',exp_lugar:'BOGOTA',exp_fecha:'2015-03-10',nac_fecha:'1990-07-21',nac_pais:'COLOMBIA',nac_depto:'BOGOTA D.C.',nac_ciudad:'BOGOTA',lugar_nac:'BOGOTA',
 sexo:'M',estado_civil:'soltero',nivel_educ:'profesional',email:'ejemplo@correo.com',celular:'3001234567',tel_fijo:'6011234567',direccion:'CALLE 100 # 10-20',barrio:'CHICO',ciudad:'BOGOTA',ciudad_res:'BOGOTA',depto_res:'BOGOTA D.C.',pais_res:'COLOMBIA',ciudad_depto_res:'BOGOTA - BOGOTA D.C.',
 estrato:'4',tipo_vivienda:'propia',ocupacion:'INGENIERO',profesion:'INGENIERO DE SISTEMAS',empresa:'EMPRESA EJEMPLO SAS',nit_empresa:'900123456',cargo:'ANALISTA',dir_trab:'CALLE 72 # 7-64',ciudad_trab:'BOGOTA',depto_trab:'BOGOTA D.C.',ciudad_depto_trab:'BOGOTA - BOGOTA D.C.',tel_trab:'6017654321',fecha_ingreso:'2018-02-01',contrato:'indefinido',contrato_txt:'Indefinido',
 ingresos:12000000,otros_ingresos:0,egresos:4000000,activos:300000000,pasivos:50000000,patrimonio:250000000,total_ingresos:12000000,declara_renta:'No',actividad_desc:'SERVICIOS',ciiu:'6201',
 valor:50000000,plazo_dias:180,plazo_meses:6,plazo_txt:'180 días',tasa_ea:'9.8000',fecha_apertura:'2026-11-05',fecha_venc:'2027-05-04',valor_letras:'CINCUENTA MILLONES DE PESOS M/CTE',tipo_cdt:'desmaterializado',periodicidad:'mensual',periodicidad_txt:'Mensual',forma_pago:'transferencia',
 cta_banco:'BANCOLOMBIA',cta_tipo:'ahorros',cta_tipo_txt:'Ahorros',cta_numero:'12345678901',cta_titular:'JUAN CARLOS PEREZ GOMEZ',fecha_dilig:'2026-11-05',oficina:'BOGOTA',
 sexo_txt:'M',lugar_exp:'BOGOTA'};
const money=v=>{const n=Math.round(Number(v)||0);return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.')};
const pad=n=>String(n).padStart(2,'0');
const dateOut=(iso,part)=>{if(!iso)return '';const [y,m,d]=String(iso).split('-');return part==='d'?d:part==='m'?m:part==='y'?y:part==='dmy'?`${d}/${m}/${y}`:iso;};
const same=(a,b)=>String(a).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim()===String(b).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const docs={ban_vinc:'mapA',ban_orden:'mapA+B',colte_vinc:'mapA',colte_cdt:'mapA+B',juris:'mapA+B',mmujer:'mapA'};
(async()=>{const summary={};
for(const k of Object.keys(docs)){
 const pdf=await L.PDFDocument.load(fs.readFileSync(W+k+'.pdf'),{ignoreEncryption:true});
 const form=pdf.getForm(); const by={}; form.getFields().forEach(f=>by[f.getName()]=f);
 Object.values(by).forEach(f=>{try{ if(f instanceof L.PDFTextField) f.setText(undefined); else if(f instanceof L.PDFCheckBox) f.uncheck(); else if(f instanceof L.PDFRadioGroup||f instanceof L.PDFDropdown||f instanceof L.PDFOptionList) f.clear(); }catch(e){}});
 const rep={notFound:[],skipped:[],text:0,checks:0,rows:0};
 const rows=[...(mapA[k]||[]), ...(docs[k].includes('B')?(mapB[k]||[]):[])];
 const setText=(n,v)=>{const f=by[n]; if(!f){rep.notFound.push(n);return;} if(v===''||v==null)return; try{ if(f instanceof L.PDFTextField){f.setText(String(v));rep.text++;} else rep.skipped.push(n+' (no es texto)'); }catch(e){rep.skipped.push(n+': '+e.message);} };
 const setCheck=n=>{const f=by[n]; if(!f){rep.notFound.push(n);return;} try{ if(f instanceof L.PDFCheckBox){f.check();rep.checks++;} else if(f instanceof L.PDFRadioGroup){const o=f.getOptions(); if(o.length){f.select(o[0]);rep.checks++;}} else if(f instanceof L.PDFTextField){f.setText('X');rep.checks++;} else rep.skipped.push(n+' (no es casilla)'); }catch(e){rep.skipped.push(n+': '+e.message);} };
 rows.forEach(r=>{ rep.rows++;
  if(r.k==='t'){ const v=D[r.key]; setText(r.f, r.fmt==='money'?money(v):v); }
  else if(r.k==='c'){ if(D[r.key]&&same(D[r.key],r.val)) setCheck(r.f); }
  else if(r.k==='x') setCheck(r.f);
  else if(r.k==='s') setText(r.f,r.val);
  else if(r.k==='d') setText(r.f,dateOut(D[r.key],r.part));
  else if(r.k==='tv'){ if(D[r.cond[0]]===r.cond[1]) setText(r.f, r.fmt==='money'?money(D[r.key]):D[r.key]); }
  else if(r.k==='ch'){ const s=String(D[r.key]??''); setText(r.f, s[r.i]??''); }
  else rep.skipped.push(r.f+' (kind '+r.k+')');
 });
 // verify: text fields that have a value but are not targets of any row
 const targets=new Set(rows.map(r=>r.f)); const stray=[];
 form.getFields().forEach(f=>{const n=f.getName(); if(f instanceof L.PDFTextField && !targets.has(n)){ const t=f.getText(); if(t) stray.push(n+'='+t); } if(f instanceof L.PDFCheckBox && f.isChecked() && !targets.has(n)) stray.push(n+'[x]'); });
 rep.stray=stray;
 fs.writeFileSync(OUT+k+'.pdf', await pdf.save());
 summary[k]={rows:rep.rows,text:rep.text,checks:rep.checks,notFound:rep.notFound.length,skipped:rep.skipped.length,strayCount:stray.length,notFoundList:[...new Set(rep.notFound)].slice(0,5),skippedList:rep.skipped.slice(0,5),stray:stray.slice(0,12)};
}
console.log(JSON.stringify(summary,null,1));})();
