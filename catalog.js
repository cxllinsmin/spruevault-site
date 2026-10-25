/* Search-only browser for the existing public SprueVault catalog file.
   This page does not write, edit or replace any catalog records. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const search = $('kit-search');
  const grade = $('grade-filter');
  const sort = $('kit-sort');
  const clear = $('clear-filters');
  const resultCount = $('result-count');
  const revision = $('catalog-revision');
  const status = $('catalog-status');
  const results = $('kit-results');
  const more = $('load-more');
  const pageSize = 36;
  let kits = [], visible = [], shown = 0;

  const clean = v => {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
    if (Array.isArray(v)) return v.map(clean).filter(Boolean).join(', ');
    if (typeof v === 'object') return clean(v.name ?? v.label ?? v.title ?? v.code ?? v.value ?? '');
    return '';
  };
  const lookup = (object, names) => {
    if (!object || typeof object !== 'object') return '';
    const groups = [object, object.kit, object.metadata, object.model, object.details, object.reference, object.info];
    for (const g of groups) {
      if (!g || typeof g !== 'object' || Array.isArray(g)) continue;
      for (const key of names) {
        if (g[key] != null && g[key] !== '') {
          const value = clean(g[key]);
          if (value) return value;
        }
      }
    }
    return '';
  };
  const extractRecords = data => {
    const arrays = [];
    const visited = new Set();
    const walk = (node, depth) => {
      if (depth > 4 || !node || typeof node !== 'object' || visited.has(node)) return;
      visited.add(node);
      if (Array.isArray(node)) {
        if (node.length && node.slice(0,4).some(v => v && typeof v === 'object' && !Array.isArray(v))) arrays.push(node);
        return;
      }
      for (const value of Object.values(node)) {
        if (value && typeof value === 'object') walk(value, depth+1);
      }
    };
    walk(data, 0);
    if (arrays.length) return arrays.sort((a,b) => b.length-a.length)[0];
    if (data && typeof data === 'object') {
      for (const bucket of [data.kits,data.models,data.entries,data.records]) {
        if (bucket && typeof bucket === 'object' && !Array.isArray(bucket)) {
          const vals = Object.values(bucket);
          if (vals.some(v => v && typeof v === 'object')) return vals;
        }
      }
    }
    return [];
  };
  const normalize = record => {
    const name = lookup(record,['name','kit_name','kitName','modelName','model_name','displayName','display_name','title','kit','product_name','productName']);
    if (!name) return null;
    const kit = {
      name,
      grade: lookup(record,['grade','kit_grade','kitGrade','grade_code','gradeCode','grade_abbreviation','gradeAbbreviation']),
      scale: lookup(record,['scale','kit_scale','kitScale']),
      series: lookup(record,['series','series_name','seriesName','anime','universe','origin','source_series','sourceSeries']),
      manufacturer: lookup(record,['manufacturer','brand','maker']),
      release: lookup(record,['release_date','releaseDate','release_month','releaseMonth','release','release_year','releaseYear']),
      code: lookup(record,['model_code','modelCode','model_number','modelNumber','product_code','productCode','sku'])
    };
    kit.searchable = Object.values(kit).join(' ').toLocaleLowerCase();
    return kit;
  };
  const el = (tag, className, value) => {
    const node=document.createElement(tag);
    if (className) node.className=className;
    if (value!=null) node.textContent=value;
    return node;
  };
  const makeCard = kit => {
    const article=el('article','catalog-card');
    const header=el('div','catalog-card-header');
    const mark=el('div','catalog-grade');
    mark.append(el('strong','',kit.grade || 'KIT'),el('small','','GRADE'));
    const content=el('div','catalog-card-copy');
    content.append(el('h2','catalog-title',kit.name));
    const meta=[kit.grade,kit.scale].filter(Boolean).join(' · ');
    if (meta) content.append(el('p','catalog-meta',meta));
    if (kit.series) content.append(el('p','catalog-series',kit.series));
    header.append(mark,content);
    article.append(header);
    if (kit.manufacturer || kit.release || kit.code) {
      const footer=el('div','catalog-extra');
      if (kit.manufacturer) footer.append(el('span','',kit.manufacturer));
      if (kit.release) {const x=el('span'); x.append(el('b','', 'Release '),document.createTextNode(kit.release));footer.append(x)}
      if (kit.code) footer.append(el('span','',kit.code));
      article.append(footer);
    }
    return article;
  };
  const addMore = () => {
    const fragment=document.createDocumentFragment();
    const end=Math.min(shown+pageSize,visible.length);
    for (let i=shown;i<end;i++) fragment.append(makeCard(visible[i]));
    results.append(fragment); shown=end;
    more.hidden = shown>=visible.length;
    more.textContent = `Show more kits (${new Intl.NumberFormat('en-US').format(visible.length-shown)} remaining)`;
  };
  const update = () => {
    const q=search.value.trim().toLocaleLowerCase();
    const g=grade.value;
    visible=kits.filter(kit => (!g || kit.grade===g) && (!q || kit.searchable.includes(q)));
    const key=sort.value;
    visible.sort((a,b)=> {
      if(key==='name-desc')return b.name.localeCompare(a.name);
      const field=key==='grade'?'grade':key==='series'?'series':'name';
      return (a[field]||'').localeCompare(b[field]||'') || a.name.localeCompare(b.name);
    });
    results.replaceChildren();shown=0;
    resultCount.textContent=new Intl.NumberFormat('en-US').format(visible.length) + ' kits found';
    status.textContent=visible.length ? '' : 'No kits match those filters. Try another keyword or clear your filters.';
    more.hidden=true;
    addMore();
  };
  let pending;
  search.addEventListener('input',()=>{window.clearTimeout(pending);pending=window.setTimeout(update,110)});
  grade.addEventListener('change',update);
  sort.addEventListener('change',update);
  clear.addEventListener('click',()=>{search.value='';grade.value='';sort.value='name';update();search.focus()});
  more.addEventListener('click',addMore);

  fetch('catalog/kits_latest.json')
    .then(response => {if(!response.ok)throw new Error('Catalog file is unavailable ('+response.status+').');return response.json()})
    .then(data => {
      const records=extractRecords(data);
      kits=records.map(normalize).filter(Boolean);
      if (!kits.length) throw new Error('The catalog data format could not be recognized.');
      const grades=[...new Set(kits.map(x=>x.grade).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      const options=document.createDocumentFragment();
      for (const name of grades) {const option=el('option','',name);option.value=name;options.append(option)}
      grade.append(options);
      const rev=data?.revision ?? data?.rev ?? data?.catalogRevision ?? data?.catalog_revision ?? data?.version;
      revision.textContent=rev ? 'SPRUEVAULT CATALOG · REV '+String(rev) : 'SPRUEVAULT CATALOG';
      const initial=new URLSearchParams(location.search).get('q');
      if(initial) search.value=initial.slice(0,150);
      update();
    })
    .catch(error=> {
      console.error('SprueVault catalog:',error);
      status.textContent='The catalog cannot be displayed at the moment. Check that catalog/kits_latest.json is present and that the site is being served over HTTPS or a local server.';
      resultCount.textContent='Catalog unavailable';more.hidden=true;
    });
})();
